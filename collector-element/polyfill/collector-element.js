/**
 * Polyfill for the HTML <collector> element, as defined in ../spec/index.bs ("The Collector Element").
 *
 * Load it once, anywhere in the page:  <script src="collector-element.js"></script>
 *
 * Function names follow the spec's algorithm names, so the two can be read side by side.
 * Where script can't observe what a browser engine can, the code approximates; those spots are
 * marked `ponytail:` and listed in README.md.
 */
(() => {
  'use strict';
  if ('HTMLCollectorElement' in window) return; // Native support.

  const FLAGS = ['valueMissing', 'typeMismatch', 'patternMismatch', 'tooLong', 'tooShort', 'rangeUnderflow',
    'rangeOverflow', 'stepMismatch', 'badInput', 'customError'];
  const INCOMPLETE_MESSAGE = 'Please fill out all parts of this field.'; // ponytail: not localized.

  const isCollector = (el) => el instanceof HTMLElement && el.localName === 'collector';

  // §2.2 Collectable elements
  const VALUE_MODE_TYPES = new Set(['text', 'search', 'tel', 'url', 'email', 'password', 'date', 'month', 'week',
    'time', 'datetime-local', 'number', 'range', 'color']);
  const isCollectable = (el) => (el instanceof HTMLInputElement && VALUE_MODE_TYPES.has(el.type)) ||
    (el instanceof HTMLSelectElement && !el.multiple);

  const collectorOwner = (el) => el.parentElement?.closest('collector') ?? null;

  function formOwner(collector) {
    if (!collector.hasAttribute('form')) return collector.closest('form');
    const form = collector.isConnected ? collector.getRootNode().getElementById?.(collector.getAttribute('form')) : null;
    return form instanceof HTMLFormElement ? form : null;
  }

  const candidateControls = (collector) => [...collector.querySelectorAll('input, select')].filter((el) =>
    isCollectable(el) && collectorOwner(el) === collector && el.form === formOwner(collector));

  // §2.3 The pattern attribute: parse a collector pattern into { kind: 'literal' | 'placeholder', text } tokens.
  function parseCollectorPattern(input) {
    const tokens = [];
    const codePoints = [...input];
    let literal = '';
    for (let position = 0; position < codePoints.length;) {
      const c = codePoints[position];
      if ((c === '{' || c === '}') && codePoints[position + 1] === c) {
        literal += c;
        position += 2;
        continue;
      }
      if (c === '{') {
        let end = position + 1;
        while (end < codePoints.length && codePoints[end] !== '{' && codePoints[end] !== '}') end++;
        const identifier = codePoints.slice(position + 1, end).join('');
        if (identifier && codePoints[end] === '}') {
          if (literal) tokens.push({ kind: 'literal', text: literal });
          literal = '';
          tokens.push({ kind: 'placeholder', text: identifier });
          position = end + 1;
          continue;
        }
      }
      literal += c; // Includes an unmatched brace, which is kept as literal text.
      position++;
    }
    if (literal) tokens.push({ kind: 'literal', text: literal });
    return tokens;
  }

  // §2.4 Collected controls
  function collectedControls(collector) {
    const candidates = candidateControls(collector);
    if (!collector.hasAttribute('pattern')) return candidates;
    const identifiers = new Set(parseCollectorPattern(collector.getAttribute('pattern'))
      .filter((token) => token.kind === 'placeholder').map((token) => token.text));
    const names = new Set();
    return candidates.filter((control) => {
      const name = control.getAttribute('name');
      if (name === null || !identifiers.has(name) || names.has(name)) return false;
      names.add(name);
      return true;
    });
  }

  const isCollectedControl = (el) => {
    const collector = isCollectable(el) ? collectorOwner(el) : null;
    return !!collector && collectedControls(collector).includes(el);
  };

  const isDisabled = (el) => el.matches(':disabled');
  const enabledControls = (controls) => controls.filter((el) => !isDisabled(el));

  function collectedValue(control) {
    if (isDisabled(control)) return '';
    if (control instanceof HTMLSelectElement) {
      return [...control.selectedOptions].find((option) => !option.matches(':disabled'))?.value ?? '';
    }
    return control.value;
  }

  const isEmpty = (controls) => enabledControls(controls).every((el) => collectedValue(el) === '');
  const isComplete = (controls) => enabledControls(controls).every((el) => collectedValue(el) !== '');

  function isCollectorDisabled(collector) {
    if (collector.hasAttribute('disabled')) return true;
    for (let fieldset = collector.closest('fieldset[disabled]'); fieldset;
      fieldset = fieldset.parentElement?.closest('fieldset[disabled]')) {
      const legend = [...fieldset.children].find((child) => child.localName === 'legend');
      if (!legend?.contains(collector)) return true;
    }
    return false;
  }

  // §2.5 The collector's value
  function collectorValue(collector) {
    const controls = collectedControls(collector);
    if (isEmpty(controls)) return '';
    if (!collector.hasAttribute('pattern')) return controls.map(collectedValue).join('');
    return parseCollectorPattern(collector.getAttribute('pattern')).map((token) => {
      if (token.kind === 'literal') return token.text;
      const control = controls.find((el) => el.getAttribute('name') === token.text);
      return control ? collectedValue(control) : '';
    }).join('');
  }

  // §3 Constraint validation.
  // ponytail: script can't give an unknown element validity, so the polyfill puts the collector's message on its
  // problem control with setCustomValidity(). The browser's own form validation then reports the collector's
  // message and focuses the problem control. Every refresh clears those messages, reads the pieces' own validity,
  // and puts them back.
  const customMessages = new WeakMap(); // collector -> message from setCustomValidity()
  const authorMessages = new WeakMap(); // input or select -> message from the page's own setCustomValidity()
  const injected = new Set(); // controls currently carrying a collector's message
  const states = new WeakMap(); // collector -> last computed state

  const nativeInputSetCustomValidity = HTMLInputElement.prototype.setCustomValidity;
  const nativeSelectSetCustomValidity = HTMLSelectElement.prototype.setCustomValidity;
  const setNativeMessage = (control, message) => (control instanceof HTMLSelectElement
    ? nativeSelectSetCustomValidity : nativeInputSetCustomValidity).call(control, message);

  const isFocusable = (el) => !isDisabled(el) && !el.closest('[inert]') && el.checkVisibility?.() !== false;

  let userValiditySupported = true;
  const hasUserValidity = (el) => {
    if (!userValiditySupported) return false;
    try {
      return el.matches(':user-valid, :user-invalid');
    } catch {
      userValiditySupported = false; // ponytail: without :user-valid support, the collector never gets user validity.
      return false;
    }
  };

  function computeState(collector) {
    const controls = collectedControls(collector);
    const enabled = enabledControls(controls);
    const flags = Object.fromEntries(FLAGS.map((flag) => [flag, false]));

    // §3.1 The collector's constraints
    flags.valueMissing = collector.hasAttribute('required') && isEmpty(controls);
    flags.patternMismatch = !isEmpty(controls) && !isComplete(controls);
    const ownProblem = flags.valueMissing || flags.patternMismatch;
    flags.customError = !!customMessages.get(collector);

    // ...and the rollup of its pieces.
    let firstInvalid = null;
    for (const control of enabled) {
      if (!control.willValidate || control.validity.valid) continue;
      firstInvalid ??= control;
      for (const flag of FLAGS) if (control.validity[flag]) flags[flag] = true;
    }

    const barred = isCollectorDisabled(collector) || !!collector.closest('datalist');
    const valid = !FLAGS.some((flag) => flags[flag]);

    // §3.3 The validation message
    let message = '';
    if (!barred && !valid) message = customMessages.get(collector) || (ownProblem ? INCOMPLETE_MESSAGE : firstInvalid.validationMessage);

    // §3.2 The problem control
    const focusable = enabled.filter(isFocusable);
    const problem = focusable.find((el) => collectedValue(el) === '' || (el.willValidate && !el.validity.valid)) ??
      focusable[0] ?? null;

    // §3.6 User validity
    const withUserValidity = enabled.map(hasUserValidity);
    const userValidity = withUserValidity.some(Boolean) &&
      (!enabled.some((el) => el.matches(':focus')) || withUserValidity.every(Boolean));

    return { flags, valid, barred, message, problem, firstFocusable: focusable[0] ?? null, userValidity };
  }

  function setAttr(el, name, value) {
    if (value === null) {
      if (el.hasAttribute(name)) el.removeAttribute(name);
    } else if (el.getAttribute(name) !== value) {
      el.setAttribute(name, value);
    }
  }

  // §5 Changes to HTML: disabled collectors disable their descendants.
  // ponytail: done by setting `disabled` on the descendants, which script can see.
  const disabledByCollector = new WeakSet();
  function syncDisabled(collector) {
    const disabled = collector.hasAttribute('disabled');
    for (const el of collector.querySelectorAll('input, select, textarea, button')) {
      if (disabled && !el.disabled) {
        el.disabled = true;
        disabledByCollector.add(el);
      } else if (!disabled && disabledByCollector.has(el)) {
        el.disabled = false;
        disabledByCollector.delete(el);
      }
    }
  }

  // §6 Accessibility, and stand-ins for the pseudo-classes, which can't match an unknown element.
  const managedNames = new WeakSet();
  function reflectState(collector, state) {
    if (!collector.hasAttribute('role')) collector.setAttribute('role', 'group');
    const invalid = !state.barred && !state.valid;
    setAttr(collector, 'aria-required', collector.hasAttribute('required') ? 'true' : null);
    setAttr(collector, 'aria-invalid', invalid && state.userValidity ? 'true' : null);
    setAttr(collector, 'data-invalid', invalid ? '' : null);
    setAttr(collector, 'data-user-invalid', invalid && state.userValidity ? '' : null);
    setAttr(collector, 'data-user-valid', !state.barred && state.valid && state.userValidity ? '' : null);

    // <label for> can't name an unknown element, so copy its text into aria-label.
    if (managedNames.has(collector) || !(collector.hasAttribute('aria-label') || collector.hasAttribute('aria-labelledby'))) {
      const text = labelsOf(collector).filter((label) => label.hasAttribute('for'))
        .map((label) => label.textContent.trim()).join(' ');
      setAttr(collector, 'aria-label', text || null);
      if (text) managedNames.add(collector);
      else managedNames.delete(collector);
    }
  }

  function labelsOf(collector) {
    const root = collector.getRootNode();
    if (!root.querySelectorAll) return [];
    return [...root.querySelectorAll('label')].filter((label) => label.hasAttribute('for')
      ? collector.id !== '' && label.getAttribute('for') === collector.id && root.getElementById(collector.id) === collector
      : label.contains(collector));
  }

  // Recompute every collector in the document.
  // ponytail: scans the whole document on each event. Fine for forms; cache per event for thousands of collectors.
  let refreshing = false;
  function refreshAll() {
    if (refreshing) return;
    refreshing = true;
    try {
      for (const control of injected) setNativeMessage(control, authorMessages.get(control) ?? '');
      injected.clear();
      const collectors = [...document.querySelectorAll('collector')];
      for (const collector of collectors) {
        upgrade(collector);
        syncDisabled(collector);
      }
      const computed = collectors.map((collector) => [collector, computeState(collector)]);
      for (const [collector, state] of computed) {
        states.set(collector, state);
        if (!state.barred && !state.valid && state.problem) {
          setNativeMessage(state.problem, state.message);
          injected.add(state.problem);
        }
        reflectState(collector, state);
      }
    } finally {
      refreshing = false;
    }
  }

  function stateOf(collector) {
    refreshAll();
    return (collector.isConnected && states.get(collector)) || computeState(collector);
  }

  // §2.6 The DOM interface
  function HTMLCollectorElement() {
    return document.createElement('collector');
  }
  Object.setPrototypeOf(HTMLCollectorElement.prototype, HTMLElement.prototype);
  Object.setPrototypeOf(HTMLCollectorElement, HTMLElement);

  const reflectBoolean = (name) => ({
    get() { return this.hasAttribute(name); },
    set(value) { this.toggleAttribute(name, !!value); },
  });
  const reflectString = (name) => ({
    get() { return this.getAttribute(name) ?? ''; },
    set(value) { this.setAttribute(name, value); },
  });

  function validityOf(state) {
    // ponytail: a snapshot, not a live object like the native ValidityState.
    const validity = Object.create(ValidityState.prototype);
    for (const flag of FLAGS) Object.defineProperty(validity, flag, { value: state.flags[flag], enumerable: true });
    Object.defineProperty(validity, 'valid', { value: state.valid, enumerable: true });
    return Object.freeze(validity);
  }

  // Reporting the problem through the problem control fires `invalid` there; this flag stops it being forwarded twice.
  let reporting = false;

  Object.defineProperties(HTMLCollectorElement.prototype, {
    disabled: reflectBoolean('disabled'),
    required: reflectBoolean('required'),
    name: reflectString('name'),
    pattern: reflectString('pattern'),
    form: { get() { return formOwner(this); } },
    type: { get() { return 'collector'; } },
    value: { get() { return collectorValue(this); } },
    willValidate: { get() { return !stateOf(this).barred; } },
    validity: { get() { return validityOf(stateOf(this)); } },
    validationMessage: { get() { return stateOf(this).message; } },
    labels: { get() { return Object.freeze(labelsOf(this)); } }, // ponytail: an array, not a NodeList.
    checkValidity: {
      value() {
        const state = stateOf(this);
        if (state.barred || state.valid) return true;
        this.dispatchEvent(new Event('invalid', { cancelable: true }));
        return false;
      },
    },
    reportValidity: {
      value() {
        const state = stateOf(this);
        if (state.barred || state.valid) return true;
        if (this.dispatchEvent(new Event('invalid', { cancelable: true })) && state.problem) {
          reporting = true;
          try {
            state.problem.focus();
            state.problem.reportValidity(); // Shows the collector's message, which the problem control carries.
          } finally {
            reporting = false;
          }
        }
        return false;
      },
    },
    setCustomValidity: {
      value(error) {
        customMessages.set(this, String(error));
        refreshAll();
      },
    },
    [Symbol.toStringTag]: { value: 'HTMLCollectorElement' },
  });
  Object.defineProperty(window, 'HTMLCollectorElement', { value: HTMLCollectorElement, writable: true, configurable: true });

  function upgrade(el) {
    if (isCollector(el) && Object.getPrototypeOf(el) !== HTMLCollectorElement.prototype) {
      Object.setPrototypeOf(el, HTMLCollectorElement.prototype);
    }
  }

  // ponytail: collectors made by createElement() are upgraded at once; parsed ones on the next refresh (a microtask).
  const nativeCreateElement = Document.prototype.createElement;
  Document.prototype.createElement = function (...args) {
    const el = nativeCreateElement.apply(this, args);
    upgrade(el);
    return el;
  };

  // The page's own setCustomValidity(), checkValidity(), and reportValidity() on the pieces see only the pieces.
  let directCall = 0;
  for (const proto of [HTMLInputElement.prototype, HTMLSelectElement.prototype]) {
    const setCustomValidity = proto.setCustomValidity;
    proto.setCustomValidity = function (error) {
      authorMessages.set(this, String(error));
      setCustomValidity.call(this, error);
      refreshAll();
    };
    for (const method of ['checkValidity', 'reportValidity']) {
      const original = proto[method];
      proto[method] = function () {
        refreshAll();
        const carriesMessage = injected.has(this) && !reporting;
        if (carriesMessage) setNativeMessage(this, authorMessages.get(this) ?? '');
        if (!reporting) directCall++;
        try {
          return original.call(this);
        } finally {
          if (!reporting) directCall--;
          if (carriesMessage) refreshAll();
        }
      };
    }
  }
  for (const method of ['checkValidity', 'reportValidity', 'requestSubmit']) {
    const original = HTMLFormElement.prototype[method];
    HTMLFormElement.prototype[method] = function (...args) {
      refreshAll();
      return original.apply(this, args);
    };
  }

  // §3.5 Form validation fires `invalid` at the collector, not at its collected controls.
  document.addEventListener('invalid', (event) => {
    const control = event.target;
    if (directCall || !isCollectedControl(control)) return;
    event.stopPropagation();
    if (reporting || !injected.has(control)) return;
    if (!collectorOwner(control).dispatchEvent(new Event('invalid', { cancelable: true }))) event.preventDefault();
  }, true);

  // §5 Changes to HTML: label activation focuses the first collected control.
  document.addEventListener('click', (event) => {
    const label = event.target.closest?.('label[for]');
    const target = label?.getRootNode().getElementById?.(label.getAttribute('for'));
    if (!isCollector(target) || event.defaultPrevented) return;
    stateOf(target).firstFocusable?.focus();
  });

  // §4.1 Form submission: rewrite the entry list in the formdata event, which FormData() and submission both fire.
  let lastSubmitter = null;
  document.addEventListener('submit', (event) => { lastSubmitter = event.submitter; }, true);

  // How many entries "construct the entry list" makes under a control's name, so entries can be matched to controls.
  function entryCount(field) {
    if (field.constructor.formAssociated) return NaN; // A custom element's entry count is unknowable.
    if (!field.getAttribute('name') || field.matches(':disabled') || field.closest('datalist')) return 0;
    if (field instanceof HTMLSelectElement) return [...field.selectedOptions].filter((o) => !o.matches(':disabled')).length;
    if (field instanceof HTMLTextAreaElement) return 1;
    if (field instanceof HTMLButtonElement) return field === lastSubmitter ? 1 : 0;
    if (field instanceof HTMLInputElement) {
      switch (field.type) {
        case 'checkbox': case 'radio': return field.checked ? 1 : 0;
        case 'file': return Math.max(1, field.files.length);
        case 'submit': return field === lastSubmitter ? 1 : 0;
        case 'image': case 'button': case 'reset': return 0; // An image button's entries use other names.
        default: return 1;
      }
    }
    return 0; // <fieldset>, <output>, and <object> contribute nothing.
  }

  document.addEventListener('formdata', (event) => {
    const form = event.target;
    queueMicrotask(() => { lastSubmitter = null; });
    const collectors = [...document.querySelectorAll('collector')].filter((collector) => formOwner(collector) === form);
    if (!collectors.length) return;

    const owners = new Map(); // name -> the control behind each entry with that name, in order
    for (const field of form.elements) {
      const count = entryCount(field);
      if (Number.isNaN(count)) return console.warn('collector polyfill: form-associated custom elements prevent collecting.');
      const name = field.getAttribute('name');
      if (!owners.has(name)) owners.set(name, []);
      for (let i = 0; i < count; i++) owners.get(name).push(field);
    }

    const entries = [...event.formData];
    const seen = new Map();
    const fields = entries.map(([name]) => {
      const index = seen.get(name) ?? 0;
      seen.set(name, index + 1);
      return owners.get(name)?.[index] ?? null;
    });
    const lastOwned = fields.findLastIndex(Boolean);

    // Each collector's entry goes where it is in tree order, and its collected controls' entries are dropped.
    const result = [];
    let next = 0;
    const appendCollectorsBefore = (field) => {
      for (; next < collectors.length; next++) {
        const collector = collectors[next];
        if (field && !(collector.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING)) return;
        const name = collector.getAttribute('name');
        if (name && !isCollectorDisabled(collector) && !collector.closest('datalist')) result.push([name, collectorValue(collector)]);
      }
    };
    entries.forEach((entry, i) => {
      if (fields[i]) appendCollectorsBefore(fields[i]);
      else if (i > lastOwned) appendCollectorsBefore(null);
      if (!fields[i] || !isCollectedControl(fields[i])) result.push(entry);
    });
    appendCollectorsBefore(null);

    for (const name of new Set(entries.map(([name]) => name))) event.formData.delete(name);
    for (const [name, value] of result) event.formData.append(name, value);
  });

  // Keep state current as the page changes.
  const refresh = () => refreshAll();
  for (const type of ['input', 'change', 'focusin', 'focusout', 'click', 'keydown']) {
    document.addEventListener(type, refresh, true);
  }
  document.addEventListener('reset', () => setTimeout(refresh), true); // Controls reset after the event.
  new MutationObserver(refresh).observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['id', 'name', 'pattern', 'required', 'disabled', 'form', 'for', 'type', 'multiple', 'value',
      'selected', 'minlength', 'maxlength', 'min', 'max', 'step', 'inert', 'hidden'],
  });
  refreshAll();
})();
