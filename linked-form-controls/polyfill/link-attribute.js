/**
 * Polyfill for the HTML `link` attribute, as defined in ../spec/index.bs ("Linked Form Controls").
 *
 * Load it once, anywhere in the page:  <script src="link-attribute.js"></script>
 *
 * Function names follow the spec's algorithm names, so the two can be read side by side.
 * Where script can't observe what a browser engine can, the code approximates; those spots are
 * marked `ponytail:` and listed in README.md.
 */
(() => {
  'use strict';
  if ('linkElement' in HTMLInputElement.prototype) return; // Native support.

  // §2.1 Linkable elements
  const TEXT_TYPES = new Set(['text', 'search', 'tel', 'password']);
  const isTextControl = (el) => el instanceof HTMLInputElement && TEXT_TYPES.has(el.type);
  const isLinkable = (el) => isTextControl(el) || (el instanceof HTMLSelectElement && !el.multiple);

  // §2.3 The IDL attribute: linkElement reflects link, including elements set directly.
  const explicitlySet = new WeakMap();
  for (const proto of [HTMLInputElement.prototype, HTMLSelectElement.prototype]) {
    Object.defineProperty(proto, 'linkElement', {
      configurable: true,
      enumerable: true,
      get() {
        const id = this.getAttribute('link');
        if (id === null) return null;
        // ponytail: the spec forgets a directly set element on any attribute change; "still empty" approximates that.
        const element = id === '' ? explicitlySet.get(this)?.deref() : null;
        if (element) {
          return element.getRootNode({ composed: true }) === this.getRootNode({ composed: true }) ? element : null;
        }
        return this.getRootNode().getElementById?.(id) ?? null;
      },
      set(element) {
        explicitlySet.delete(this);
        if (element == null) return this.removeAttribute('link');
        this.setAttribute('link', '');
        explicitlySet.set(this, new WeakRef(element));
      },
    });
  }

  // §2.4 Link targets and link chains
  function linkTarget(element) {
    if (!isLinkable(element)) return null;
    const target = element.linkElement;
    if (!target || target === element || !isLinkable(target)) return null;
    return target.getRootNode() === element.getRootNode() ? target : null;
  }

  // ponytail: scans every [link] element in the tree on each call; cache per event if forms get very large.
  function linkSource(element) {
    for (const candidate of element.getRootNode().querySelectorAll?.('[link]') ?? []) {
      if (linkTarget(candidate) === element) return candidate;
    }
    return null;
  }

  function tentativeNextControl(element) {
    const target = linkTarget(element);
    return target && linkSource(target) === element ? target : null;
  }

  // Terminates: an element is the tentative next control of at most one element.
  function inLinkCycle(element) {
    for (let current = tentativeNextControl(element); current; current = tentativeNextControl(current)) {
      if (current === element) return true;
    }
    return false;
  }

  const nextLinkedControl = (el) => (inLinkCycle(el) ? null : tentativeNextControl(el));
  const previousLinkedControl = (el) => (inLinkCycle(el) ? null : linkSource(el));

  function linkChain(element) {
    let head = element;
    for (let previous = previousLinkedControl(head); previous; previous = previousLinkedControl(head)) head = previous;
    const chain = [head];
    for (let next = nextLinkedControl(head); next; next = nextLinkedControl(next)) chain.push(next);
    return chain;
  }

  const isLinkedControl = (el) =>
    isLinkable(el) && (nextLinkedControl(el) !== null || previousLinkedControl(el) !== null);
  const isLinkedTextControl = (el) => isTextControl(el) && isLinkedControl(el);

  // ponytail: approximates "focusable" with :disabled, inert, and checkVisibility().
  const isAvailable = (el) =>
    !el.matches(':disabled') &&
    !(isTextControl(el) && el.readOnly) &&
    !el.closest('[inert]') &&
    el.checkVisibility?.({ visibilityProperty: true, checkVisibilityCSS: true }) !== false;

  function findAvailable(element, step) {
    let current = step(element);
    while (current && !isAvailable(current)) current = step(current);
    return current;
  }
  const nextAvailableLinkedControl = (el) => findAvailable(el, nextLinkedControl);
  const previousAvailableLinkedControl = (el) => findAvailable(el, previousLinkedControl);

  const isFocused = (el) => el.getRootNode().activeElement === el;

  function focusWithSelection(control, start, end = start) {
    control.focus();
    if (isFocused(control) && isTextControl(control)) control.setSelectionRange(start, end);
  }

  // §3.1 Advancing focus
  // ponytail: stands in for the user setting in spec §6. <html data-link-auto-advance="off"> turns it off.
  const autoAdvanceIsOff = () => document.documentElement.dataset.linkAutoAdvance === 'off';

  function advanceFocus(control) {
    if (autoAdvanceIsOff()) return;
    const next = nextAvailableLinkedControl(control);
    if (next) focusWithSelection(next, 0, isTextControl(next) ? next.value.length : 0);
  }

  function checkForAutomaticAdvance(control) {
    const max = control.maxLength; // -1 means no maximum allowed value length
    const end = control.value.length;
    if (!isFocused(control) || max < 0 || end < max) return;
    if (control.selectionStart !== end || control.selectionEnd !== end) return;
    advanceFocus(control);
  }

  // §3.2 Distributing text
  const isLeadingSurrogate = (unit) => unit >= 0xd800 && unit <= 0xdbff;
  const isTrailingSurrogate = (unit) => unit >= 0xdc00 && unit <= 0xdfff;

  function distributeText(control, text, start, end, moveFocus = true, inputType = 'insertText') {
    const max = control.maxLength;
    if (max < 0) return false;
    const before = control.value.slice(0, start);
    const after = control.value.slice(end);
    if (before.length + text.length + after.length <= max) return false;

    let target = control;
    let prefix = before;
    let suffix = after;
    let remaining = text;
    let lastTarget = control;
    let caret = before.length;
    const changed = [];

    for (;;) {
      const limit = target.maxLength;
      const room = Math.max(0, limit < 0 ? remaining.length : limit - prefix.length);
      let piece = remaining.slice(0, room);
      if (piece && remaining.length > piece.length && isLeadingSurrogate(piece.charCodeAt(piece.length - 1))) {
        piece = piece.slice(0, -1);
      }
      remaining = remaining.slice(piece.length);

      const excess = limit < 0 ? 0 : Math.max(0, prefix.length + piece.length + suffix.length - limit);
      let kept = suffix.slice(Math.min(excess, suffix.length));
      if (kept && isTrailingSurrogate(kept.charCodeAt(0))) kept = kept.slice(1);

      const newValue = prefix + piece + kept;
      if (newValue !== target.value) {
        target.value = newValue;
        changed.push(target);
      }
      lastTarget = target;
      caret = prefix.length + piece.length;

      if (!remaining) break;
      const next = nextAvailableLinkedControl(target);
      if (!next || !isTextControl(next) || (next.type === 'password') !== (target.type === 'password')) break;
      target = next;
      prefix = '';
      suffix = next.value;
    }

    if (moveFocus) {
      if (lastTarget !== control) lastTarget.focus();
      if (isFocused(lastTarget)) lastTarget.setSelectionRange(caret, caret);
    }
    // ponytail: the spec queues these as tasks; dispatching synchronously keeps the same order.
    for (const changedControl of changed) {
      changedControl.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType }));
      if (!moveFocus || (changedControl !== control && changedControl !== lastTarget)) {
        changedControl.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    return true;
  }

  // §3.3 Moving between linked text controls
  function deleteBackward(control) {
    // The browser's own command keeps grapheme clusters, undo, and beforeinput/input native.
    if (document.execCommand('delete')) return;
    // ponytail: fallback removes one code point, without beforeinput or undo.
    const value = control.value;
    const pair = value.length > 1 && isTrailingSurrogate(value.charCodeAt(value.length - 1)) &&
      isLeadingSurrogate(value.charCodeAt(value.length - 2));
    control.value = value.slice(0, pair ? -2 : -1);
    control.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'deleteContentBackward' }));
  }

  // User actions. Bubble-phase listeners run after the page's own, so a canceled event is respected.
  const INSERTIONS = new Set(['insertText', 'insertFromPaste', 'insertFromDrop', 'insertReplacementText', 'insertFromYank']);

  document.addEventListener('beforeinput', (event) => {
    const control = event.composedPath()[0];
    if (event.defaultPrevented || event.isComposing || !INSERTIONS.has(event.inputType)) return;
    if (!isLinkedTextControl(control)) return;
    const text = (event.data ?? event.dataTransfer?.getData('text/plain') ?? '').replace(/[\r\n]+/g, '');
    if (distributeText(control, text, control.selectionStart, control.selectionEnd, true, event.inputType)) {
      event.preventDefault();
    }
  });

  document.addEventListener('input', (event) => {
    const control = event.composedPath()[0];
    if (event.isComposing || !event.inputType?.startsWith('insert') || !isLinkedTextControl(control)) return;
    checkForAutomaticAdvance(control); // Synchronous, so the next keystroke already lands in the next control.
  });

  document.addEventListener('compositionend', (event) => {
    const control = event.composedPath()[0];
    if (isLinkedTextControl(control)) checkForAutomaticAdvance(control);
  });

  document.addEventListener('keydown', (event) => {
    const control = event.composedPath()[0];
    if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (!isLinkedTextControl(control) || control.selectionStart !== control.selectionEnd) return;

    const atStart = control.selectionStart === 0;
    const atEnd = control.selectionEnd === control.value.length;
    const rtl = getComputedStyle(control).direction === 'rtl';

    if (event.key === 'Backspace' && atStart) {
      const previous = previousAvailableLinkedControl(control);
      if (!previous) return;
      event.preventDefault();
      if (!isTextControl(previous)) return previous.focus();
      focusWithSelection(previous, previous.value.length);
      if (isFocused(previous)) deleteBackward(previous);
    } else if (event.key === (rtl ? 'ArrowRight' : 'ArrowLeft') && atStart) {
      const previous = previousAvailableLinkedControl(control);
      if (!isTextControl(previous)) return;
      event.preventDefault();
      focusWithSelection(previous, previous.value.length);
    } else if (event.key === (rtl ? 'ArrowLeft' : 'ArrowRight') && atEnd) {
      const next = nextAvailableLinkedControl(control);
      if (!isTextControl(next)) return;
      event.preventDefault();
      focusWithSelection(next, 0);
    }
  });

  // §3.1 for <select>: advance only when an option is picked from the drop-down box.
  // ponytail: a native picker isn't observable from script, so a change right after a navigation or
  // type-ahead key counts as "not picked"; a change after a pointer press, Enter, or Space counts as picked.
  const changedByKeyboard = new WeakSet();
  document.addEventListener('keydown', (event) => {
    const select = event.composedPath()[0];
    if (!(select instanceof HTMLSelectElement)) return;
    if (event.key === 'Enter' || event.key === ' ') changedByKeyboard.delete(select);
    else if (!event.altKey && (/^(Arrow|Page|Home$|End$)/.test(event.key) || event.key.length === 1)) changedByKeyboard.add(select);
  }, true);
  document.addEventListener('pointerdown', (event) => {
    const select = event.composedPath()[0].closest?.('select');
    if (select) changedByKeyboard.delete(select);
  }, true);
  document.addEventListener('change', (event) => {
    const select = event.composedPath()[0];
    if (!(select instanceof HTMLSelectElement) || select.size > 1 || changedByKeyboard.has(select)) return;
    if (isLinkedControl(select) && isFocused(select)) advanceFocus(select);
  });

  // §4 Form submission: rewrite the entry list in the formdata event, which FormData() and submission both fire.
  let lastSubmitter = null;
  document.addEventListener('submit', (event) => { lastSubmitter = event.submitter; }, true);

  const enabledSelectedOptions = (select) => [...select.selectedOptions].filter((option) => !option.matches(':disabled'));

  function joinedGroup(control) {
    return linkChain(control).filter((member) =>
      member.getAttribute('name') === control.getAttribute('name') && member.form && member.form === control.form &&
      !member.matches(':disabled') && !member.closest('datalist'));
  }

  function joinedValue(group) {
    return group.map((member) => member instanceof HTMLSelectElement
      ? enabledSelectedOptions(member).map((option) => option.value).join('')
      : member.value).join('');
  }

  // How many entries "construct the entry list" makes for a control, so entries can be matched to controls.
  function entryCount(field) {
    if (field.constructor.formAssociated) return NaN; // A custom element's entry count is unknowable.
    if (!field.getAttribute('name') || field.matches(':disabled') || field.closest('datalist')) return 0;
    if (field instanceof HTMLSelectElement) return enabledSelectedOptions(field).length;
    if (field instanceof HTMLTextAreaElement) return 1;
    if (field instanceof HTMLButtonElement) return field === lastSubmitter ? 1 : 0;
    if (field instanceof HTMLInputElement) {
      switch (field.type) {
        case 'checkbox': case 'radio': return field.checked ? 1 : 0;
        case 'file': return Math.max(1, field.files.length);
        case 'submit': return field === lastSubmitter ? 1 : 0;
        case 'button': case 'reset': return 0;
        default: return 1;
      }
    }
    return 0; // <fieldset>, <output>, and <object> contribute nothing.
  }

  document.addEventListener('formdata', (event) => {
    const owners = new Map(); // name -> the control behind each entry with that name, in order
    for (const field of event.target.elements) {
      const count = entryCount(field);
      if (Number.isNaN(count)) return console.warn('link polyfill: form-associated custom elements prevent joining.');
      const name = field.getAttribute('name');
      if (!owners.has(name)) owners.set(name, []);
      for (let i = 0; i < count; i++) owners.get(name).push(field);
    }

    const entries = [...event.formData];
    const seen = new Map();
    const done = new Set();
    const result = [];
    let joined = false;
    for (const [name, value] of entries) {
      const index = seen.get(name) ?? 0;
      seen.set(name, index + 1);
      const field = owners.get(name)?.[index];
      const group = field && isLinkedControl(field) ? joinedGroup(field) : [];
      if (group.length < 2) {
        result.push([name, value]);
        continue;
      }
      joined = true;
      // The joined entry goes where the group's first member (in link order) would have put its entry.
      if (done.has(group[0]) || (field !== group[0] && entryCount(group[0]) > 0)) continue;
      done.add(group[0]);
      result.push([name, joinedValue(group)]);
    }
    lastSubmitter = null;
    if (!joined) return;

    for (const name of new Set(entries.map(([name]) => name))) event.formData.delete(name);
    for (const [name, value] of result) event.formData.append(name, value);
  });
})();
