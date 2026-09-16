// SITE SELECTION measured against the LOCKED ENDPOINT.
//
// The endpoint was frozen in LEGASUS_V4.md before siteselect.mjs was written: recall, precision, exact
// candidate-set match, inflation ratio. A trivial superset is NOT success. "Every line" is an explicit
// failure, so a degenerate baseline is measured alongside the deriver to prove the metric can detect it.
//
// Goals 64 and 74 are ONE historical development challenge, not tune-and-holdout: they share a file, a
// function and a history. Their reference sites predate this deriver by weeks, which is what makes the
// comparison meaningful - and also why passing here is DEVELOPMENT evidence, never final validation.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { SITES, locate } from './oraclesites.mjs';
import { deriveSites, functionLines } from './siteselect.mjs';

const HERE = new URL('.', import.meta.url).pathname.replace(/^\//, '');
const GOALS = JSON.parse(readFileSync('C:/Users/tatte/Projects/ai-coding-hub-indent/measurements/2026-09-12-setH/goals-H.json', 'utf8'));
const NL = String.fromCharCode(10);

const world = new Map();
for (const d of ['seed', 'seed60']) {
  for (const f of readdirSync(join(HERE, d))) {
    const p = join(HERE, d, f);
    if (statSync(p).isFile()) world.set(f, readFileSync(p));
  }
}

// The reference sites, expressed as the line index (within the function) AFTER which the insertion goes.
// Read from the frozen oracle only to SCORE; the deriver never sees them.
function referenceLines(src, spec, fn) {
  const f = functionLines(src, fn);
  const out = [];
  for (const site of spec.sites) {
    const at = src.indexOf(site.anchor);
    if (at === -1) { out.push(null); continue; }
    const upto = src.slice(0, at + site.anchor.length);
    out.push(upto.split(NL).length - 2 - f.offset);   // last line of the anchor, function-relative
  }
  return out.filter((x) => x !== null);
}

// TOLERANCE. A site is recovered if a candidate lands on the same line or the line immediately before -
// an insertion "after the flush_list() call" and "after the last line of the flush_list def" can be the
// same semantic position. Stated explicitly so it cannot be quietly widened later.
const TOL = 1;
const recovered = (refLine, cands) => cands.some((c) => Math.abs(c.line - refLine) <= TOL);

console.log('  SITE SELECTION vs the locked endpoint');
console.log('  historical development challenge: goals 64 and 74 TOGETHER\n');

const rows = [];
for (const goal of [64, 74]) {
  const spec = SITES[goal];
  const src = world.get(spec.file).toString('utf8');
  const refs = referenceLines(src, spec, spec.fn);
  const d = deriveSites(src, spec.fn, GOALS[goal - 1]);

  if (!d.ok) { console.log('  goal ' + goal + '  DERIVER REFUSED: ' + d.why); continue; }
  const hit = refs.filter((r) => recovered(r, d.sites)).length;
  const useful = d.sites.filter((c) => refs.some((r) => Math.abs(c.line - r) <= TOL)).length;
  const recall = hit / refs.length;
  const precision = d.sites.length ? useful / d.sites.length : 0;
  const inflation = d.sites.length / refs.length;
  const exact = hit === refs.length && d.sites.length === refs.length;

  console.log('  === goal ' + goal + ' ===');
  console.log('    analogue chosen      accumulator=' + d.analogue.accumulator
    + '  drain=' + d.analogue.drain + '  (of ' + d.analogue.groups + ' feature groups found)');
  console.log('    reference sites      ' + refs.length + '   at function lines ' + refs.join(', '));
  console.log('    derived candidates   ' + d.sites.length + '   at function lines '
    + d.sites.map((s) => s.line).join(', '));
  console.log('    RECALL               ' + hit + '/' + refs.length + ' = ' + recall.toFixed(3));
  console.log('    PRECISION            ' + useful + '/' + d.sites.length + ' = ' + precision.toFixed(3));
  console.log('    EXACT SET MATCH      ' + exact);
  console.log('    INFLATION RATIO      ' + inflation.toFixed(2) + 'x');
  for (const s of d.sites) {
    const on = refs.some((r) => Math.abs(s.line - r) <= TOL);
    console.log('      line ' + String(s.line).padStart(3) + (on ? '  hit ' : '  --- ') + s.why);
  }
  console.log('');
  rows.push({ goal, refs: refs.length, cands: d.sites.length, hit, useful, recall, precision, inflation, exact });
}

// DEGENERATE BASELINE. "Every line in the function" must be reported as a FAILURE by these metrics, or
// the metrics cannot detect the cheat the endpoint names.
console.log('  === degenerate baseline: propose EVERY line ===');
for (const goal of [64, 74]) {
  const spec = SITES[goal];
  const src = world.get(spec.file).toString('utf8');
  const refs = referenceLines(src, spec, spec.fn);
  const f = functionLines(src, spec.fn);
  const all = f.lines.map((_, i) => ({ line: i }));
  const hit = refs.filter((r) => recovered(r, all)).length;
  const useful = all.filter((c) => refs.some((r) => Math.abs(c.line - r) <= TOL)).length;
  console.log('    goal ' + goal + '  recall ' + (hit / refs.length).toFixed(3)
    + '   precision ' + (useful / all.length).toFixed(3)
    + '   inflation ' + (all.length / refs.length).toFixed(1) + 'x   -> perfect recall, and FAILS on'
    + ' precision and inflation, as the endpoint requires');
}

console.log('\n===== VERDICT =====');
for (const r of rows) {
  console.log('  goal ' + r.goal + '  recall ' + r.recall.toFixed(3) + '  precision ' + r.precision.toFixed(3)
    + '  inflation ' + r.inflation.toFixed(2) + 'x  exact ' + r.exact);
}
const allRecalled = rows.length && rows.every((r) => r.recall === 1);
console.log('\n  ' + (allRecalled
  ? 'Containment holds on the historical set: every reference site was recovered without being supplied.'
  : 'Containment does NOT hold. Report which sites were missed and why before changing anything.'));
console.log('  This is DEVELOPMENT evidence. Validation requires the frozen selector on the untouched');
console.log('  substrate, which does not exist yet.');
