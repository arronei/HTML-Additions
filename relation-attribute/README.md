# The `relation` attribute

The `relation` attribute on `<input type="checkbox">` relates checkboxes that share a `name`, the same way radio
buttons are grouped.

```html
<!-- parent: one checkbox controls the rest of its group -->
<input type="checkbox" name="toppings" value="all" relation="parent"> All toppings
<input type="checkbox" name="toppings" value="cheese"> Cheese
<input type="checkbox" name="toppings" value="olives"> Olives

<!-- linked: every linked checkbox in the group changes together -->
<input type="checkbox" name="newsletter" value="yes" relation="linked"> Email me the newsletter
<input type="checkbox" name="newsletter" value="yes" relation="linked"> Newsletter
```

- **`parent`** goes on one checkbox in the group. It's unchecked when no other checkbox in the group is checked,
  indeterminate when some are, and checked when all are. Clicking it checks or unchecks all of them.
- **`linked`** goes on every checkbox that should follow the others. Checking one checks them all.
- The group is every checkbox with the same `name` in the same form, like a radio button group.

| Folder | Contents |
| --- | --- |
| [spec/](spec/) | The specification. [index.bs](spec/index.bs) is the Bikeshed source, and [index.html](spec/index.html) is the rendered spec. |
| [polyfill/](polyfill/) | A working JavaScript implementation, a live demo, tests, and notes for browser engines. |

To rebuild the spec after editing `index.bs`, run this from this folder:

```sh
pip install bikeshed
bikeshed spec spec/index.bs spec/index.html
```

To regenerate the spec's images, run `node tools/relation-screenshots.mjs` from the repository root.
