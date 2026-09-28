# AUDIT-2 — the two protocols, frozen before any fresh page exists

Captured by running both runners against a recording backend on the same emitted page.
Nothing was generated and nothing judged: these are the requests as they cross the wire.

Requirement, emitted by `emitTaskAuto` and identical for both arms: **{"kind":"click","selector":"#clear-filter"}**
Effects: "#filter is empty", "every item in the list is visible again"

| | arm A — full Legasus | arm B — direct repair |
|---|---|---|
| interface | infill, prefix + suffix | whole page |
| prompt bytes | 1260 | 1166 |
| suffix bytes | 24 | none |
| prompt sha | 0aaaada6c624996c | fbd11db35a236ffd |
| num_predict | 400 | 3000 |
| temperature | 0.2 | 0.2 |

## Arm A — the request, in full

```
<!DOCTYPE html><html><body>
<h1>Fruit</h1>
<input type="text" id="filter" placeholder="filter">
<ul id="list"><li class="item">apple</li><li class="item">apricot</li><li class="item">banana</li><li class="item">cherry</li><li class="item">date</li></ul>
<script>
const input = document.getElementById('filter');
const items = Array.from(document.querySelectorAll('#list .item'));
function applyFilter() {
  const q = input.value.toLowerCase();
  items.forEach((li) => { li.style.display = li.textContent.toLowerCase().includes(q) ? '' : 'none'; });
}
input.addEventListener('input', applyFilter);
// create #clear-filter and attach the handler that does the work
// the page updates through applyFilter, which existing code calls after changing state
// FACT: this file defines applyFilter()
// FACT: a input on input#filter handler is registered
// when #clear-filter is clicked: #filter is empty; every item in the list is visible again. Ensure typing in the filter still narrows the list.
// JAVASCRIPT STATEMENTS ONLY. This point is inside the page's existing <script> block.
// No HTML, no <script> tags, no markdown fence, no explanation, no full-page replacement.
// Create any element you need with document.createElement and append it. Continue here:

```

### Arm A — the suffix the completion must join onto

```

</script></body></html>
```

## Arm B — the request, in full

```
Here is a complete, working web page.

<!DOCTYPE html><html><body>
<h1>Fruit</h1>
<input type="text" id="filter" placeholder="filter">
<ul id="list"><li class="item">apple</li><li class="item">apricot</li><li class="item">banana</li><li class="item">cherry</li><li class="item">date</li></ul>
<script>
const input = document.getElementById('filter');
const items = Array.from(document.querySelectorAll('#list .item'));
function applyFilter() {
  const q = input.value.toLowerCase();
  items.forEach((li) => { li.style.display = li.textContent.toLowerCase().includes(q) ? '' : 'none'; });
}
input.addEventListener('input', applyFilter);
</script></body></html>

Change it so that when #clear-filter is clicked: #filter is empty; every item in the list is visible again. Ensure typing in the filter still narrows the list.
Everything the page already does must keep working.

Reply with the COMPLETE updated page: a single HTML document from <!DOCTYPE html> to </html>.
No markdown fence, no explanation, no partial snippet, and no placeholder comments.
Keep all existing markup and script, and create any new element with JavaScript DOM calls or markup as you prefer.
```

## What differs, and it is only the thing under test

Arm B has the same starting page, the same machine-emitted requirement in the same English,
the same model, backend, decoding and call cap, an output contract of the same kind as arm A's
slot-language contract, containment of the same kind (its inline scripts must parse), the same
restoration path and the same final evaluator. It does not have observation selection, code-fact
extraction, a planner-chosen site or scaffold, or any guidance packet.
