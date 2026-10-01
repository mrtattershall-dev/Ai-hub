/**
 * cont2.probe.mjs - CONT-2 row C7: after an unverified predecessor is HELD, does a human's POST /agent/queue/run
 * start the dependent goal? (The human's act is the authorization the frozen contract names.)
 *
 *   CONT2_PHASE=before|after node server/cont2.probe.mjs
 *
 * Frozen in legasus/screen/CONT-2_PREREG.md. Separate from cont1.probe.mjs, which is not edited to fit a
 * repair. Same construction as CONT-1 C2 (A = unverified-no-work), then the override.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openRun, EVIDENCE_CLASS } from './evidenceRun.mjs';

const PHASE = process.env.CONT2_PHASE; if (!['before', 'after'].includes(PHASE)) throw new Error('set CONT2_PHASE=before|after');
const HERE = dirname(fileURLToPath(import.meta.url));
const { scratch, startHub, freePorts } = await import('./testHarness.mjs');
const REPO = process.cwd();
const run = openRun({ root: join(REPO, 'legasus', 'evidence-runs'), label: `CONT-2-OVERRIDE-${PHASE.toUpperCase()}`, command: `CONT2_PHASE=${PHASE} node server/cont2.probe.mjs`,
  repo: REPO, evidenceClass: EVIDENCE_CLASS.ORIGINAL, note: `CONT-2 C7 ${PHASE}: human override after a held unverified predecessor.` });
const log = []; const say = (s) => { console.log(s); log.push(s); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const temps = [];
const PLAN = (f) => `1. WHAT IT DOES - ${f}\n2. FILES - ${f}\n3. BUILD ORDER - edit\n4. HOW TO VERIFY - run`;
const FIN = (n) => `THOUGHT: Done, attempt ${n}.\nACTION: finish\nTEXT:\nok ${n}`;
const READ = 'THOUGHT: reading out.js.\nACTION: read_file\nPATH: out.js';
const A_GOAL = "Add probe() to out.js returning the string 'A'.";
const B_GOAL = 'Check that out.js exports probe and report what it returns.';

try {
  say(`CONT-2 C7 ${PHASE.toUpperCase()}   EH1 ${run.id}`);
  const [hubPort, fakePort] = await freePorts(2);
  const dir = scratch('cont2-c7', { baseUrl: `http://127.0.0.1:${fakePort}`, model: 'fake' }); temps.push(dir);
  const ws = join(dir, 'workspace'); mkdirSync(ws, { recursive: true }); writeFileSync(join(ws, 'out.js'), 'module.exports = {};');
  writeFileSync(join(dir, 'replies.json'), JSON.stringify([PLAN('out.js'), FIN(1), FIN(2), PLAN('out.js'), READ, FIN('B1'), FIN('B2'), FIN('B3')]));
  const fake = spawn(process.execPath, [join(HERE, 'fakemodel.mjs'), '--port', String(fakePort), '--replies', join(dir, 'replies.json')], { stdio: 'ignore', env: process.env });
  let hub = null;
  try {
    const started = await startHub(dir, { port: hubPort, env: { AGENT_APPROVAL_MODE: 'build', AGENT_SUPERVISOR: '1', AGENT_BOUND_ROUTES: '', AGENT_WORKER_EXEC: '' } }); hub = started.hub;
    const { api } = started;
    const c = await api('/agent/queue/chain', { method: 'POST', body: JSON.stringify({ goals: [A_GOAL, B_GOAL] }) });
    const [itemA, itemB] = c.queued;
    await api('/agent/queue/run', { method: 'POST' });
    // wait for A to end
    let items = null, A = null;
    for (let i = 0; i < 150; i++) { await sleep(2000); items = (await api('/agent/queue')).items || (await api('/agent/queue')); A = items.find((x) => x.id === itemA.id); if (A && A.status !== 'queued' && A.status !== 'taken') break; }
    await sleep(4000);   // give the supervisor its moment
    items = (await api('/agent/queue')).items || (await api('/agent/queue'));
    const B1 = items.find((x) => x.id === itemB.id);
    const runA = A?.runId ? await api(`/agent/${A.runId}`).catch(() => null) : null;
    const heldNote = (runA?.steps || []).map((s) => String(s.text || '')).find((t) => /Held|held/.test(t) && /unverified/i.test(t)) || null;
    const autoStarted = !!B1?.runId;
    say(`  A: item=${A?.status} finishKind(item)=${A?.finishKind ?? 'absent'} ; B after A: item=${B1?.status} autoStarted=${autoStarted} ; hold note: ${heldNote ? heldNote.slice(0, 90) : 'none'}`);
    // the override: a human presses run
    let overrideStarted = null;
    if (!autoStarted) {
      await api('/agent/queue/run', { method: 'POST' });
      for (let i = 0; i < 60; i++) { await sleep(2000); items = (await api('/agent/queue')).items || (await api('/agent/queue')); const b = items.find((x) => x.id === itemB.id); if (b?.runId) { overrideStarted = true; if (b.status !== 'taken' && b.status !== 'queued') break; } }
      overrideStarted = !!overrideStarted;
      say(`  override: POST /agent/queue/run -> B started=${overrideStarted}; B item now ${items.find((x) => x.id === itemB.id)?.status}`);
    }
    const outcome = PHASE === 'before'
      ? (autoStarted ? 'B AUTO-STARTED after an unverified predecessor (the defect, as characterized)' : `B did not auto-start before the repair?! ${JSON.stringify(B1)}`)
      : (!autoStarted && heldNote && overrideStarted ? 'HELD with a note naming the verdict; human run started B (holds)' : `unexpected: autoStarted=${autoStarted} note=${!!heldNote} override=${overrideStarted}`);
    say(`\n=== CONT-2 C7 ${PHASE.toUpperCase()} ===\n    ${outcome}`);
    run.artifact('cont2.log', log.join('\n') + '\n'); run.artifact('result.json', { phase: PHASE, A, B1, autoStarted, heldNote, overrideStarted, outcome });
  } finally { try { hub && hub.kill('SIGKILL'); } catch {} try { fake.kill('SIGKILL'); } catch {} }
  const s = run.seal({ exitStatus: 0 }); console.log(`EH1 sealed: ${s.state}  ${run.dir}`);
} catch (e) { say(`APPARATUS FAILURE: ${e.stack || e}`); try { run.artifact('cont2.log', log.join('\n') + '\n'); run.abandon({ reason: String(e.message).slice(0, 300) }); } catch {} process.exitCode = 1; }
finally { for (const d of temps) { try { rmSync(d, { recursive: true, force: true }); } catch {} } }
