# HTML Additions

Proposals for new HTML features. Each proposal has its own folder, with its spec in `spec/` and any
supporting material, such as a polyfill, alongside it.

| Proposal | What it adds |
| --- | --- |
| [Linked form controls](linked-form-controls/) | A `link` attribute that chains text inputs and selects into one segmented field, such as a phone number or a one-time code. |

Specs are written in [Bikeshed](https://speced.github.io/bikeshed/). To build one:

```sh
pip install bikeshed
bikeshed spec <proposal>/spec/index.bs <proposal>/spec/index.html
```
