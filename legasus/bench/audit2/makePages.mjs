#!/usr/bin/env node
// AUDIT-2 stage 3 — the FRESH evaluation pages. Written after stages 1 and 2 were frozen and after
// both arms' protocols were captured, and deliberately spread across application SHAPES rather than
// across variations of one shape: different interaction modality, different DOM structure, different
// hiding mechanism, different listener style, different state representation.
//
// The pilot's four pages are DEVELOPMENT pages. None of them appears here.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const NL = String.fromCharCode(10);
const pages = {};

// ── e1: a text filter over a definition list, hidden by a class, listener on the container ──
pages.e1 = `<!DOCTYPE html>
<html><head><title>Glossary</title><style>.off{display:none}</style></head>
<body>
<h2>Glossary</h2>
<input id="lookup" type="text" placeholder="look up a term">
<dl id="terms">
  <div class="entry"><dt>latency</dt></div>
  <div class="entry"><dt>lattice</dt></div>
  <div class="entry"><dt>buffer</dt></div>
  <div class="entry"><dt>cursor</dt></div>
  <div class="entry"><dt>daemon</dt></div>
</dl>
<script>
var box = document.getElementById('lookup');
var entries = document.querySelectorAll('#terms .entry');
function narrow() {
  var q = box.value.toLowerCase();
  for (var i = 0; i < entries.length; i++) {
    var hit = entries[i].textContent.toLowerCase().indexOf(q) !== -1;
    entries[i].className = hit ? 'entry' : 'entry off';
  }
}
box.addEventListener('input', narrow);
</script>
</body></html>`;

// ── e2: click-driven counter, no text input at all. Exercises browser.click, KEY addition. ──
pages.e2 = `<!DOCTYPE html>
<html><head><title>Tally</title></head>
<body>
<h1>Tally</h1>
<p>count: <span id="count">0</span></p>
<button id="up">add one</button>
<button id="down">take one</button>
<script>
let total = 0;
const readout = document.getElementById('count');
function show() { readout.textContent = String(total); }
document.getElementById('up').addEventListener('click', function () { total = total + 1; show(); });
document.getElementById('down').addEventListener('click', function () { total = total - 1; show(); });
show();
</script>
</body></html>`;

// ── e3: keyboard-driven, arrow keys move a marker through a row. Exercises browser.keyboard. ──
pages.e3 = `<!DOCTYPE html>
<html><head><title>Track</title><style>.cell{display:inline-block;width:2em}.here{font-weight:bold}</style></head>
<body>
<h3>Track</h3>
<div id="row">
  <span class="cell">.</span><span class="cell">.</span><span class="cell">.</span>
  <span class="cell">.</span><span class="cell">.</span>
</div>
<p id="where">position 0</p>
<script>
var pos = 0;
var cells = document.querySelectorAll('#row .cell');
var label = document.getElementById('where');
function paint() {
  for (var i = 0; i < cells.length; i++) {
    cells[i].textContent = i === pos ? 'X' : '.';
    cells[i].className = i === pos ? 'cell here' : 'cell';
  }
  label.textContent = 'position ' + pos;
}
document.addEventListener('keydown', function (e) {
  if (e.key === 'ArrowRight' && pos < cells.length - 1) { pos = pos + 1; paint(); }
  if (e.key === 'ArrowLeft' && pos > 0) { pos = pos - 1; paint(); }
});
paint();
</script>
</body></html>`;

// ── e4: filter driven by a SELECT plus a text box; hiding by the hidden property ──
pages.e4 = `<!DOCTYPE html>
<html><head><title>Stock</title></head>
<body>
<h2>Stock</h2>
<input id="q" type="text">
<ul id="rows">
  <li class="row">copper wire</li>
  <li class="row">copper pipe</li>
  <li class="row">steel plate</li>
  <li class="row">steel rod</li>
  <li class="row">brass fitting</li>
  <li class="row">nylon washer</li>
</ul>
<script>
const term = document.getElementById('q');
const rows = document.getElementById('rows');
function redraw() {
  const needle = term.value.trim().toLowerCase();
  Array.prototype.forEach.call(rows.children, function (li) {
    li.hidden = needle.length > 0 && li.textContent.toLowerCase().indexOf(needle) === -1;
  });
}
term.addEventListener('input', redraw);
redraw();
</script>
</body></html>`;

// ── e5: a form with a submit handler; nothing is typed-and-filtered, so the KEY rule applies ──
pages.e5 = `<!DOCTYPE html>
<html><head><title>Notes</title></head>
<body>
<h2>Notes</h2>
<form id="add"><input id="text" type="text"><button type="submit">save</button></form>
<ul id="saved"></ul>
<script>
var list = document.getElementById('saved');
var field = document.getElementById('text');
var kept = [];
function render() {
  list.innerHTML = '';
  for (var i = 0; i < kept.length; i++) {
    var li = document.createElement('li');
    li.textContent = kept[i];
    list.appendChild(li);
  }
}
document.getElementById('add').addEventListener('submit', function (e) {
  e.preventDefault();
  if (field.value.trim()) { kept.push(field.value.trim()); field.value = ''; render(); }
});
</script>
</body></html>`;

// ── e6: filter whose state lives in an object, hiding by inline style, arrow-function listener ──
pages.e6 = `<!DOCTYPE html>
<html><head><title>Crew</title></head>
<body>
<h2>Crew</h2>
<input id="search" type="search" placeholder="name">
<div id="people">
  <p class="who">Okafor</p>
  <p class="who">Okamoto</p>
  <p class="who">Lindqvist</p>
  <p class="who">Ferreira</p>
  <p class="who">Novak</p>
</div>
<script>
const model = { query: '' };
const who = Array.from(document.querySelectorAll('#people .who'));
const draw = () => {
  who.forEach((el) => {
    el.style.display = el.textContent.toLowerCase().includes(model.query) ? 'block' : 'none';
  });
};
document.getElementById('search').addEventListener('input', (e) => {
  model.query = e.target.value.toLowerCase();
  draw();
});
draw();
</script>
</body></html>`;

// ── e7: two independent click controls toggling visibility of sections. browser.click, KEY rule. ──
pages.e7 = `<!DOCTYPE html>
<html><head><title>Panels</title></head>
<body>
<h2>Panels</h2>
<button id="toggle-a">toggle alpha</button>
<button id="toggle-b">toggle beta</button>
<section id="alpha"><p>alpha content</p></section>
<section id="beta"><p>beta content</p></section>
<script>
var shown = { alpha: true, beta: true };
function apply() {
  document.getElementById('alpha').style.display = shown.alpha ? '' : 'none';
  document.getElementById('beta').style.display = shown.beta ? '' : 'none';
}
document.getElementById('toggle-a').addEventListener('click', function () { shown.alpha = !shown.alpha; apply(); });
document.getElementById('toggle-b').addEventListener('click', function () { shown.beta = !shown.beta; apply(); });
apply();
</script>
</body></html>`;

// ── e8: filter over a table, delegated listener on document, case-sensitive matching ──
pages.e8 = `<!DOCTYPE html>
<html><head><title>Ledger</title></head>
<body>
<h2>Ledger</h2>
<input id="find" type="text">
<table id="book"><tbody>
  <tr class="line"><td>Freight</td></tr>
  <tr class="line"><td>Freezer</td></tr>
  <tr class="line"><td>Postage</td></tr>
  <tr class="line"><td>Postal</td></tr>
  <tr class="line"><td>Utilities</td></tr>
</tbody></table>
<script>
var lines = [].slice.call(document.querySelectorAll('#book .line'));
var finder = document.getElementById('find');
function sift() {
  var q = finder.value.toLowerCase();
  lines.forEach(function (tr) {
    tr.style.display = tr.textContent.toLowerCase().indexOf(q) === -1 ? 'none' : '';
  });
}
document.addEventListener('input', function (e) { if (e.target && e.target.id === 'find') sift(); });
</script>
</body></html>`;

for (const [name, html] of Object.entries(pages)) {
  const dir = join(here, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'baseline-as-delivered.html'), html.endsWith(NL) ? html : html + NL, 'utf8');
  console.log(`wrote ${name}`);
}
console.log(`${Object.keys(pages).length} fresh pages written to ${here}`);
