/**
 * finishGateEntry.test.mjs - the finish gate must judge the project the goal is about.
 *
 *   node server/finishGateEntry.test.mjs
 *
 * Audited 2026-09-11, confirmed in the source rather than inferred:
 *
 * 1. detectKind checks index.html, then package.json, and only THEN .py (verifyProject.js:105-119). The hub writes a
 *    package.json into every workspace as a boundary marker, so detectKind answers 'node' for every project it holds.
 *    A pure-Python goal therefore cannot be judged as Python at all unless an entry is passed.
 *
 * 2. verify()'s entry override is gated on ['node','python','unknown'] (verifyProject.js:146-151), which excludes
 *    'web'. One leftover index.html - from any earlier goal in a shared workspace - makes every later Python or Node
 *    goal answer "index.html exists" and pass, whatever the entry says.
 *
 * 3. The tool verify_project resolves an entry from the goal (agent.js:1241-1246); the FINISH GATE calls
 *    verify(WORKSPACE) with no entry at all (agent.js:3060). So the gate can green-light a goal by running an
 *    unrelated leftover .js from a different project, and record "Verified (node): `node q1_stock.js` ran and exited
 *    cleanly" - a true sentence about the wrong file.
 *
 * This pins the behaviour so a fix can be measured. Cases marked "(known)" document what happens TODAY and are
 * expected to fail until the gate resolves an entry; the controls prove the machinery itself works when it is told
 * which file the goal is about.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectKind, verify } from './verifyProject.js';

let passed = 0, failed = 0, known = 0;
const openCases = [];
const test = async (n, f) => {
  try { await f(); passed++; console.log(`  ok    ${n}`); }
  catch (e) { if (/\(known\)/.test(n)) { known++; openCases.push(n.replace(/^\(known\) /, '')); console.log(`  KNOWN ${n}\n        ${e.message.split('\n')[0]}`); } else { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); } }
};
console.log('\nthe finish gate judges the goal\'s own project\n');

// The boundary marker the hub writes into every workspace (agent.js:196-211).
const MARKER = JSON.stringify({ name: 'agent-workspace', version: '0.0.0', private: true, type: 'commonjs', description: 'Boundary marker' });
const ws = (files) => {
  const d = mkdtempSync(join(tmpdir(), 'gate-'));
  mkdirSync(d, { recursive: true });
  for (const [name, body] of Object.entries(files)) writeFileSync(join(d, name), body, 'utf8');
  return d;
};
const CRASHING_PY = 'def units(n):\n    return n * 2\n\n\nassert units(2) == 5, "units wrong"\n';
const PASSING_JS = 'function stock(n) { return n; }\nconsole.log("stock ok", stock(1));\n';

// 1. A Python-only workspace, with the marker the hub always writes.
const py = ws({ 'package.json': MARKER, 'main.py': CRASHING_PY });
await test('(known) a Python project is detected as Python, not as Node', () => {
  assert.equal(detectKind(py).kind, 'python', 'the workspace boundary marker decided the language');
});

// 2. The gate's own call: verify(workspace) with NO entry, in a workspace holding two goals' files.
//
// These two stay KNOWN-OPEN on purpose, and not because the gate is still broken - finishGateGoalEntry.test.mjs
// proves the GATE now resolves an entry from the goal. What they pin is verifyProject's own behaviour: called with no
// entry, it still picks whatever detectKind finds and will happily cite another goal's file as evidence. That is a
// live hazard for any future caller that forgets an entry, which is exactly the mistake the gate made for months, so
// it is worth keeping visible rather than deleting.
const mixed = ws({ 'package.json': MARKER, 'q8_units.py': CRASHING_PY, 'q1_stock.js': PASSING_JS });
const vMixed = await verify(mixed);
await test('(known) a failing Python goal is not passed by an unrelated leftover .js', () => {
  assert.equal(vMixed.ok, false, 'verified: ' + JSON.stringify(vMixed.evidence).slice(0, 200));
});
await test('(known) and the evidence does not name a file from another goal as proof', () => {
  const ev = JSON.stringify(vMixed.evidence || []);
  assert.ok(!/q1_stock\.js/.test(ev), 'cited the wrong project as evidence: ' + ev.slice(0, 200));
});

// 3. A stale index.html from an earlier goal, with the entry passed explicitly.
const stale = ws({ 'package.json': MARKER, 'index.html': '<!doctype html><title>old</title>', 'main.py': CRASHING_PY });
const vStale = await verify(stale, { entry: 'main.py' });
await test('(known) an explicit entry overrides a leftover index.html', () => {
  assert.equal(vStale.kind, 'python', 'kind was ' + vStale.kind + ' - the entry was ignored');
});
await test('(known) so a crashing Python entry is not reported as a pass', () => {
  assert.equal(vStale.ok, false, 'passed on the strength of an index.html this goal never touched');
});

// ── controls: told which file the goal is about, the machinery is right ──
const plain = ws({ 'package.json': MARKER, 'main.py': CRASHING_PY });
const vPlain = await verify(plain, { entry: 'main.py' });
await test('control: with an entry and no index.html, the Python crash IS reported', () => {
  assert.equal(vPlain.ok, false, 'evidence: ' + JSON.stringify(vPlain.evidence).slice(0, 200));
  assert.match(JSON.stringify(vPlain.problems), /main\.py/, JSON.stringify(vPlain.problems).slice(0, 300));
});
const jsOnly = ws({ 'package.json': MARKER, 'app.js': PASSING_JS });
await test('control: a genuine Node project is still detected as Node', () => {
  assert.equal(detectKind(jsOnly).kind, 'node');
});
const webReal = ws({ 'package.json': MARKER, 'index.html': '<!doctype html><title>real</title>' });
await test('control: a real web project is still detected as web', () => {
  assert.equal(detectKind(webReal).kind, 'web');
});

const KNOWN_EXPECTED = 3;   // bugs known open today; see the header for what and why
console.log(`\n${passed} passed, ${failed} failed, ${known} known-open`);
// The one line the suite runner greps, so a green file can never hide an open bug in the summary.
console.log(`KNOWN-OPEN: ${known} of ${KNOWN_EXPECTED} expected`);
if (openCases.length) console.log('  still open: ' + openCases.join(' | '));
// A count that DROPS means a case labelled "(known)" now passes - the label is a lie and the test is claiming
// a bug is open that is not. A count that RISES means a new failure hid behind the label. Both fail the file.
if (known !== KNOWN_EXPECTED) {
  console.error(`  FAIL  known-open count changed: ${known}, expected ${KNOWN_EXPECTED}`
    + (known > KNOWN_EXPECTED ? ' - a NEW failure is hiding behind the "(known)" label'
      : ' - a "(known)" case now PASSES; fix the expectation and the header, or drop the label'));
  failed++;
}
process.exit(failed ? 1 : 0);
