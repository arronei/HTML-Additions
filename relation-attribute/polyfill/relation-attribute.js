/**
 * Polyfill for the HTML `relation` attribute, as defined in ../spec/index.bs ("The Relation Attribute").
 *
 * Load it once, anywhere in the page:  <script src="relation-attribute.js"></script>
 *
 * Function names follow the spec's algorithm names, so the two can be read side by side.
 * Where script can't observe what a browser engine can, the code approximates; those spots are
 * marked `ponytail:` and listed in README.md.
 */
(() => {
  'use strict';
  if ('relation' in HTMLInputElement.prototype) return; // Native support.

  const checked = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked');
  const isChecked = (el) => checked.get.call(el);
  const setCheckedness = (el, value) => checked.set.call(el, value); // Also sets the dirty checkedness flag.

  // §2.1 The content attribute: an enumerated attribute with the states parent, linked, and none.
  const relationState = (el) => /^(parent|linked)$/i.exec(el.getAttribute('relation') ?? '')?.[1].toLowerCase() ?? 'none';

  // §2.3 The IDL attribute, limited to only known values.
  Object.defineProperty(HTMLInputElement.prototype, 'relation', {
    configurable: true,
    enumerable: true,
    get() { return relationState(this) === 'none' ? '' : relationState(this); },
    set(value) { this.setAttribute('relation', value); },
  });

  // §2.2 Checkbox groups
  const isCheckbox = (el) => el instanceof HTMLInputElement && el.type === 'checkbox';

  function checkboxGroup(el) {
    const name = el.getAttribute('name');
    if (!isCheckbox(el) || !name) return [el];
    const root = el.getRootNode();
    return [root, ...root.querySelectorAll('input')].filter((other) =>
      isCheckbox(other) && other.getAttribute('name') === name && other.form === el.form);
  }

  const parentOf = (group) => group.find((el) => relationState(el) === 'parent') ?? null;
  const childrenOf = (group, parent) => group.filter((el) => el !== parent && relationState(el) !== 'linked');

  // §3.1 Update the parent
  function updateTheParent(parent, children) {
    if (!children.length) return;
    const count = children.filter(isChecked).length;
    setCheckedness(parent, count === children.length);
    parent.indeterminate = count > 0 && count < children.length;
  }

  // §3.2 Propagate the checkedness
  function propagateTheCheckedness(el) {
    const group = checkboxGroup(el);
    const parent = parentOf(group);
    const targets = el === parent ? childrenOf(group, parent)
      : relationState(el) === 'linked' ? group.filter((other) => other !== el && relationState(other) === 'linked')
      : [];
    for (const target of targets) {
      setCheckedness(target, isChecked(el));
      target.indeterminate = false;
    }
    if (parent) updateTheParent(parent, childrenOf(group, parent));
  }

  // ponytail: recomputes every parent in the document on any relevant change, O(parents x inputs);
  // track groups incrementally if pages with thousands of checkboxes need it.
  function updateEveryParent() {
    for (const el of document.querySelectorAll('input[relation]')) {
      const group = checkboxGroup(el);
      if (parentOf(group) === el) updateTheParent(el, childrenOf(group, el));
    }
  }

  // §3.3 Activation behavior: the input event fires after the click wasn't canceled, before change.
  document.addEventListener('input', (event) => {
    const target = event.composedPath()[0];
    if (event.isTrusted && isCheckbox(target)) propagateTheCheckedness(target);
  }, true);

  // §3.4 The checked IDL attribute
  Object.defineProperty(HTMLInputElement.prototype, 'checked', {
    ...checked,
    set(value) {
      checked.set.call(this, value);
      if (isCheckbox(this)) propagateTheCheckedness(this);
    },
  });

  // Group membership changes, and checked content attribute changes. Mutation observers run a microtask late.
  // ponytail: doesn't see into shadow roots, or a form's id changing; observe those if a page needs it.
  new MutationObserver(updateEveryParent).observe(document, {
    subtree: true, childList: true, attributes: true, attributeFilter: ['name', 'type', 'relation', 'form', 'checked'],
  });

  // The reset event fires before the controls are reset.
  document.addEventListener('reset', () => setTimeout(updateEveryParent), true);

  updateEveryParent();
})();
