# `<chart>` element polyfill

A working JavaScript implementation of [the Chart Element](../spec/index.bs). It exists to show that the spec's
behavior can be built and is useful. It isn't meant as a production library.

| File | What it is |
| --- | --- |
| [chart-element.js](chart-element.js) | The polyfill. One script, no dependencies, no build step. It does nothing when the browser supports `<chart>` natively. |
| [demo.html](demo.html) | The spec's examples, running live, plus controls to change a chart's type and add points. The images in the spec are screenshots of this page. |
| [test.html](test.html) | Self-checking tests for the normative behavior. Open the page and it prints `PASS`/`FAIL` lines. |

## Use it

```html
<script src="chart-element.js"></script>

<chart type="pie">
  <figcaption>Fruit sold</figcaption>
  <data value="42">Apples</data>
  <data value="30">Oranges</data>
  <data value="28">Pears</data>
  <legend></legend>
</chart>
```

The script watches the document, so charts added later, and changes to existing ones, redraw without any setup.

## Run the tests

Open `test.html` in a browser, or run it headless:

```sh
chrome --headless=new --virtual-time-budget=15000 --dump-dom chart-element/polyfill/test.html | grep -E "PASS|FAIL"
```

All 15 tests pass in Chrome. Without the script tag, all 15 fail.

## Spec-to-code map

| Spec section | Code |
| --- | --- |
| 2.4 Using `data`, `figcaption`, and `legend` in a chart; 3.1–3.4 The chart's data | `readChart`, `pointName`, `pointValue` |
| 4.1 Chart layout | `render` |
| 4.2.1 Bar charts, 4.2.2 Line charts, 4.2.3 Area charts | `renderCartesian` |
| 4.2.4 Pie charts | `renderPie` |
| 4.3 Painting series | `paintPath` |
| 4.5 Point text | `anchorPadding`, and the `justify-content` values in `renderCartesian` |
| 4.6 The legend | The legend block in `render` |
| 4.7 User agent style sheet | The `@layer chart-polyfill` style sheet |
| 5.1 Keyboard | `updateFocus`, `onKeyDown` |
| 5.2 Dynamic changes | `invalidate`, `flush`, and the `MutationObserver` and `ResizeObserver` |
| 6 The DOM interface | `upgrade` |
| 8 Accessibility considerations | The `role` and `aria-*` attributes set in `render` |

## Where the polyfill differs from the spec

1. **Geometry.** The spec's layout ignores properties like `width` and `position` on points. The polyfill positions
   points with `!important` inline styles, which only an author's own `!important` inline style can override.
2. **Generated content.** Axes, tick labels, and lines are drawn in an `aria-hidden` element at the start of the chart,
   and legend entries are `<span>` elements in the `<legend>`. Selectors such as `chart > :first-child` see them.
3. **Series hit testing.** Lines and filled areas don't receive pointer events. The pointer reaches the chart instead
   of the `<series>` element.
4. **Legend text.** The spec doesn't render a legend's own children. The polyfill hides its child elements, but text
   directly inside `<legend>` still shows.
5. **The user agent style sheet.** It is a cascade layer at the start of `<head>`, so any unlayered author style
   overrides it, as it would a real one. Styles in an author's own layers compete with it by layer order.
6. **Line labels.** Visible line marker contents are pushed above the marker with a `::before` spacer, so a line
   chart's points can't use `::before` for their own content.
7. **IDL attributes.** `chart`, `series`, and `axis` are `HTMLUnknownElement`s, so `type`, `stacked`, `horizontal`, and
   `name` are defined on each element when the polyfill first sees it, not on a prototype. `HTMLChartElement` and the
   other interfaces don't exist.
8. **Redrawing.** Charts redraw when their own content or attributes change, or they resize. Style changes elsewhere,
   such as a class on `<body>` that changes a series' color, don't redraw a chart until something else does.
9. **Focus.** Keyboard focus uses `tabindex` on points, so the polyfill sets `tabindex` itself, and a point's own
   `tabindex` attribute is ignored.

## Notes for browser engines

- **Layout.** The chart is a formatting context with fixed children: caption, legend, axis titles, and marks. The
  marks are absolutely positioned boxes whose used position and size come from the chart, like grid items with
  their geometry properties ignored.
- **Pie wedges.** Apply the wedge as a used `clip-path`, so painting, contents, and hit testing all follow the shape.
- **Series.** A `<series>` element's line and fill are painted like an SVG path, using its computed `stroke` and `fill`
  properties, below the marks.
- **Point text.** Give points `content-visibility: hidden` in the UA sheet, but take their accessible names from the
  DOM text, not from the rendered text.
