# The `<collector>` element

The `<collector>` element combines the `<input>` and `<select>` elements inside it into one submitted value.
Its `pattern` attribute says how, with each `{identifier}` replaced by the value of the control with that `name`:

```html
<label for="phone">Phone number</label>
<collector id="phone" name="phone" pattern="({areaCode}) {centralOfficeCode}-{lineNumber}" required>
  (<input type="tel" name="areaCode" maxlength="3">)
  <input type="tel" name="centralOfficeCode" maxlength="3"> -
  <input type="tel" name="lineNumber" maxlength="4">
</collector>
<!-- submits phone=(206) 555-0123 -->
```

- The collector submits one entry under its own `name`. The controls it collects aren't submitted on their own.
- It is validated as a whole. It's invalid while the pattern is only partly filled in, or while any piece is
  invalid, and it shows one error message for the whole value.
- `{{` and `}}` are literal braces, so `pattern="{{{areaCode}}}"` gives `{206}`.
- A collector that's left entirely blank has an empty value, not `() -`.

| Folder | Contents |
| --- | --- |
| [spec/](spec/) | The specification. [index.bs](spec/index.bs) is the Bikeshed source, and [index.html](spec/index.html) is the rendered spec. |
| [polyfill/](polyfill/) | A working JavaScript implementation, a live demo, tests, and notes for browser engines. |

To rebuild the spec after editing `index.bs`, run this from this folder:

```sh
pip install bikeshed
bikeshed spec spec/index.bs spec/index.html
```
