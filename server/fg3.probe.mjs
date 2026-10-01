/**
 * fg3.probe.mjs - FG-3 ADMISSION: is a `Verified` finish a receipt for work that happened?
 *
 *   FG3_PHASE=before node server/fg3.probe.mjs     (unrepaired - A1 and A5 MUST show Verified with zero writes)
 *   FG3_PHASE=after  node server/fg3.probe.mjs
 *
 * Frozen in legasus/screen/FG-3-ADMISSION_PREREG.md (e872f0ba) before this file existed. A1-A4 call
 * verify() directly. A5-A7 drive the REAL hub exactly as finishGateHost.test does: a scripted model
 * (fakemodel.mjs), startHub, unbounded so the host verifier runs. Repairs nothing.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, mkdtempSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { openRun, EVIDENCE_CLASS } from './evidenceRun.mjs';
import * as verifier from './verifyProject.js';
import { namedFiles } from './taskLedger.js';

const PHASE = process.env.FG3_PHASE; if (!['before', 'after'].includes(PHASE)) throw new Error('set FG3_PHASE=before|after');
const HERE = dirname(fileURLToPath(import.meta.url));
const { scratch, startHub, freePorts } = await import('./testHarness.mjs');
const REPO = process.cwd();
const run = openRun({ root: join(REPO, 'legasus', 'evidence-runs'), label: `FG-3-ADMISSION-${PHASE.toUpperCase()}`, command: `FG3_PHASE=${PHASE} node server/fg3.probe.mjs`,
  repo: REPO, evidenceClass: EVIDENCE_CLASS.ORIGINAL, note: `FG-3 ADMISSION ${PHASE} the repair.` });
const log = []; const say = (s) => { console.log(s); log.push(s); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const temps = [];
const LIB = 'class Library { constructor(){ this.books=[]; } addBook(b){ this.books.push(b); } copies(){ return this.books.length; } }\nmodule.exports = Library;\n';
const LIB_DONE = LIB.replace('copies(){ return this.books.length; }', 'copies(){ return this.books.length; } checkout(i,m){ return true; } available(i){ return true; }');
const GOAL1 = 'Add checkout(isbn, member) and available(isbn) to the EXISTING Library in s1_library.js.';
const rows = []; const rec = (id, label, r) => { rows.push({ id, label, ...r }); say(`  ${id.padEnd(4)} ${label.padEnd(52)} ${r.outcome}`); for (const n of r.notes || []) say(`       ${String(n).replace(/\s+/g, ' ').slice(0, 130)}`); };

// ── verify()-level ─────────────────────────────────────────────────────────────────────────────
function wsDir(files) { const d = mkdtempSync(join(tmpdir(), 'fg3-')); temps.push(d); writeFileSync(join(d, 'package.json'), '{"name":"w"}\n'); for (const [f, b] of Object.entries(files)) writeFileSync(join(d, f), b); return d; }
const goalEntryOf = (W, goal) => namedFiles(goal || '').find((f) => /\.(py|c?js|mjs)$/i.test(f) && existsSync(join(W, f)));   // VERBATIM agent.js branch 4
async function v(d, goal, extra) { const v0 = await verifier.verify(d, { entry: goalEntryOf(d, goal), goal, ...extra }); return v0; }

// ── hub-level: the finishGateHost.test drive(), with the workspace and replies as parameters ──────
const PLAN = (f) => `1. WHAT IT DOES - ${f}\n2. FILES - ${f}\n3. BUILD ORDER - edit\n4. HOW TO VERIFY - run`;
const FINISH = 'THOUGHT: Done.\nACTION: finish\nTEXT:\nok';
const WRITE = (p, body, lang) => `THOUGHT: writing ${p}.\nACTION: write_file\nPATH: ${p}\n\`\`\`${lang}\n${body}\n\`\`\``;
async function drive(label, files, goal, replies, env = { AGENT_BOUND_ROUTES: '', AGENT_WORKER_EXEC: '' }) {
  const [hubPort, fakePort] = await freePorts(2);
  const dir = scratch(`fg3-${label}`, { baseUrl: `http://127.0.0.1:${fakePort}`, model: 'fake' }); temps.push(dir);
  const ws = join(dir, 'workspace'); mkdirSync(ws, { recursive: true });
  for (const [f, b] of Object.entries(files)) writeFileSync(join(ws, f), b, 'utf8');
  const rf = join(dir, 'replies.json'); writeFileSync(rf, JSON.stringify(replies), 'utf8');
  const fake = spawn(process.execPath, [join(HERE, 'fakemodel.mjs'), '--port', String(fakePort), '--replies', rf], { stdio: 'ignore', env: process.env });
  let hub = null;
  try {
    const started = await startHub(dir, { port: hubPort, env: { AGENT_APPROVAL_MODE: 'build', ...env } }); hub = started.hub;
    const { runId } = await started.api('/agent/start', { method: 'POST', body: JSON.stringify({ goal }) });
    let r = null; for (let i = 0; i < 160; i++) { r = await started.api(`/agent/${runId}`).catch(() => null); if (r && r.status !== 'running' && !r.busy) break; await sleep(500); }
    return r;
  } finally { try { hub && hub.kill('SIGKILL'); } catch {} try { fake.kill('SIGKILL'); } catch {} }
}
const landed = (r) => (r?.steps || []).filter((s) => s.type === 'tool' && /^(write_file|edit_file|append_file)$/.test(String(s.tool)) && /^OK/.test(String(s.result || ''))).length;   // VERBATIM agent.js ~5406
const texts = (r) => (r?.steps || []).map((s) => String(s.text || ''));
const summarize = (r) => ({ status: r?.status ?? null, finishKind: r?.finishKind ?? null, finishBlocks: r?.finishBlocks ?? 0, landedWrites: landed(r),
  verifiedNote: texts(r).some((t) => /^Verified \(/.test(t)), unverifiedNote: texts(r).find((t) => /Finished UNVERIFIED/.test(t)) ?? null,
  noWorkBlock: texts(r).find((t) => /no (successful )?write|nothing (on disk )?changed|landed/i.test(t) && /finish|goal/i.test(t)) ?? null });

try {
  say(`FG-3 ADMISSION ${PHASE.toUpperCase()}   EH1 ${run.id}`);
  { const d = wsDir({ 's1_library.js': LIB }); const r = await v(d, GOAL1, { landedWrites: 0 });
    rec('A1', 'verify(): add-goal, file lacks it, landedWrites=0', { outcome: r.ok ? 'VERIFIED with nothing judged (red)' : r.admission === 'NO_WORK' ? 'NOT ok, admission NO_WORK' : 'not ok, other reason', ok: r.ok, admission: r.admission ?? null, notes: r.problems }); }
  { const d = wsDir({ 's1_library.js': LIB_DONE }); const r = await v(d, GOAL1, { landedWrites: 1 });
    rec('A2', 'verify(): same goal, landedWrites=1', { outcome: r.ok ? 'ok (holds)' : 'BLOCKED - regression', ok: r.ok, notes: r.problems }); }
  { const d = wsDir({ 'm.py': 'def f():\n    return 42\n' }); const r = await v(d, 'Check that m.py returns 42 and report.', { landedWrites: 0 });
    rec('A3', 'verify(): check-and-report goal, landedWrites=0', { outcome: r.ok ? 'ok (holds: no mutating verb)' : 'BLOCKED - the rule over-applies', ok: r.ok, notes: r.problems }); }
  { const d = wsDir({ 's1_library.js': LIB }); const r = await v(d, GOAL1, {});
    rec('A4', 'verify(): landedWrites undefined (existing callers)', { outcome: r.ok ? 'ok (holds: rule not applied)' : 'BLOCKED - existing callers changed', ok: r.ok }); }

  // hub-level
  { const r = await drive('a5', { 's1_library.js': LIB }, GOAL1, [PLAN('s1_library.js'), FINISH, FINISH, FINISH]); const s = summarize(r);
    const before = s.verifiedNote && s.landedWrites === 0;
    const after = !s.verifiedNote && s.landedWrites === 0 && s.status === 'done' && s.finishKind === 'unverified-no-work' && !!s.unverifiedNote && !!s.noWorkBlock;
    rec('A5', 'hub: finish at once, twice; zero writes', { outcome: before ? 'VERIFIED with zero writes (red)' : after ? 'blocked once, then done UNVERIFIED (no work)' : `other: ${JSON.stringify(s)}`, ...s }); }
  { const r = await drive('a6', { 's1_library.js': LIB }, GOAL1, [PLAN('s1_library.js'), WRITE('s1_library.js', LIB_DONE, 'javascript'), FINISH, FINISH]); const s = summarize(r);
    rec('A6', 'hub: model writes the goal, then finishes', { outcome: s.verifiedNote && s.landedWrites >= 1 && s.status === 'done' ? 'Verified (holds)' : `other: ${JSON.stringify(s)}`, ...s }); }
  { const M = 'import platform\n\ndef f():\n    return 42\n'; const TEST = 'THOUGHT: Testing.\nACTION: run_python\nCODE:\n```python\nimport m\nprint(m.f())\n```';
    const r = await drive('a7', { 'm.py': M }, 'Check that m.py returns 42 and report.', [PLAN('m.py'), TEST, FINISH]); const s = summarize(r);
    rec('A7', "hub: finishGateHost's goal, zero writes (unbounded)", { outcome: s.verifiedNote && s.status === 'done' ? 'Verified (holds)' : `other: ${JSON.stringify(s)}`, ...s }); }
  // A8 (Amendment 1): the goal's own file CRASHES and zero writes land - must stay BLOCKED, never UNVERIFIED-yield
  { const r = await drive('a8', { 'q8_units.py': 'def units(n):\n    return n * 2\n\n\nassert units(2) == 5, "units wrong"\n' }, 'Add units(n) to q8_units.py and make it correct.', [PLAN('q8_units.py'), FINISH, FINISH, FINISH]); const s = summarize(r);
    const ok8 = !s.verifiedNote && s.finishKind !== 'unverified-no-work' && s.finishBlocks >= 2;
    rec('A8', 'hub: own file crashes, zero writes, finish three times', { outcome: ok8 ? `stays BLOCKED (${s.finishBlocks} blocks, finishKind ${s.finishKind})` : `YIELDED - ${JSON.stringify(s)}`, ...s }); }
  // F4 must stay red
  { const d = wsDir({ 's1_library.js': LIB_DONE, 's7_cache.js': 'module.exports = {};\n' }); const goal = 'Add desk() to s10_desk.js, using s1_library.js and s7_cache.js.'; const r = await v(d, goal, { landedWrites: 1 });
    rec('F4', 'SUBJECT: target missing, entry falls through (must stay red)', { outcome: r.ok ? 'STILL VERIFIED on the fall-through file (red, as frozen)' : 'changed - ADMISSION leaked into SUBJECT', ok: r.ok }); }

  const by = Object.fromEntries(rows.map((r) => [r.id, r])); const o = (id) => by[id]?.outcome || '';
  const verdict = PHASE === 'before'
    ? { mustFire: /VERIFIED with nothing/.test(o('A1')) && /VERIFIED with zero/.test(o('A5')), controls: /holds/.test(o('A2')) && /holds/.test(o('A3')) && /holds/.test(o('A6')) && /holds/.test(o('A7')) }
    : { a1: /NO_WORK/.test(o('A1')), a5: /blocked once/.test(o('A5')), a8StaysBlocked: /stays BLOCKED/.test(o('A8')), controls: /holds/.test(o('A2')) && /holds/.test(o('A3')) && /holds/.test(o('A4')) && /holds/.test(o('A6')) && /holds/.test(o('A7')), f4StillRed: /STILL VERIFIED/.test(o('F4')) };
  say(`\n=== FG-3 ADMISSION ${PHASE.toUpperCase()} ===`); for (const [k, x] of Object.entries(verdict)) say(`    ${k.padEnd(10)} ${x}`);
  run.artifact('fg3.log', log.join('\n') + '\n'); run.artifact('result.json', { phase: PHASE, rows, verdict });
  const s = run.seal({ exitStatus: 0 }); console.log(`EH1 sealed: ${s.state}  ${run.dir}`);
} catch (e) { say(`APPARATUS FAILURE: ${e.stack || e}`); try { run.artifact('fg3.log', log.join('\n') + '\n'); run.abandon({ reason: String(e.message).slice(0, 300) }); } catch {} process.exitCode = 1; }
finally { for (const d of temps) { try { rmSync(d, { recursive: true, force: true }); } catch {} } }
