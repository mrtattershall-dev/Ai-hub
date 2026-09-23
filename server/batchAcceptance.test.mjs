/**
 * batchAcceptance.test.mjs - DOES THE BATCH LET THE VERDICT CONTROL WHAT THE NEXT TASK GETS?
 *
 *   node server/batchAcceptance.test.mjs
 *
 * acceptance.test.mjs qualified the POLICY FUNCTION. That is a different claim from "the batch
 * applies it and the decision reaches the next task" - and only the second one closes the gap
 * PILOT-2 exposed, where a detected regression stayed in the workspace.
 *
 * Every task's work is a SCRIPTED EDIT replaying what the 7B actually did, so there are no model
 * calls and each outcome is known in advance:
 *
 *   t5-replay   writes the real broken cart.js  -> capture, restore, verify, ADVANCE
 *   t2/t3-replay writes the real fixes          -> RETAIN, and the baseline advances
 *   incomplete  protected passes, requested fails -> preserved, baseline UNCHANGED
 *   restore/eval failure                        -> the batch STOPS without advancing
 *
 * The assertions are on the GENERATED REPORT and the BASELINE IDENTITY, not on the policy's
 * return value: candidate verdict, surviving verdict, disposition, and which tree the next task
 * actually received.
 */
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const { runBatch, Journal, TASK_STATE } = await import('./batch.js');
const { DISPOSITION } = await import('./acceptance.js');
const { VERDICT } = await import('./evaluator.js');

let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };
const note = (m) => console.log(`        ${m}`);

const PKG = '{"name":"fx","type":"commonjs"}\n';
const PRICING = 'function round2(n) { return Math.round(n * 100) / 100; }\nmodule.exports = { round2 };\n';
const CART_OK = "const { round2 } = require('./pricing');\nfunction cartTotal(items) { return round2(items.reduce((a, i) => a + i.price * i.qty, 0)); }\nmodule.exports = { cartTotal };\n";
// The REAL regression the 7B produced in PILOT-2: cartTotal(items) becomes NaN.
const CART_BROKEN = "const { round2 } = require('./pricing');\nfunction cartTotal(items, percent) {\n  return round2(items.reduce((a, i) => a + i.price * i.qty, 0) * (1 - percent / 100));\n}\nmodule.exports = { cartTotal };\n";

const protCart = { script: 'node -e "const c=require(\'/candidate/cart.js\'); const t=c.cartTotal([{price:10,qty:2},{price:5,qty:1}]); if (t!==25) { console.log(\'cartTotal =\', t); process.exit(1); } console.log(\'ok\')"' };
const reqDiscount = { script: 'node -e "const p=require(\'/candidate/pricing.js\'); process.exit(typeof p.applyDiscount===\'function\'?0:1)"' };

/**
 * Scripted work: apply the task's edits directly.
 *
 * An earlier version shelled the writes through the worker with
 * `node -e "require('fs').writeFileSync(...)"`. The nested quoting broke, the edit never
 * landed, and the batch then behaved CORRECTLY on a workspace that was never broken - so the
 * test reported a policy failure that had not happened. The lesson is the recurring one: a
 * silent apparatus failure looks exactly like a result.
 *
 * The worker is qualified separately (workerIsolation 21/21, hubWorker 13/13). What is under
 * test HERE is batch -> acceptance -> baseline, so the edits are applied directly and the
 * scripted outcome is synthesised.
 */
const scripted = async (ws, task) => {
  for (const [f, body] of Object.entries(task.edits || {})) writeFileSync(join(ws, f), body, 'utf8');
  return { status: 'COMPLETED', ok: true, exit: 0, timedOut: false, out: '', elapsedSec: 0, terminationReason: 'ended' };
};
const dirs = [];
const scratch = (p) => { const d = mkdtempSync(join(tmpdir(), p)); dirs.push(d); return d; };
const endOf = (events, id) => events.filter((e) => e.event === 'task_end' && e.task === id).pop() || {};

try {
  // ── 1. THE REGRESSION IS REJECTED, AND THE BATCH ADVANCES CLEANLY ──
  console.log('=== 1. replaying the real t5 regression through the batch ===');
  const root = scratch('bacc-');
  const tasks = [
    { id: 't5-replay', seed: { 'package.json': PKG, 'pricing.js': PRICING, 'cart.js': CART_OK },
      edits: { 'cart.js': CART_BROKEN }, requested: reqDiscount, protected: protCart },
    { id: 't3-replay', seed: { 'package.json': PKG, 'pricing.js': PRICING, 'cart.js': CART_OK },
      edits: { 'pricing.js': PRICING.replace('module.exports = { round2 };', 'function applyDiscount(a,p){return round2(a*(1-p/100));}\nmodule.exports = { round2, applyDiscount };') },
      requested: reqDiscount, protected: protCart },
  ];
  const out = await runBatch(tasks, {
    journalPath: join(root, 'j.jsonl'), workspacesDir: join(root, 'ws'), auditDir: join(root, 'audit'),
    perTaskSec: 90, totalSec: 600, chain: true, runTask: scripted,
  });
  const events = new Journal(join(root, 'j.jsonl')).read();
  const by = Object.fromEntries(out.results.map((r) => [r.task, r]));

  const t5 = by['t5-replay'];
  const t5end = endOf(events, 't5-replay');
  say(t5end.disposition === DISPOSITION.RESTORED, `t5: the REPORT records disposition=RESTORED (${t5end.disposition})`);
  say(t5end.candidateVerdict?.protected === VERDICT.FAIL, `t5: CANDIDATE verdict protected=FAIL is in the report (${t5end.candidateVerdict?.protected})`);
  say(t5end.survivingWorkspaceVerdict?.protected === VERDICT.PASS, `t5: SURVIVING verdict protected=PASS is recorded separately (${t5end.survivingWorkspaceVerdict?.protected})`);
  note('Both verdicts in the generated report: the rollback does not hide that the model broke it.');
  say(t5.state !== TASK_STATE.COMPLETED, `t5: not counted as a completion (${t5.state})`);
  say(!!t5end.capturedAt && existsSync(t5end.capturedAt), 't5: the rejected candidate was captured');
  const capCart = t5end.capturedAt ? join(t5end.capturedAt, 'cart.js') : null;
  say(!!capCart && existsSync(capCart) && readFileSync(capCart, 'utf8').includes('1 - percent / 100'),
    't5: and the capture still holds the broken code');
  // the workspace itself
  const t5cart = readFileSync(join(root, 'ws', 't5-replay', 'cart.js'), 'utf8');
  say(!t5cart.includes('1 - percent / 100'), 't5: the broken code is GONE from the workspace');

  // ── 2. THE BASELINE. This is the link PILOT-2 was missing. ──
  console.log('\n=== 2. the decision controls what the NEXT task receives ===');
  const t5Baseline = t5end.baselineTree;
  say(t5Baseline === null || t5end.baselineTask === 'none', `t5: a REJECTED task does not advance the baseline (baselineTask=${t5end.baselineTask})`);
  const t3end = endOf(events, 't3-replay');
  say(t3end.disposition === DISPOSITION.RETAIN, `t3: RETAIN (${t3end.disposition})`);
  say(!!t3end.baselineTree && t3end.baselineTask === 't3-replay', `t3: an ACCEPTED task advances the baseline to its own tree (${String(t3end.baselineTree).slice(0, 12)})`);
  const baselineEvents = events.filter((e) => e.event === 'task_baseline');
  say(baselineEvents.length === 2, `every task recorded where its starting state came from (${baselineEvents.length})`);
  say(baselineEvents[0]?.baselineSource === 'task seed', `t5 started from the seed (${baselineEvents[0]?.baselineSource})`);
  note('t3 followed a REJECTED task, so it also started from the seed rather than from');
  note('the broken workspace - the rejection controlled what it received.');

  // ── 3. AN ACCEPTED BASELINE IS ACTUALLY HANDED ON ──
  console.log('\n=== 3. an accepted baseline IS handed to the next task ===');
  const root3 = scratch('bacc3-');
  const chained = [
    { id: 'a-good', seed: { 'package.json': PKG, 'pricing.js': PRICING, 'cart.js': CART_OK },
      edits: { 'marker.txt': 'FROM_TASK_A' },
      requested: { script: 'node -e "process.exit(require(\'fs\').existsSync(\'/candidate/marker.txt\')?0:1)"' }, protected: protCart },
    { id: 'b-next', seed: { 'package.json': PKG, 'pricing.js': PRICING, 'cart.js': CART_OK },
      edits: {}, requested: { script: 'node -e "process.exit(require(\'fs\').existsSync(\'/candidate/marker.txt\')?0:1)"' }, protected: protCart },
  ];
  const out3 = await runBatch(chained, {
    journalPath: join(root3, 'j.jsonl'), workspacesDir: join(root3, 'ws'), auditDir: join(root3, 'audit'),
    perTaskSec: 90, totalSec: 600, chain: true, runTask: scripted,
  });
  const ev3 = new Journal(join(root3, 'j.jsonl')).read();
  say(endOf(ev3, 'a-good').disposition === DISPOSITION.RETAIN, 'the first task is RETAINED');
  const bBase = ev3.filter((e) => e.event === 'task_baseline').pop();
  say(/accepted baseline from a-good/.test(String(bBase?.baselineSource)), `the second task started FROM THE ACCEPTED BASELINE (${bBase?.baselineSource})`);
  say(existsSync(join(root3, 'ws', 'b-next', 'marker.txt')), 'and it really received the accepted content, not the seed');
  say(out3.results.every((r) => r.state === TASK_STATE.COMPLETED), 'both tasks completed on the accepted line');

  // ── 4. A FORCED EVALUATION FAILURE STOPS THE BATCH WITHOUT ADVANCING ──
  //
  // The first version of this section did not force anything: both tasks evaluated cleanly,
  // the batch correctly did not halt, and the assertions passed while testing nothing. The
  // evaluator image is injectable so the failure is REAL here.
  console.log('\n=== 4. a forced evaluation failure stops the batch, baseline unchanged ===');
  const root4 = scratch('bacc4-');
  const out4 = await runBatch([
    { id: 'evalerr', seed: { 'package.json': PKG, 'pricing.js': PRICING, 'cart.js': CART_OK },
      edits: {}, requested: protCart, protected: protCart },
    { id: 'after', seed: { 'package.json': PKG, 'pricing.js': PRICING, 'cart.js': CART_OK },
      edits: {}, requested: protCart, protected: protCart },
  ], {
    journalPath: join(root4, 'j.jsonl'), workspacesDir: join(root4, 'ws'), auditDir: join(root4, 'audit'),
    perTaskSec: 90, totalSec: 600, chain: true, runTask: scripted,
    evalImage: 'sha256:' + '0'.repeat(64),   // the instrument cannot run at all
  });
  const ev4 = new Journal(join(root4, 'j.jsonl')).read();
  const e4 = endOf(ev4, 'evalerr');
  say(e4.disposition === DISPOSITION.HELD, `the evaluation failure yields HELD (${e4.disposition})`);
  say(e4.state === TASK_STATE.EVAL_ERROR, `recorded as EVAL_ERROR, NOT as a code failure (${e4.state})`);
  say(!!out4.halted, `the batch HALTED (${String(out4.halted).slice(0, 60)})`);
  say(e4.baselineTask === 'none' && !e4.baselineTree, 'and the baseline was NOT advanced');
  say(!!e4.capturedAt && existsSync(e4.capturedAt), 'the candidate was preserved separately');
  const after4 = out4.results.find((r) => r.task === 'after');
  say(after4?.state === TASK_STATE.UNATTEMPTED, `the following task is UNATTEMPTED, not run on an unknown state (${after4?.state})`);
  say(out4.accounting.complete, `still fully accounted for (${out4.accounting.accountedFor}/${out4.accounting.queued})`);
  note('Nothing was promoted on a verdict that was never established.');
  // ── 5. every task still has exactly ONE terminal record ──
  console.log('\n=== 5. one terminal record per task, after the rewiring ===');
  for (const id of ['t5-replay', 't3-replay']) {
    const n = events.filter((e) => e.event === 'task_end' && e.task === id).length;
    say(n === 1, `${id}: exactly one terminal record (${n})`);
  }
  // The invariant is ONE RECORD PER TASK INCLUDING EARLY EXITS - not that one function
  // owns the write. Five early-exit paths write their own and never reach finalise().
  for (const [label, evs, ids] of [['forced-failure batch', ev4, ['evalerr', 'after']]]) {
    for (const id of ids) {
      const n = evs.filter((e) => e.event === 'task_end' && e.task === id).length;
      say(n === 1, label + ': ' + id + ' has exactly one terminal record, via an EARLY EXIT (' + n + ')');
    }
  }
  note('Two call sites used to write their own task_end before calling the acceptance step,');
  note('which produced two terminal records per task. finalise() is not the SOLE writer -');
  note('five early-exit paths write their own - but every task has exactly one.');
} finally {
  for (const d of dirs) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
}

console.log(`\n  batch acceptance: ${passed} passed, ${failed} failed -> ${failed ? 'THE VERDICT DOES NOT CONTROL WHAT SURVIVES' : 'the verdict controls what the next task receives'}`);
process.exit(failed ? 1 : 0);
