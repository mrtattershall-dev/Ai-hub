// FIXTURES FOR SAFE_BEHAVIOURAL_REPLACEMENT.
//
// The whole point of this lane is the conjunction, so the two adversarial cases matter most:
//     new delta passes but OLD behaviour breaks  -> must FAIL and roll back
//     old behaviour survives but NEW delta missing -> must FAIL and roll back
// A pipeline that only checks "does the new thing work" would pass the first, which is precisely
// the failure mode that kept replace_method out of v2.
//
// FIM is injected, so every case is deterministic. Replacement bodies are taken from the goal
// reference implementations already witnessed in probes.test.mjs.
import { replaceBehaviour, spanReplaceFunction } from './safeReplace.mjs';
import { regressionFor } from './regression.mjs';
import { deriveContract } from './contract.mjs';
import { probeFor } from './probes.mjs';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HERE = new URL('.', import.meta.url).pathname.replace(/^\//, '');
const SEED = join(HERE, 'seed');
const GOALS = JSON.parse(readFileSync('C:/Users/tatte/Projects/ai-coding-hub-indent/measurements/2026-09-12-setH/goals-H.json', 'utf8'));

let pass = 0;
let fail = 0;
const t = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '   ' + detail : '')); }
};
const mkws = () => {
  const ws = mkdtempSync(join(tmpdir(), 'repl-'));
  writeFileSync(join(ws, 'package.json'), JSON.stringify({ name: 'ws', version: '1.0.0', type: 'commonjs' }, null, 2), 'utf8');
  for (const f of readdirSync(SEED)) {
    const p = join(SEED, f);
    if (statSync(p).isFile()) copyFileSync(p, join(ws, f));
  }
  return ws;
};
// The reference body for a goal, minus its "def name(" / "function name(" opener, which the span
// already supplies.
const refBody = (goal, file, opener) => {
  const src = readFileSync(join(HERE, 'ref', 'goal' + goal, file), 'utf8');
  const at = src.indexOf(opener);
  if (at < 0) throw new Error('opener not found in ref goal' + goal);
  return src.slice(at + opener.length);
};
const give = (s) => async () => s;

console.log('  BASELINE SOUNDNESS\n');
{
  const ws = mkws();
  t('s4_markdown.py old-behaviour suite passes on the canonical seed', regressionFor('s4_markdown.py')(ws).pass);
  t('s5_expr.js old-behaviour suite passes on the canonical seed', regressionFor('s5_expr.js')(ws).pass);
}
{
  const ws = mkws();
  writeFileSync(join(ws, 's5_expr.js'), 'function evaluate(e, v = {}) { return 0; }\nmodule.exports = { evaluate };\n', 'utf8');
  const r = await replaceBehaviour({ ws, contract: deriveContract(GOALS[44]), target: 'evaluate', fimFn: give('x) { return 1; }') });
  t('REFUSES when the baseline regression is already failing', r.ok === false && /baseline regression already failing/.test(r.why));
  console.log('       why: ' + r.why.slice(0, 96));
}

console.log('\n  THE CONJUNCTION - both halves are required\n');
{
  // New behaviour delivered, OLD behaviour destroyed: a links implementation that drops emphasis.
  const ws = mkws();
  const c = deriveContract(GOALS[43]);         // goal 44
  const original = readFileSync(join(ws, c.lead), 'utf8');
  const broken = [
    'text):',
    '    import re',
    '    out = []',
    '    for block in str(text).split("\\n\\n"):',
    '        if not block.strip():',
    '            continue',
    '        b = " ".join(l.strip() for l in block.split("\\n"))',
    '        b = b.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")',
    '        b = re.sub(r"\\[([^\\]]*)\\]\\(([^)]*)\\)", r\'<a href="\\2">\\1</a>\', b)',
    '        out.append("<p>" + b + "</p>")',
    '    return "\\n".join(out)',
  ].join('\n');
  const r = await replaceBehaviour({
    ws, contract: c, target: 'to_html', fimFn: give(broken), deltaProbe: probeFor(44),
  });
  t('FAILS when the new delta works but OLD behaviour breaks', r.ok === false, 'it passed');
  t('...and says so explicitly', /OLD BEHAVIOUR BROKE/.test(r.why), r.why);
  t('...and rolls the file back byte-for-byte', readFileSync(join(ws, c.lead), 'utf8') === original);
  console.log('       why: ' + r.why.slice(0, 110));
}
{
  // Old behaviour preserved, NEW delta missing: replace to_html with itself.
  const ws = mkws();
  const c = deriveContract(GOALS[43]);
  const original = readFileSync(join(ws, c.lead), 'utf8');
  const seedBody = refBody(54, 's4_markdown.py', 'def to_html(');   // goal 54 ref keeps 4/14/24/34
  // strip goal 54's list support so ONLY the old behaviour remains
  const noDelta = seedBody.replace(/\n        if line\.startswith\("- "\):[\s\S]*?continue\n/, '\n');
  const r = await replaceBehaviour({
    ws, contract: c, target: 'to_html', fimFn: give(noDelta), deltaProbe: probeFor(44),
  });
  t('FAILS when old behaviour survives but the NEW delta is missing', r.ok === false, 'it passed');
  t('...and reports the delta, not a regression', /new behaviour not delivered/.test(r.why), r.why);
  t('...and rolls back', readFileSync(join(ws, c.lead), 'utf8') === original);
}
{
  // An unchanged implementation must fail the delta probe.
  const ws = mkws();
  const c = deriveContract(GOALS[43]);
  const same = refBody(54, 's4_markdown.py', 'def to_html(');
  const r = await replaceBehaviour({ ws, contract: c, target: 'to_html', fimFn: give(same), deltaProbe: probeFor(44) });
  t('an UNCHANGED implementation fails the new-delta probe', r.ok === false && r.regression_after === true);
}

console.log('\n  SINGLE-SPAN REPLACEMENT - what it does and does not cover\n');
// Deltas CONFINED to the target function are delivered. Deltas that also live outside it are not,
// and must fail safely rather than half-apply. Which of the four is which was determined by reading
// the reference implementations, not by observing outcomes:
//   goal 54  delta is entirely inside to_html (flush_list is nested)        -> deliverable
//   goal 55  tokenize is byte-identical to the seed; delta is inside evaluate -> deliverable
//   goal 44  link logic lives in _inline plus a module-level _LINK constant  -> NOT deliverable
//   goal 45  the FUNCS table is a module-level const outside evaluate        -> NOT deliverable
for (const [goal, file, opener, deliverable] of [
  [54, 's4_markdown.py', 'def to_html(', true],
  [55, 's5_expr.js', 'function evaluate(', true],
  [44, 's4_markdown.py', 'def to_html(', false],
  [45, 's5_expr.js', 'function evaluate(', false],
]) {
  const ws = mkws();
  const c = deriveContract(GOALS[goal - 1]);
  const original = readFileSync(join(ws, c.lead), 'utf8');
  const name = opener.includes('to_html') ? 'to_html' : 'evaluate';
  const r = await replaceBehaviour({ ws, contract: c, target: name,
    fimFn: give(refBody(goal, file, opener)), deltaProbe: probeFor(goal) });
  if (deliverable) {
    t('goal ' + goal + ': confined delta is DELIVERED', r.ok === true, r.why);
    t('goal ' + goal + ': old behaviour still green', r.regression_after === true);
    t('goal ' + goal + ': new delta green', r.delta_after === true);
  } else {
    t('goal ' + goal + ': multi-site delta is NOT falsely reported as delivered', r.ok === false, 'it claimed success');
    t('goal ' + goal + ': it fails on the DELTA, not on a regression',
      r.regression_after === true && r.delta_after === false, 'regression=' + r.regression_after + ' delta=' + r.delta_after);
    t('goal ' + goal + ': the file is rolled back byte-for-byte',
      readFileSync(join(ws, c.lead), 'utf8') === original);
    console.log('       boundary: ' + String(r.why).slice(0, 92));
  }
}

console.log('\n  SPAN REFUSALS\n');
{
  const ws = mkws();
  const c = deriveContract(GOALS[43]);
  const r = await replaceBehaviour({ ws, contract: c, target: 'not_a_function', fimFn: give('x): pass') });
  t('REFUSES a target that does not exist', r.ok === false && /span refused/.test(r.why));
}
{
  const ws = mkws();
  const c = deriveContract(GOALS[43]);
  const src = readFileSync(join(ws, c.lead), 'utf8');
  writeFileSync(join(ws, c.lead), src + '\n\ndef to_html(text):\n    return ""\n', 'utf8');
  const r = await replaceBehaviour({ ws, contract: c, target: 'to_html', fimFn: give('text):\n    return ""') });
  t('REFUSES a duplicated target', r.ok === false, r.why);
  console.log('       why: ' + r.why.slice(0, 96));
}
{
  // A replacement that also edits outside its span must be rejected before anything runs.
  const ws = mkws();
  const c = deriveContract(GOALS[44]);
  const original = readFileSync(join(ws, c.lead), 'utf8');
  const sneaky = 'expr, vars = {}) { return 0; }\nmodule.exports = { evaluate: null };\n// ';
  const r = await replaceBehaviour({ ws, contract: c, target: 'evaluate', fimFn: give(sneaky), deltaProbe: probeFor(45) });
  t('REJECTS an edit that reaches outside the authorized span', r.ok === false, r.why);
  t('...and the file is untouched', readFileSync(join(ws, c.lead), 'utf8') === original);
}

console.log('\n  MODULE-LEVEL SPAN SHAPE\n');
{
  const ws = mkws();
  const py = readFileSync(join(ws, 's4_markdown.py'), 'utf8');
  const s = spanReplaceFunction(py, 'py', 'to_html');
  t('python: locates the module-level def', s.ok, s.why);
  t('python: the following __main__ block survives', s.ok && s.suffix.includes('__main__'));
  t('python: helper functions above survive', s.ok && s.prefix.includes('def _inline('));
  const js = readFileSync(join(ws, 's5_expr.js'), 'utf8');
  const j = spanReplaceFunction(js, 'js', 'evaluate');
  t('js: locates the module-level function', j.ok, j.why);
  t('js: module.exports survives in the suffix', j.ok && j.suffix.includes('module.exports'));
  t('js: the tokenize helper survives in the prefix', j.ok && j.prefix.includes('function tokenize('));
}

console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
