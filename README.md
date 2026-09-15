# HTML Additions

Proposals for new HTML features. Each proposal has its own folder, with its spec in `spec/` and any
supporting material, such as a polyfill, alongside it.

| Proposal | What it adds |
| --- | --- |
| [Linked form controls](linked-form-controls/) | A `link` attribute that chains text inputs and selects into one segmented field, such as a phone number or a one-time code. |
| [Collector element](collector-element/) | A `<collector>` element that combines the inputs and selects inside it into one value through a `pattern` template, and validates that value as a whole. |
| [Formatter attribute](formatter-attribute/) | A `formatter` attribute that applies a template, such as `({value})`, to an input's or select's value when the form is submitted. |
| [Relation attribute](relation-attribute/) | A `relation` attribute that relates checkboxes sharing a name: `parent` makes one checkbox check the others and show whether none, some, or all are checked, and `linked` makes checkboxes change together. |
| [Chart element](chart-element/) | A `<chart>` element that draws a pie, line, bar, or area chart from the `<data>` elements inside it, with `<series>`, `<axis>`, `<figcaption>`, and `<legend>` for series, axis names, the title, and the key. |
| [JSON templates](json-templates/) | A `json` attribute that loads JSON data into a `<template>`, a `template` attribute that renders that template into any element once per item, and a `key` attribute that fills in each element's text and attributes. |

Specs are written in [Bikeshed](https://speced.github.io/bikeshed/). To build one:

```sh
pip install bikeshed
bikeshed spec <proposal>/spec/index.bs <proposal>/spec/index.html
```

Scripts for maintaining the proposals, such as the one that regenerates the chart spec's images, are in
[tools/](tools/).
