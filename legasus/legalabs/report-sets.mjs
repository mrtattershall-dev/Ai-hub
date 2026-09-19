// SET REALIZATIONS — generated from the artifact. Console output is non-evidentiary.
//
// The verified rate is not the interesting number here. The interesting question is whether the models
// produce genuinely DIFFERENT ALGEBRAIC REALIZATIONS of the same domain, and what the verifier does with
// each:
//
//     n in (2, 4, 6, 8)                          membership - the obvious form
//     n == 2 or n == 4 or n == 6 or n == 8       an or-chain - the same domain, different algebra
//     2 <= n <= 8                                THE SPANNING RANGE - satisfies every member and is
//                                                wrong at 3, 5 and 7
//
// The first two must both verify or the verifier is an oracle for a spelling rather than a check on
// meaning. The third must fail, and it must fail on the GAP PROBES rather than on anything written for
// it - that failure mode was named in the preregistration before generation.
import { readFileSync } from 'node:fs';
import { parseCondition } from '../legacore/predicates.mjs';
import { relate, RELATION } from '../legacore/domain-algebra.mjs';

const FILE = process.argv[2] || 'measurements/2026-09-19-set-domains/RESULT.json';

// The requested domain of each operation, as the plan holds it.
const REQUESTED = {
  evens: 'n in (2, 4, 6, 8)', mid2: 'n in (4, 6)', four: 'n == 4',
  odds: 'n in (1, 5, 7)', low: 'n < 10', cross: 'n in (6, 10)',
};

// What KIND of algebra did the model reach for? Classified by form, then checked for MEANING separately,
// because the two questions are different and conflating them is how an oracle gets built.
function algebraOf(cond) {
  if (!cond) return 'none';
  if (/\bin\s*[([{]/.test(cond)) return 'membership';
  if (/\bor\b/.test(cond)) return 'or-chain';
  if (/<=?.*<=?/.test(cond)) return 'spanning-range';
  if (/==/.test(cond)) return 'equality';
  return 'comparison';
}

const r = JSON.parse(readFileSync(FILE, 'utf8'));
const byAlgebra = {};
const byModel = {};
const meaning = { EQUAL: 0, other: 0 };
const wrongButAdmitted = [];

for (const key of Object.keys(r.cells)) {
  const c = r.cells[key];
  const m = c.model.replace('qwen2.5-coder:', '');
  for (const row of c.rows) {
    for (const [id, o] of Object.entries(row.perOp || {})) {
      if (!o.condition) continue;
      const alg = algebraOf(o.condition);
      byAlgebra[alg] = (byAlgebra[alg] || 0) + 1;
      byModel[m] = byModel[m] || {};
      byModel[m][alg] = (byModel[m][alg] || 0) + 1;
      // Does the realization MEAN the requested domain? Asked of the algebra, not of the spelling.
      const want = parseCondition(REQUESTED[id]);
      const got = parseCondition(o.condition);
      const rel = relate(want, got).relation;
      if (rel === RELATION.EQUAL) meaning.EQUAL++;
      else {
        meaning.other++;
        if (o.authorized) {
          wrongButAdmitted.push({ model: m, case: c.case, id, wrote: o.condition,
            wanted: REQUESTED[id], relation: rel });
        }
      }
    }
  }
}

const pad = (s, n) => String(s).length >= n ? String(s) + ' ' : String(s).padEnd(n);

console.log('  SOURCE: ' + FILE);
console.log('');
console.log('  WHICH ALGEBRA DID THE MODELS REACH FOR?');
console.log('');
const algs = Object.keys(byAlgebra).sort((a, b) => byAlgebra[b] - byAlgebra[a]);
console.log('    ' + pad('model', 8) + algs.map((a) => pad(a, 16)).join(''));
for (const m of Object.keys(byModel)) {
  console.log('    ' + pad(m, 8) + algs.map((a) => pad(byModel[m][a] || 0, 16)).join(''));
}
console.log('    ' + pad('TOTAL', 8) + algs.map((a) => pad(byAlgebra[a], 16)).join(''));

console.log('');
console.log('  DOES THE REALIZATION MEAN THE REQUESTED DOMAIN?  (asked of the algebra, not the spelling)');
console.log('    EQUAL to the requested domain   ' + meaning.EQUAL);
console.log('    something else                  ' + meaning.other);

console.log('');
if (!wrongButAdmitted.length) {
  console.log('  No authorized fragment carried a domain other than the one requested.');
} else {
  console.log('  ' + wrongButAdmitted.length + ' AUTHORIZED fragment(s) carried a DIFFERENT domain.');
  console.log('  CONSTRAIN admits these by design - the shape is legal. The meaning is PROVE to judge.');
  const seen = {};
  for (const w of wrongButAdmitted) {
    const k = w.id + ' wrote ' + w.wrote;
    seen[k] = seen[k] || { n: 0, w };
    seen[k].n++;
  }
  for (const [k, v] of Object.entries(seen).sort((a, b) => b[1].n - a[1].n).slice(0, 12)) {
    console.log('    ' + pad(v.n + 'x', 5) + pad(v.w.wanted, 20) + '-> ' + pad(v.w.wrote, 34)
      + v.w.relation);
  }
}
