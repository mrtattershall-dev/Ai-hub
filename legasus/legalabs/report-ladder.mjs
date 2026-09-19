// THE REPORT IS GENERATED FROM THE ARTIFACT. There is no parallel reporting path.
//
// This run nearly produced two wrong conclusions from console text alone:
//   - `padEnd(15)` cannot pad a 16-character label, so `SIBLING_RESOLVED` ran into its case name and a
//     whole condition appeared to be missing from the run;
//   - a greedy `sed` crossed logical record boundaries and reported 0.900 for a cell whose true value
//     was 0.000.
//
// Neither was a measurement error. Both were PRESENTATION errors that looked like measurements. So:
//
//     JSON ARTIFACTS ARE AUTHORITATIVE. CONSOLE OUTPUT IS NON-EVIDENTIARY.
//
// The console may show progress while a run is in flight. No scientific conclusion is drawn from it,
// and every number in a write-up comes from here.
import { readFileSync } from 'node:fs';

const FILE = process.argv[2] || 'measurements/2026-09-18-rendering-ladder/RESULT.json';
const r = JSON.parse(readFileSync(FILE, 'utf8'));

const OWN_COND = { micro: 'n < 0', low: 'n < 10', mid: 'n < 100', five: 'n == 5',
  fifty: 'n == 50', high: 'n > 100', plus: 'n > 0' };
// Only an operation whose own domain strictly CONTAINS a sibling's can either defend or be captured.
const CONTAINS = { E0: {}, E1: { low: ['micro'] }, E2: { low: ['micro', 'five'] },
  E3: { mid: ['low', 'micro'], low: ['micro'] } };
const RE_EXCLUDES = />=\s*0|>\s*-1|!=\s*5(?![0-9])|!=\s*50(?![0-9])|n\s*>=?\s*[0-9]/;

function capture(caseKey, id, condition) {
  const owned = (CONTAINS[caseKey] || {})[id];
  if (!owned || !condition) return null;
  for (const sib of owned) {
    const d = OWN_COND[sib];
    if (condition === d || condition.startsWith(d + ' and')) return 'ADOPTED';
  }
  if (RE_EXCLUDES.test(condition)) return 'EXCLUDED';
  return null;
}

const pad = (s, n) => String(s).length >= n ? String(s) + ' ' : String(s).padEnd(n);

const renders = [...new Set(Object.values(r.cells).map((c) => c.render))];
const models = r.models;

// ---- per condition: correctness, capture, leaks -------------------------------------------------
const byR = {};
const byRM = {};
for (const key of Object.keys(r.cells)) {
  const c = r.cells[key];
  const acc = [byR[c.render] = byR[c.render] || blank(),
    (byRM[c.render] = byRM[c.render] || {})[c.model] =
      (byRM[c.render] || {})[c.model] || blank()];
  for (const a of acc) {
    a.assembled += c.assembled;
    a.verified += c.verified;
    a.opsAuth += c.op_yield * c.of * c.rows.length ? 0 : 0;
  }
  for (const row of c.rows) {
    let collapsed = 0;
    for (const [id, o] of Object.entries(row.perOp || {})) {
      if (!o.condition) continue;
      const rel = capture(c.case, id, o.condition);
      for (const a of acc) {
        if ((CONTAINS[c.case] || {})[id]) a.eligible++;
        if (rel === 'ADOPTED') { a.adopted++; collapsed++; }
        if (rel === 'EXCLUDED') a.excluded++;
      }
    }
    if (!collapsed) continue;
    for (const a of acc) {
      a.withCollapse++;
      if (!row.assembled) a.refused++;
      else if (!row.verified) a.proved++;
      else a.leaked++;
    }
  }
}
function blank() {
  return { assembled: 0, verified: 0, opsAuth: 0, eligible: 0, adopted: 0, excluded: 0,
    withCollapse: 0, refused: 0, proved: 0, leaked: 0 };
}

console.log('  SOURCE: ' + FILE);
console.log('');
console.log('  THE LADDER — one axis, four levels');
console.log('');
console.log('    condition          P(correct|assembled)   guards that contain a sibling'
  + '   ADOPTED it   EXCLUDED it');
for (const R of renders) {
  const a = byR[R];
  console.log('    ' + pad(R, 18)
    + pad((a.assembled ? a.verified / a.assembled : 0).toFixed(3), 22)
    + pad(a.eligible, 31)
    + pad(a.adopted + '  ' + (a.eligible ? (100 * a.adopted / a.eligible).toFixed(1) + '%' : ''), 13)
    + a.excluded);
}

console.log('');
console.log('  CAPTURE RATE BY CAPACITY  (adopted / guards whose domain contains a sibling)');
console.log('');
console.log('    ' + pad('condition', 18) + models.map((m) => pad(m.replace('qwen2.5-coder:', ''), 12)).join(''));
for (const R of renders) {
  console.log('    ' + pad(R, 18) + models.map((m) => {
    const a = (byRM[R] || {})[m];
    if (!a || !a.eligible) return pad('-', 12);
    return pad(a.adopted + '/' + a.eligible, 12);
  }).join(''));
}

console.log('');
console.log('  P(correct|assembled) BY CAPACITY');
console.log('');
console.log('    ' + pad('condition', 18) + models.map((m) => pad(m.replace('qwen2.5-coder:', ''), 12)).join(''));
for (const R of renders) {
  console.log('    ' + pad(R, 18) + models.map((m) => {
    const a = (byRM[R] || {})[m];
    return pad(a && a.assembled ? (a.verified / a.assembled).toFixed(3) : '-', 12);
  }).join(''));
}

console.log('');
console.log('  THE HARD GUARDRAIL — a wrong contract must never reach commit');
console.log('');
for (const R of renders) {
  const a = byR[R];
  console.log('    ' + pad(R, 18) + ' transactions carrying a captured contract ' + pad(a.withCollapse, 5)
    + '  CONSTRAIN refused ' + pad(a.refused, 4)
    + '  PROVE rejected ' + pad(a.proved, 4)
    + '  LEAKED ' + a.leaked);
}
const totalLeak = renders.reduce((s, R) => s + byR[R].leaked, 0);
console.log('');
console.log(totalLeak === 0
  ? '    ZERO LEAKS across every condition.'
  : '    ' + totalLeak + ' LEAK(S) - this supersedes every other question in the family.');

// ---- what was actually written, per operation, per condition -------------------------------------
console.log('');
console.log('  WHAT THE OPERATIONS ACTUALLY WROTE  (operations that contain a sibling)');
const wrote = {};
for (const key of Object.keys(r.cells)) {
  const c = r.cells[key];
  for (const row of c.rows) {
    for (const [id, o] of Object.entries(row.perOp || {})) {
      if (!o.condition || !(CONTAINS[c.case] || {})[id]) continue;
      const k = id + '|' + c.render;
      wrote[k] = wrote[k] || {};
      wrote[k][o.condition] = (wrote[k][o.condition] || 0) + 1;
    }
  }
}
for (const id of ['low', 'mid']) {
  for (const R of renders) {
    const m = wrote[id + '|' + R];
    if (!m) continue;
    const top = Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 4)
      .map(([cnd, n]) => n + 'x ' + cnd).join('   |   ');
    console.log('    ' + pad(id, 5) + pad(R, 18) + top);
  }
  console.log('');
}
