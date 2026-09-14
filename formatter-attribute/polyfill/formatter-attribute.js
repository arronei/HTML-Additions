/**
 * Polyfill for the HTML `formatter` attribute, as defined in ../spec/index.bs ("The Formatter Attribute").
 *
 * Load it once, anywhere in the page:  <script src="formatter-attribute.js"></script>
 *
 * Function names follow the spec's algorithm names, so the two can be read side by side.
 * Where script can't observe what a browser engine can, the code approximates; those spots are
 * marked `ponytail:` and listed in README.md.
 */
(() => {
  'use strict';
  if ('formatter' in HTMLInputElement.prototype) return; // Native support.

  // §2.1 Formattable elements
  const VALUE_MODE_TYPES = new Set(['text', 'search', 'tel', 'url', 'email', 'password', 'date', 'month', 'week',
    'time', 'datetime-local', 'number', 'range', 'color']);
  const isFormattable = (el) => (el instanceof HTMLInputElement && VALUE_MODE_TYPES.has(el.type)) ||
    el instanceof HTMLSelectElement;

  // §2.3 The IDL attribute
  for (const proto of [HTMLInputElement.prototype, HTMLSelectElement.prototype]) {
    Object.defineProperty(proto, 'formatter', {
      configurable: true,
      enumerable: true,
      get() { return this.getAttribute('formatter') ?? ''; },
      set(value) { this.setAttribute('formatter', value); },
    });
  }

  // §2.2 Parse a formatter template: a list of strings (literal text) and PLACEHOLDER.
  const PLACEHOLDER = Symbol('placeholder');

  function parseFormatterTemplate(input) {
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
          if (literal) tokens.push(literal);
          literal = '';
          if (identifier === 'value') tokens.push(PLACEHOLDER); // Any other placeholder is replaced with nothing.
          position = end + 1;
          continue;
        }
      }
      literal += c; // Includes an unmatched brace, which is kept as literal text.
      position++;
    }
    if (literal) tokens.push(literal);
    return tokens;
  }

  function formatValue(element, value) {
    if (!element.hasAttribute('formatter') || value === '') return value;
    return parseFormatterTemplate(element.getAttribute('formatter'))
      .map((token) => (token === PLACEHOLDER ? value : token)).join('');
  }

  // §3.1 Form submission: rewrite the entry list in the formdata event, which FormData() and submission both fire.
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
    const fields = [...event.target.elements];
    queueMicrotask(() => { lastSubmitter = null; });
    if (!fields.some((field) => field.hasAttribute('formatter') && isFormattable(field))) return;

    const owners = new Map(); // name -> the control behind each entry with that name, in order
    for (const field of fields) {
      const count = entryCount(field);
      if (Number.isNaN(count)) return console.warn('formatter polyfill: form-associated custom elements prevent formatting.');
      const name = field.getAttribute('name');
      if (!owners.has(name)) owners.set(name, []);
      for (let i = 0; i < count; i++) owners.get(name).push(field);
    }

    const entries = [...event.formData];
    const seen = new Map();
    const result = entries.map(([name, value]) => {
      const index = seen.get(name) ?? 0;
      seen.set(name, index + 1);
      const field = owners.get(name)?.[index];
      return [name, field && isFormattable(field) && typeof value === 'string' ? formatValue(field, value) : value];
    });
    if (result.every(([, value], i) => value === entries[i][1])) return;

    for (const name of new Set(entries.map(([name]) => name))) event.formData.delete(name);
    for (const [name, value] of result) event.formData.append(name, value);
  });
})();
