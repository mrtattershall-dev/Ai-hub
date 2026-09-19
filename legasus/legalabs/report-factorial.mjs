// THE 2x2, generated from the artifact. Console output is non-evidentiary.
//
// The question is not "is capture lower somewhere". It is which FACTOR it tracks, per capacity:
//
//                      SIMILAR surface        DISSIMILAR surface
//     in the chain            a                      b
//     elsewhere               c                      d
//
//   tracks the ROWS      a,b high and c,d low        relationship-driven
//   tracks the COLUMNS   a,c high and b,d low        surface-driven
//   tracks neither       all four similar            something else entirely
//
// The comprehension gate is reported FIRST, because if the alternative wording is not understood the
// DISSIMILAR column is void and nothing below it means anything.
import { readFileSync } from 'node:fs';

const FILE = process.argv[2] || 'measurements/2026-09-18-capture-factorial/RESULT.json';

const OWN_COND = { micro: 'n < 0', low: 'n < 10', mid: 'n < 100', five: 'n == 5',
  fifty: 'n == 50', high: 'n > 100' };
const CONTAINS = { E1: { low: ['micro'] }, E2: { low: ['micro', 'five'] },
  E3: { mid: ['low', 'micro'], low: ['micro'] } };

const CELLS4 = ['IN_CHAIN_SIMILAR', 'IN_CHAIN_DISSIMILAR', 'ELSEWHERE_SIMILAR', 'ELSEWHERE_DISSIMILAR'];

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

const r = JSON.parse(readFileSync(FILE, 'utf8'));
const models = r.models;
const cap = {};     // model -> render -> {n, ad}
const corr = {};    // model -> render -> {as, v}

for (const key of Object.keys(r.cells)) {
  const c = r.cells[key];
  const m = c.model.replace('qwen2.5-coder:', '');
  const k = (bucket, init) => {
    bucket[m] = bucket[m] || {};
    bucket[m][c.render] = bucket[m][c.render] || init();
    return bucket[m][c.render];
  };
  const cc = k(corr, () => ({ as: 0, v: 0 }));
  cc.as += c.assembled; cc.v += c.verified;
  const a = k(cap, () => ({ n: 0, ad: 0 }));
  for (const row of c.rows) {
    for (const [id, o] of Object.entries(row.perOp || {})) {
      const owned = (CONTAINS[c.case] || {})[id];
      if (!owned || !o.condition) continue;
      a.n++;
      if (owned.some((s) => o.condition === OWN_COND[s] || o.condition.startsWith(OWN_COND[s] + ' and'))) {
        a.ad++;
      }
    }
  }
}

const pad = (s, n) => String(s).length >= n ? String(s) + ' ' : String(s).padEnd(n);
const rate = (x) => x && x.as ? (x.v / x.as).toFixed(3) : '-';

console.log('  SOURCE: ' + FILE);
console.log('');
console.log('  COMPREHENSION GATE — is the alternative wording understood at all?');
console.log('  If OWN_DISSIMILAR degrades, the DISSIMILAR column is VOID and nothing below it counts.');
console.log('');
console.log('    ' + pad('model', 8) + pad('ISOLATED', 12) + 'OWN_DISSIMILAR');
for (const mm of models) {
  const m = mm.replace('qwen2.5-coder:', '');
  const I = (corr[m] || {}).ISOLATED; const O = (corr[m] || {}).OWN_DISSIMILAR;
  const p = I && O ? fisher(I.v, I.as - I.v, O.v, O.as - O.v).toExponential(2) : '-';
  console.log('    ' + pad(m, 8) + pad(rate(I) + '  ' + (I ? I.v + '/' + I.as : ''), 12)
    + pad(rate(O) + '  ' + (O ? O.v + '/' + O.as : ''), 14) + '   p = ' + p);
}

console.log('');
console.log('  CAPTURE, THE 2x2, PER CAPACITY   (adopted / guards whose domain contains a sibling)');
for (const mm of models) {
  const m = mm.replace('qwen2.5-coder:', '');
  const g = (R) => (cap[m] || {})[R] || { n: 0, ad: 0 };
  const [a, b, c, d] = CELLS4.map(g);
  console.log('');
  console.log('    ' + m);
  console.log('      ' + pad('', 14) + pad('SIMILAR', 14) + 'DISSIMILAR');
  console.log('      ' + pad('IN_CHAIN', 14) + pad(a.ad + '/' + a.n, 14) + b.ad + '/' + b.n);
  console.log('      ' + pad('ELSEWHERE', 14) + pad(c.ad + '/' + c.n, 14) + d.ad + '/' + d.n);
  const iso = g('ISOLATED');
  console.log('      ' + pad('ISOLATED', 14) + iso.ad + '/' + iso.n);
  // Main effects, each collapsing over the other factor.
  const relIn = { ad: a.ad + b.ad, n: a.n + b.n };
  const relEl = { ad: c.ad + d.ad, n: c.n + d.n };
  const surSim = { ad: a.ad + c.ad, n: a.n + c.n };
  const surDis = { ad: b.ad + d.ad, n: b.n + d.n };
  console.log('      RELATIONSHIP  in-chain ' + relIn.ad + '/' + relIn.n
    + '  vs elsewhere ' + relEl.ad + '/' + relEl.n
    + '   p = ' + fisher(relIn.ad, relIn.n - relIn.ad, relEl.ad, relEl.n - relEl.ad).toExponential(2));
  console.log('      SURFACE       similar  ' + surSim.ad + '/' + surSim.n
    + '  vs dissimilar ' + surDis.ad + '/' + surDis.n
    + '   p = ' + fisher(surSim.ad, surSim.n - surSim.ad, surDis.ad, surDis.n - surDis.ad).toExponential(2));
  // Within ELSEWHERE, the surface effect is the one that separates the hypotheses cleanly: there is no
  // relationship story available there, so any remaining effect is surface.
  console.log('      SURFACE within ELSEWHERE  ' + c.ad + '/' + c.n + ' vs ' + d.ad + '/' + d.n
    + '   p = ' + fisher(c.ad, c.n - c.ad, d.ad, d.n - d.ad).toExponential(2));
}

console.log('');
console.log('  P(correct|assembled) PER CONDITION');
console.log('');
const renders = [...new Set(Object.values(r.cells).map((c) => c.render))];
console.log('    ' + pad('condition', 22) + models.map((m) => pad(m.replace('qwen2.5-coder:', ''), 10)).join(''));
for (const R of renders) {
  console.log('    ' + pad(R, 22) + models.map((mm) => {
    const m = mm.replace('qwen2.5-coder:', '');
    return pad(rate((corr[m] || {})[R]), 10);
  }).join(''));
}
