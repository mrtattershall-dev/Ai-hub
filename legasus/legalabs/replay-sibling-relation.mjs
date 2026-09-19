// Replay the repaired sibling-relation metric over recorded rows, so the number in the write-up is
// produced by the code in the harness rather than by a one-off command line.
//
// The metric's first version counted any clause that was not the canonical own-domain as "sibling
// defence", which scored a simply wrong guard as defending. This distinguishes the two things that can
// actually happen, and they are opposites:
//
//     EXCLUDED   the guard carves the sibling's domain OUT of its own      n < 10 and n >= 0
//     ADOPTED    the guard REPLACES its own domain with the sibling's      n < 0, when n < 10 was asked
import { readFileSync } from 'node:fs';

const FILE = process.argv[2] || 'measurements/2026-09-18-decide-rendering/RESULT.json';

const OWN_COND = { micro: 'n < 0', low: 'n < 10', mid: 'n < 100', five: 'n == 5',
  fifty: 'n == 50', high: 'n > 100', plus: 'n > 0' };

// Only operations whose own domain strictly CONTAINS a sibling's can either defend or collapse.
const CONTAINS = { E0: {}, E1: { low: ['micro'] }, E2: { low: ['micro', 'five'] },
  E3: { mid: ['low', 'micro'], low: ['micro'] } };

const RE_EXCLUDES = />=\s*0|>\s*-1|!=\s*5(?![0-9])|!=\s*50(?![0-9])|n\s*>=?\s*[0-9]/;

function siblingRelation(caseKey, id, condition) {
  const owned = (CONTAINS[caseKey] || {})[id];
  if (!owned || !condition) return null;
  for (const sib of owned) {
    const d = OWN_COND[sib];
    if (condition === d || condition.startsWith(d + ' and')) return 'ADOPTED';
  }
  if (RE_EXCLUDES.test(condition)) return 'EXCLUDED';
  return null;
}

const r = JSON.parse(readFileSync(FILE, 'utf8'));
const byRender = {};
const byModel = {};
for (const key of Object.keys(r.cells)) {
  const c = r.cells[key];
  for (const row of c.rows) {
    for (const [id, o] of Object.entries(row.perOp || {})) {
      if (!o.condition || !(CONTAINS[c.case] || {})[id]) continue;
      for (const bucket of [byRender[c.render] = byRender[c.render] || { n: 0, ex: 0, ad: 0 },
        (byModel[c.model] = byModel[c.model] || {})[c.render] =
          (byModel[c.model] || {})[c.render] || { n: 0, ex: 0, ad: 0 }]) {
        bucket.n++;
        const rel = siblingRelation(c.case, id, o.condition);
        if (rel === 'EXCLUDED') bucket.ex++;
        if (rel === 'ADOPTED') bucket.ad++;
      }
    }
  }
}

console.log('  GUARDS WHOSE OWN DOMAIN CONTAINS A SIBLING');
for (const [R, a] of Object.entries(byRender)) {
  console.log('    ' + R.padEnd(15) + ' guards ' + String(a.n).padStart(4)
    + '   EXCLUDED it ' + String(a.ex).padStart(3)
    + '   ADOPTED it ' + String(a.ad).padStart(3)
    + '   ' + (100 * a.ad / a.n).toFixed(1) + '%');
}
console.log('');
for (const [m, v] of Object.entries(byModel)) {
  console.log('    ' + m.padEnd(20) + Object.entries(v).map(([R, a]) =>
    R + ' ' + a.ad + '/' + a.n).join('   '));
}
