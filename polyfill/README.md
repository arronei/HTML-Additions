# `link` attribute polyfill

A working JavaScript implementation of [Linked Form Controls](../spec/index.bs). It exists to show that the
spec's behavior can be built and is useful. It isn't meant as a production library.

| File | What it is |
| --- | --- |
| [link-attribute.js](link-attribute.js) | The polyfill. One script, no dependencies, no build step. It does nothing when the browser supports `linkElement` natively. |
| [demo.html](demo.html) | The spec's examples, running live. Each form shows its submitted entries as you type. |
| [test.html](test.html) | Self-checking tests for every normative behavior. Open the page and it prints `PASS`/`FAIL` lines. |

## Use it

```html
<script src="link-attribute.js"></script>

<input type="tel" id="areaCode" name="phoneNumber" maxlength="3" link="centralOfficeCode">
<input type="tel" id="centralOfficeCode" name="phoneNumber" maxlength="3" link="lineNumber">
<input type="tel" id="lineNumber" name="phoneNumber" maxlength="4">
<!-- submits phoneNumber=5551234567 -->
```

The script listens on `document`, so controls added later work without any setup.

## Run the tests

Open `test.html` in a browser, or run it headless:

```sh
chrome --headless=new --dump-dom polyfill/test.html | grep -E "PASS|FAIL"
```

All 11 tests pass in Chrome. Without the script tag, all 11 fail.

## Spec-to-code map

| Spec section | Code |
| --- | --- |
| 2.1 Linkable elements | `isLinkable`, `isTextControl` |
| 2.3 The IDL attribute | `linkElement` getter and setter |
| 2.4 Link targets and link chains | `linkTarget`, `linkSource`, `tentativeNextControl`, `inLinkCycle`, `nextLinkedControl`, `previousLinkedControl`, `linkChain`, `isAvailable` |
| 3.1 Advancing focus | `advanceFocus`, `checkForAutomaticAdvance`, and the `input`, `compositionend`, and `select` `change` listeners |
| 3.2 Distributing text | `distributeText` and the `beforeinput` listener |
| 3.3 Moving between linked text controls | the `keydown` listener and `deleteBackward` |
| 4 Form submission | `joinedGroup`, `joinedValue`, and the `formdata` listener |
| 6 Accessibility (user setting) | `<html data-link-auto-advance="off">` |

## Where the polyfill differs from the spec

Script can't see everything a browser engine can. Each difference below is marked `ponytail:` in the code.

1. **Focusability** is approximated with `:disabled`, the `inert` attribute, and `checkVisibility()`.
2. **Picking from a `<select>` drop-down** can't be observed. A change right after an arrow, Page, Home, End,
   or type-ahead key counts as "not picked". A change after a pointer press, Enter, or Space counts as picked.
3. **Events and undo.** The spec queues `input` and `change` as tasks, but the polyfill dispatches them
   synchronously, in the same order. They're untrusted events. Distributed edits aren't on the browser's undo
   stack. Since the values are set by script, the browser may not fire `change` on blur for the control that
   ends up focused.
4. **Input methods.** Text committed from an input method composition isn't distributed. Automatic advance
   still happens after `compositionend`.
5. **Autofill spill-over isn't polyfilled.** Autofill doesn't fire a cancelable `beforeinput`, and browsers
   generally apply `maxlength` to the filled value before script sees it.
6. **Constraint validation.** Values set by the polyfill don't count as user edits, so `tooLong`
   and `tooShort` don't flag distributed text.
7. **`linkElement`** forgets an element that was set directly only once the `link` attribute stops being the
   empty string. The spec forgets it on any attribute change.
8. **Joined submission** has to work out which control each `FormData` entry came from. Forms that contain
   form-associated custom elements are left unjoined, with a console warning. `new FormData(form, submitter)`
   can mismatch if the submitter's name is also used by a joined group.
9. **Performance.** Chain lookups scan every `[link]` element on each event. That's fine for forms. Cache per
   event if a page has thousands of linked controls.

## Notes for browser engines

- **Resolving chains.** Link targets resolve like `commandfor`, through element reflection. Cache each
  tree's chains, and throw the cache away when a `link` or `id` attribute changes, or when a linkable element
  is inserted, removed, or changes `type` or `multiple`. The rules that make the chains well defined (the
  first source wins, cycles unlink, and roots must match) all work from the element graph, so the cache never
  depends on focus or values.
- **Editing.** Distribution belongs where the engine applies a text insertion to a text control, after
  `beforeinput` and before `maxlength` truncation. Engines already make that same decision there when they
  truncate pasted text. Backspace and arrow crossing belong in the default handling of those editing commands,
  so a canceled `keydown` stops them.
- **`<select>`.** Automatic advance hooks the picker's commit, meaning the point where a picked option closes
  the drop-down. It must not hook every selection change.
- **Submission.** Only one step changes in "construct the entry list". `FormData`, the `formdata` event, and
  navigation all pick it up.
- **Accessibility.** Expose each linked control's position in its chain, and a flows-to relation, to the
  platform accessibility API. Also add a user setting that turns automatic advance off.
