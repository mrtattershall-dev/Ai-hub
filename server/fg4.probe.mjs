/**
 * fg4.probe.mjs - FG-4 SUBJECT: does the gate judge the file the goal names, or refuse?
 *
 *   FG4_PHASE=before node server/fg4.probe.mjs     (unrepaired agent.js - S0 and S5 MUST show the fall-through)
 *   FG4_PHASE=after  node server/fg4.probe.mjs
 *
 * Frozen in legasus/screen/FG-4-SUBJECT_PREREG.md (80174bbe) before this file existed. S0 reproduces the
 * shipped selection line VERBATIM for the record; S1-S4 measure the pure goalEntry() (unwired in BEFORE,
 * like cid1 was); S5/S6 drive the REAL hub as finishGateHost.test does. Repairs nothing.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openRun, EVIDENCE_CLASS } from './evidenceRun.mjs';
import { namedFiles } from './taskLedger.js';
import { goalEntry } from './goalEntry.mjs';

const PHASE = process.env.FG4_PHASE; if (!['before', 'after'].includes(PHASE)) throw new Error('set FG4_PHASE=before|after');
const HERE = dirname(fileURLToPath(import.meta.url));
const { scratch, startHub, freePorts } = await import('./testHarness.mjs');
const REPO = process.cwd();
const run = openRun({ root: join(REPO, 'legasus', 'evidence-runs'), label: `FG-4-SUBJECT-${PHASE.toUpperCase()}`, command: `FG4_PHASE=${PHASE} node server/fg4.probe.mjs`,
  repo: REPO, evidenceClass: EVIDENCE_CLASS.ORIGINAL, note: `FG-4 SUBJECT ${PHASE} the agent.js repair.` });
const log = []; const say = (s) => { console.log(s); log.push(s); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const temps = [];
const LIB = 'class Library { constructor(){ this.books=[]; } addBook(b){ this.books.push(b); } copies(){ return this.books.length; } }\nmodule.exports = Library;\n';
const LIB_DONE = LIB.replace('copies(){ return this.books.length; }', 'copies(){ return this.books.length; } checkout(i,m){ return true; } available(i){ return true; }');
const GOAL_S10 = 'Add desk() to s10_desk.js, using s1_library.js and s7_cache.js.';
const rows = []; const rec = (id, label, r) => { rows.push({ id, label, ...r }); say(`  ${id.padEnd(4)} ${label.padEnd(54)} ${r.outcome}`); };
const PLAN = (f) => `1. WHAT IT DOES - ${f}\n2. FILES - ${f}\n3. BUILD ORDER - edit\n4. HOW TO VERIFY - run`;
const FINISH = 'THOUGHT: Done.\nACTION: finish\nTEXT:\nok';
const WRITE = (p, body, lang) => `THOUGHT: writing ${p}.\nACTION: write_file\nPATH: ${p}\n\`\`\`${lang}\n${body}\n\`\`\``;
async function drive(label, files, goal, replies, env = { AGENT_BOUND_ROUTES: '', AGENT_WORKER_EXEC: '' }) {
  const [hubPort, fakePort] = await freePorts(2);
  const dir = scratch(`fg4-${label}`, { baseUrl: `http://127.0.0.1:${fakePort}`, model: 'fake' }); temps.push(dir);
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
const texts = (r) => (r?.steps || []).map((s) => String(s.text || ''));
const summarize = (r) => ({ status: r?.status ?? null, finishKind: r?.finishKind ?? null, finishBlocks: r?.finishBlocks ?? 0,
  verifiedNote: texts(r).find((t) => /^Verified \(/.test(t)) ?? null, missingBlock: texts(r).find((t) => /s10_desk\.js.*does not exist|does not exist.*s10_desk\.js/i.test(t)) ?? null });

try {
  say(`FG-4 SUBJECT ${PHASE.toUpperCase()}   EH1 ${run.id}`);
  // S0: the shipped line, verbatim, on the F4 workspace - for the record in both phases
  { const have = new Set(['s1_library.js', 's7_cache.js']); const shipped = namedFiles(GOAL_S10).find((f) => /\.(py|c?js|mjs)$/i.test(f) && have.has(f));
    rec('S0', 'shipped .find(exists) on the F4 workspace (verbatim)', { outcome: shipped === 's1_library.js' ? 'falls through to s1_library.js (the defect, as a reference)' : `selects ${shipped}`, shipped }); }
  // S1-S4: the pure function
  const fs = (...have) => (f) => have.includes(f);
  { const g = goalEntry(GOAL_S10, fs('s1_library.js', 's7_cache.js')); rec('S1', 'goalEntry: named target missing', { outcome: g.missing === 's10_desk.js' && g.entry === undefined ? 'REFUSES: missing=s10_desk.js' : `other ${JSON.stringify(g)}`, ...g }); }
  { const g = goalEntry('Add checkout() to s1_library.js.', fs('s1_library.js')); rec('S2', 'goalEntry: one named file, exists', { outcome: g.entry === 's1_library.js' ? 'entry=s1_library.js (holds)' : `other ${JSON.stringify(g)}` }); }
  { const g = goalEntry('Remove old.js and update index.js.', fs('index.js')); rec('S3', 'goalEntry: remove-goal, old.js absent', { outcome: g.entry === 'index.js' && !g.missing ? 'entry=index.js (exception holds)' : `other ${JSON.stringify(g)}` }); }
  { const g = goalEntry('Make the library better.', fs('s1_library.js')); rec('S4', 'goalEntry: no named code file', { outcome: g.entry === undefined && !g.missing ? 'no entry, no refusal (holds)' : `other ${JSON.stringify(g)}` }); }
  // S5: hub - the model writes s1_library.js (so ADMISSION is satisfied) and finishes; s10_desk.js never exists
  { const r = await drive('s5', { 's1_library.js': LIB, 's7_cache.js': 'module.exports = {};\n' }, GOAL_S10, [PLAN('s10_desk.js'), WRITE('s1_library.js', LIB_DONE, 'javascript'), FINISH, FINISH, FINISH, FINISH]); const s = summarize(r);
    rec('S5', 'hub: target never written; model writes s1 and finishes', { outcome: s.verifiedNote ? `VERIFIED on the fall-through file (red): ${s.verifiedNote.slice(0, 60)}` : s.missingBlock ? `blocked: names s10_desk.js as missing (${s.finishBlocks} blocks, status ${s.status}, finishKind ${s.finishKind})` : `other ${JSON.stringify(s)}`, ...s }); }
  // S6: hub - the model writes the named target
  { const r = await drive('s6', { 's1_library.js': LIB, 's7_cache.js': 'module.exports = {};\n' }, GOAL_S10, [PLAN('s10_desk.js'), WRITE('s10_desk.js', "const L = require('./s1_library'); module.exports = { desk: () => new L().copies() };\n", 'javascript'), FINISH, FINISH]); const s = summarize(r);
    rec('S6', 'hub: model writes s10_desk.js, then finishes', { outcome: s.verifiedNote && /s10_desk\.js/.test(s.verifiedNote) ? 'Verified on s10_desk.js (holds)' : `other ${JSON.stringify(s)}`, ...s }); }

  const by = Object.fromEntries(rows.map((r) => [r.id, r])); const o = (id) => by[id]?.outcome || '';
  const verdict = PHASE === 'before'
    ? { mustFire: /falls through/.test(o('S0')) && /VERIFIED on the fall-through/.test(o('S5')), pureHolds: /REFUSES/.test(o('S1')) && /holds/.test(o('S2')) && /holds/.test(o('S3')) && /holds/.test(o('S4')), s6: /holds/.test(o('S6')) }
    : { s5Refuses: /blocked: names s10_desk\.js/.test(o('S5')) && !/VERIFIED/.test(o('S5')), pureHolds: /REFUSES/.test(o('S1')) && /holds/.test(o('S2')) && /holds/.test(o('S3')) && /holds/.test(o('S4')), s6: /holds/.test(o('S6')) };
  say(`\n=== FG-4 SUBJECT ${PHASE.toUpperCase()} ===`); for (const [k, x] of Object.entries(verdict)) say(`    ${k.padEnd(10)} ${x}`);
  run.artifact('fg4.log', log.join('\n') + '\n'); run.artifact('result.json', { phase: PHASE, rows, verdict });
  const s = run.seal({ exitStatus: 0 }); console.log(`EH1 sealed: ${s.state}  ${run.dir}`);
} catch (e) { say(`APPARATUS FAILURE: ${e.stack || e}`); try { run.artifact('fg4.log', log.join('\n') + '\n'); run.abandon({ reason: String(e.message).slice(0, 300) }); } catch {} process.exitCode = 1; }
finally { for (const d of temps) { try { rmSync(d, { recursive: true, force: true }); } catch {} } }
