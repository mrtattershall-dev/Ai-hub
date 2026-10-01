/**
 * cont1.probe.mjs - CONT-1: what fact authorizes continuation to the next goal?
 *
 *   node server/cont1.probe.mjs            (characterization of the CURRENT tree; no repair exists)
 *   CONT1_PHASE=after node server/cont1.probe.mjs   (after a frozen repair, unchanged)
 *
 * Frozen in legasus/screen/CONT-1_PREREG.md (8a27d453) before this file existed. Each row is a fresh REAL
 * hub (testHarness startHub, fakemodel --replies, AGENT_SUPERVISOR=1, approval 'build') with a two-item
 * chain: A (the varied goal) then B after A. Only A's terminal semantics vary. B is a check-and-report goal
 * that READS the file A was asked to produce, so B's own tool result shows what it observed of A's state.
 *
 * The fake model serves ONE reply stream across both runs and repeats its last reply when exhausted; the
 * hub's repeat guard stops a run on the third identical reply. So A's finishes are made DISTINCT where a
 * forced finish is wanted, and an identical non-finish reply x3 is how the `stopped` control is produced.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openRun, EVIDENCE_CLASS } from './evidenceRun.mjs';

const PHASE = process.env.CONT1_PHASE || 'before';
const HERE = dirname(fileURLToPath(import.meta.url));
const { scratch, startHub, freePorts, waitForQueue } = await import('./testHarness.mjs');
const REPO = process.cwd();
const run = openRun({ root: join(REPO, 'legasus', 'evidence-runs'), label: `CONT-1-${PHASE.toUpperCase()}`, command: `CONT1_PHASE=${PHASE} node server/cont1.probe.mjs`,
  repo: REPO, evidenceClass: EVIDENCE_CLASS.ORIGINAL, note: `CONT-1 ${PHASE}: continuation after each finish kind, real hub + supervisor + chain.` });
const log = []; const say = (s) => { console.log(s); log.push(s); };
const temps = [];
const rows = []; const rec = (id, label, r) => { rows.push({ id, label, ...r }); say(`  ${id.padEnd(3)} ${label.padEnd(38)} ${r.outcome}`); for (const n of r.notes || []) say(`      ${n}`); };

const A_GOAL = "Add probe() to out.js returning the string 'A'.";
const B_GOAL = 'Check that out.js exports probe and report what it returns.';
const PLAN = (f) => `1. WHAT IT DOES - ${f}\n2. FILES - ${f}\n3. BUILD ORDER - edit\n4. HOW TO VERIFY - run`;
const FIN = (n) => `THOUGHT: Done, attempt ${n}.\nACTION: finish\nTEXT:\nok ${n}`;
const WRITE = (p, body) => `THOUGHT: writing ${p}.\nACTION: write_file\nPATH: ${p}\n\`\`\`javascript\n${body}\n\`\`\``;
const READ = 'THOUGHT: reading out.js.\nACTION: read_file\nPATH: out.js';
const GOOD = "module.exports = { probe: () => 'A' };";
const B_REPLIES = [PLAN('out.js'), READ, FIN('B1'), FIN('B2'), FIN('B3')];

async function chain(label, { seed = {}, aReplies, env = {} }) {
  const [hubPort, fakePort] = await freePorts(2);
  const dir = scratch(`cont1-${label}`, { baseUrl: `http://127.0.0.1:${fakePort}`, model: 'fake' }); temps.push(dir);
  const ws = join(dir, 'workspace'); mkdirSync(ws, { recursive: true });
  for (const [f, b] of Object.entries(seed)) writeFileSync(join(ws, f), b, 'utf8');
  const rf = join(dir, 'replies.json'); writeFileSync(rf, JSON.stringify([...aReplies, ...B_REPLIES]), 'utf8');
  const fake = spawn(process.execPath, [join(HERE, 'fakemodel.mjs'), '--port', String(fakePort), '--replies', rf], { stdio: 'ignore', env: process.env });
  let hub = null;
  try {
    const started = await startHub(dir, { port: hubPort, env: { AGENT_APPROVAL_MODE: 'build', AGENT_SUPERVISOR: '1', AGENT_BOUND_ROUTES: '', AGENT_WORKER_EXEC: '', ...env } }); hub = started.hub;
    const { api } = started;
    const c = await api('/agent/queue/chain', { method: 'POST', body: JSON.stringify({ goals: [A_GOAL, B_GOAL] }) });
    const [itemA, itemB] = c.queued;
    await api('/agent/queue/run', { method: 'POST' });
    const settled = await waitForQueue(api, { minutes: 6, every: 2000 });
    const items = settled.items; const A = items.find((i) => i.id === itemA.id), B = items.find((i) => i.id === itemB.id);
    const runOf = async (it) => (it?.runId ? await api(`/agent/${it.runId}`).catch(() => null) : null);
    const runA = await runOf(A), runB = await runOf(B);
    const index = existsSync(join(dir, 'run-index.jsonl')) ? readFileSync(join(dir, 'run-index.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
    const traces = existsSync(join(dir, 'traces', 'traces.jsonl')) ? readFileSync(join(dir, 'traces', 'traces.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
    const idxA = index.find((r) => r.id === A?.runId) || null, idxB = index.find((r) => r.id === B?.runId) || null;
    const trA = traces.find((t) => t.id === A?.runId) || null;
    const bRead = (runB?.steps || []).find((s) => s.type === 'tool' && s.tool === 'read_file');
    return {
      settled: settled.settled, items: items.map((i) => ({ id: i.id, status: i.status, after: i.after ?? null, runId: i.runId ?? null, summary: i.summary ?? null, repairOf: i.repairOf ?? null })),
      A: { item: A?.status ?? null, runStatus: runA?.status ?? null, finishKind: runA?.finishKind ?? null, idxKind: idxA?.finishKind ?? null, idxSubject: idxA?.finishSubject ? 'present' : 'absent', traceKind: trA?.finishKind ?? null, finishBlocks: runA?.finishBlocks ?? 0 },
      B: { item: B?.status ?? null, started: !!B?.runId, runStatus: runB?.status ?? null, finishKind: runB?.finishKind ?? null, idxKind: idxB?.finishKind ?? null, observed: bRead ? String(bRead.result || '').replace(/\s+/g, ' ').slice(0, 90) : null },
      outFile: existsSync(join(ws, 'out.js')) ? readFileSync(join(ws, 'out.js'), 'utf8').slice(0, 60) : null,
      itemsGrew: items.length > 2,
    };
  } finally { try { hub && hub.kill('SIGKILL'); } catch {} try { fake.kill('SIGKILL'); } catch {} }
}
const cont = (x) => `A item=${x.A.item} kind=${x.A.finishKind}/idx=${x.A.idxKind} | B started=${x.B.started} item=${x.B.item} status=${x.B.runStatus} | B observed: ${x.B.observed ?? '-'}`;

// APPARATUS FAULT, run 9a33779c (preserved): rows C1 and C4 read A's kind from the run VIEW, which carries
// finishKind only when a route stamps it (forced, no-work, auto). 'verified' and 'unverified' are DERIVED
// by finishVerdict() when the index row is written and never written back, so those rows read null and
// self-labelled APPARATUS although the index rows said verified / unverified. The prereg names the INDEX
// row as the confirming source; the rows now read it. No other change.
const kindOf = (x) => x.A.idxKind;

try {
  say(`CONT-1 ${PHASE.toUpperCase()}   EH1 ${run.id}`);
  const results = {};
  // C1 verified: A writes out.js and finishes
  // Run 9a33779c also left A's spare finish replies in the shared stream, so B's first reply was a finish and
  // B ended before reading (C1/C4 "observed" blank). Each A row now gets exactly the replies it consumes.
  results.C1 = await chain('c1', { aReplies: [PLAN('out.js'), WRITE('out.js', GOOD), FIN(1)] });
  rec('C1', 'A verified (positive control)', { outcome: results.C1.A.idxKind === 'verified' ? `A verified; ${cont(results.C1)}` : `APPARATUS: A ended ${results.C1.A.runStatus}/${results.C1.A.finishKind}`, ...results.C1 });
  // C2 unverified-no-work: out.js exists but lacks the goal; A finishes twice without writing
  results.C2 = await chain('c2', { seed: { 'out.js': 'module.exports = {};' }, aReplies: [PLAN('out.js'), FIN(1), FIN(2)] });
  rec('C2', 'A unverified-no-work', { outcome: results.C2.A.idxKind === 'unverified-no-work' ? cont(results.C2) : `APPARATUS: A ended ${results.C2.A.runStatus}/${results.C2.A.finishKind} (${results.C2.A.finishBlocks} blocks)`, ...results.C2 });
  // C3 forced: out.js crashes on load; A finishes four distinct times -> 3 blocks, then forced
  results.C3 = await chain('c3', { seed: { 'out.js': "throw new Error('out is broken');" }, aReplies: [PLAN('out.js'), FIN(1), FIN(2), FIN(3), FIN(4)] });
  rec('C3', 'A forced (3 blocks, gate steps aside)', { outcome: results.C3.A.idxKind === 'forced' ? cont(results.C3) : `APPARATUS: A ended ${results.C3.A.runStatus}/${results.C3.A.finishKind} (${results.C3.A.finishBlocks} blocks)`, ...results.C3 });
  // C4 unverified via the bounded finish (host verifier closed): A writes out.js and finishes
  results.C4 = await chain('c4', { aReplies: [PLAN('out.js'), WRITE('out.js', GOOD), FIN(1)], env: { AGENT_BOUND_ROUTES: '1', AGENT_WORKER_EXEC: '1' } });
  rec('C4', 'A unverified (bounded: verifier closed)', { outcome: results.C4.A.idxKind === 'unverified' ? cont(results.C4) : `APPARATUS: A ended ${results.C4.A.runStatus}/${results.C4.A.finishKind}`, ...results.C4 });
  // C5 stopped (failure-path control): A repeats an identical non-finish reply -> repeat guard stops it
  results.C5 = await chain('c5', { seed: { 'out.js': GOOD }, aReplies: [PLAN('out.js'), READ, READ, READ] });
  rec('C5', 'A stopped (repeat guard) - failure path', { outcome: results.C5.A.runStatus === 'stopped' ? cont(results.C5) : `APPARATUS: A ended ${results.C5.A.runStatus}/${results.C5.A.finishKind}`, ...results.C5 });
  rec('C6', 'A error (machine failure) - failure path', { outcome: 'UNMEASURED: no fault injection for a genuine machine failure in this harness' });

  // X2: does later success erase A's kind? (C2-C4: A's index row and trace row after B ran)
  for (const id of ['C2', 'C3', 'C4']) { const x = results[id]; if (!x) continue;
    rec(`X2-${id}`, `A's kind survives B (${id})`, { outcome: x.A.idxKind && x.A.traceKind ? `index=${x.A.idxKind} trace=${x.A.traceKind} subject=${x.A.idxSubject}; item carries runId=${!!x.items.find((i) => i.status && i.runId)}` : `index=${x.A.idxKind} trace=${x.A.traceKind} - NOT recoverable` }); }
  // X3: what the queue says about the chain
  rec('X3', 'chain label on the queue items', { outcome: Object.entries(results).map(([k, x]) => `${k}: ${x.items.map((i) => i.status).join('>')} (kind on item: none)`).join('; ') });

  const same = ['C1', 'C2', 'C3', 'C4'].filter((k) => results[k] && !/APPARATUS/.test(rows.find((r) => r.id === k).outcome)).map((k) => `${k}:${results[k].A.item}/${results[k].B.started}`);
  say(`\n=== CONT-1 ${PHASE.toUpperCase()} ===`);
  say(`    continuation per kind (A item / B started): ${same.join('  ')}`);
  say(`    hypothesis "termination alone grants continuation": ${['C2', 'C3', 'C4'].every((k) => results[k]?.B.started && results[k]?.A.item === 'done') ? 'CONFIRMED on every measured unverified kind' : 'NOT confirmed - see rows'}`);
  say(`    failure-path control C5: A item=${results.C5.A.item} B started=${results.C5.B.started}`);
  run.artifact('cont1.log', log.join('\n') + '\n'); run.artifact('result.json', { phase: PHASE, rows, results });
  const s = run.seal({ exitStatus: 0 }); console.log(`EH1 sealed: ${s.state}  ${run.dir}`);
} catch (e) { say(`APPARATUS FAILURE: ${e.stack || e}`); try { run.artifact('cont1.log', log.join('\n') + '\n'); run.abandon({ reason: String(e.message).slice(0, 300) }); } catch {} process.exitCode = 1; }
finally { for (const d of temps) { try { rmSync(d, { recursive: true, force: true }); } catch {} } }
