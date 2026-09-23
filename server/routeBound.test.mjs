/**
 * routeBound.test.mjs - EXECUTION-PATH BOUNDING.
 *
 *   node server/routeBound.test.mjs
 *
 * Answers step 2 of the campaign gate: the uncovered tool-execution sites must be unavailable
 * in both arms, or carry their own qualification.
 *
 * TWO CLAIMS, KEPT APART, because they are not equally strong:
 *
 *   UNAVAILABLE (runSubtask)     `spawn_subtask` is gone from the real tool table, so the only
 *                                entry to that dispatch does not exist. Asserted against
 *                                agent.js's own `hasTool` lookup - the one the run loop does.
 *   DETECTED    (driveDetached)  the approved-command path is closed by a gate and instrumented
 *                                regardless, so a traversal EXCLUDES the run. "No approver was
 *                                watching" is not "this route cannot execute" - this project
 *                                has a route that executed 0 times in 17,466 replies and was
 *                                reachable the whole time.
 *
 * THE MODULE IS IMPORTED WITH BOUNDING ON. The bounding statement only runs in that
 * configuration, so importing agent.js unbounded would check nothing: five undefined-symbol
 * slips in this project were "verified" by checks that could not reach the line. Both
 * configurations are loaded here, in separate child processes, because ROUTES_BOUNDED is read
 * once at import and a second import in one process would return the cached module.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const { noteUncoveredTraversal, runIsBounded, refuseAtDetachedSite, UNCOVERED_SITES, traversalReport } =
  await import('./routeBound.js');

let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };

/**
 * Load agent.js in a child process under a given AGENT_BOUND_ROUTES and ask its OWN test hook
 * whether a tool is callable. Not a grep: the question is what `tools[name]` resolves to.
 */
const hasToolUnder = (bound, name) => {
  const src = `const m = await import(${JSON.stringify('file:///' + join(HERE, 'agent.js').replace(/\\/g, '/'))});
process.stdout.write(String(m.__toolPolicyTest.hasTool(${JSON.stringify(name)})));`;
  try {
    return execFileSync(process.execPath, ['--input-type=module', '-e', src], {
      encoding: 'utf8',
      env: { ...process.env, AGENT_BOUND_ROUTES: bound ? '1' : '0', AGENT_WORKSPACE: process.env.AGENT_WORKSPACE || HERE },
      timeout: 60_000,
    }).trim();
  } catch (e) { return `LOAD FAILED: ${String(e.stderr || e.message).replace(/\s+/g, ' ').slice(0, 160)}`; }
};

// ── 1. the detector fires, and a run carrying a traversal is EXCLUDED ──
console.log('=== 1. the traversal detector (positive control first) ===');
const clean = { id: 'r-clean' };
say(runIsBounded(clean).ok === true, 'a run that never touched an uncovered site is eligible');
const dirty = { id: 'r-dirty' };
noteUncoveredTraversal(dirty, 'runSubtask', 'write_file');
// POSITIVE CONTROL: if this did not change the verdict, every "0 traversals" result below
// would be meaningless - an inert detector reports a clean run for everything.
say(runIsBounded(dirty).ok === false, 'POSITIVE CONTROL: one traversal makes the run INELIGIBLE');
say(runIsBounded(dirty).traversals === 1, 'and it is counted');
say(/runSubtask/.test(runIsBounded(dirty).reason || ''), 'the reason NAMES the site - an exclusion with no attributable cause is indistinguishable from an apparatus failure');
noteUncoveredTraversal(dirty, 'driveDetached', 'run_command');
say(/runSubtask, driveDetached/.test(runIsBounded(dirty).reason || ''), 'multiple sites are all reported, not just the first');
say(UNCOVERED_SITES.length === 2, 'both uncovered sites are named in the module');
// A detector that crashes on a missing run would take the run down with it.
let threw = false;
try { noteUncoveredTraversal(null, 'runSubtask', 'x'); } catch { threw = true; }
say(!threw, 'noting a traversal on a missing run is a no-op, not a crash');

// ── 2. the detached-site gate DECIDES correctly in both configurations ──
console.log('\n=== 2. the approved-command gate ===');
say(refuseAtDetachedSite().refuse === false, 'unbounded (the ordinary hub): the approval path still executes');
const boundedDecision = execFileSync(process.execPath, ['--input-type=module', '-e',
  `const m = await import(${JSON.stringify('file:///' + join(HERE, 'routeBound.js').replace(/\\/g, '/'))});
   process.stdout.write(JSON.stringify(m.refuseAtDetachedSite()));`],
  { encoding: 'utf8', env: { ...process.env, AGENT_BOUND_ROUTES: '1' }, timeout: 30_000 }).trim();
say(JSON.parse(boundedDecision).refuse === true, `bounded: the approval path refuses (${boundedDecision.slice(0, 60)})`);
console.log('      SCOPE: this pins the DECISION. That the call sits at the right place in the');
console.log('      approve handler is a separate claim, carried by the code review of that site.');

// ── 3. THE REAL TOOL TABLE, loaded in both configurations ──
console.log('\n=== 3. spawn_subtask in agent.js\'s own tool lookup ===');
const unbounded = hasToolUnder(false, 'spawn_subtask');
say(unbounded === 'true', `unbounded: spawn_subtask IS callable - the route exists to be closed (${unbounded})`);
const bounded = hasToolUnder(true, 'spawn_subtask');
say(bounded === 'false', `bounded: spawn_subtask is NOT callable - the subtask dispatch is unreachable (${bounded})`);
// The bounding line runs ONLY when bounding is on, and it touches AUTO_TOOLS, which is
// declared after the tool table. Placed wrong it is a TDZ ReferenceError at load - invisible
// to every unbounded check. A clean load here is what rules that out.
say(!/LOAD FAILED/.test(bounded), 'agent.js LOADS CLEANLY with bounding on - the statement runs, no TDZ error');
// A tool that is merely stubbed still answers "yes, I exist", which is the wrong answer.
const keep = hasToolUnder(true, 'write_file');
say(keep === 'true', 'and ordinary tools are untouched - bounding removed one route, not the toolset');

// ── 4. traversals are an OUTCOME, reported by arm, never a silent drop ──
//
// A preregistered exclusion is still a result. If one arm reaches closed routes more often
// than the other, that is a fact about the treatment, and dropping those runs without saying
// so would hide it. Every rate must travel with the count it excluded to get there - this
// project already has a recorded case of every published percentage using the wrong
// denominator.
console.log('\n=== 4. closed-route traversal as an experimental outcome ===');
const rep = traversalReport([
  { arm: 'A' }, { arm: 'A' }, { arm: 'A', uncoveredTraversals: [{ site: 'driveDetached' }] },
  { arm: 'B' }, { arm: 'B', uncoveredTraversals: [{ site: 'runSubtask' }, { site: 'runSubtask' }] },
]);
const RA = rep.arms.find((x) => x.arm === 'A'), RB = rep.arms.find((x) => x.arm === 'B');
say(RA.runs === 3 && RA.analysed === 2 && RA.traversedRuns === 1, 'ARM A: the denominator KEEPS the excluded run (3 runs, 2 analysed, 1 excluded)');
say(RB.runs === 2 && RB.analysed === 1 && RB.traversals === 2, 'ARM B: two traversals in one run count as two calls and one excluded run');
say(/2\/3 runs analysed/.test(rep.statement) && /1\/2 runs analysed/.test(rep.statement), 'the statement quotes analysed-over-total for BOTH arms - no rate without its denominator');
say(/driveDetached=1/.test(rep.statement) && /runSubtask=2/.test(rep.statement), 'and names WHICH closed route each arm reached, so a by-arm difference is visible');
say(traversalReport([]).arms.length === 0, 'an empty campaign reports no arms rather than inventing a zero');

console.log(`\n  route bounding: ${passed} passed, ${failed} failed -> ${failed ? 'THE EXPERIMENT IS NOT BOUNDED' : 'subtask route unavailable; approval route closed and detected'}`);
process.exit(failed ? 1 : 0);
