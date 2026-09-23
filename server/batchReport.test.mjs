/**
 * batchReport.test.mjs - THE REPORT MUST CARRY ITS REQUIRED FIELDS.
 *
 *   node server/batchReport.test.mjs
 *
 * PILOT-1's report came out with ELEVEN null fields per task - elapsed time, model calls,
 * tokens, d2 state, requested and protected behaviour - because batch.js dropped the per-task
 * `outcome`. The data existed in the journal the whole time; the generator lost it. And
 * `partial_preserved` recorded `at: <path>`, overwriting the event's own timestamp with a
 * Windows path.
 *
 * The existing 24 batch checks all passed through both defects, so fixing the code and re-running
 * them establishes nothing. These are the checks that FAIL on the unfixed code:
 *
 *   1. every task result carries its outcome, with the accounting fields populated
 *   2. every journal event's `at` is an ISO-8601 TIMESTAMP, not a path or any other payload
 *   3. no journal event lets a payload key shadow a reserved envelope key
 *   4. termination evidence is about containers that EXIST, not a vacuous confirmation
 *
 * Each is asserted through the real batch path, not against a hand-built object.
 */
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const { runBatch, Journal, TASK_STATE } = await import('./batch.js');
const { runInWorker, confirmNoneRunning, runningAttempts } = await import('./worker.js');

let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };
const note = (m) => console.log(`        ${m}`);

const LIB = 'function double(n){return n*2;}\nmodule.exports={double};\n';
const PKG = '{"name":"fx","type":"commonjs"}\n';
const checkDouble = { script: 'node -e "const l=require(\'/candidate/lib.js\'); process.exit(l.double(4)===8?0:1)"' };

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const RESERVED = ['at', 'event', 'task', 'state'];

const dirs = [];
try {
  const root = mkdtempSync(join(tmpdir(), 'rep-')); dirs.push(root);
  const tasks = [
    // one that completes, and one that TIMES OUT - the timeout path is where `at` was clobbered
    { id: 'ok', seed: { 'lib.js': LIB, 'package.json': PKG }, command: 'echo fine', requested: checkDouble, protected: checkDouble },
    { id: 'slow', seed: { 'lib.js': LIB, 'package.json': PKG }, command: "node -e \"require('fs').writeFileSync('partial.txt','x')\"; sleep 60", timeoutSec: 4, requested: checkDouble, protected: checkDouble },
  ];
  const out = await runBatch(tasks, {
    journalPath: join(root, 'j.jsonl'), workspacesDir: join(root, 'ws'), auditDir: join(root, 'audit'),
    perTaskSec: 30, totalSec: 300,
    runTask: async (ws, task, ctx) => {
      const started = Date.now();
      const r = await runInWorker(ws, task.command, { timeoutSec: task.timeoutSec || ctx.timeoutSec, attemptId: ctx.attemptId });
      // the accounting fields a report needs, attached where the report can reach them
      return { ...r, elapsedSec: Math.round((Date.now() - started) / 1000), modelCalls: 0, tokens: 0, terminationReason: r.timedOut ? 'per-task limit' : 'ended' };
    },
  });

  // ── 1. THE OUTCOME REACHES THE RESULT ──
  console.log('=== 1. per-task accounting survives the batch (the PILOT-1 null-column defect) ===');
  for (const r of out.results) {
    say(!!r.outcome, `${r.task}: the result carries its outcome`);
    if (r.outcome) {
      say(typeof r.outcome.elapsedSec === 'number', `${r.task}: elapsedSec is a number (${r.outcome?.elapsedSec})`);
      say(typeof r.outcome.terminationReason === 'string', `${r.task}: terminationReason is present (${r.outcome?.terminationReason})`);
    }
  }
  note('On the unfixed batch.js every one of these was undefined - which is how the pilot');
  note('reported eleven null columns while the journal held the data all along.');

  // ── 2. TIMESTAMPS ARE TIMESTAMPS ──
  console.log('\n=== 2. every journal event carries a real ISO timestamp ===');
  const events = new Journal(join(root, 'j.jsonl')).read();
  const bad = events.filter((e) => !ISO.test(String(e.at || '')));
  say(bad.length === 0, `all ${events.length} events have an ISO-8601 \`at\` (${bad.length} bad)`);
  if (bad.length) note(`first bad: ${JSON.stringify(bad[0]).slice(0, 140)}`);
  const preserved = events.find((e) => e.event === 'partial_preserved');
  say(!!preserved, 'the timeout path emitted a partial_preserved event');
  say(!!preserved && ISO.test(String(preserved.at)), `and ITS timestamp is a timestamp, not a path (${String(preserved?.at).slice(0, 30)})`);
  say(!!preserved && typeof preserved.preservedAt === 'string' && !ISO.test(preserved.preservedAt),
    'the preserved PATH is carried in its own field, not in `at`');

  // ── 3. NO PAYLOAD KEY MAY SHADOW AN ENVELOPE KEY ──
  // The defect was not "one bad field name" but a shape that lets any payload overwrite the
  // envelope. This asserts the shape, so the next such collision fails here.
  console.log('\n=== 3. payload keys cannot shadow the envelope ===');
  const j2 = new Journal(join(root, 'j2.jsonl'));
  j2.record({ event: 'probe', task: 't', at: 'C:/some/path', state: 'x' });
  const probe = j2.read()[0];
  say(ISO.test(String(probe.at)), `a payload \`at\` does NOT overwrite the envelope timestamp (${String(probe.at).slice(0, 30)})`);
  note('This is the general defect. The pilot only showed one instance of it.');

  // ── 4. TERMINATION EVIDENCE IS ABOUT CONTAINERS THAT EXIST ──
  console.log('\n=== 4. termination evidence, not a vacuous confirmation ===');
  const names = await runningAttempts();
  say(Array.isArray(names), `the running-container list can be read (${Array.isArray(names) ? names.length + ' running' : 'daemon unreachable'})`);
  const none = await confirmNoneRunning({ timeoutMs: 20_000 });
  say(none.ok, `after the batch, NO worker container is still running (${none.ok ? 'confirmed' : none.reason})`);
  note('confirmStopped(attemptId) alone could not establish this: agent.js generates its own');
  note('container names, so that id was never attached to anything and it "confirmed" nothing.');

  // ── 5. and the accounting still holds ──
  say(out.accounting.complete, `accounting complete (${out.accounting.accountedFor}/${out.accounting.queued})`);
} finally {
  for (const d of dirs) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
}

console.log(`\n  batch reporting: ${passed} passed, ${failed} failed -> ${failed ? 'THE REPORT CANNOT BE TRUSTED' : 'the report carries its required fields'}`);
process.exit(failed ? 1 : 0);
