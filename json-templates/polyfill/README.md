# `json`, `template`, and `key` attributes polyfill

A working JavaScript implementation of [JSON Templates](../spec/index.bs). It exists to show that the spec's behavior
can be built and is useful. It isn't meant as a production library.

| File | What it is |
| --- | --- |
| [json-templates.js](json-templates.js) | The polyfill. One script, no dependencies, no build step. It does nothing when the browser supports `json` natively. |
| [demo.html](demo.html) | The spec's examples, running live against the files in [json/](json/). Serve the folder over HTTP to try it. |
| [test.html](test.html) | Self-checking tests for the normative behavior. Open the page and it prints `PASS`/`FAIL` lines. |

## Use it

```html
<script src="json-templates.js"></script>

<template id="tableRow" json="./json/tableData.json">
  <tr><td key="city"></td><td key="state"></td></tr>
</template>

<table>
  <tbody template="tableRow"></tbody>
</table>
```

The script watches the document, so templates and hosts added later work without any setup.

## Run the tests

The tests load their data from `data:` URLs, so they run straight from disk. Open `test.html` in a browser, or run it
headless:

```sh
chrome --headless=new --virtual-time-budget=10000 --dump-dom json-templates/polyfill/test.html | grep -E "PASS|FAIL"
```

All 9 tests pass in Chrome. Without the script tag, all 9 fail.

To try the demo, serve this folder and open `demo.html`:

```sh
python -m http.server
```

## Spec-to-code map

| Spec section | Code |
| --- | --- |
| 2.1 The content attribute | `jsonData`, `controllers` |
| 2.2 The IDL attribute | `json` getter and setter |
| 2.3 Loading the data | `updateJsonData` |
| 3.1 The content attribute | `referencedTemplate`, `templateHosts` |
| 3.2 and 4.2 The IDL attributes | `template` and `key` getters and setters |
| 5.1 When to render | `connected` and the `MutationObserver` |
| 5.2 Rendering a template | `renderTemplate` |
| 5.3 Binding values | `bindValue`, `bindText`, `bindAttribute` |

## Where the polyfill differs from the spec

1. **Timing.** The spec queues a task to render; the polyfill renders from a `MutationObserver` callback, which runs
   as a microtask. Scripts that check the DOM synchronously after inserting a host see the same thing either way.
2. **Shadow roots.** Only the document is observed. Templates and hosts inside shadow roots aren't picked up.
3. **Request.** `fetch()` can't set the request's destination to `json`, so it's left empty.
4. **Attribute names.** The spec skips names that aren't valid attribute local names; the polyfill relies on
   `setAttribute` throwing for them, such as names that contain spaces.

## Notes for browser engines

- **Loading.** The template owns the request, like `<link rel=stylesheet>` owns its sheet. Abort it when the template
  disconnects or its `json` attribute changes.
- **Rendering.** Clone the template contents once per item, bind by key, then replace the host's children in one
  operation, so there's a single mutation and a single layout.
- **Guards.** Check the guards at bind time, on the lowercased attribute name and the parsed value, so they hold no
  matter how the template was built.
