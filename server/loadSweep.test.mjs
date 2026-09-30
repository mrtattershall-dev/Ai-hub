/**
 * loadSweep.test.mjs - the cheapest-obvious-fix control INC-1B's result demanded.
 *
 *   node server/loadSweep.test.mjs
 *
 * THE QUESTION THIS ANSWERS. INC-1B found 3 of 10 ordinary-hub runs leaving earlier behaviour
 * broken, all three the same bug: `module.exports` naming a function never defined. Legasus caught
 * its one instance because its final check RUNS the behaviour; the ordinary finish gate only
 * checked that files PARSE. So before any claim that Legasus is what protected the code, the
 * ordinary hub has to be given the obvious guard and re-measured. The standing rule is that a
 * benefit claim must survive a strip-Legasus control.
 *
 * L1 is the one that matters: the real bug, reproduced from the INC-1B failures verbatim.
 *
 * NEGATIVE CONTROLS ARE NOT OPTIONAL HERE. A gate that refuses everything would pass L1 and look
 * like a triumph - this repo has a recorded instance of exactly that ("a bridge that refuses
 * everything would pass the other four"). L2, L5 and L6 exist to make L1 mean something.
 */
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { verify } from './verifyProject.js';

let passed = 0, failed = 0;
const ok = (c, m) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${m}`); c ? passed++ : failed++; };

function ws(files, pkg = { name: 'lt', version: '1.0.0' }) {
  const d = mkdtempSync(join(tmpdir(), 'loadsweep-'));
  writeFileSync(join(d, 'package.json'), JSON.stringify(pkg), 'utf8');
  for (const [name, body] of Object.entries(files)) {
    const full = join(d, name);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, body, 'utf8');
  }
  return d;
}
const dirs = [];
const mk = (...a) => { const d = ws(...a); dirs.push(d); return d; };

// ── L1  THE REAL BUG, verbatim from the INC-1B baseline failures ────────────────────────────────
// `total` is exported and never defined. `node --check` accepts it; require() throws.
{
  const d = mk({
    'inventory.js': [
      'function add(a, b) { return a + b; }',
      'module.exports = { add, total };',
    ].join('\n'),
    'index.js': 'console.log("ok");',
  });
  const v = await verify(d, { entry: 'index.js' });
  const named = JSON.stringify(v.problems);
  ok(!v.ok, 'L1 the INC-1B bug is now CAUGHT: a module exporting an undefined name blocks finish');
  ok(/inventory\.js/.test(named), 'L1 and the offending FILE is named: ' + (v.problems[0] || '').slice(0, 90));
  ok(/PARSE but THROW/.test(named), 'L1 reported as parse-vs-load, not as a syntax error');
}

// ── L2  NEGATIVE: correct code must still finish. The anti-refusal control. ─────────────────────
{
  const d = mk({
    'inventory.js': 'function add(a, b) { return a + b; }\nmodule.exports = { add };',
    'index.js': 'const { add } = require("./inventory");\nif (add(1, 2) !== 3) throw new Error("bad");\nconsole.log("ok");',
  });
  const v = await verify(d, { entry: 'index.js' });
  ok(v.ok, 'L2 ANTI-REFUSAL: a correct two-module project still verifies');
  ok(/module\(s\) load without throwing/.test(JSON.stringify(v.evidence)),
    'L2 and the load sweep is recorded as EVIDENCE, not silence');
}

// ── L3  the gap it closes: a broken NON-ENTRY module. The entry alone ran fine before. ──────────
{
  const d = mk({
    'broken.js': 'module.exports = { nope };',
    'index.js': 'console.log("entry is fine");',
  });
  const v = await verify(d, { entry: 'index.js' });
  ok(!v.ok, 'L3 a broken NON-ENTRY module blocks finish - previously invisible, the entry ran clean');
}

// ── L4  a module broken only because its DEPENDENCY is broken still reports both. ───────────────
// At the finish boundary this is correct: the project IS broken. Per-write refusal is what
// e0ca8ef falsified, and this check is not per-write.
{
  const d = mk({
    'lib.js': 'module.exports = { missing };',
    'consumer.js': 'const l = require("./lib");\nmodule.exports = { go: () => l.missing() };',
    'index.js': 'console.log("ok");',
  });
  const v = await verify(d, { entry: 'index.js' });
  ok(!v.ok, 'L4 a cascade is caught at the finish boundary');
  ok(/lib\.js/.test(JSON.stringify(v.problems)), 'L4 the root file is among those named');
}

// ── L5  NEGATIVE: a syntax error must NOT be re-reported as a load failure. ─────────────────────
// One defect, one name. The load sweep is skipped when syntax is already broken.
{
  const d = mk({
    'bad.js': 'function oops( {',
    'index.js': 'console.log("ok");',
  });
  const v = await verify(d, { entry: 'index.js' });
  const p = JSON.stringify(v.problems);
  ok(!v.ok, 'L5 a syntax error still blocks finish');
  ok(!/PARSE but THROW/.test(p), 'L5 and is NOT also reported as a load failure - one defect, one name');
}

// ── L6  NEGATIVE: an ESM workspace reads correctly, so the guard is not CJS-only. ───────────────
{
  const d = mk({
    'util.mjs': 'export const twice = (n) => n * 2;',
    'index.mjs': 'import { twice } from "./util.mjs";\nif (twice(2) !== 4) throw new Error("bad");\nconsole.log("ok");',
  }, { name: 'lt', version: '1.0.0', type: 'module' });
  const v = await verify(d, { entry: 'index.mjs' });
  ok(v.ok, 'L6 ESM: correct modules verify under "type":"module" too');
}

// ── L7  the ESM form of the same bug is caught. ─────────────────────────────────────────────────
{
  const d = mk({
    'util.mjs': 'export { ghost };',
    'index.mjs': 'console.log("ok");',
  }, { name: 'lt', version: '1.0.0', type: 'module' });
  const v = await verify(d, { entry: 'index.mjs' });
  ok(!v.ok, 'L7 ESM: exporting an undefined binding is caught');
}

for (const d of dirs) { try { rmSync(d, { recursive: true, force: true }); } catch {} }
console.log(`\n  ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
