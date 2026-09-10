/**
 * longrun.mjs - does the agent SURVIVE a long run?
 *
 *   node server/longrun.mjs --analyse              score every run already on disk (free)
 *   node server/longrun.mjs --analyse <run-id>     score one
 *   node server/longrun.mjs --live "<goal>"        drive a new run, then score it
 *
 * THE THING NOTHING ELSE MEASURES
 * -------------------------------
 * The 75-prompt eval measures SINGLE-SHOT generation: one prompt, one answer, scored.
 * That is a fair measure of the adapter and it is not what 24/7 automation rests on.
 *
 * An unattended run dies from things a one-shot eval cannot see:
 *
 *   it loops                 the same response three times in eight steps
 *   it stops parsing         five unparseable replies in ten
 *   it halts                 an approval nobody is awake to grant
 *   it repeats a failure     the same error four times with four "fixes"
 *   it forgets               the task ledger stops matching what was built
 *   it declares victory      finish called on something that does not run
 *
 * A model can score 22/32 on prompts and still be useless overnight. This scores the
 * OTHER axis: given hundreds of steps, does the loop hold together.
 *
 * WHY --analyse EXISTS
 * --------------------
 * Every run is already checkpointed to server/agent-runs/<id>.json, steps and all. So
 * the metrics can be computed against runs that already happened, for free, and the
 * analyser can be validated before anyone spends GPU time on a fresh one. Building a
 * measurement tool and first using it on an expensive run is how you find out your
 * scorer was wrong after paying for the data - which happened twice tonight.
 */
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNS_DIR = join(__dirname, 'agent-runs');
const HUB = process.env.HUB || 'http://localhost:3001';

const argv = process.argv.slice(2);
const has = (f) => argv.includes('--' + f);
const val = (f, d) => { const i = argv.indexOf('--' + f); return i > -1 && argv[i + 1] ? argv[i + 1] : d; };

// ── metrics ───────────────────────────────────────────────────────────────────
/**
 * Everything here is derived from the persisted step feed, so it works on a live run
 * and a historical one identically. Each metric names a way an unattended run dies.
 */
function analyse(run) {
  const steps = run.steps || [];
  const byType = {};
  for (const s of steps) byType[s.type] = (byType[s.type] || 0) + 1;

  const tools = steps.filter((s) => s.type === 'tool');
  const errors = steps.filter((s) => s.type === 'error');
  const mutations = tools.filter((s) => ['write_file', 'edit_file'].includes(s.tool)).length;

  // How the run ENDED is the single most important fact about it.
  const finished = steps.some((s) => s.type === 'finish');
  const text = errors.map((s) => s.text || '').join(' | ');
  const ending = finished ? 'finished'
    : /budget/i.test(text) ? 'ran out of budget'
    : /same response/i.test(text) ? 'LOOPED'
    : /could not be parsed/i.test(text) ? 'stopped parsing'
    : /Same error persisted/i.test(text) ? 'stuck on one error'
    : /unreachable|tunnel/i.test(text) ? 'model unreachable'
    : run.status === 'awaiting_approval' ? 'HALTED for approval'
    : run.status;

  // Repeated-failure detection: the same error signature coming back after a "fix" is
  // the clearest sign the agent is not learning from its own feedback.
  const sigs = {};
  for (const s of errors) {
    const sig = String(s.text || '').replace(/\d+/g, '#').slice(0, 60);
    if (sig) sigs[sig] = (sigs[sig] || 0) + 1;
  }
  const worstRepeat = Object.entries(sigs).sort((a, b) => b[1] - a[1])[0] || ['', 0];

  // Verification: did it actually check its own work, and how often relative to edits?
  const verifications = tools.filter((s) => ['test_web', 'see_screen', 'verify_project'].includes(s.tool)).length;

  // Ledger use: an agent that never marks a task done is not tracking its own progress.
  const ledgerWrites = tools.filter((s) => ['task_add', 'task_done'].includes(s.tool)).length;

  const parseFails = errors.filter((s) => /Could not parse/i.test(s.text || '')).length;
  const mins = run.createdAt ? Math.round((Date.now() - run.createdAt) / 60000) : null;

  return {
    id: run.id, goal: (run.goal || '').slice(0, 60), status: run.status,
    ending, steps: steps.length, modelCalls: run.modelCalls || 0,
    mutations, verifications, ledgerWrites,
    approvals: byType.approval_request || 0,
    denials: byType.policy_denied || 0,
    autoApproved: byType.policy_allowed || 0,
    checkpoints: byType.checkpoint || 0,
    subtasks: byType.subtask_start || 0,
    errors: errors.length, parseFails,
    repeatSig: worstRepeat[0], repeatCount: worstRepeat[1],
    mins,
    // Ratios are what transfer between runs of different lengths.
    errorRate: steps.length ? +(errors.length / steps.length).toFixed(2) : 0,
    verifyRatio: mutations ? +(verifications / mutations).toFixed(2) : 0,
  };
}

/** Turn the numbers into the judgements a person would actually make. */
function verdicts(m) {
  const out = [];
  if (m.ending === 'LOOPED') out.push(['FAIL', 'looped — the same response came back repeatedly']);
  if (m.ending === 'stopped parsing') out.push(['FAIL', 'the model stopped producing valid actions']);
  if (m.ending === 'HALTED for approval') out.push(['BLOCK', 'stopped for a human — fatal for unattended running']);
  if (m.ending === 'stuck on one error') out.push(['FAIL', 'the same bug survived several fix attempts']);
  if (m.repeatCount >= 3) out.push(['WARN', `one error signature repeated ${m.repeatCount}x — not learning from feedback`]);
  if (m.mutations >= 3 && m.verifications === 0) out.push(['WARN', `${m.mutations} edits and never verified any of them`]);
  if (m.errorRate > 0.4) out.push(['WARN', `${Math.round(m.errorRate * 100)}% of steps were errors`]);
  if (m.parseFails >= 3) out.push(['WARN', `${m.parseFails} unparseable responses`]);
  if (m.steps >= 25 && m.ledgerWrites === 0) out.push(['WARN', 'long run with no task-ledger use — not tracking its own progress']);
  if (m.mutations >= 3 && m.checkpoints === 0) out.push(['WARN', 'edited files with no git checkpoints — damage would not be revertible']);
  if (m.ending === 'finished' && !out.length) out.push(['OK', 'finished cleanly']);
  if (!out.length) out.push(['OK', `ended: ${m.ending}`]);
  return out;
}

// ── live mode ─────────────────────────────────────────────────────────────────
async function live(goal) {
  const start = await fetch(`${HUB}/api/agent/start`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal }),
  }).then((r) => r.json());
  if (!start.runId) throw new Error(`hub refused: ${JSON.stringify(start)}`);
  console.log(`  run ${start.runId}\n  polling…\n`);

  let last = 0;
  for (;;) {
    await new Promise((r) => setTimeout(r, 4000));
    const run = await fetch(`${HUB}/api/agent/${start.runId}`).then((r) => r.json());
    const steps = run.steps || [];
    for (const s of steps.slice(last)) {
      console.log(`  ${String(steps.indexOf(s) + 1).padStart(3)}  ${(s.type || '').padEnd(18)} ${(s.tool || '').padEnd(14)} ${(s.text || s.summary || '').slice(0, 60).replace(/\n/g, ' ')}`);
    }
    last = steps.length;
    if (['done', 'error', 'stopped', 'interrupted', 'awaiting_approval'].includes(run.status)) return run;
  }
}

// ── report ────────────────────────────────────────────────────────────────────
const pad = (s, n) => String(s).padEnd(n);

function report(rows) {
  console.log(`\n${'='.repeat(96)}`);
  console.log('LONG-RUN BEHAVIOUR — what a single-shot prompt eval cannot see');
  console.log('='.repeat(96));
  console.log(`\n${pad('ending', 22)}${pad('steps', 7)}${pad('edits', 7)}${pad('verify', 8)}${pad('errors', 8)}${pad('ledger', 8)}${pad('ckpt', 6)}goal`);
  console.log('-'.repeat(96));
  for (const m of rows) {
    console.log(`${pad(m.ending, 22)}${pad(m.steps, 7)}${pad(m.mutations, 7)}${pad(m.verifications, 8)}${pad(m.errors, 8)}${pad(m.ledgerWrites, 8)}${pad(m.checkpoints, 6)}${m.goal}`);
  }

  console.log(`\n${'-'.repeat(96)}\nverdicts\n${'-'.repeat(96)}`);
  for (const m of rows) {
    for (const [level, why] of verdicts(m)) {
      console.log(`  ${pad(level, 6)} ${pad(m.id.slice(0, 8), 10)} ${why}`);
    }
  }

  // The aggregate is the number that matters for "can I leave this running".
  const n = rows.length;
  const clean = rows.filter((m) => m.ending === 'finished').length;
  const looped = rows.filter((m) => m.ending === 'LOOPED').length;
  const halted = rows.filter((m) => m.ending === 'HALTED for approval').length;
  const unverified = rows.filter((m) => m.mutations >= 3 && m.verifications === 0).length;
  console.log(`\n${'='.repeat(96)}`);
  console.log(`  runs analysed          ${n}`);
  console.log(`  finished cleanly       ${clean}/${n}${n ? `  (${Math.round((100 * clean) / n)}%)` : ''}`);
  console.log(`  looped                 ${looped}/${n}`);
  console.log(`  halted for approval    ${halted}/${n}   <- each one is a run that needed a human`);
  console.log(`  edited without verify  ${unverified}/${n}`);
  console.log(`\n  "Finished cleanly" is the headline number for unattended operation.`);
  console.log(`  A model that scores well on prompts and low here cannot be left alone.\n`);
}

// ── main ──────────────────────────────────────────────────────────────────────
if (has('live')) {
  const goal = val('live', '') || argv[argv.indexOf('--live') + 1];
  if (!goal) { console.error('usage: node server/longrun.mjs --live "<goal>"'); process.exit(1); }
  console.log(`\n  goal: ${goal}\n  hub:  ${HUB}\n`);
  const run = await live(goal);
  report([analyse(run)]);
} else {
  const one = val('analyse', null);
  if (!existsSync(RUNS_DIR)) { console.error(`no runs at ${RUNS_DIR}`); process.exit(1); }
  const files = readdirSync(RUNS_DIR).filter((f) => f.endsWith('.json'))
    .filter((f) => !one || f.startsWith(one));
  if (!files.length) { console.error('no matching runs'); process.exit(1); }
  const rows = [];
  for (const f of files) {
    try { rows.push(analyse(JSON.parse(readFileSync(join(RUNS_DIR, f), 'utf8')))); }
    catch (e) { console.error(`  skipped ${f}: ${e.message}`); }
  }
  rows.sort((a, b) => b.steps - a.steps);
  report(rows);
}
