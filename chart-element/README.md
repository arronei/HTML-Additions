# The `<chart>` element

The `<chart>` element draws a pie, line, bar, or area chart from the `<data>` elements inside it. Each `<data>`
element is a point: its text is the name and its `value` attribute is the number.

```html
<chart type="bar">
  <figcaption>Revenue by quarter</figcaption>
  <axis type="category">Quarter</axis>
  <axis type="value">Revenue ($M)</axis>
  <series name="2025">
    <data value="10">Q1</data>
    <data value="14">Q2</data>
  </series>
  <series name="2026">
    <data value="12">Q1</data>
    <data value="18">Q2</data>
  </series>
  <legend></legend>
</chart>
```

- A `<series>` element groups points. `<data>` elements placed directly in `<chart>` form one series.
- `<figcaption>` is the title, `<legend>` draws the key, and `<axis type="category|value">` names an axis.
- Each `<data>` element's box is its mark: a bar, a pie wedge, a line marker, or a band in an area chart.
  Authors style marks with CSS, and `:hover`, `:focus-visible`, and `click` work on them.
- The user agent sets the position and size of each mark, and authors can't change them. `gap` sets the space between bars.
- A point's text is hidden in the mark by default. `content-visibility: visible` shows it.
- The chart is one tab stop, and the arrow keys move between points.
- A missing value (`value=""`) leaves a gap. A pie chart draws only its first series.
- Browsers without support show the text of the points.

| Folder | Contents |
| --- | --- |
| [spec/](spec/) | The specification. [index.bs](spec/index.bs) is the Bikeshed source, and [index.html](spec/index.html) is the rendered spec. Its [images/](spec/images/) are screenshots of the polyfill demo. |
| [polyfill/](polyfill/) | A working JavaScript implementation, a live demo, tests, and notes for browser engines. |

To rebuild the spec after editing `index.bs`, run this from this folder:

```sh
pip install bikeshed
bikeshed spec spec/index.bs spec/index.html
```
