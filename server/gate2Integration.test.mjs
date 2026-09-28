/**
 * gate2Integration.test.mjs — does the GATE-2 rule actually CONTROL WHAT SURVIVES?
 *
 *   node server/gate2Integration.test.mjs
 *
 * `acceptanceDecision.test.mjs` has 30 passing assertions about the rule. That established nothing about
 * retention, because the live runner did not import it: it retained on `rec.boundaries.accepted` straight
 * from the functional gate. A rule that returns a verdict somewhere in the system is not a rule that
 * governs anything, and this project has recorded the same failure twice before - detection wired to
 * nothing.
 *
 * So this drives the REAL retain path - `retainPath.judgeAndDecide` and `retainPath.shouldRetain`, the
 * same two functions `managerRun.mjs` calls - with three candidates:
 *
 *   1. functionally PASSING, VIOLATES a required visual contract   -> must be BLOCKED, not retained
 *   2. functionally PASSING, required visual check NEVER RUN       -> must be BLOCKED, not retained
 *   3. functionally PASSING, passes the visual contract            -> must remain eligible for retention
 *
 * A positive control is included on purpose: if every candidate were blocked, a gate that rejects
 * everything would pass this test and be worthless.
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const git = (ws, args) => exec('git', ['-C', ws, ...args], { windowsHide: true });
const NL = String.fromCharCode(10);

const { judgeAndDecide, shouldRetain } = await import('./retainPath.mjs');
const { judgeCandidate } = await import('./judgeCandidate.mjs');
const { playCheck } = await import('./playCheck.js');
const { evaluate } = await import('./evaluator.js');
const { applyAcceptance } = await import('./acceptance.js');

let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };

const LAYOUT = resolve('legasus/bench/visual/scoreboard-layout.json');
const TRACE = resolve('legasus/bench/visual/trace.json');
const trace = JSON.parse(readFileSync(TRACE, 'utf8'));

// The functional spec: state-based, and BOTH the correct page and the wrong-totals page satisfy it,
// because they keep identical state and differ only in what they draw. That is the whole point - the
// functional gate cannot tell them apart, and the visual contract must.
const steps = trace.steps.map((s, i) => ({
  n: i + 1,
  name: i === 0 ? 'loads in its starting state' : `after pressing ${s.key}`,
  do: s.key ? [{ key: s.key }] : [],
  expect: `JSON.stringify(state) === ${JSON.stringify(JSON.stringify(s.expect))}`,
}));
steps.push({ n: steps.length + 1, name: 'no error at any point', do: [], expect: 'noErrors' });
const spec = { entry: 'index.html', stateExpr: 'window.app.state()', contract: 'scoreboard', steps };
const allSteps = steps.map((s) => s.n);

const baseTask = {
  id: 'gate2-integration', group: 'GATE2', source: 'internal', language: 'javascript', kind: 'build',
  goal: 'integration fixture', requirement: { trigger: { kind: 'key', key: 'z' }, effects: ['x'], invariants: [] },
  seed: {}, requested: { play: { spec, steps: allSteps } },
  accumulates: [], supersedes: [],
  protected: { plays: [{ from: 'the page as delivered', spec: { ...spec, steps: steps.filter((s) => s.n <= 3) }, steps: [1, 2, 3] }] },
  diagnostic: { kind: 'play', spec, timeoutSec: 90 },
  upstreamCases: allSteps.length, protectedCases: 3,
};
const withContract = { ...baseTask, visualContract: { required: true, name: '400-pixel scoreboard', layout: LAYOUT, trace: TRACE } };

/** Run ONE candidate through the real retain path and report what happened to it. */
async function run(pageFile, task, { runVisual = true } = {}) {
  const ws = mkdtempSync(join(tmpdir(), 'gate2-'));
  try {
    const html = readFileSync(pageFile, 'utf8');
    // A start state that is NOT the candidate, so acceptance has a baseline to restore to.
    writeFileSync(join(ws, 'index.html'), '<!DOCTYPE html><html><body><canvas id="c" width="400" height="100"></canvas><script>window.app={state:()=>({})};</script></body></html>', 'utf8');
    await git(ws, ['init', '-q']); await git(ws, ['config', 'core.autocrlf', 'false']);
    await git(ws, ['add', '-A']);
    await git(ws, ['-c', 'user.email=g@g', '-c', 'user.name=g', 'commit', '-q', '-m', 'start']);
    const startRef = (await git(ws, ['rev-parse', 'HEAD'])).stdout.trim();
    writeFileSync(join(ws, 'index.html'), html, 'utf8');
    await git(ws, ['add', '-A']);
    await git(ws, ['-c', 'user.email=g@g', '-c', 'user.name=g', 'commit', '-q', '-m', 'candidate']).catch((e) => {
      if (!/nothing to commit/i.test(String(e.stdout || '') + String(e.stderr || ''))) throw e;
    });
    const rec = { boundaries: {}, timing: {} };
    const decision = await judgeAndDecide({
      ws, task, spec, startRef, rec, T0: Date.now(),
      deps: { judgeCandidate, playCheck, evaluate, applyAcceptance },
      runVisual, runRender: false,
    });
    return { decision, rec, retained: shouldRetain(decision) };
  } finally { if (existsSync(ws)) { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } } }
}

// ══ 3. THE POSITIVE CONTROL FIRST. If nothing can be retained, the other two prove nothing. ═══════
console.log('\n3. a candidate that passes BOTH remains eligible for retention  (the positive control)');
const good = await run('legasus/bench/visual/correct/index.html', withContract);
say(good.decision.functionallyAccepted, 'the functional gate passes it');
say(good.rec.visual && good.rec.visual.verdict === 'DISPLAY_MATCHES_EXPECTED', `the visual contract passes it (${good.rec.visual?.verdict})`);
say(good.retained === true, 'and shouldRetain says YES - it survives');
say(good.rec.outcome === 'ACCEPTED', `its recorded outcome is ACCEPTED (${good.rec.outcome})`);

// ══ 1. functionally passing, violates the required visual contract ══════════════════════════════
console.log('\n1. functionally PASSING but VIOLATES the required visual contract -> BLOCKED');
const wrong = await run('legasus/bench/visual/wrong-totals/index.html', withContract);
say(wrong.decision.functionallyAccepted === true, 'the functional gate PASSES it - state is identical to the good page');
say(wrong.rec.visual && wrong.rec.visual.verdict === 'DISPLAY_DOES_NOT_MATCH_EXPECTED', 'the visual contract FAILS it');
say(wrong.retained === false, 'and shouldRetain says NO - it does NOT survive');
say(wrong.rec.outcome === 'BLOCKED_BY_VISUAL_CONTRACT', `recorded as blocked, not as rejected (${wrong.rec.outcome})`);
say(wrong.decision.visualStatus === 'REQUIREMENT_FAILURE_WRONG_DISPLAY', 'as a REQUIREMENT failure, not a checker limitation');

// ══ 2. functionally passing, required visual check never run ════════════════════════════════════
console.log('\n2. functionally PASSING but the required visual check was NEVER RUN -> BLOCKED');
const notrun = await run('legasus/bench/visual/correct/index.html', withContract, { runVisual: false });
say(notrun.decision.functionallyAccepted === true, 'the functional gate passes it');
say(notrun.rec.visual === null, 'no visual evidence was gathered');
say(notrun.retained === false, 'and shouldRetain says NO - an unrun required check does not silently pass');
say(notrun.decision.visualStatus === 'REQUIRED_BUT_NOT_RUN', `recorded as REQUIRED_BUT_NOT_RUN (${notrun.decision.visualStatus})`);

// ══ 4. and without a contract, the same page is retained with visual NOT EVALUATED ═══════════════
console.log('\n4. the same wrong-display page, on a task with NO visual contract');
const noContract = await run('legasus/bench/visual/wrong-totals/index.html', baseTask);
say(noContract.retained === true, 'is retained - the functional checks decide');
say(noContract.decision.visualStatus === 'NOT_RUN', `and the visual arm is recorded as ${noContract.decision.visualStatus}, never as a pass`);
say(noContract.decision.visualEvaluated === false, 'with visualEvaluated false');

console.log(`\n  gate-2 integration: ${passed} passed, ${failed} failed -> ${failed ? 'THE RULE DOES NOT CONTROL RETENTION' : 'the decision governs what survives: a visual requirement failure and an unrun required check both block, and a candidate that passes both is retained'}`);
process.exit(failed ? 1 : 0);
