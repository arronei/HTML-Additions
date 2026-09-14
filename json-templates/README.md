# JSON templates

The `json` attribute on a `<template>` element loads JSON data. The `template` attribute on any element renders that
template into it, once for each item in the data. Each element in the template with a `key` attribute receives the
item's property with the same name:

```html
<template id="cityRow" json="./json/cities.json">
  <tr>
    <td key="city"></td>
    <td><a key="link"></a></td>
    <td><img key="photo"></td>
  </tr>
</template>

<table>
  <tbody template="cityRow">
    <tr><td colspan="3">Loading…</td></tr>
  </tbody>
</table>
```

```json
[
  {
    "city":  "Seattle",
    "link":  { "href": "/wa/seattle", "content": "Details" },
    "photo": { "src": "seattle.jpg", "alt": "Seattle skyline" }
  }
]
```

- A string value becomes the element's text. An object value sets attributes, and its `content` property sets the text.
- `true` adds an attribute with an empty value, and `false` or `null` removes it, which suits `required` or `selected`.
- Data can't add behavior: `on*` attributes, `srcdoc`, `javascript:` URLs, and `<script>` elements are never bound.
- Keys don't need to be unique, and copies keep them, so `[key="city"]` selects the rendered cells.
- The host's original contents stay until the data loads, and stay if it fails. Browsers without support show them too.
- Values are inserted as text, never as markup.
- A JSON array renders one copy per object. A single object renders one copy.
- The template fires `load` when rendering finishes and `error` if the data can't be loaded or parsed.

| Folder | Contents |
| --- | --- |
| [spec/](spec/) | The specification. [index.bs](spec/index.bs) is the Bikeshed source, and [index.html](spec/index.html) is the rendered spec. |
| [polyfill/](polyfill/) | A working JavaScript implementation, a live demo, tests, and notes for browser engines. |

To rebuild the spec after editing `index.bs`, run this from this folder:

```sh
pip install bikeshed
bikeshed spec spec/index.bs spec/index.html
```
