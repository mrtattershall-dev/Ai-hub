// EXECUTION ISOLATION, proven against the real specimen that forced it.
//
// Cell C goal 20 of the clean baseline answered "add availability(...) to the EXISTING s10_desk.js
// and export it" by writing a program that rewrites the program - and running it to check its
// exports OVERWROTE THE FILE UNDER TEST. Only the separately preserved .bytes copy survived.
//
// The witnesses required here, and both are necessary:
//   SENSITIVITY  the adversarial artifact must be REPORTED as execution_contamination
//   SPECIFICITY  a benign artifact must NOT be, and must still be scored normally
// plus the property that actually protects the dataset:
//   the CANONICAL workspace must be byte-identical before and after every check.
import { deriveContract } from './contract.mjs';
import { checkContract } from './contractCheck.mjs';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const GOALS = JSON.parse(readFileSync('C:/Users/tatte/Projects/ai-coding-hub-indent/measurements/2026-09-12-setH/goals-H.json', 'utf8'));
const SPECIMEN = 'C:/Users/tatte/AppData/Local/Temp/baseline-3GWCKL/C/g20.bytes';

let pass = 0;
let fail = 0;
const t = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '   ' + detail : '')); }
};
const snap = (dir) => {
  const m = new Map();
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isFile()) m.set(f, createHash('sha256').update(readFileSync(p)).digest('hex'));
  }
  return m;
};
const sameSnap = (a, b) => a.size === b.size && [...a].every(([k, v]) => b.get(k) === v);

const mkws = () => {
  const ws = mkdtempSync(join(tmpdir(), 'isows-'));
  writeFileSync(join(ws, 'package.json'), JSON.stringify({ name: 'ws', version: '1.0.0', type: 'commonjs' }, null, 2), 'utf8');
  return ws;
};

// ---- 1. THE ADVERSARIAL SPECIMEN, verbatim from the run.
if (!existsSync(SPECIMEN)) {
  t('specimen present', false, 'missing ' + SPECIMEN);
} else {
  const src = readFileSync(SPECIMEN, 'utf8');
  const c = deriveContract(GOALS[19]);
  const ws = mkws();
  writeFileSync(join(ws, c.lead), src, 'utf8');
  // A second artifact that the adversary could plausibly damage - proves the blast radius is zero.
  writeFileSync(join(ws, 'bystander.js'), 'module.exports = { untouched: true };\n', 'utf8');

  t('specimen really is the self-rewriting one', /fs\.writeFileSync\(\s*['"]\.\/s10_desk\.js/.test(src),
    'specimen does not match the recorded failure');

  const before = snap(ws);
  const r = checkContract(ws, c.lead, c);
  const after = snap(ws);

  t('CANONICAL WORKSPACE IS UNCHANGED after executing the adversarial artifact',
    sameSnap(before, after),
    'workspace mutated: ' + [...after].filter(([k, v]) => before.get(k) !== v).map(([k]) => k).join(','));
  t('the bystander artifact is untouched',
    before.get('bystander.js') === after.get('bystander.js'));
  t('mutation is REPORTED as execution_contamination',
    r.reasons.some((x) => x.kind === 'execution_contamination'),
    'kinds=' + JSON.stringify(r.reasons.map((x) => x.kind)));
  t('the artifact still fails its contract (exports nothing - it is inside a template literal)',
    r.ok === false && r.reasons.some((x) => x.kind === 'missing_export'),
    'kinds=' + JSON.stringify(r.reasons.map((x) => x.kind)));
  console.log('       reported: ' + r.msg.slice(0, 150));
}

// ---- 2. SPECIFICITY: a benign artifact must not be flagged, and must score normally.
{
  const c = deriveContract(GOALS[19]);
  const ws = mkws();
  writeFileSync(join(ws, c.lead), 'function availability(lib, isbn) { return "1/2"; }\nmodule.exports = { availability };\n', 'utf8');
  const before = snap(ws);
  const r = checkContract(ws, c.lead, c);
  const after = snap(ws);
  t('benign artifact PASSES and is not flagged', r.ok === true && r.mutated === null, r.msg);
  t('benign check leaves the workspace unchanged too', sameSnap(before, after));
}

// ---- 3. A deliberately destructive artifact that deletes a neighbour, not itself.
{
  const c = deriveContract(GOALS[19]);
  const ws = mkws();
  writeFileSync(join(ws, 'victim.js'), 'module.exports = { v: 1 };\n', 'utf8');
  writeFileSync(join(ws, c.lead),
    'const fs = require("fs");\ntry { fs.unlinkSync("./victim.js"); } catch (e) {}\n'
    + 'function availability(l, i) { return "1/2"; }\nmodule.exports = { availability };\n', 'utf8');
  const before = snap(ws);
  const r = checkContract(ws, c.lead, c);
  const after = snap(ws);
  t('an artifact deleting a NEIGHBOUR cannot reach the canonical workspace', sameSnap(before, after),
    'victim gone: ' + !existsSync(join(ws, 'victim.js')));
  t('the deletion is still reported', r.reasons.some((x) => x.kind === 'execution_contamination'),
    'kinds=' + JSON.stringify(r.reasons.map((x) => x.kind)));
  // It satisfies its contract; contamination is what makes it unacceptable, and both are recorded.
  console.log('       reported: ' + r.msg.slice(0, 120));
}

// ---- 4. An artifact that hangs must time out rather than stall the run.
{
  const c = deriveContract(GOALS[19]);
  const ws = mkws();
  writeFileSync(join(ws, c.lead), 'while (true) {}\nmodule.exports = {};\n', 'utf8');
  const t0 = Date.now();
  const r = checkContract(ws, c.lead, c);
  const secs = (Date.now() - t0) / 1000;
  t('an infinite loop is bounded by the timeout (' + secs.toFixed(0) + 's)', secs < 45 && r.ok === false,
    'took ' + secs + 's ok=' + r.ok);
}

console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
