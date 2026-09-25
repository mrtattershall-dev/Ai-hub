/**
 * autodiag.test.mjs - THE AUTOMATIC DIAGNOSTIC TELLS THE TRUTH, IN ORDER, WITHOUT BEING ASKED.
 *
 *   node server/autodiag.test.mjs
 *
 * No model calls (scripted replies), no GPU. The diagnostic itself runs in the qualified worker.
 *
 * THE SEQUENCE, end to end on the real route:
 *   failing seed -> diagnostic delivered BEFORE the first model call
 *                -> INCORRECT edit  -> fresh diagnostic that still reports failure, truthfully
 *                -> UNCHANGED file  -> no stale "fresh" report claiming a change happened
 *                -> CORRECT edit    -> fresh diagnostic reporting all cases pass
 *                -> terminal acceptance, unchanged
 *
 * The incorrect edit and the unchanged file are the point. A test that only drove a correct
 * repair would pass if the Hub simply echoed "all pass" at every step, which is the failure
 * mode that matters: feedback that reaches completion without being true.
 *
 * Also asserted: content binding (each report names the sha256 of the file it judged, and the
 * sha changes when the file does), omission is flagged rather than implied, infrastructure
 * failure is NOT reported as a failing case, and the acceptance evaluator is untouched.
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const { scratch, startHub, freePorts } = await import('./testHarness.mjs');
const { externalTasks } = await import('./benchTasks.js');
const { runDiagnostic, diagnosticMessage, DIAG, MAX_SHOWN } = await import('./autodiag.js');

let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };
const note = (m) => console.log(`        ${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (s) => createHash('sha256').update(s).digest('hex');
const dirs = [];

const TASK = externalTasks().find((t) => t.id === 'ext-lcs_length');
const MODULE = 'lcs_length';
const SEED = TASK.seed['lcs_length.py'];
const CASES = TASK.requested.files['cases.jsonl'];
const BUGGY = '                dp[i, j] = dp[i - 1, j] + 1';
const FIXED = '                dp[i, j] = dp[i - 1, j - 1] + 1';
const WRONG = '                dp[i, j] = dp[i - 1, j] + 2';     // still wrong, differently wrong

const PLAN = '1. WHAT IT DOES - lcs_length\n2. FILES - lcs_length.py\n3. BUILD ORDER - fix\n4. HOW TO VERIFY - the diagnostic runs automatically';
const edit = (find, replace) => `THOUGHT: Editing.\nACTION: edit_file\nPATH: lcs_length.py\nFIND:\n${find}\nREPLACE:\n${replace}`;
const LIST = 'THOUGHT: Looking around without touching the file.\nACTION: list_dir\nPATH: .';
const FINISH = 'THOUGHT: Done.\nACTION: finish\nTEXT:\nfixed';

async function drive(replies, { seed = SEED, label = 'seq', diagnostic = { moduleName: MODULE, casesJsonl: CASES } } = {}) {
  const [hubPort, fakePort] = await freePorts(2);
  const dir = scratch(`ad-${label}`, { baseUrl: `http://127.0.0.1:${fakePort}`, model: 'fake' });
  dirs.push(dir);
  const ws = join(dir, 'workspace');
  mkdirSync(ws, { recursive: true });
  writeFileSync(join(ws, 'lcs_length.py'), seed, 'utf8');
  const rf = join(dir, 'replies.json'); writeFileSync(rf, JSON.stringify(replies), 'utf8');
  const promptLog = join(dir, 'prompts.jsonl');
  const fake = spawn(process.execPath, [join(HERE, 'fakemodel.mjs'), '--port', String(fakePort), '--replies', rf],
    { stdio: 'ignore', env: { ...process.env, FAKE_PROMPT_LOG: promptLog } });
  let hub = null;
  try {
    const started = await startHub(dir, { port: hubPort, env: { AGENT_APPROVAL_MODE: 'build', AGENT_BOUND_ROUTES: '1', AGENT_WORKER_EXEC: '1' } });
    hub = started.hub;
    const { runId } = await started.api('/agent/start', {
      method: 'POST',
      body: JSON.stringify({ goal: `The file ${MODULE}.py contains a bug. Fix ${MODULE}() so it is correct for every input.`, budgetSec: 300, diagnostic }),
    });
    let run = null;
    for (let i = 0; i < 180; i++) {
      run = await started.api(`/agent/${runId}`).catch(() => null);
      if (run && run.status && run.status !== 'running' && !run.busy) break;
      await sleep(1000);
    }
    const reqs = existsSync(promptLog) ? readFileSync(promptLog, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
    return { run, reqs, ws };
  } finally {
    try { hub && hub.kill('SIGKILL'); } catch { /* best effort */ }
    try { fake.kill('SIGKILL'); } catch { /* best effort */ }
  }
}
/** Every AUTOMATIC DIAGNOSTIC message the model was actually sent, in order, deduplicated. */
function diagMessagesSeen(reqs) {
  const seen = [], all = new Set();
  for (const r of reqs) {
    for (const m of r.messages) {
      const c = String(m.content || '');
      if (/^AUTOMATIC DIAGNOSTIC/.test(c) && !all.has(c)) { all.add(c); seen.push(c); }
    }
  }
  return seen;
}

try {
  // ── 1. THE SEQUENCE ──
  console.log('=== 1. failing seed -> diagnostic -> WRONG edit -> truthful re-run -> unchanged -> CORRECT edit -> pass ===');
  const a = await drive([PLAN, edit(BUGGY, WRONG), LIST, edit(WRONG, FIXED), FINISH], { label: 'seq' });
  const msgs = diagMessagesSeen(a.reqs);
  note(`${msgs.length} distinct diagnostic messages delivered`);

  say(msgs.length >= 1 && /run for you before you started/.test(msgs[0]), 'the FIRST message is the opening report, delivered before the model acted');
  say(/1 passed, 8 failed/.test(msgs[0] || ''), `the opening report is TRUE for the failing seed (${(msgs[0] || '').match(/\d+ cases attempted, \d+ passed, \d+ failed/)?.[0]})`);
  say((msgs[0] || '').includes(sha(SEED).slice(0, 16)), 'and it names the sha256 of the exact file it tested');
  // it must arrive BEFORE the model's first action - i.e. in the first request that carries a turn
  const firstTurnReq = a.reqs.find((r) => r.messages.some((m) => /^Files currently in the workspace/.test(String(m.content))));
  say(!!firstTurnReq && firstTurnReq.messages.some((m) => /^AUTOMATIC DIAGNOSTIC/.test(String(m.content))),
    'it is present in the FIRST turn request, not a later one');

  const wrongSrc = SEED.replace(BUGGY, WRONG);
  const afterWrong = msgs.find((m) => m.includes(sha(wrongSrc).slice(0, 16)));
  say(!!afterWrong, 'a fresh report was delivered for the INCORRECT edit, bound to its new sha256');
  say(!!afterWrong && /re-run for you just now/.test(afterWrong), 'labelled as a re-run against the file as it now stands');
  say(!!afterWrong && /failed/.test(afterWrong) && !/Every case passes/.test(afterWrong),
    `and it TRUTHFULLY still reports failure (${(afterWrong || '').match(/\d+ cases attempted, \d+ passed, \d+ failed/)?.[0]})`);
  say(!!afterWrong && afterWrong !== msgs[0], 'it is a different report from the opening one, not a repeat');

  const fixedSrc = SEED.replace(BUGGY, FIXED);
  const afterFix = msgs.find((m) => m.includes(sha(fixedSrc).slice(0, 16)));
  say(!!afterFix && /Every case passes/.test(afterFix), 'after the CORRECT edit, a fresh report says every case passes');
  say(!!afterFix && /9 cases attempted, 9 passed, 0 failed/.test(afterFix), 'with the true counts');

  // the unchanged-file step must NOT produce a new report
  say(msgs.length === 3, `exactly 3 reports: start, after-wrong-edit, after-correct-edit - the list_dir step produced none (${msgs.length})`);
  const recs = a.run?.diagnostics || [];
  say(recs.length === 3 && recs[0].when === 'start' && recs.slice(1).every((r) => r.when === 'after-edit'),
    `the run records them in order (${recs.map((r) => r.when).join(', ')})`);
  say(new Set(recs.map((r) => r.sha256)).size === 3, 'each record binds to a DIFFERENT file content');
  say(recs[0].failed === 8 && recs[2].failed === 0, `recorded counts move 8 failing -> 0 (${recs.map((r) => r.failed).join(' -> ')})`);

  console.log('\n=== 2. acceptance is untouched ===');
  say(a.run?.status === 'done', `the run finished (${a.run?.status})`);
  say(/dp\[i, j\] = dp\[i - 1, j - 1\] \+ 1/.test(readFileSync(join(a.ws, 'lcs_length.py'), 'utf8')), 'the fix is in the workspace');
  say(!a.run?.governance, 'no acceptance verdict was produced by the diagnostic path (acceptance is the runner\'s job, unchanged)');

  // ── 3. AN UNCHANGED FILE PRODUCES NO FRESH REPORT ──
  console.log('\n=== 3. a run that never edits gets exactly one report ===');
  const b = await drive([PLAN, LIST, LIST, FINISH], { label: 'noedit' });
  const bmsgs = diagMessagesSeen(b.reqs);
  say(bmsgs.length === 1, `exactly one report - the opening one (${bmsgs.length})`);
  say(/1 passed, 8 failed/.test(bmsgs[0] || ''), 'and it still tells the truth about the untouched seed');

  // ── 4. A FAILED EDIT DOES NOT TRIGGER A FRESH REPORT ──
  console.log('\n=== 4. an edit that did not apply produces no fresh report ===');
  const c = await drive([PLAN, edit('THIS TEXT IS NOT IN THE FILE', 'x'), LIST, FINISH], { label: 'failedit' });
  const cmsgs = diagMessagesSeen(c.reqs);
  say(cmsgs.length === 1, `exactly one report - the failed edit changed nothing, so nothing was re-reported (${cmsgs.length})`);
  say(readFileSync(join(c.ws, 'lcs_length.py'), 'utf8') === SEED, 'and the file really is unchanged');

  // ── 5. INFRASTRUCTURE FAILURE IS NOT A FAILING CASE ──
  console.log('\n=== 5. infrastructure failure is reported as that, never as a test failure ===');
  const bad = await runDiagnostic(join(dirs[0], 'workspace'), { moduleName: MODULE, casesJsonl: CASES }, { image: 'legasus-worker@sha256:' + '0'.repeat(64) });
  say(bad.status === DIAG.UNAVAILABLE, `status DIAGNOSTIC_UNAVAILABLE (${bad.status})`);
  const badMsg = diagnosticMessage(bad, MODULE, 'start');
  say(/INFRASTRUCTURE failure, not a test failure/.test(badMsg), 'the message says it is infrastructure, not a test failure');
  say(/NOTHING is known/.test(badMsg), 'and that nothing is known about the code');
  say(!/cases attempted|Every case passes/.test(badMsg), 'it reports no counts and no pass claim');

  // ── 6. OMISSION IS FLAGGED, NOT IMPLIED ──
  console.log('\n=== 6. withheld failures are counted out loud ===');
  const many = { status: DIAG.OK, identity: { sha256: 'a'.repeat(64), lines: 10, bytes: 100 }, attempted: 20, passed: 0, failed: 20, omitted: 20 - MAX_SHOWN, failures: Array.from({ length: 20 }, (_, i) => ({ n: i + 1, kind: 'FAIL', text: `f(${i}) -> 0   EXPECTED ${i}` })) };
  const manyMsg = diagnosticMessage(many, MODULE, 'start');
  say((manyMsg.match(/^ {2}FAIL case /gm) || []).length === MAX_SHOWN, `at most ${MAX_SHOWN} failing cases shown`);
  say(new RegExp(`${20 - MAX_SHOWN} further failing case\\(s\\) NOT SHOWN`).test(manyMsg), 'the number withheld is stated explicitly');
  say(/Do not assume the ones above are the only problems/.test(manyMsg), 'and the model is told not to assume it has seen everything');
} finally {
  for (const d of dirs) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
}

console.log(`\n  autodiag: ${passed} passed, ${failed} failed -> ${failed ? 'THE AUTOMATIC DIAGNOSTIC IS NOT TRUSTWORTHY' : 'delivered before acting, re-run only on real change, truthful when wrong, bound to content'}`);
process.exit(failed ? 1 : 0);
