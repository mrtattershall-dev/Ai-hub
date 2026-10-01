/**
 * fg5.probe.mjs - FG-5 RECEIPT: does the Verified note name what was judged, and do the records agree?
 *
 *   FG5_PHASE=before node server/fg5.probe.mjs     (unrepaired - R1a/R1c MUST read 'ok'; R2 MUST lack `judged`)
 *   FG5_PHASE=after  node server/fg5.probe.mjs
 *
 * Frozen in legasus/screen/FG-5-RECEIPT_PREREG.md (b965558e) before this file existed. runIndex.mjs is a
 * SCRIPT (it exits on import), so R1 drives it through its CLI on a scratch index; tochat.mjs likewise on
 * a scratch results directory. R4-R6 drive the REAL hub as finishGateHost.test does and read the records
 * the harness isolates (AGENT_TRACES_DIR/traces.jsonl, RUN_INDEX). Repairs nothing.
 */
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync, mkdtempSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { openRun, EVIDENCE_CLASS } from './evidenceRun.mjs';
import * as verifier from './verifyProject.js';
import { identityOf } from './cid1.mjs';

const PHASE = process.env.FG5_PHASE; if (!['before', 'after'].includes(PHASE)) throw new Error('set FG5_PHASE=before|after');
const HERE = dirname(fileURLToPath(import.meta.url));
const { scratch, startHub, freePorts } = await import('./testHarness.mjs');
const REPO = process.cwd();
const run = openRun({ root: join(REPO, 'legasus', 'evidence-runs'), label: `FG-5-RECEIPT-${PHASE.toUpperCase()}`, command: `FG5_PHASE=${PHASE} node server/fg5.probe.mjs`,
  repo: REPO, evidenceClass: EVIDENCE_CLASS.ORIGINAL, note: `FG-5 RECEIPT ${PHASE} the repair.` });
const log = []; const say = (s) => { console.log(s); log.push(s); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const temps = []; const mk = (p) => { const d = mkdtempSync(join(tmpdir(), `fg5-${p}-`)); temps.push(d); return d; };
const rows = []; const rec = (id, label, r) => { rows.push({ id, label, ...r }); say(`  ${id.padEnd(4)} ${label.padEnd(56)} ${r.outcome}`); };
const LIB = 'class Library { constructor(){ this.books=[]; } addBook(b){ this.books.push(b); } copies(){ return this.books.length; } }\nmodule.exports = Library;\n';
const LIB_DONE = LIB.replace('copies(){ return this.books.length; }', 'copies(){ return this.books.length; } checkout(i,m){ return true; } available(i){ return true; }');
const GOAL1 = 'Add checkout(isbn, member) and available(isbn) to the EXISTING Library in s1_library.js.';

// ── R1: the record consumers, through their CLIs ───────────────────────────────────────────────
function indexVerdict(kind) {
  const d = mk('idx'); const f = join(d, 'run-index.jsonl');
  const row = { ts: Date.now(), id: 'r', status: 'done', goal: `probe ${kind ?? 'absent'}`, calls: 1, errorCount: 0, tokPerSec: null };
  if (kind !== undefined) row.finishKind = kind;
  writeFileSync(f, JSON.stringify(row) + '\n');
  const out = execFileSync(process.execPath, [join(HERE, 'runIndex.mjs')], { env: { ...process.env, RUN_INDEX: f }, encoding: 'utf8', windowsHide: true });
  const line = out.split('\n').find((l) => /probe /.test(l)) || '';
  const m = line.match(/done\s+(\S+)/); return { verdict: m ? m[1] : null, line: line.trim() };
}
function tochatSkip(kind, blocks) {
  const d = mk('tc'); writeFileSync(join(d, 'x.run.json'), JSON.stringify({ status: 'done', finishBlocks: blocks, finishKind: kind, history: [], steps: [] }));
  writeFileSync(join(d, 'results.jsonl'), JSON.stringify({ pass: true, runFile: 'x.run.json', finishBlocks: blocks, forcedFinish: false, finishKind: kind }) + '\n');
  const out = execFileSync(process.execPath, [join(REPO, 'training-data', 'factory', 'tochat.mjs'), d, '--out', join(d, 'out.jsonl')], { encoding: 'utf8', windowsHide: true });
  return (out.match(/left out: (.*)/) || [])[1] || out.trim();
}

// ── hub drive (finishGateHost.test's shape) ────────────────────────────────────────────────────
const PLAN = (f) => `1. WHAT IT DOES - ${f}\n2. FILES - ${f}\n3. BUILD ORDER - edit\n4. HOW TO VERIFY - run`;
const FINISH = 'THOUGHT: Done.\nACTION: finish\nTEXT:\nok';
const WRITE = (p, body, lang) => `THOUGHT: writing ${p}.\nACTION: write_file\nPATH: ${p}\n\`\`\`${lang}\n${body}\n\`\`\``;
async function drive(label, files, goal, replies, env = { AGENT_BOUND_ROUTES: '', AGENT_WORKER_EXEC: '' }) {
  const [hubPort, fakePort] = await freePorts(2);
  const dir = scratch(`fg5-${label}`, { baseUrl: `http://127.0.0.1:${fakePort}`, model: 'fake' }); temps.push(dir);
  const ws = join(dir, 'workspace'); mkdirSync(ws, { recursive: true });
  for (const [f, b] of Object.entries(files)) writeFileSync(join(ws, f), b, 'utf8');
  const rf = join(dir, 'replies.json'); writeFileSync(rf, JSON.stringify(replies), 'utf8');
  const fake = spawn(process.execPath, [join(HERE, 'fakemodel.mjs'), '--port', String(fakePort), '--replies', rf], { stdio: 'ignore', env: process.env });
  let hub = null;
  try {
    const started = await startHub(dir, { port: hubPort, env: { AGENT_APPROVAL_MODE: 'build', ...env } }); hub = started.hub;
    const { runId } = await started.api('/agent/start', { method: 'POST', body: JSON.stringify({ goal }) });
    let r = null; for (let i = 0; i < 160; i++) { r = await started.api(`/agent/${runId}`).catch(() => null); if (r && r.status !== 'running' && !r.busy) break; await sleep(500); }
    await sleep(2000);   // the trace and index rows are written at run end; give them a moment before the hub is killed
    const traces = existsSync(join(dir, 'traces', 'traces.jsonl')) ? readFileSync(join(dir, 'traces', 'traces.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
    const index = existsSync(join(dir, 'run-index.jsonl')) ? readFileSync(join(dir, 'run-index.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
    return { run: r, ws, trace: traces.find((t) => t.id === runId) || traces[traces.length - 1] || null, index: index.find((t) => t.id === runId) || index[index.length - 1] || null };
  } finally { try { hub && hub.kill('SIGKILL'); } catch {} try { fake.kill('SIGKILL'); } catch {} }
}
const texts = (r) => (r?.steps || []).map((s) => String(s.text || ''));
const idOver = (ws, files) => identityOf(files.map((f) => ({ type: 'F', path: f, bytes: readFileSync(join(ws, f)) })));

try {
  say(`FG-5 RECEIPT ${PHASE.toUpperCase()}   EH1 ${run.id}`);
  { const r = indexVerdict('unverified-no-work'); rec('R1a', "runIndex: finishKind 'unverified-no-work'", { outcome: r.verdict === 'ok' ? "reads 'ok' - a no-work finish indexed as clean (red)" : r.verdict === 'unverified-no-work' ? 'reads the kind (holds)' : `reads ${r.verdict}`, ...r }); }
  { const s = tochatSkip('unverified-no-work', 1); rec('R1b', 'tochat: no-work row, 1 block', { outcome: /never verified \(unverified-no-work\)/.test(s) ? 'skipped, naming the verdict (holds)' : /blocked/.test(s) ? `skipped by block count only: ${s}` : `kept?! ${s}`, left: s }); }
  { const r = indexVerdict('something-new'); rec('R1c', "runIndex: an unknown finishKind", { outcome: r.verdict === 'ok' ? "reads 'ok' - unknown treated as clean (red)" : r.verdict === 'unknown' ? "reads 'unknown' (holds)" : `reads ${r.verdict}`, ...r }); }
  { const a = indexVerdict('verified'), b = indexVerdict(undefined); rec('R1d', "runIndex: 'verified' / absent", { outcome: `${a.verdict} / ${b.verdict}`, holds: (a.verdict === 'ok' || a.verdict === 'verified') && b.verdict === '?' }); }
  // R2 / R3: verify() names the judged subset
  { const d = mk('v'); writeFileSync(join(d, 'package.json'), '{"name":"w"}\n'); writeFileSync(join(d, 's1_library.js'), LIB_DONE); writeFileSync(join(d, 'other.js'), 'module.exports = 2;\n');
    const v = await verifier.verify(d, { entry: 's1_library.js', goal: GOAL1 }); const j = v.judged ?? null;
    const files = j?.files ?? null; const own = files ? idOver(d, files) : null;
    rec('R2', 'verify(): judged {entry, files, id} over the scoped set', { outcome: !j ? 'no `judged` on the result (red)' : j.entry === 's1_library.js' && Array.isArray(files) && files.includes('s1_library.js') && !files.includes('other.js') && /^cid1:/.test(j.id || '') && j.id === own ? 'judged names entry + scoped files; id = identityOf over them (holds)' : `judged present but wrong: ${JSON.stringify(j).slice(0, 120)}`, judged: j, recomputed: own });
    writeFileSync(join(d, 's1_library.js'), LIB_DONE + '// one more byte\n'); const v2 = await verifier.verify(d, { entry: 's1_library.js', goal: GOAL1 });
    rec('R3', 'verify(): judged.id changes with the judged bytes', { outcome: !j ? 'n/a (no judged)' : v2.judged?.id && v2.judged.id !== j.id ? 'differs (holds)' : 'SAME - identity does not track the bytes', before: j?.id ?? null, after: v2.judged?.id ?? null }); }
  // R4 / R5: a Verified hub finish carries the subject in the note, the run, the trace row and the index row
  { const x = await drive('r4', { 's1_library.js': LIB }, GOAL1, [PLAN('s1_library.js'), WRITE('s1_library.js', LIB_DONE, 'javascript'), FINISH, FINISH]);
    const note = texts(x.run).find((t) => /^Verified \(/.test(t)) || null; const fs = x.run?.finishSubject ?? null;
    const own = fs?.files ? idOver(x.ws, fs.files) : null;
    rec('R4', 'hub: Verified note + run.finishSubject', { outcome: !note ? `APPARATUS: no Verified note (status ${x.run?.status})` : !fs ? `note names ${/s1_library\.js/.test(note) ? 'the entry' : 'no file'}, no identity; run has no finishSubject (red)` : /cid1/.test(note) && fs.entry === 's1_library.js' && fs.id === own ? 'note carries entry, files, cid1-over-files; finishSubject matches an independent identityOf (holds)' : `partial: note=${note.slice(0, 80)} fs=${JSON.stringify(fs).slice(0, 100)}`, note: note?.slice(0, 160) ?? null, finishSubject: fs, recomputed: own });
    rec('R5', 'hub: trace row and index row carry finishKind AND finishSubject', { outcome: !x.trace || !x.index ? `APPARATUS: trace ${!!x.trace} index ${!!x.index}` : x.trace.finishSubject && x.index.finishSubject ? `both carry finishSubject (holds); finishKind ${x.trace.finishKind}/${x.index.finishKind}` : `finishKind only: trace ${x.trace.finishKind} (subject ${!!x.trace.finishSubject}), index ${x.index.finishKind} (subject ${!!x.index.finishSubject}) (red)`, traceKind: x.trace?.finishKind ?? null, indexKind: x.index?.finishKind ?? null }); }
  // R6: the FG-3 no-work finish through the real writer and the real index reader
  { const x = await drive('r6', { 's1_library.js': LIB }, GOAL1, [PLAN('s1_library.js'), FINISH, FINISH, FINISH]);
    const d = mk('idx6'); const f = join(d, 'run-index.jsonl'); writeFileSync(f, x.index ? JSON.stringify({ ...x.index, goal: 'probe r6' }) + '\n' : '');
    const out = x.index ? execFileSync(process.execPath, [join(HERE, 'runIndex.mjs')], { env: { ...process.env, RUN_INDEX: f }, encoding: 'utf8', windowsHide: true }) : '';
    const m = (out.split('\n').find((l) => /probe r6/.test(l)) || '').match(/done\s+(\S+)/); const verdict = m ? m[1] : null;
    rec('R6', 'hub: the no-work finish, through the real writer and the index reader', { outcome: !x.index ? `APPARATUS: no index row (status ${x.run?.status}, kind ${x.run?.finishKind})` : x.index.finishKind !== 'unverified-no-work' ? `writer stamped ${x.index.finishKind}` : verdict === 'ok' ? "writer stamped unverified-no-work; index reads 'ok' (red)" : verdict === 'unverified-no-work' ? 'writer and reader agree: unverified-no-work (holds)' : `reads ${verdict}`, written: x.index?.finishKind ?? null, read: verdict }); }

  const by = Object.fromEntries(rows.map((r) => [r.id, r])); const o = (id) => by[id]?.outcome || '';
  const verdict = PHASE === 'before'
    ? { mustFire: /red/.test(o('R1a')) && /red/.test(o('R1c')) && /red/.test(o('R2')), r1dHolds: !!by.R1d?.holds }
    : { r1: /holds/.test(o('R1a')) && /holds/.test(o('R1b')) && /holds/.test(o('R1c')) && !!by.R1d?.holds, r2r3: /holds/.test(o('R2')) && /holds/.test(o('R3')), r4r5: /holds/.test(o('R4')) && /holds/.test(o('R5')), r6: /holds/.test(o('R6')) };
  say(`\n=== FG-5 RECEIPT ${PHASE.toUpperCase()} ===`); for (const [k, x] of Object.entries(verdict)) say(`    ${k.padEnd(10)} ${x}`);
  run.artifact('fg5.log', log.join('\n') + '\n'); run.artifact('result.json', { phase: PHASE, rows, verdict });
  const s = run.seal({ exitStatus: 0 }); console.log(`EH1 sealed: ${s.state}  ${run.dir}`);
} catch (e) { say(`APPARATUS FAILURE: ${e.stack || e}`); try { run.artifact('fg5.log', log.join('\n') + '\n'); run.abandon({ reason: String(e.message).slice(0, 300) }); } catch {} process.exitCode = 1; }
finally { for (const d of temps) { try { rmSync(d, { recursive: true, force: true }); } catch {} } }
