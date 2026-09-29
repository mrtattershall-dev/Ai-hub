#!/usr/bin/env node
// SUPPRESSION-1 — 12 filter pages. Structurally varied so a result is not about one page shape, and
// deliberately of the family where the 1.5B has never succeeded.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const NL = String.fromCharCode(10);

// Each page varies: element type, hiding mechanism, listener style, state location, naming.
const SPECS = [
  { id: 's01', field: 'q', list: 'rows', item: 'li', wrap: 'ul', items: ['almond', 'apricot', 'brazil', 'cashew', 'pecan'], hide: 'style', fn: 'filterRows', listener: 'input', state: 'none' },
  { id: 's02', field: 'search', list: 'cards', item: 'div', wrap: 'div', items: ['maple', 'mahogany', 'birch', 'cedar', 'walnut'], hide: 'class', fn: 'refine', listener: 'input', state: 'none' },
  { id: 's03', field: 'lookup', list: 'entries', item: 'p', wrap: 'section', items: ['quartz', 'quarry', 'basalt', 'gneiss', 'shale'], hide: 'hidden', fn: 'update', listener: 'keyup', state: 'obj' },
  { id: 's04', field: 'needle', list: 'stack', item: 'li', wrap: 'ol', items: ['lisbon', 'lima', 'cairo', 'oslo', 'dakar'], hide: 'style', fn: 'redraw', listener: 'input', state: 'obj' },
  { id: 's05', field: 'term', list: 'grid', item: 'span', wrap: 'div', items: ['violet', 'vermilion', 'ochre', 'indigo', 'umber'], hide: 'class', fn: 'paint', listener: 'input', state: 'none' },
  { id: 's06', field: 'find', list: 'log', item: 'li', wrap: 'ul', items: ['delta', 'denim', 'fennel', 'garnet', 'hazel'], hide: 'hidden', fn: 'show', listener: 'input', state: 'obj' },
  { id: 's07', field: 'filterbox', list: 'people', item: 'p', wrap: 'div', items: ['nadia', 'nasser', 'oleg', 'priya', 'ravi'], hide: 'style', fn: 'apply', listener: 'keyup', state: 'none' },
  { id: 's08', field: 'text', list: 'parts', item: 'li', wrap: 'ul', items: ['washer', 'wrench', 'anvil', 'bolt', 'clamp'], hide: 'class', fn: 'narrowList', listener: 'input', state: 'obj' },
  { id: 's09', field: 'query', list: 'items', item: 'div', wrap: 'main', items: ['saffron', 'sage', 'thyme', 'oregano', 'cumin'], hide: 'hidden', fn: 'render', listener: 'input', state: 'none' },
  { id: 's10', field: 'box', list: 'catalogue', item: 'li', wrap: 'ul', items: ['ferry', 'fennec', 'gannet', 'heron', 'ibis'], hide: 'style', fn: 'sift', listener: 'input', state: 'obj' },
  { id: 's11', field: 'input-term', list: 'listing', item: 'p', wrap: 'article', items: ['cobalt', 'copper', 'nickel', 'osmium', 'pewter'], hide: 'class', fn: 'display', listener: 'keyup', state: 'none' },
  { id: 's12', field: 'seek', list: 'results', item: 'li', wrap: 'ol', items: ['tundra', 'tulip', 'meadow', 'canyon', 'delta'], hide: 'hidden', fn: 'recompute', listener: 'input', state: 'obj' },
];

const hideCode = (mode, v) => ({
  style: `${v}.style.display = hit ? '' : 'none';`,
  class: `${v}.className = hit ? '${'item'}' : '${'item'} gone';`,
  hidden: `${v}.hidden = !hit;`,
}[mode]);

function page(s) {
  const css = s.hide === 'class' ? '<style>.gone{display:none}</style>' : '';
  const read = s.state === 'obj' ? 'model.query' : 'field.value.toLowerCase()';
  const setState = s.state === 'obj' ? `  model.query = field.value.toLowerCase();${NL}` : '';
  const stateDecl = s.state === 'obj' ? `const model = { query: '' };${NL}` : '';
  return `<!DOCTYPE html>
<html>
<head><title>${s.id}</title>${css}</head>
<body>
<h2>${s.id}</h2>
<input type="text" id="${s.field}">
<${s.wrap} id="${s.list}">
${s.items.map((x) => `  <${s.item} class="item">${x}</${s.item}>`).join(NL)}
</${s.wrap}>
<script>
${stateDecl}const field = document.getElementById('${s.field}');
const rows = Array.from(document.querySelectorAll('#${s.list} .item'));
function ${s.fn}() {
${setState}  const q = ${read};
  rows.forEach(function (el) {
    const hit = el.textContent.toLowerCase().indexOf(q) !== -1;
    ${hideCode(s.hide, 'el')}
  });
}
field.addEventListener('${s.listener}', ${s.fn});
</script>
</body>
</html>
`;
}

for (const s of SPECS) {
  const dir = join(here, s.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'baseline-as-delivered.html'), page(s), 'utf8');
}
console.log(`${SPECS.length} pages written to ${here}`);
