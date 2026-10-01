/**
 * fg1.probe.mjs - FG-1: which finish-gate defects from fatal-09 are LIVE on candidate-0?
 *
 *   node server/fg1.probe.mjs
 *
 * CHARACTERIZATION ONLY. Frozen in legasus/screen/FG-1_PREREG.md before this file existed. Nothing is
 * repaired. verifyProject.verify() is called as shipped; the gate's entry selection is reproduced
 * VERBATIM from agent.js branch 4 (it lives inside drive(), which cannot run without the hub); and
 * whether branch 4 carries a landed-writes predicate is READ from agent.js's source, not assumed.
 *
 * Every row records the boundary it belongs to (ADMISSION / SCOPE / SUBJECT / RECEIPT), per the prereg.
 * The controls F6+/F6- must hold or the run says nothing.
 */
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openRun, EVIDENCE_CLASS } from './evidenceRun.mjs';
import * as verifier from './verifyProject.js';
import { namedFiles } from './taskLedger.js';
import { cid1 } from './cid1.mjs';

const REPO = process.cwd();
const run = openRun({ root: join(REPO, 'legasus', 'evidence-runs'), label: 'FG-1-UNREPAIRED', command: 'node server/fg1.probe.mjs',
  repo: REPO, evidenceClass: EVIDENCE_CLASS.ORIGINAL, note: 'FG-1 characterization of the finish gate on candidate-0. Nothing repaired.' });
const log = []; const say = (s) => { console.log(s); log.push(s); };
const temps = [];
function ws(files) { const d = mkdtempSync(join(tmpdir(), 'fg1-')); temps.push(d); writeFileSync(join(d, 'package.json'), '{"name":"w"}\n');
  for (const [f, b] of Object.entries(files)) { mkdirSync(join(d, f, '..'), { recursive: true }); writeFileSync(join(d, f), b); } return d; }
/** VERBATIM from agent.js branch 4: the gate's entry selection. */
const goalEntryOf = (WORKSPACE, goal) => namedFiles(goal || '').find((f) => /\.(py|c?js|mjs)$/i.test(f) && existsSync(join(WORKSPACE, f)));
async function gate(d, goal) { const entry = goalEntryOf(d, goal); const v = await verifier.verify(d, { entry, goal }); return { entry: entry ?? null, ok: v.ok, kind: v.kind, evidence: v.evidence, problems: v.problems }; }
const LIB = 'class Library { constructor(){ this.books=[]; } addBook(b){ this.books.push(b); } copies(){ return this.books.length; } }\nmodule.exports = Library;\n';
const LIB_DONE = LIB.replace('copies(){ return this.books.length; }', 'copies(){ return this.books.length; } checkout(isbn, member){ return true; } available(isbn){ return true; }');
const GOAL1 = 'Add checkout(isbn, member) and available(isbn) to the EXISTING Library in s1_library.js.';
const rows = [];
const rec = (id, boundary, label, r) => { rows.push({ id, boundary, label, ...r }); say(`  ${id.padEnd(4)} ${boundary.padEnd(10)} ${label.padEnd(44)} ${r.outcome}`); for (const n of r.notes || []) say(`       ${n}`); };
const short = (a) => (a || []).map((s) => String(s).replace(/\s+/g, ' ').slice(0, 110));

try {
  say(`FG-1 UNREPAIRED   EH1 ${run.id}`);
  let py = true; try { execFileSync('python', ['-c', 'import pytest'], { stdio: 'ignore', windowsHide: true }); } catch { py = false; }

  // F6+ positive control: the goal is genuinely done -> Verified
  { const d = ws({ 's1_library.js': LIB_DONE }); const g = await gate(d, GOAL1);
    rec('F6+', 'control', 'complete goal, file has checkout/available', { outcome: g.ok ? 'HOLDS (Verified)' : 'CONTROL FAILED (blocked)', ...g, notes: short(g.evidence).concat(short(g.problems)) }); }
  // F6- negative control: the goal's OWN file crashes on load -> blocked
  { const d = ws({ 's1_library.js': "throw new Error('boom');\n" }); const g = await gate(d, GOAL1);
    rec('F6-', 'control', "the goal's own file throws on load", { outcome: !g.ok ? 'HOLDS (blocked)' : 'CONTROL FAILED (Verified over a crashing file)', ...g, notes: short(g.problems) }); }

  // F1 ADMISSION: zero landed writes; the file exists, loads, lacks the goal (8e7cf9aa shape)
  { const d = ws({ 's1_library.js': LIB }); const g = await gate(d, GOAL1);
    const src = readFileSync(join(REPO, 'server', 'agent.js'), 'utf8');
    const b4 = src.slice(src.indexOf('const goalEntry = ledger.namedFiles'), src.indexOf("pushStep(run, { type: 'note', text: `Verified ("));
    const hasWritesPredicate = /landed|writes|mutat/i.test(b4);
    rec('F1', 'ADMISSION', 'zero landed writes, file loads, goal absent', { outcome: g.ok ? 'LIVE: Verified with nothing judged' : 'NOT LIVE (blocked)', ...g, hasWritesPredicateInBranch4: hasWritesPredicate,
      notes: short(g.evidence).concat([`agent.js branch 4 carries a landed-writes predicate: ${hasWritesPredicate}`, `file contains checkout: ${/checkout/.test(LIB)}`]) }); }

  // F2 SCOPE: the goal's file is clean; an unparseable leftover elsewhere
  { const d = ws({ 's2.js': 'function greet(n){ return "hi " + n; }\nmodule.exports = { greet };\n', 'junk.js': 'function (\n' }); const g = await gate(d, 'Add greet(name) to s2.js returning a greeting.');
    const groundedInJunk = (g.problems || []).some((p) => /junk\.js/.test(p)); const mentionsS2 = (g.problems || []).some((p) => /s2\.js/.test(p));
    rec('F2', 'SCOPE', 'clean goal file, unparseable leftover junk.js', { outcome: !g.ok && groundedInJunk && !mentionsS2 ? 'LIVE: blocked on a file the goal never named' : g.ok ? 'NOT LIVE (finished)' : 'blocked for another reason', ...g, notes: short(g.problems) }); }

  // F3 SCOPE: python goal, own file + own test pass, an unrelated test fails
  if (!py) rec('F3', 'SCOPE', 'python: unrelated failing test_other.py', { outcome: 'NOT_RUNNABLE (no python/pytest on this host)' });
  else { const d = ws({ 's3_calc.py': 'def add(a, b):\n    return a + b\n', 'test_s3_calc.py': 'from s3_calc import add\ndef test_add():\n    assert add(1, 2) == 3\n', 'test_other.py': 'def test_broken():\n    assert False\n' });
    const g = await gate(d, 'Add add(a, b) to s3_calc.py.');
    const groundedInOther = (g.problems || []).some((p) => /test_other/.test(p));
    rec('F3', 'SCOPE', 'python: unrelated failing test_other.py', { outcome: !g.ok && groundedInOther ? 'LIVE: blocked by a test the goal never named' : g.ok ? 'NOT LIVE (finished)' : 'blocked for another reason', ...g, notes: short(g.problems) }); }

  // F4 SUBJECT: the named target was never written; the entry falls through to another named file
  { const d = ws({ 's1_library.js': LIB_DONE, 's7_cache.js': 'module.exports = {};\n' }); const goal = 'Add desk() to s10_desk.js, using s1_library.js and s7_cache.js.';
    const g = await gate(d, goal);
    rec('F4', 'SUBJECT', 'target s10_desk.js missing; entry falls through', { outcome: g.entry !== 's10_desk.js' && g.ok ? `LIVE: Verified on ${g.entry}, a file the goal did not ask to create` : g.ok ? 'finished on the right file?' : 'NOT LIVE (blocked)', ...g, notes: [`entry chosen: ${g.entry}`].concat(short(g.evidence)) }); }

  // F5 RECEIPT: what does a Verified note name? (taken from F6+)
  { const f6 = rows.find((r) => r.id === 'F6+'); const ev = (f6.evidence || []).join('; ');
    const namesEntry = /s1_library\.js/.test(ev), namesSet = /\b(s1_library\.js|package\.json)\b.*\b(and|,)\b/.test(ev) && false, namesIdentity = /cid1:|[0-9a-f]{40}/.test(ev);
    rec('F5', 'RECEIPT', 'does the Verified note name what was judged?', { outcome: `names entry: ${namesEntry}; names the swept SET: ${namesSet} (a count only); names an identity: ${namesIdentity}`, evidence: f6.evidence, cid1OfJudged: cid1(temps[0]).id }); }

  const live = rows.filter((r) => /^LIVE/.test(r.outcome)).map((r) => r.id);
  const controls = rows.find((r) => r.id === 'F6+').outcome.startsWith('HOLDS') && rows.find((r) => r.id === 'F6-').outcome.startsWith('HOLDS');
  say(`\n=== FG-1 UNREPAIRED ===\n    controls hold: ${controls}\n    LIVE on candidate-0: ${live.join(', ') || 'none'}\n    by boundary: ${['ADMISSION', 'SCOPE', 'SUBJECT'].map((b) => `${b}=${rows.filter((r) => r.boundary === b && /^LIVE/.test(r.outcome)).map((r) => r.id).join('+') || '-'}`).join('  ')}`);
  run.artifact('fg1.log', log.join('\n') + '\n'); run.artifact('result.json', { rows, live, controls, pythonAvailable: py });
  const s = run.seal({ exitStatus: 0 }); console.log(`EH1 sealed: ${s.state}  ${run.dir}`);
} catch (e) {
  say(`APPARATUS FAILURE: ${e.stack || e}`); try { run.artifact('fg1.log', log.join('\n') + '\n'); run.abandon({ reason: String(e.message).slice(0, 300) }); } catch {}
  process.exitCode = 1;
} finally { for (const d of temps) { try { rmSync(d, { recursive: true, force: true }); } catch {} } console.log('NOTHING WAS REPAIRED.'); }
