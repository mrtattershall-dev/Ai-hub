/**
 * fg2.probe.mjs - FG-2 SCOPE: is a finish block grounded only in the goal's files and their dependencies?
 *
 *   FG2_PHASE=before node server/fg2.probe.mjs     (unrepaired verify() - F2/F3 MUST be blocked on unrelated files)
 *   FG2_PHASE=after  node server/fg2.probe.mjs
 *
 * Frozen in legasus/screen/FG-2-SCOPE_PREREG.md before this file existed. verify() and format() called as
 * shipped; the gate's entry selection reproduced verbatim from agent.js branch 4. Repairs nothing itself.
 */
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openRun, EVIDENCE_CLASS } from './evidenceRun.mjs';
import * as verifier from './verifyProject.js';
import { namedFiles } from './taskLedger.js';

const PHASE = process.env.FG2_PHASE; if (!['before', 'after'].includes(PHASE)) throw new Error('set FG2_PHASE=before|after');
const REPO = process.cwd();
const run = openRun({ root: join(REPO, 'legasus', 'evidence-runs'), label: `FG-2-SCOPE-${PHASE.toUpperCase()}`, command: `FG2_PHASE=${PHASE} node server/fg2.probe.mjs`,
  repo: REPO, evidenceClass: EVIDENCE_CLASS.ORIGINAL, note: `FG-2 SCOPE ${PHASE} the verify() repair.` });
const log = []; const say = (s) => { console.log(s); log.push(s); };
const temps = [];
function ws(files) { const d = mkdtempSync(join(tmpdir(), 'fg2-')); temps.push(d); writeFileSync(join(d, 'package.json'), '{"name":"w"}\n');
  for (const [f, b] of Object.entries(files)) { mkdirSync(join(d, f, '..'), { recursive: true }); writeFileSync(join(d, f), b); } return d; }
const goalEntryOf = (W, goal) => namedFiles(goal || '').find((f) => /\.(py|c?js|mjs)$/i.test(f) && existsSync(join(W, f)));   // VERBATIM agent.js branch 4
async function gate(d, goal) { const entry = goalEntryOf(d, goal); const v = await verifier.verify(d, { entry, goal }); return { entry: entry ?? null, ...v, rendered: verifier.format(v) }; }
const LIB = 'class Library { constructor(){ this.books=[]; } addBook(b){ this.books.push(b); } copies(){ return this.books.length; } }\nmodule.exports = Library;\n';
const LIB_DONE = LIB.replace('copies(){ return this.books.length; }', 'copies(){ return this.books.length; } checkout(i,m){ return true; } available(i){ return true; }');
const GOAL1 = 'Add checkout(isbn, member) and available(isbn) to the EXISTING Library in s1_library.js.';
const mentions = (arr, re) => (arr || []).some((p) => re.test(String(p)));
const rows = []; const rec = (id, label, r) => { rows.push({ id, label, ...r }); say(`  ${id.padEnd(4)} ${label.padEnd(50)} ${r.outcome}`); for (const n of r.notes || []) say(`       ${String(n).replace(/\s+/g, ' ').slice(0, 120)}`); };

try {
  say(`FG-2 SCOPE ${PHASE.toUpperCase()}   EH1 ${run.id}`);
  // F2: clean goal file, unparseable leftover
  { const d = ws({ 's2.js': 'function greet(n){ return "hi " + n; }\nmodule.exports = { greet };\n', 'junk.js': 'function (\n' }); const g = await gate(d, 'Add greet(name) to s2.js returning a greeting.');
    const noteNamesJunk = mentions(g.notes, /junk\.js/) && /junk\.js/.test(g.rendered);
    rec('F2', 'clean goal file; unparseable junk.js elsewhere', { outcome: !g.ok && mentions(g.problems, /junk\.js/) ? 'BLOCKED on junk.js (red)' : g.ok && noteNamesJunk ? 'Verified; NOTE names junk.js' : g.ok ? 'Verified but the leftover is SILENT - VIOLATION (F9)' : 'blocked for another reason', ok: g.ok, problems: g.problems, notes: g.notes ?? null, rendered: g.rendered }); }
  // F3: python, own file + test pass, unrelated test fails
  { const d = ws({ 's3_calc.py': 'def add(a, b):\n    return a + b\n', 'test_s3_calc.py': 'from s3_calc import add\ndef test_add():\n    assert add(1, 2) == 3\n', 'test_other.py': 'def test_broken():\n    assert False\n' });
    const g = await gate(d, 'Add add(a, b) to s3_calc.py.'); const noteNamesOther = mentions(g.notes, /test_other/) && /test_other/.test(g.rendered);
    rec('F3', 'python: own test passes; unrelated test_other.py fails', { outcome: !g.ok && mentions(g.problems, /test_other|pytest/) ? 'BLOCKED by whole-workspace pytest (red)' : g.ok && noteNamesOther ? 'Verified; NOTE names test_other.py' : g.ok ? 'Verified but the failing test is SILENT - VIOLATION (F9)' : 'blocked for another reason', ok: g.ok, problems: g.problems, notes: g.notes ?? null, evidence: g.evidence }); }
  // F6-: own file throws
  { const d = ws({ 's1_library.js': "throw new Error('boom');\n" }); const g = await gate(d, GOAL1); rec('F6-', "control: the goal's OWN file throws on load", { outcome: !g.ok ? 'blocked (holds)' : 'CONTROL FAILED: Verified over a crashing file', problems: g.problems }); }
  // F7: the goal's file requires ./util.js which throws
  { const d = ws({ 's2.js': "const u = require('./util');\nmodule.exports = { greet: (n) => u.hi(n) };\n", 'util.js': "throw new Error('util is broken');\n" }); const g = await gate(d, 'Add greet(name) to s2.js.');
    rec('F7', 'the goal file REQUIRES util.js, which throws', { outcome: !g.ok ? 'blocked (holds: the closure reaches util.js)' : 'VERIFIED - closure MISSED a dependency - REPAIR REJECTED', problems: g.problems, notes: g.notes ?? null }); }
  // F7p: python: s3_calc imports helper; helper's own test fails
  { const d = ws({ 's3_calc.py': 'from helper import h\ndef add(a, b):\n    return h(a) + b\n', 'helper.py': 'def h(x):\n    return x\n', 'test_s3_calc.py': 'from s3_calc import add\ndef test_add():\n    assert add(1, 2) == 3\n', 'test_helper.py': 'from helper import h\ndef test_h():\n    assert h(1) == 2\n' });
    const g = await gate(d, 'Add add(a, b) to s3_calc.py.'); rec('F7p', "python: a dependency's test (test_helper.py) fails", { outcome: !g.ok && mentions(g.problems, /test_helper|pytest/) ? 'blocked (holds: helper is in scope)' : g.ok ? 'VERIFIED - scoped tests MISSED the dependency - REPAIR REJECTED' : 'blocked for another reason', problems: g.problems }); }
  // F8: goal names no file; a broken file anywhere
  { const d = ws({ 'x.js': 'module.exports = 1;\n', 'junk.js': 'function (\n' }); const g = await gate(d, 'Make the project better.');
    rec('F8', 'goal names NO file; broken junk.js', { outcome: !g.ok ? 'blocked (holds: whole workspace is the scope)' : 'VERIFIED - the no-file case lost its scope - REPAIR REJECTED', problems: g.problems }); }
  // F1 ADMISSION and F4 SUBJECT must stay red
  { const d = ws({ 's1_library.js': LIB }); const g = await gate(d, GOAL1); rec('F1', 'ADMISSION: zero writes, goal absent (must stay red)', { outcome: g.ok ? 'STILL VERIFIED (red, as frozen)' : 'turned green - SCOPE leaked into ADMISSION', ok: g.ok }); }
  { const d = ws({ 's1_library.js': LIB_DONE, 's7_cache.js': 'module.exports = {};\n' }); const g = await gate(d, 'Add desk() to s10_desk.js, using s1_library.js and s7_cache.js.'); rec('F4', 'SUBJECT: target missing, entry falls through (must stay red)', { outcome: g.ok && g.entry !== 's10_desk.js' ? `STILL VERIFIED on ${g.entry} (red, as frozen)` : 'changed - SCOPE leaked into SUBJECT', ok: g.ok, entry: g.entry }); }
  { const d = ws({ 's1_library.js': LIB_DONE }); const g = await gate(d, GOAL1); rec('F6+', 'control: complete goal', { outcome: g.ok ? 'Verified (holds)' : 'CONTROL FAILED (blocked)', problems: g.problems }); }

  const by = Object.fromEntries(rows.map((r) => [r.id, r])); const o = (id) => by[id].outcome;
  const verdict = PHASE === 'before'
    ? { mustFire: /BLOCKED/.test(o('F2')) && /BLOCKED/.test(o('F3')), controls: /holds/.test(o('F6-')) && /holds/.test(o('F6+')) && /holds/.test(o('F7')) && /holds/.test(o('F7p')) && /holds/.test(o('F8')) }
    : { f2f3Green: /NOTE names/.test(o('F2')) && /NOTE names/.test(o('F3')), closureGuards: /holds/.test(o('F7')) && /holds/.test(o('F7p')), noFileCase: /holds/.test(o('F8')), controls: /holds/.test(o('F6-')) && /holds/.test(o('F6+')), f1f4StillRed: /STILL VERIFIED/.test(o('F1')) && /STILL VERIFIED/.test(o('F4')) };
  say(`\n=== FG-2 SCOPE ${PHASE.toUpperCase()} ===`); for (const [k, v] of Object.entries(verdict)) say(`    ${k.padEnd(14)} ${v}`);
  run.artifact('fg2.log', log.join('\n') + '\n'); run.artifact('result.json', { phase: PHASE, rows, verdict });
  const s = run.seal({ exitStatus: 0 }); console.log(`EH1 sealed: ${s.state}  ${run.dir}`);
} catch (e) { say(`APPARATUS FAILURE: ${e.stack || e}`); try { run.artifact('fg2.log', log.join('\n') + '\n'); run.abandon({ reason: String(e.message).slice(0, 300) }); } catch {} process.exitCode = 1; }
finally { for (const d of temps) { try { rmSync(d, { recursive: true, force: true }); } catch {} } }
