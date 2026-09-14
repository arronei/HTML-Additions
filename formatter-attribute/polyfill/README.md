# `formatter` attribute polyfill

A working JavaScript implementation of [The Formatter Attribute](../spec/index.bs). It exists to show that the
spec's behavior can be built and is useful. It isn't meant as a production library.

| File | What it is |
| --- | --- |
| [formatter-attribute.js](formatter-attribute.js) | The polyfill. One script, no dependencies, no build step. It does nothing when the browser supports `formatter` natively. |
| [demo.html](demo.html) | The spec's examples, running live. Each form shows its submitted entries as you type. |
| [test.html](test.html) | Self-checking tests for the normative behavior. Open the page and it prints `PASS`/`FAIL` lines. |

## Use it

```html
<script src="formatter-attribute.js"></script>

<input type="tel" name="areaCode" maxlength="3" formatter="({value})">
<!-- the user types 206; the form submits areaCode=(206) -->
```

The script listens on `document`, so controls added later work without any setup.

## Run the tests

Open `test.html` in a browser, or run it headless:

```sh
chrome --headless=new --dump-dom formatter-attribute/polyfill/test.html | grep -E "PASS|FAIL"
```

All 6 tests pass in Chrome. Without the script tag, 5 fail. The blank-field test passes either way, because a browser
without support also submits an empty value.

## Spec-to-code map

| Spec section | Code |
| --- | --- |
| 2.1 Formattable elements | `isFormattable` |
| 2.2 The content attribute | `parseFormatterTemplate`, `formatValue` |
| 2.3 The IDL attribute | `formatter` getter and setter |
| 3.1 Form submission | `entryCount` and the `formdata` listener |

## Where the polyfill differs from the spec

1. **Joined submission** has to work out which control each `FormData` entry came from. Forms that contain
   form-associated custom elements are left unformatted, with a console warning. `new FormData(form, submitter)` can
   mismatch if the submitter's name is also used by a formatted control.
2. **Other polyfills that rewrite `FormData`**, such as the collector polyfill, match entries to controls the same
   way. Combining them works when names aren't shared, but a control whose entry another polyfill removed can shift
   the matching for later controls with the same name.

## Notes for browser engines

- **Submission.** Only the entry values change in "construct the entry list": format the value where the entry is
  created. `FormData`, the `formdata` event, and navigation all pick it up. Nothing else about the control changes.
