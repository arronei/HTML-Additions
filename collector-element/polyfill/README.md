# `<collector>` element polyfill

A working JavaScript implementation of [The Collector Element](../spec/index.bs). It exists to show that the
spec's behavior can be built and is useful. It isn't meant as a production library.

| File | What it is |
| --- | --- |
| [collector-element.js](collector-element.js) | The polyfill. One script, no dependencies, no build step. It does nothing when the browser has `HTMLCollectorElement` natively. |
| [demo.html](demo.html) | The spec's examples, running live. Each form shows the collector's value, its validity, and the submitted entries as you type. |
| [test.html](test.html) | Self-checking tests for the normative behavior. Open the page and it prints `PASS`/`FAIL` lines. |

## Use it

```html
<script src="collector-element.js"></script>

<label for="phone">Phone number</label>
<collector id="phone" name="phone" required pattern="({areaCode}) {centralOfficeCode}-{lineNumber}">
  (<input type="tel" name="areaCode" maxlength="3">)
  <input type="tel" name="centralOfficeCode" maxlength="3"> -
  <input type="tel" name="lineNumber" maxlength="4">
</collector>
<!-- submits phone=(206) 555-0123 -->
```

The script watches the whole document, so collectors added later work without any setup. Style errors with both
the real pseudo-class and the polyfill's attribute, in separate rules:

```css
collector:user-invalid { outline: 2px solid crimson; }
collector[data-user-invalid] { outline: 2px solid crimson; }
```

## Run the tests

Open `test.html` in a browser, or run it headless:

```sh
chrome --headless=new --dump-dom collector-element/polyfill/test.html | grep -E "PASS|FAIL"
```

All 9 tests pass in Chrome. Without the script tag, all 9 fail.

## Spec-to-code map

| Spec section | Code |
| --- | --- |
| 2.2 Collectable elements | `isCollectable`, `collectorOwner`, `formOwner`, `candidateControls` |
| 2.3 The `pattern` attribute | `parseCollectorPattern` |
| 2.4 Collected controls | `collectedControls`, `isCollectedControl`, `collectedValue`, `isEmpty`, `isComplete` |
| 2.5 The collector's value | `collectorValue` |
| 2.6 The DOM interface | `HTMLCollectorElement`, `upgrade`, and the `createElement` wrapper |
| 3.1–3.3 Constraints, problem control, validation message | `computeState` |
| 3.4–3.5 Reporting and form validation | `refreshAll`, `reportValidity`, the `setCustomValidity`/`checkValidity`/`reportValidity` wrappers, and the `invalid` listener |
| 3.6 User validity | `hasUserValidity` and `computeState` |
| 4 Form submission | `entryCount` and the `formdata` listener |
| 5 Changes to HTML (disabled, labels) | `isCollectorDisabled`, `syncDisabled`, and the label `click` listener |
| 6 Accessibility | `reflectState` |

## Where the polyfill differs from the spec

Script can't see everything a browser engine can. Each difference below is marked `ponytail:` in the code.

1. **Validity through the pieces.** An unknown element can't take part in form validation, so the polyfill calls
   `setCustomValidity()` on the collector's problem control with the collector's message. The browser then reports
   that message and focuses that control. While a collector is invalid, its problem control matches `:invalid` and
   its `validity` shows a custom error, even if the piece is fine on its own. Calling `checkValidity()` or
   `reportValidity()` on the piece directly still checks only the piece.
2. **A required collector with no focusable pieces** has no problem control, so native form submission isn't blocked.
3. **Pseudo-classes** can't match an unknown element. The polyfill sets `data-invalid`, `data-user-invalid`, and
   `data-user-valid` instead, along with `role="group"`, `aria-required`, `aria-invalid`, and an `aria-label` copied
   from `<label for>`. User validity needs `:user-valid` support in the browser.
4. **Upgrading.** Collectors created with `document.createElement()` are upgraded at once. Parsed or cloned ones are
   upgraded on the next refresh, which is a microtask after they're inserted. Collectors inside shadow roots aren't
   upgraded.
5. **Staying current.** The polyfill refreshes on `input`, `change`, focus, click, and key events, on form
   `checkValidity()`, `reportValidity()`, and `requestSubmit()`, and when relevant attributes change. A value set by
   script with nothing else happening isn't seen until the next of those, but reading any of the collector's own
   properties is always up to date.
6. **`validity`** is a snapshot, not a live object. **`labels`** is a frozen array, not a `NodeList`.
7. **Disabled collectors** set `disabled` on their descendant controls, which script can see.
8. **`form.elements`** doesn't include the collector.
9. **Joined submission** has to work out which control each `FormData` entry came from. Forms that contain
   form-associated custom elements are left alone, with a console warning. A `dirname` entry from a collected
   control is still submitted.
10. **The "incomplete" message** isn't localized.
11. **Performance.** Every refresh scans all collectors in the document. That's fine for forms. Cache per event if a
    page has thousands of collectors.

## Notes for browser engines

- **Validity.** The collector is a listed, submittable element whose flags are its own constraints ORed with its
  enabled collected controls' flags. Recompute lazily when a descendant control's value or validity changes, or when
  the subtree or the `pattern` attribute changes.
- **Form validation.** Skip collected controls in "statically validate the constraints", and report the collector at
  its problem control. No `invalid` event fires at the pieces.
- **Submission.** Two steps change in "construct the entry list": skip collected controls, and add the collector's
  entry. `FormData`, the `formdata` event, and navigation all pick it up.
- **Accessibility.** Map the collector to `group`, and expose its required and invalid states and its error message.
