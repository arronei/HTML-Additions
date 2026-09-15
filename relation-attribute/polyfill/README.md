# `relation` attribute polyfill

A working JavaScript implementation of [The Relation Attribute](../spec/index.bs). It exists to show that the
spec's behavior can be built and is useful. It isn't meant as a production library.

| File | What it is |
| --- | --- |
| [relation-attribute.js](relation-attribute.js) | The polyfill. One script, no dependencies, no build step. It does nothing when the browser supports `relation` natively. |
| [demo.html](demo.html) | The spec's examples, running live, plus the examples the spec's images are taken from. |
| [test.html](test.html) | Self-checking tests for the normative behavior. Open the page and it prints `PASS`/`FAIL` lines. |

## Use it

```html
<script src="relation-attribute.js"></script>

<input type="checkbox" name="toppings" value="all" relation="parent"> All toppings
<input type="checkbox" name="toppings" value="cheese"> Cheese
<input type="checkbox" name="toppings" value="olives"> Olives
```

The script listens on `document` and watches it for changes, so checkboxes added later work without any setup.

## Run the tests

Open `test.html` in a browser, or run it headless. The tests wait for timers, so give Chrome a time budget:

```sh
chrome --headless=new --virtual-time-budget=5000 --dump-dom relation-attribute/polyfill/test.html | grep -E "PASS|FAIL"
```

All 12 tests pass in Chrome. Without the script tag, 11 fail. The canceled-click test passes either way, because a
browser without support doesn't change the group either.

## Spec-to-code map

| Spec section | Code |
| --- | --- |
| 2.1 The content attribute | `relationState` |
| 2.2 Checkbox groups | `checkboxGroup`, `parentOf`, `childrenOf` |
| 2.3 The IDL attribute | `relation` getter and setter |
| 3.1 Updating the parent | `updateTheParent`, `updateEveryParent`, the `MutationObserver` and `reset` listener |
| 3.2 Propagating the checkedness | `propagateTheCheckedness` |
| 3.3 Activation behavior | the capturing `input` listener |
| 3.4 The `checked` IDL attribute | the patched `checked` setter |

## Where the polyfill differs from the spec

1. **Timing.** A click updates the group before `input` and `change` listeners run, as the spec says, but after
   `click` listeners. Inserting, removing, or renaming checkboxes, or changing their `checked` attribute, updates the
   parent a microtask late. A form reset updates it a task late.
2. **Canceled clicks on a child.** The spec updates the parent when the child toggles and again if the click is
   canceled. The polyfill updates it only once the click goes through. The end state is the same.
3. **Blind spots.** The polyfill doesn't watch inside shadow roots, and doesn't notice a checkbox changing form
   because a `<form>` element's `id` changed.
4. **`indeterminate` set by script** on a parent is replaced after any watched change anywhere in the document, not
   only in that parent's group.

## Notes for browser engines

- **Groups.** Reuse the radio button group machinery: the same name, form owner, and tree rules decide the group,
  and the same membership-change hooks decide when to update the parent.
- **Activation.** Propagate in the checkbox's activation behavior, not its pre-activation behavior, so a canceled
  click leaves the group alone.
- **Accessibility.** The parent's indeterminate state is the existing one, so it is already exposed as "mixed".
