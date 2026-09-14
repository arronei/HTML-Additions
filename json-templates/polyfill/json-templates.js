/**
 * Polyfill for the HTML `json`, `template`, and `key` attributes, as defined in ../spec/index.bs ("JSON Templates").
 *
 * Load it once, anywhere in the page:  <script src="json-templates.js"></script>
 *
 * Function names follow the spec's algorithm names, so the two can be read side by side.
 * Where script can't observe what a browser engine can, the code approximates; those spots are
 * marked `ponytail:` and listed in README.md.
 */
(() => {
  'use strict';
  if ('json' in HTMLTemplateElement.prototype) return; // Native support.

  // §2.2, §3.2, and §4.2 The IDL attributes
  Object.defineProperty(HTMLTemplateElement.prototype, 'json', {
    configurable: true,
    enumerable: true,
    get() {
      const value = this.getAttribute('json');
      if (value === null) return '';
      try { return new URL(value.trim(), this.baseURI).href; } catch { return value; }
    },
    set(value) { this.setAttribute('json', value); },
  });
  for (const name of ['template', 'key']) {
    Object.defineProperty(HTMLElement.prototype, name, {
      configurable: true,
      enumerable: true,
      get() { return this.getAttribute(name) ?? ''; },
      set(value) { this.setAttribute(name, value); },
    });
  }

  // §2.1 Each template's JSON data (a list, or undefined while loading) and fetch controller.
  const jsonData = new WeakMap();
  const controllers = new WeakMap();

  // §2.3 Update the JSON data
  async function updateJsonData(template) {
    controllers.get(template)?.abort();
    controllers.delete(template);
    jsonData.delete(template);
    if (!template.isConnected || !template.hasAttribute('json')) return;

    const controller = new AbortController();
    controllers.set(template, controller);
    let value;
    try {
      const response = await fetch(new URL(template.getAttribute('json').trim(), template.baseURI),
        { mode: 'cors', credentials: 'same-origin', signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      value = await response.json();
    } catch {
      if (controller.signal.aborted) return;
      controllers.delete(template);
      template.dispatchEvent(new Event('error'));
      return;
    }
    if (controller.signal.aborted) return;
    controllers.delete(template);
    jsonData.set(template, Array.isArray(value) ? value : [value]);
    for (const host of templateHosts(template)) renderTemplate(host);
    template.dispatchEvent(new Event('load'));
  }

  // §3.1 Referenced template and template hosts
  function referencedTemplate(host) {
    const name = host.getAttribute('template');
    if (!name || !host.isConnected) return null;
    const candidate = host.getRootNode().getElementById(name);
    return candidate instanceof HTMLTemplateElement ? candidate : null;
  }

  function templateHosts(template) {
    const root = template.getRootNode();
    if (!template.id || !root.querySelectorAll) return [];
    return [...root.querySelectorAll('[template]')].filter((host) => referencedTemplate(host) === template);
  }

  // §5.2 Render a template
  function renderTemplate(host) {
    const template = referencedTemplate(host);
    const items = template && jsonData.get(template);
    if (!items) return;
    const name = host.getAttribute('template');
    for (let ancestor = host.parentElement; ancestor; ancestor = ancestor.parentElement) {
      if (ancestor.getAttribute('template') === name) return;
    }

    const fragment = new DocumentFragment();
    for (const item of items) {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) continue;
      const clone = document.importNode(template.content, true);
      for (const element of clone.querySelectorAll('[key]')) {
        const key = element.getAttribute('key');
        if (Object.hasOwn(item, key)) bindValue(element, item[key]);
      }
      fragment.append(clone);
    }
    host.replaceChildren(fragment);
  }

  // §5.3 Binding values
  const isMap = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

  function bindValue(element, value) {
    if (element.localName === 'script') return; // HTML and SVG scripts never receive data.
    if (!isMap(value)) return bindText(element, value);
    for (const [name, propertyValue] of Object.entries(value)) {
      if (name === 'content') bindText(element, propertyValue);
      else bindAttribute(element, name, propertyValue);
    }
  }

  function bindText(element, value) {
    if (value === null) element.textContent = '';
    else if (typeof value !== 'object') element.textContent = String(value); // Arrays and objects are left alone.
  }

  function bindAttribute(element, name, value) {
    if (element instanceof HTMLElement) name = name.toLowerCase();
    if (name.startsWith('on') || name === 'srcdoc') return;
    try {
      if (value === false || value === null) return element.removeAttribute(name);
      if (typeof value === 'object') return;
      const text = value === true ? '' : String(value);
      if (URL.parse(text)?.protocol === 'javascript:') return;
      element.setAttribute(name, text);
    } catch {} // ponytail: setAttribute throwing stands in for the spec's "valid attribute local name" check.
  }

  // When to load and render. Rendering is queued (a microtask here), never run inside insertion.
  // ponytail: observes the document only; templates and hosts inside shadow roots aren't picked up.
  function connected(node) {
    if (!(node instanceof Element) || !node.isConnected) return;
    for (const element of [node, ...node.querySelectorAll('template[json], [template]')]) {
      if (element instanceof HTMLTemplateElement && element.hasAttribute('json')) updateJsonData(element);
      if (element.hasAttribute('template')) renderTemplate(element);
    }
  }

  new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'childList') {
        record.addedNodes.forEach(connected);
        // ponytail: a removed template stops loading; its data is simply dropped, as the spec requires.
        for (const node of record.removedNodes) {
          if (node instanceof Element && !node.isConnected) {
            for (const t of [node, ...node.querySelectorAll('template[json]')]) {
              if (t instanceof HTMLTemplateElement) updateJsonData(t);
            }
          }
        }
        continue;
      }
      const element = record.target;
      if (!element.isConnected) continue;
      if (record.attributeName === 'json' && element instanceof HTMLTemplateElement) updateJsonData(element);
      else if (record.attributeName === 'template' && element.hasAttribute('template')) renderTemplate(element);
      else if (record.attributeName === 'id' && element instanceof HTMLTemplateElement) {
        templateHosts(element).forEach(renderTemplate);
      }
    }
  }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['json', 'template', 'id'] });

  connected(document.documentElement);
})();
