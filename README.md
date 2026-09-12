# HTML Additions

Proposals for new HTML features.

## Linked form controls: the `link` attribute

The `link` attribute lets text-entry `<input>` and `<select>` elements that hold pieces of one value, such as a
phone number, a one-time code, or a card number, work as a unit without script:

```html
<input type="tel" id="areaCode" name="phoneNumber" maxlength="3" link="centralOfficeCode">
<input type="tel" id="centralOfficeCode" name="phoneNumber" maxlength="3" link="lineNumber">
<input type="tel" id="lineNumber" name="phoneNumber" maxlength="4">
```

- Focus moves to the next control when one fills.
- Backspace, the arrow keys, pasting, and autofill all work across the controls.
- Linked controls that share a `name` submit one joined entry: `phoneNumber=5551234567`.

| Folder | Contents |
| --- | --- |
| [spec/](spec/) | The specification. [index.bs](spec/index.bs) is the Bikeshed source, and [index.html](spec/index.html) is the rendered spec. |
| [polyfill/](polyfill/) | A working JavaScript implementation, a live demo, tests, and notes for browser engines. |

To rebuild the spec after editing `index.bs`:

```sh
pip install bikeshed
bikeshed spec spec/index.bs spec/index.html
```
