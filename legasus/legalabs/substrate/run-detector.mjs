// PROSPECTIVE RUN of the frozen applicability detector against the sealed substrate.
//
// The detector sees task.json and source/ ONLY. This runner reads evidence/ to SCORE, after the
// detector has already decided - the evaluator may know how success was established; the system under
// test may not.
//
// Endpoint preregistered in LEGASUS_V4.md before the detector was implemented. Reported in three
// separate groups, because conditional site quality alone rewards a detector that refuses everything.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { applicability } from '../../legaparse/applicability.mjs';
import { functionLines } from '../../legaparse/siteselect.mjs';
import { verifyFamily } from './seal.mjs';

const FAM = process.argv[2] || './family';
const NL = String.fromCharCode(10);

// The target symbol, derived from PROMPT-VISIBLE material only: the goal names what is being extended.
function targetFrom(task, src) {
  const g = String(task.goal || '');
  // The first version matched only `name(` and returned null for all six tasks, because these goals
  // name their target without parentheses ("Add nested block comments to tokens in the EXISTING
  // scan.py"). The detector was handed null every time and never decided anything, so that run was void
  // as a test of it. This is runner plumbing - the frozen detector is untouched and its hash unchanged.
  const cands = [];
  for (const m of g.matchAll(/\b([a-z_][a-z0-9_]{2,})\s*\(/gi)) cands.push(m[1]);
  for (const m of g.matchAll(/EXISTING\s+([A-Za-z_]\w*)/g)) cands.push(m[1]);
  for (const m of g.matchAll(/\b([a-z_][a-z0-9_]{2,})\b/g)) cands.push(m[1]);
  const declared = new Set(Array.isArray(task.interface) ? task.interface : []);
  // Prefer a name the SOURCE already defines at module level and the task does not introduce.
  for (const c of cands) {
    if (declared.has(c)) continue;
    if (new RegExp('^def\\s+' + c + '\\s*\\(', 'm').test(src)) return c;
  }
  return null;
}

const seal = verifyFamily(FAM, join(FAM, 'MANIFEST.sealed.json'));
console.log('  seal: ' + (seal.ok ? 'INTACT' : 'BROKEN - do not read the numbers below') + NL);
if (!seal.ok) process.exit(1);

const rows = [];
for (const id of readdirSync(FAM).filter((d) => existsSync(join(FAM, d, 'task.json'))).sort()) {
  const task = JSON.parse(readFileSync(join(FAM, id, 'task.json'), 'utf8'));
  const src = readFileSync(join(FAM, id, 'source', task.lead), 'utf8');

  // ---- the detector, on prompt-visible material only
  const target = targetFrom(task, src);
  const d = applicability(task, src, target);

  // ---- scoring, from sealed evidence, AFTER the decision
  const oracle = JSON.parse(readFileSync(join(FAM, id, 'evidence', 'oracle.json'), 'utf8'));
  const truthApplicable = oracle.analogy_class === 'analogy_specified';
  const refSites = oracle.transaction.operations.map((o) => o.site_hint);
  const f = target ? functionLines(src, target) : null;

  // A derived candidate counts as recovering a reference site if it lands within one line of the last
  // line of that site's anchor. Tolerance fixed at 1, as in the historical development run.
  let hit = 0; let useful = 0;
  if (d.verdict === 'APPLICABLE' && f) {
    const refLines = refSites.map((h) => {
      const at = src.indexOf(h);
      if (at === -1) return null;
      return src.slice(0, at + h.length).split(NL).length - 1 - f.offset;
    }).filter((x) => x !== null);
    hit = refLines.filter((r) => d.sites.some((c) => Math.abs(c.line - r) <= 1)).length;
    useful = d.sites.filter((c) => refLines.some((r) => Math.abs(c.line - r) <= 1)).length;
    rows.push({ id, truthApplicable, verdict: d.verdict, target,
      refs: refLines.length, cands: d.sites.length, hit, useful });
  } else {
    rows.push({ id, truthApplicable, verdict: d.verdict, target, reason: d.reason,
      refs: refSites.length, cands: 0, hit: 0, useful: 0 });
  }

  const r = rows[rows.length - 1];
  console.log('  ' + id + '  truth=' + (truthApplicable ? 'applicable   ' : 'no-analogue  ')
    + d.verdict.padEnd(11) + ' target=' + String(target).padEnd(12)
    + (d.verdict === 'APPLICABLE'
      ? 'cands ' + r.cands + '  recovered ' + r.hit + '/' + r.refs
      : d.reason));
}

// ---------------------------------------------------------------------------------------------------
const applicableTruth = rows.filter((r) => r.truthApplicable);
const noAnalogueTruth = rows.filter((r) => !r.truthApplicable);
const trueApply = applicableTruth.filter((r) => r.verdict === 'APPLICABLE').length;
const falseApply = noAnalogueTruth.filter((r) => r.verdict === 'APPLICABLE').length;
const abstained = rows.filter((r) => r.verdict === 'ABSTAIN').length;
const applied = rows.filter((r) => r.verdict === 'APPLICABLE');
const sumHit = applied.reduce((a, r) => a + r.hit, 0);
const sumRef = applied.reduce((a, r) => a + r.refs, 0);
const sumUse = applied.reduce((a, r) => a + r.useful, 0);
const sumCand = applied.reduce((a, r) => a + r.cands, 0);
const acceptable = applied.filter((r) => r.hit === r.refs && r.cands <= r.refs * 2).length;

console.log(NL + '===== APPLICABILITY =====');
console.log('  true-apply   ' + trueApply + '/' + applicableTruth.length + '   (tasks that DO possess the supported relation)');
console.log('  false-apply  ' + falseApply + '/' + noAnalogueTruth.length + '   (tasks that do NOT - goal 74 failure mode)');
console.log('  abstention   ' + abstained + '/' + rows.length);

console.log(NL + '===== SITE QUALITY, conditional on APPLY =====');
if (!applied.length) console.log('  undefined - the detector applied to nothing, so this has NO SENSITIVITY');
else {
  console.log('  recall     ' + sumHit + '/' + sumRef + ' = ' + (sumHit / sumRef).toFixed(3));
  console.log('  precision  ' + sumUse + '/' + sumCand + ' = ' + (sumCand ? (sumUse / sumCand).toFixed(3) : '-'));
  console.log('  inflation  ' + (sumRef ? (sumCand / sumRef).toFixed(2) : '-') + 'x');
}

console.log(NL + '===== SYSTEM COVERAGE =====');
console.log('  applies AND returns an acceptable site set:  ' + acceptable + '/' + rows.length);
console.log('  (the guard against a detector that earns precision by refusing nearly everything)');
