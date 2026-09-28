// WHAT KIND OF SIBLING GETS CAPTURED? Generated from the artifact, not from a command line.
//
// CROSS-OBLIGATION CAPTURE could be either of two very different things:
//
//   indiscriminate attraction   any foreign domain in the prompt can be adopted
//   a relational phenomenon     only a domain standing in a particular relation to the operation's own
//
// The rendering ladder already contains the discriminator, for free. In `E1` the operation `low`
// (n < 10) is shown TWO siblings in the same paragraph, the same sentence frame and the same position:
//
//     micro   n < 0      strictly INSIDE low
//     high    n > 100    DISJOINT from low
//
// If capture were attraction to foreign semantic content, both should be adopted. If it is relational,
// only one should. Across the other cases the same comparison is available for a narrower domain of a
// DIFFERENT SHAPE (a point, n == 5) and for a domain that CONTAINS the operation's own (n < 100).
import { readFileSync } from 'node:fs';

const FILE = process.argv[2] || 'measurements/2026-09-18-rendering-ladder/RESULT.json';

// Every (operation, sibling) pair actually shown, with the relation between their domains.
const SHOWN = {
  E1: { low: [['micro', 'n < 0', 'INSIDE, same shape'], ['high', 'n > 100', 'DISJOINT']] },
  E2: { low: [['micro', 'n < 0', 'INSIDE, same shape'], ['five', 'n == 5', 'INSIDE, different shape']] },
  E3: { mid: [['low', 'n < 10', 'INSIDE, same shape'], ['micro', 'n < 0', 'INSIDE, same shape']],
    low: [['mid', 'n < 100', 'CONTAINS the operation'], ['micro', 'n < 0', 'INSIDE, same shape']] },
};

const r = JSON.parse(readFileSync(FILE, 'utf8'));
const byRelation = {};
const byPair = {};

for (const key of Object.keys(r.cells)) {
  const c = r.cells[key];
  // Only conditions that actually expose a sibling's domain can produce capture.
  if (c.render === 'ISOLATED' || c.render === 'SIBLING_EXISTS') continue;
  const spec = SHOWN[c.case];
  if (!spec) continue;
  for (const row of c.rows) {
    for (const [id, o] of Object.entries(row.perOp || {})) {
      const sibs = spec[id];
      if (!sibs || !o.condition) continue;
      for (const [sname, sdom, relation] of sibs) {
        const adopted = o.condition === sdom || o.condition.startsWith(sdom + ' and');
        for (const [bucket, k] of [[byRelation, relation],
          [byPair, relation + '   ' + id + ' shown ' + sname + ' = ' + sdom]]) {
          const a = bucket[k] = bucket[k] || { n: 0, ad: 0 };
          a.n++;
          if (adopted) a.ad++;
        }
      }
    }
  }
}

const pct = (a) => (100 * a.ad / a.n).toFixed(1) + '%';

console.log('  SOURCE: ' + FILE);
console.log('');
console.log('  IS CAPTURE INDISCRIMINATE, OR RELATIONAL?');
console.log('');
for (const [k, a] of Object.entries(byRelation).sort((x, y) => y[1].ad / y[1].n - x[1].ad / x[1].n)) {
  console.log('    ' + k.padEnd(28) + ' shown ' + String(a.n).padStart(4)
    + '   ADOPTED ' + String(a.ad).padStart(3) + '   ' + pct(a));
}
// Fisher exact, two-tailed, so the ordering above is not eyeballed.
function lfac(n) { let s = 0; for (let i = 2; i <= n; i++) s += Math.log(i); return s; }
function hyper(a, b, c, d) {
  return Math.exp(lfac(a + b) + lfac(c + d) + lfac(a + c) + lfac(b + d)
    - lfac(a) - lfac(b) - lfac(c) - lfac(d) - lfac(a + b + c + d));
}
function fisher(a, b, c, d) {
  const obs = hyper(a, b, c, d); let tot = 0;
  const n = a + b + c + d; const r1 = a + b; const c1 = a + c;
  for (let i = Math.max(0, c1 - (n - r1)); i <= Math.min(r1, c1); i++) {
    const q = hyper(i, r1 - i, c1 - i, n - r1 - c1 + i);
    if (q <= obs * 1.0000001) tot += q;
  }
  return tot;
}
const cmp = (x, y) => {
  const A = byRelation[x]; const B = byRelation[y];
  return fisher(A.ad, A.n - A.ad, B.ad, B.n - B.ad).toExponential(2);
};
console.log('');
console.log('    INSIDE same shape vs DISJOINT                 p = ' + cmp('INSIDE, same shape', 'DISJOINT'));
console.log('    INSIDE same shape vs INSIDE different shape   p = '
  + cmp('INSIDE, same shape', 'INSIDE, different shape'));
console.log('    INSIDE same shape vs CONTAINS the operation   p = '
  + cmp('INSIDE, same shape', 'CONTAINS the operation'));

console.log('');
console.log('  BY PAIR');
console.log('');
for (const [k, a] of Object.entries(byPair).sort((x, y) => y[1].ad / y[1].n - x[1].ad / x[1].n)) {
  console.log('    ' + k.padEnd(52) + ' shown ' + String(a.n).padStart(4)
    + '   ADOPTED ' + String(a.ad).padStart(3) + '   ' + pct(a));
}
