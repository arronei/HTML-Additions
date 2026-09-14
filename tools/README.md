# Tools

Scripts for maintaining the proposals. They aren't part of any proposal.

| Script | What it does |
| --- | --- |
| [chart-screenshots.mjs](chart-screenshots.mjs) | Regenerates the images in [chart-element/spec/images/](../chart-element/spec/images/) by screenshotting [chart-element/polyfill/demo.html](../chart-element/polyfill/demo.html) in headless Chrome, including hovered and keyboard-focused states. |

## `chart-screenshots.mjs`

Needs Node 22 or later and Chrome. It has no dependencies, and uses the Chrome DevTools protocol directly. Run it
from anywhere:

```sh
node tools/chart-screenshots.mjs
```

If Chrome isn't in a standard location, set `CHROME` to its path first. The script prints each image's size in CSS
pixels. If a size changes, update the matching `width` and `height` attributes in
[chart-element/spec/index.bs](../chart-element/spec/index.bs), then rebuild the spec.

To add an image, wrap the example in `demo.html` in a `<div class="shot" id="shot-…">`, add a `shoot()` call to the
script, and reference the new file from `index.bs`.
