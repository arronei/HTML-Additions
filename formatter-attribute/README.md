# The `formatter` attribute

The `formatter` attribute on `<input>` and `<select>` elements formats the value when the form is submitted.
`{value}` stands for the control's value:

```html
<input type="tel" name="areaCode" maxlength="3" pattern="[0-9]{3}" formatter="({value})">
<!-- the user types 206; the form submits areaCode=(206) -->
```

- The user sees and edits the plain value, and `input.value` still returns it.
- Validation, such as `pattern` and `required`, checks the plain value.
- An empty value isn't formatted, so a blank field submits `areaCode=`, not `areaCode=()`.
- `{{` and `}}` are literal braces, so `formatter="{{{value}}}"` gives `{206}`.

| Folder | Contents |
| --- | --- |
| [spec/](spec/) | The specification. [index.bs](spec/index.bs) is the Bikeshed source, and [index.html](spec/index.html) is the rendered spec. |
| [polyfill/](polyfill/) | A working JavaScript implementation, a live demo, tests, and notes for browser engines. |

To rebuild the spec after editing `index.bs`, run this from this folder:

```sh
pip install bikeshed
bikeshed spec spec/index.bs spec/index.html
```
