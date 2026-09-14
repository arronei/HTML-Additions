/**
 * Polyfill for the HTML <chart>, <series>, and <axis> elements, as defined in ../spec/index.bs ("The Chart Element").
 *
 * Load it once, anywhere in the page:  <script src="chart-element.js"></script>
 *
 * Function names follow the spec's terms, so the two can be read side by side.
 * Where script can't do what a browser engine can, the code approximates; those spots are
 * marked `ponytail:` and listed in README.md.
 */
(() => {
  'use strict';
  if ('HTMLChartElement' in window) return; // Native support.

  const GENERATED = 'data-chart-generated';
  const SVG = 'http://www.w3.org/2000/svg';
  const TYPES = ['pie', 'line', 'bar', 'area'];

  // §4.7 User agent style sheet. A cascade layer ranks it below every unlayered author style, as a real UA sheet is.
  // The last block is the polyfill's own plumbing.
  const sheet = document.createElement('style');
  sheet.textContent = `@layer chart-polyfill {
    chart { display: block; block-size: 20em; gap: 25% 2px; }
    chart[type=pie i] { block-size: auto; aspect-ratio: 1; }
    chart > figcaption { display: block; text-align: center; font-weight: bold; }
    chart > legend, chart > axis { display: block; }
    chart > legend { text-align: center; }

    chart > data, series:nth-of-type(8n+1), chart[type=pie i] data:nth-of-type(8n+1) { color: #2a78d6; }
    series:nth-of-type(8n+2), chart[type=pie i] data:nth-of-type(8n+2) { color: #eb6834; }
    series:nth-of-type(8n+3), chart[type=pie i] data:nth-of-type(8n+3) { color: #1baf7a; }
    series:nth-of-type(8n+4), chart[type=pie i] data:nth-of-type(8n+4) { color: #eda100; }
    series:nth-of-type(8n+5), chart[type=pie i] data:nth-of-type(8n+5) { color: #e87ba4; }
    series:nth-of-type(8n+6), chart[type=pie i] data:nth-of-type(8n+6) { color: #008300; }
    series:nth-of-type(8n+7), chart[type=pie i] data:nth-of-type(8n+7) { color: #4a3aa7; }
    series:nth-of-type(8n+8), chart[type=pie i] data:nth-of-type(8n+8) { color: #e34948; }

    chart { stroke: #2a78d6; stroke-width: 2px; stroke-linejoin: round; stroke-linecap: round; fill: none; }
    series { stroke: currentColor; }
    chart[type=area i] { fill: #2a78d6; fill-opacity: 0.1; }
    chart[type=area i] series { fill: currentColor; }

    chart data { content-visibility: hidden; }
    chart:not([type=pie i], [type=line i], [type=area i]) data { background: currentColor; transform-origin: 50% 100%; }
    chart:not([type=pie i], [type=line i], [type=area i])[horizontal] data { transform-origin: 0% 50%; }
    chart[type=pie i] data { background: currentColor; }
    chart[type=line i] data { inline-size: 0.5em; block-size: 0.5em; border-radius: 50%; background: currentColor; box-shadow: 0 0 0 2px Canvas; }
    chart[type=area i] data { transform-origin: 50% 100%; }
    chart[type=area i] data:hover { background: color-mix(in srgb, currentColor 15%, transparent); }
    chart data:focus-visible { outline: 2px solid; outline-offset: 2px; }

    chart { position: relative; }
    chart > legend > :not([${GENERATED}]) { display: none !important; }
    chart[type=line i] data::before { content: ""; order: 1; flex: none; block-size: calc(100% + 0.25em); }
    chart [${GENERATED}] { pointer-events: none; }
    chart > series::before, chart > series::after { display: none !important; }
    .chart-polyfill-tick { position: absolute; font-size: 0.75em; line-height: 1.2; white-space: nowrap; opacity: 0.7; }
    .chart-polyfill-legend-entry { display: inline-flex; align-items: center; gap: 0.4em; margin-inline: 0.5em; }
    .chart-polyfill-swatch { inline-size: 0.75em; block-size: 0.75em; border-radius: 2px; }
  }`;
  (document.head ?? document.documentElement).prepend(sheet);

  // Inline styles and attributes the polyfill set, so they can be undone without touching the author's own.
  const owned = new WeakMap();
  function own(element) {
    if (!owned.has(element)) owned.set(element, { styles: new Set(), attributes: new Set() });
    return owned.get(element);
  }
  // ponytail: the spec's chart layout ignores geometry properties; the polyfill wins over them with !important inline styles.
  function setStyles(element, styles) {
    for (const [name, value] of Object.entries(styles)) {
      element.style.setProperty(name, String(value), 'important');
      own(element).styles.add(name);
    }
  }
  function setAttribute(element, name, value) {
    const record = own(element);
    if (element.hasAttribute(name) && !record.attributes.has(name)) return; // The author's value wins.
    element.setAttribute(name, value);
    record.attributes.add(name);
  }
  function release(element) {
    const record = owned.get(element);
    if (!record) return;
    for (const name of record.styles) element.style.removeProperty(name);
    for (const name of record.attributes) element.removeAttribute(name);
    owned.delete(element);
  }

  // §6 The DOM interface. ponytail: unknown elements can't get new prototypes, so each element gets own properties.
  const reflectEnum = (keywords, fallback) => ({
    configurable: true,
    get() {
      const value = (this.getAttribute('type') ?? '').toLowerCase();
      return keywords.includes(value) ? value : fallback;
    },
    set(value) { this.setAttribute('type', value); },
  });
  const reflectBoolean = (name) => ({
    configurable: true,
    get() { return this.hasAttribute(name); },
    set(value) { this.toggleAttribute(name, Boolean(value)); },
  });
  function upgrade(element) {
    if (Object.hasOwn(element, 'type') || Object.hasOwn(element, 'name')) return;
    if (element.localName === 'chart') {
      Object.defineProperties(element, {
        type: reflectEnum(TYPES, 'bar'), stacked: reflectBoolean('stacked'), horizontal: reflectBoolean('horizontal'),
      });
    } else if (element.localName === 'series') {
      Object.defineProperty(element, 'name', {
        configurable: true, get() { return this.getAttribute('name') ?? ''; }, set(value) { this.setAttribute('name', value); },
      });
    } else if (element.localName === 'axis') {
      Object.defineProperty(element, 'type', reflectEnum(['category', 'value'], 'category'));
    }
  }

  // §3.2 A point's name and value.
  const pointName = (point) => point.textContent.replace(/[\t\n\f\r ]+/g, ' ').replace(/^ | $/g, '');
  function pointValue(point) {
    if (!point.hasAttribute('value')) return null; // missing
    // The rules for parsing floating-point number values: leading whitespace, then a number; trailing text is ignored.
    const match = /^[\t\n\f\r ]*([+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?)/.exec(point.getAttribute('value'));
    const value = match ? Number(match[1]) : NaN;
    return Number.isFinite(value) ? value + 0 : null;
  }

  // §3.1–3.4 Parts, series list, categories, and drawn points.
  function readChart(chart) {
    const kids = [...chart.children].filter((kid) => !kid.hasAttribute(GENERATED));
    const isData = (element) => element.localName === 'data';
    const type = chart.type;
    const axisOf = (name) => kids.find((kid) => kid.localName === 'axis' && kid.type === name) ?? null;
    const seriesElements = kids.filter((kid) => kid.localName === 'series');

    let seriesList;
    if (seriesElements.length) {
      seriesList = seriesElements.map((element) => ({ element, owner: element, points: [...element.children].filter(isData) }));
    } else if (kids.some(isData)) {
      seriesList = [{ element: null, owner: chart, points: kids.filter(isData) }];
    } else {
      seriesList = [];
    }
    if (type === 'pie') seriesList = seriesList.slice(0, 1);

    const categories = [];
    for (const series of seriesList) {
      series.name = series.element?.getAttribute('name') ?? null;
      series.byCategory = new Map();
      for (const point of series.points) {
        const name = pointName(point);
        if (!categories.includes(name)) categories.push(name);
        if (!series.byCategory.has(name)) series.byCategory.set(name, point); // the point for a category
      }
    }

    const drawn = [];
    for (const series of seriesList) {
      for (const [name, point] of series.byCategory) {
        const value = pointValue(point);
        if (type === 'pie' ? value > 0 : value !== null) {
          drawn.push({ point, series, category: categories.indexOf(name), value, name });
        }
      }
    }
    drawn.sort((a, b) => (a.point.compareDocumentPosition(b.point) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));

    return {
      type,
      kids,
      stacked: (type === 'bar' || type === 'area') && chart.stacked,
      horizontal: type === 'bar' && chart.horizontal,
      caption: kids.find((kid) => kid.localName === 'figcaption') ?? null,
      legend: kids.find((kid) => kid.localName === 'legend') ?? null,
      categoryTitle: type === 'pie' ? null : axisOf('category'),
      valueTitle: type === 'pie' ? null : axisOf('value'),
      seriesList,
      categories,
      drawn,
    };
  }

  const px = (value) => parseFloat(value) || 0;
  const gap = (value, base) => (value.endsWith('%') ? (parseFloat(value) / 100) * base : px(value));
  const outerHeight = (element) => {
    const style = getComputedStyle(element);
    return element.offsetHeight + px(style.marginTop) + px(style.marginBottom);
  };
  const outerWidth = (element) => {
    const style = getComputedStyle(element);
    return element.offsetWidth + px(style.marginLeft) + px(style.marginRight);
  };

  function niceTicks(low, high) {
    if (low === high) { low -= 1; high += 1; }
    const raw = (high - low) / 5;
    const magnitude = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].find((n) => n * magnitude >= raw) * magnitude;
    const first = Math.floor(low / step);
    const last = Math.ceil(high / step);
    const ticks = [];
    for (let i = first; i <= last; i++) ticks.push(Number((i * step).toPrecision(12)));
    return ticks;
  }

  function svgElement(parent, name, attributes) {
    const element = document.createElementNS(SVG, name);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    parent.append(element);
    return element;
  }

  // §4.3 Painting series: copy the series' stroke and fill properties to an SVG path.
  function paintPath(svg, owner, d, { stroke, fill }) {
    const style = getComputedStyle(owner);
    const path = svgElement(svg, 'path', { d });
    path.style.cssText = stroke
      ? `stroke:${style.stroke};stroke-width:${style.strokeWidth};stroke-opacity:${style.strokeOpacity};` +
        `stroke-dasharray:${style.strokeDasharray};stroke-linecap:${style.strokeLinecap};stroke-linejoin:${style.strokeLinejoin};fill:none`
      : `fill:${style.fill};fill-opacity:${style.fillOpacity};stroke:none`;
  }

  // Centers a mark's contents on its label anchor (§4.5) by padding the side away from the anchor.
  function anchorPadding(width, height, x, y) {
    return {
      'padding-left': `${Math.max(0, 2 * x - width)}px`, 'padding-right': `${Math.max(0, width - 2 * x)}px`,
      'padding-top': `${Math.max(0, 2 * y - height)}px`, 'padding-bottom': `${Math.max(0, height - 2 * y)}px`,
    };
  }

  const MARK = { position: 'absolute', margin: '0', float: 'none', 'box-sizing': 'border-box', right: 'auto', bottom: 'auto',
    'min-width': '0', 'min-height': '0', 'max-width': 'none', 'max-height': 'none', display: 'flex', 'flex-direction': 'column',
    'align-items': 'center', 'justify-content': 'center', padding: '0', 'clip-path': 'none' };

  // §4 Rendering
  function render(chart) {
    upgrade(chart);
    const focused = document.activeElement; // Read first: hiding a focused point blurs it.
    for (const element of chart.querySelectorAll('*')) release(element);
    release(chart);
    chart.querySelectorAll(`[${GENERATED}]`).forEach((element) => element.remove());
    if (!chart.getClientRects().length) return updateFocus(chart, [], focused);

    for (const kid of chart.children) upgrade(kid);
    const model = readChart(chart);
    const { type, drawn } = model;

    // Everything that isn't rendered is hidden.
    const rendered = new Set([model.caption, model.legend, model.categoryTitle, model.valueTitle, ...drawn.map((d) => d.point)]);
    for (const series of model.seriesList) if (series.element) rendered.add(series.element);
    for (const element of chart.querySelectorAll(':scope > *, :scope > series > *')) {
      if (element.localName === 'series' && rendered.has(element)) setStyles(element, { display: 'contents' });
      else if (!rendered.has(element) && element.parentElement !== model.legend) setStyles(element, { display: 'none' });
    }

    const layer = document.createElement('div');
    layer.setAttribute(GENERATED, '');
    layer.setAttribute('aria-hidden', 'true');
    layer.style.cssText = 'position:absolute;inset:0;overflow:visible';
    chart.prepend(layer);
    const svg = svgElement(layer, 'svg', { width: '100%', height: '100%', style: 'position:absolute;inset:0;overflow:visible' });
    const label = (text, className = 'chart-polyfill-tick') => {
      const span = document.createElement('span');
      span.className = className;
      span.textContent = text;
      layer.append(span);
      return span;
    };

    const style = getComputedStyle(chart);
    let top = px(style.paddingTop);
    let bottom = chart.clientHeight - px(style.paddingBottom);
    const left = px(style.paddingLeft);
    const right = chart.clientWidth - px(style.paddingRight);

    // §4.1 Caption at the block-start edge, legend at the block-end edge.
    if (model.caption) {
      setStyles(model.caption, { position: 'absolute', left: `${left}px`, right: `${chart.clientWidth - right}px`, top: `${top}px`, bottom: 'auto' });
      top += outerHeight(model.caption);
    }
    if (model.legend) {
      // §4.6 The legend: named series, or a pie's drawn points.
      const entries = type === 'pie'
        ? drawn.map((d) => [d.name, d.point])
        : model.seriesList.filter((s) => s.name !== null).map((s) => [s.name, s.element]);
      for (const [name, element] of entries) {
        const entry = document.createElement('span');
        entry.setAttribute(GENERATED, '');
        entry.setAttribute('aria-hidden', 'true');
        entry.className = 'chart-polyfill-legend-entry';
        const swatch = document.createElement('span');
        swatch.className = 'chart-polyfill-swatch';
        swatch.style.background = getComputedStyle(element).color;
        entry.append(swatch, name);
        model.legend.append(entry);
      }
      setStyles(model.legend, { position: 'absolute', left: `${left}px`, right: `${chart.clientWidth - right}px`, bottom: `${chart.clientHeight - bottom}px`, top: 'auto' });
      bottom -= outerHeight(model.legend);
    }

    const geometry = new Map();
    if (type === 'pie') renderPie(model, geometry, { top, bottom, left, right });
    else renderCartesian(chart, model, geometry, svg, label, style, { top, bottom, left, right });

    // §4.2 Marks, and the accessibility mappings from §8.
    setAttribute(chart, 'role', 'graphics-document');
    setAttribute(chart, 'aria-roledescription', 'chart');
    if (model.caption && !chart.hasAttribute('aria-label')) {
      if (!model.caption.id) setAttribute(model.caption, 'id', `chart-caption-${Math.random().toString(36).slice(2)}`);
      setAttribute(chart, 'aria-labelledby', model.caption.id);
    }
    for (const series of model.seriesList) {
      if (!series.element) continue;
      setAttribute(series.element, 'role', 'graphics-object');
      if (series.name !== null) setAttribute(series.element, 'aria-label', series.name);
    }
    for (const d of drawn) {
      const { center, ...box } = geometry.get(d.point);
      setStyles(d.point, { ...MARK, ...box });
      setAttribute(d.point, 'role', 'graphics-symbol');
      setAttribute(d.point, 'aria-label', [d.series.name, d.name, d.point.getAttribute('value').trim()].filter(Boolean).join(', '));
    }
    if (type === 'line') {
      // Markers keep their own size, so they're placed after it's known.
      for (const d of drawn) {
        const { x, y } = geometry.get(d.point).center;
        setStyles(d.point, { left: `${x - d.point.offsetWidth / 2}px`, top: `${y - d.point.offsetHeight / 2}px`, 'justify-content': 'flex-end' });
      }
    }

    updateFocus(chart, drawn, focused);
  }

  function renderPie(model, geometry, area) {
    const size = Math.max(0, Math.min(area.right - area.left, area.bottom - area.top));
    const x = area.left + (area.right - area.left - size) / 2;
    const y = area.top + (area.bottom - area.top - size) / 2;
    const total = model.drawn.reduce((sum, d) => sum + d.value, 0);
    let angle = 0;
    for (const d of model.drawn) {
      const start = angle;
      const end = angle + (d.value / total) * 2 * Math.PI;
      angle = end;
      const corners = ['50% 50%'];
      const steps = Math.max(1, Math.ceil((end - start) / (Math.PI / 90)));
      for (let k = 0; k <= steps; k++) {
        const a = start + ((end - start) * k) / steps;
        corners.push(`${(50 + 50 * Math.sin(a)).toFixed(3)}% ${(50 - 50 * Math.cos(a)).toFixed(3)}%`);
      }
      const middle = (start + end) / 2;
      geometry.set(d.point, {
        left: `${x}px`, top: `${y}px`, width: `${size}px`, height: `${size}px`, 'clip-path': `polygon(${corners.join(',')})`,
        ...anchorPadding(size, size, size / 2 + (size / 3) * Math.sin(middle), size / 2 - (size / 3) * Math.cos(middle)),
      });
    }
  }

  function renderCartesian(chart, model, geometry, svg, label, style, area) {
    const { type, drawn, stacked, horizontal, categories, seriesList } = model;

    // Value range: every drawn value, every stacked total, and zero for bar and area charts.
    let low = type === 'line' ? Infinity : 0;
    let high = type === 'line' ? -Infinity : 0;
    const stacks = categories.map(() => ({ positive: 0, negative: 0 }));
    for (const series of seriesList) {
      for (const [name, point] of series.byCategory) {
        const d = drawn.find((item) => item.point === point);
        const value = d ? d.value : 0; // A missing value counts as zero in a stack.
        const stack = stacks[categories.indexOf(name)];
        let start = 0;
        let end = value;
        if (stacked) {
          start = value >= 0 ? stack.positive : stack.negative;
          end = start + value;
          stack[value >= 0 ? 'positive' : 'negative'] = end;
        }
        if (!d) continue;
        d.start = start;
        d.end = end;
        low = Math.min(low, start, end);
        high = Math.max(high, start, end);
      }
    }
    if (low === Infinity) { low = 0; high = 1; }
    const ticks = niceTicks(low, high);
    low = ticks[0];
    high = ticks.at(-1);

    // Measure the axis labels and titles so the plot area can be what's left.
    const tickLabels = ticks.map((tick) => [tick, label(tick.toLocaleString())]);
    const categoryLabels = categories.map((name) => label(name));
    const labelHeight = tickLabels[0][1].offsetHeight;
    const valueLabelWidth = Math.max(...tickLabels.map(([, span]) => span.offsetWidth));
    const categoryLabelWidth = Math.max(0, ...categoryLabels.map((span) => span.offsetWidth));
    const sideTitle = horizontal ? model.categoryTitle : model.valueTitle;
    const bottomTitle = horizontal ? model.valueTitle : model.categoryTitle;
    if (sideTitle) setStyles(sideTitle, { position: 'absolute', 'writing-mode': 'sideways-lr', left: `${area.left}px`, top: '0px', right: 'auto', bottom: 'auto' });
    if (bottomTitle) setStyles(bottomTitle, { position: 'absolute', left: '0px', top: '0px', right: 'auto', bottom: 'auto' });
    const sideTitleWidth = sideTitle ? outerWidth(sideTitle) : 0;
    const bottomTitleHeight = bottomTitle ? outerHeight(bottomTitle) : 0;
    const spacing = 6;

    const plot = {
      left: area.left + sideTitleWidth + (horizontal ? categoryLabelWidth : valueLabelWidth) + spacing,
      right: area.right - (horizontal ? valueLabelWidth / 2 : spacing),
      top: area.top + (horizontal ? spacing : labelHeight / 2),
      bottom: area.bottom - bottomTitleHeight - labelHeight - spacing,
    };
    const categoryStart = horizontal ? plot.top : plot.left;
    const length = Math.max(0, horizontal ? plot.bottom - plot.top : plot.right - plot.left);
    const valueAt = horizontal
      ? (v) => plot.left + ((v - low) / (high - low)) * (plot.right - plot.left)
      : (v) => plot.bottom - ((v - low) / (high - low)) * (plot.bottom - plot.top);
    const n = categories.length || 1;
    const pitch = length / n;
    const centerOf = (i) => categoryStart + (i + 0.5) * pitch;
    const rect = (along, thickness, v0, v1) => {
      const a = valueAt(v0);
      const b = valueAt(v1);
      return horizontal
        ? { left: Math.min(a, b), top: along, width: Math.abs(b - a), height: thickness }
        : { left: along, top: Math.min(a, b), width: thickness, height: Math.abs(b - a) };
    };

    // Gridlines, axis lines, and labels.
    const hairline = (x1, y1, x2, y2, opacity) =>
      svgElement(svg, 'line', { x1, y1, x2, y2, style: `stroke:currentColor;stroke-width:1px;stroke-opacity:${opacity};fill:none` });
    for (const [tick, span] of tickLabels) {
      const at = valueAt(tick);
      if (horizontal) {
        hairline(at, plot.top, at, plot.bottom, tick === 0 ? 0.45 : 0.12);
        Object.assign(span.style, { left: `${at - span.offsetWidth / 2}px`, top: `${plot.bottom + spacing}px` });
      } else {
        hairline(plot.left, at, plot.right, at, tick === 0 ? 0.45 : 0.12);
        Object.assign(span.style, { left: `${plot.left - spacing - span.offsetWidth}px`, top: `${at - labelHeight / 2}px` });
      }
    }
    categoryLabels.forEach((span, i) => {
      Object.assign(span.style, horizontal
        ? { left: `${plot.left - spacing - span.offsetWidth}px`, top: `${centerOf(i) - span.offsetHeight / 2}px` }
        : { left: `${centerOf(i) - span.offsetWidth / 2}px`, top: `${plot.bottom + spacing}px` });
    });
    if (sideTitle) {
      setStyles(sideTitle, { top: `${(plot.top + plot.bottom) / 2 - outerHeight(sideTitle) / 2}px` });
    }
    if (bottomTitle) {
      setStyles(bottomTitle, {
        left: `${(plot.left + plot.right) / 2 - outerWidth(bottomTitle) / 2}px`,
        top: `${plot.bottom + spacing + labelHeight}px`,
      });
    }

    const toPx = (box) => Object.fromEntries(Object.entries(box).map(([key, value]) => [key, `${value}px`]));

    if (type === 'bar') {
      // §4.2.1 Category bands, series slots, and gaps.
      const rowGap = gap(style.rowGap, pitch);
      const band = Math.max(0, pitch - rowGap);
      const columnGap = gap(style.columnGap, band);
      const count = seriesList.length;
      const slot = stacked ? band : Math.max(0, (band - (count - 1) * columnGap) / count);
      for (const d of drawn) {
        const index = stacked ? 0 : seriesList.indexOf(d.series);
        const box = rect(categoryStart + d.category * pitch + rowGap / 2 + index * (slot + columnGap), slot, d.start, d.end);
        geometry.set(d.point, toPx(box));
      }
      return;
    }

    // §4.2.2 and §4.2.3 Lines and areas.
    const positionOf = (d) => ({ x: centerOf(d.category), y: valueAt(stacked ? d.end : d.value) });
    for (const series of seriesList) {
      const points = drawn.filter((d) => d.series === series).sort((a, b) => a.category - b.category);
      const runs = [];
      for (const d of points) {
        const run = runs.at(-1);
        if (run && run.at(-1).category === d.category - 1) run.push(d);
        else runs.push([d]);
      }
      for (const run of runs) {
        const line = run.map((d, i) => `${i ? 'L' : 'M'}${positionOf(d).x},${positionOf(d).y}`).join('');
        if (type === 'area') {
          const base = [...run].reverse().map((d) => `L${positionOf(d).x},${valueAt(stacked ? d.start : 0)}`).join('');
          paintPath(svg, series.owner, `${line}${base}Z`, { fill: true });
        }
        paintPath(svg, series.owner, line, { stroke: true });
      }
    }
    for (const d of drawn) {
      const { x, y } = positionOf(d);
      if (type === 'line') {
        geometry.set(d.point, { center: { x, y } });
        continue;
      }
      const from = d.category === 0 ? plot.left : (centerOf(d.category - 1) + x) / 2;
      const to = d.category === categories.length - 1 ? plot.right : (centerOf(d.category + 1) + x) / 2;
      const bandTop = stacked ? valueAt(d.end) : plot.top;
      const bandBottom = stacked ? valueAt(d.start) : plot.bottom;
      const height = Math.max(0, bandBottom - bandTop);
      geometry.set(d.point, {
        ...toPx({ left: from, top: bandTop, width: to - from, height }),
        'justify-content': 'flex-end',
        'padding-bottom': `${Math.min(height, Math.max(0, bandBottom - y + 4))}px`,
      });
    }
  }

  // §5.1 Keyboard: one tab stop, arrow keys between points.
  const activePoints = new WeakMap();
  const drawnPoints = new WeakMap();
  const listening = new WeakSet();
  function updateFocus(chart, drawn, focused) {
    const points = drawn.map((d) => d.point);
    const previous = drawnPoints.get(chart) ?? [];
    let active = activePoints.get(chart);
    if (!points.includes(active)) {
      const index = previous.indexOf(active);
      active = index < 0 ? points[0] : points[Math.min(index, points.length - 1)];
    }
    drawnPoints.set(chart, points);
    activePoints.set(chart, active);
    for (const point of points) setAttribute(point, 'tabindex', point === active ? '0' : '-1');
    if (focused?.localName === 'data' && previous.includes(focused) && document.activeElement !== focused) {
      // Redrawing removes and restores tabindex, which blurs the point; put focus back, or on the new active point.
      (points.includes(focused) ? focused : active)?.focus({ preventScroll: true });
    }

    if (!listening.has(chart)) {
      listening.add(chart);
      chart.addEventListener('keydown', (event) => onKeyDown(chart, event));
      chart.addEventListener('focusin', (event) => {
        if (drawnPoints.get(chart)?.includes(event.target)) {
          activePoints.set(chart, event.target);
          for (const point of drawnPoints.get(chart)) point.setAttribute('tabindex', point === event.target ? '0' : '-1');
        }
      });
    }
  }

  function onKeyDown(chart, event) {
    const model = readChart(chart);
    const current = model.drawn.find((d) => d.point === event.target);
    if (!current || event.altKey || event.ctrlKey || event.metaKey) return;
    let target;
    if (model.type === 'pie') {
      const index = model.drawn.indexOf(current);
      target = { ArrowRight: index + 1, ArrowDown: index + 1, ArrowLeft: index - 1, ArrowUp: index - 1, Home: 0, End: model.drawn.length - 1 }[event.key];
      target = model.drawn[target];
    } else {
      const along = model.horizontal ? { ArrowDown: 1, ArrowUp: -1 } : { ArrowRight: 1, ArrowLeft: -1 };
      const across = model.horizontal ? { ArrowRight: 1, ArrowLeft: -1 } : { ArrowDown: 1, ArrowUp: -1 };
      const inSeries = model.drawn.filter((d) => d.series === current.series).sort((a, b) => a.category - b.category);
      if (event.key === 'Home') target = inSeries[0];
      else if (event.key === 'End') target = inSeries.at(-1);
      else if (along[event.key]) {
        const step = along[event.key];
        target = step > 0 ? inSeries.find((d) => d.category > current.category) : inSeries.findLast((d) => d.category < current.category);
      } else if (across[event.key]) {
        const step = across[event.key];
        const order = model.seriesList.indexOf(current.series);
        const sameCategory = model.drawn.filter((d) => d.category === current.category);
        const index = (d) => model.seriesList.indexOf(d.series);
        target = step > 0
          ? sameCategory.filter((d) => index(d) > order).sort((a, b) => index(a) - index(b))[0]
          : sameCategory.filter((d) => index(d) < order).sort((a, b) => index(b) - index(a))[0];
      }
    }
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    target?.point.focus();
  }

  // §5.2 Dynamic changes.
  const dirty = new Set();
  let scheduled = false;
  const resizeObserver = new ResizeObserver((entries) => entries.forEach((entry) => invalidate(entry.target)));
  const seen = new WeakSet();
  function invalidate(chart) {
    if (!seen.has(chart)) { seen.add(chart); resizeObserver.observe(chart); }
    dirty.add(chart);
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(flush);
  }
  function flush() {
    scheduled = false;
    mutationObserver.disconnect();
    try {
      for (const chart of dirty) if (chart.isConnected) render(chart);
    } finally {
      dirty.clear();
      mutationObserver.takeRecords(); // The polyfill's own changes.
      observe();
    }
  }
  const mutationObserver = new MutationObserver((records) => {
    for (const record of records) {
      if (record.attributeName === 'tabindex') continue; // Roving focus, which doesn't change the drawing.
      const element = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement;
      const chart = element?.closest('chart');
      if (chart) invalidate(chart);
      for (const node of record.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node.localName === 'chart') invalidate(node);
        node.querySelectorAll('chart').forEach(invalidate);
      }
      for (const node of record.removedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        for (const element of [node, ...node.querySelectorAll('*')]) {
          if (element.hasAttribute(GENERATED)) element.remove();
          else release(element);
        }
      }
    }
  });
  function observe() {
    mutationObserver.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  }

  function start() {
    document.querySelectorAll('chart').forEach(invalidate);
    observe();
    document.fonts?.ready.then(() => document.querySelectorAll('chart').forEach(invalidate));
  }
  if (document.readyState === 'loading') {
    observe();
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
