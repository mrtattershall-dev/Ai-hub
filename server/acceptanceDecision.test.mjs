/**
 * acceptanceDecision.test.mjs — the four situations, and the two that must never be confused.
 *
 *   node server/acceptanceDecision.test.mjs
 *
 * The rule under test is not "does the visual check work" - that is validated in VISUAL-1 against five
 * fixtures. It is whether the DECISION treats the same visual outcome differently depending on what the
 * task asked for:
 *
 *   non-conformance when the task REQUIRES the layout   = a REQUIREMENT FAILURE, and it blocks
 *   non-conformance when the task requires nothing      = a CHECKER LIMITATION, reported as NOT
 *                                                         EVALUATED, and it does not block
 *
 * Getting that backwards fails in one of two bad ways: advisory everywhere lets a KNOWN WRONG DISPLAY
 * through on the tasks where it can actually be verified; blocking everywhere rejects almost every real
 * page for a fact about the checker rather than about the page.
 */
const { decide } = await import('./acceptanceDecision.mjs');

let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };

const OK = { accepted: true, disposition: 'RETAIN' };
const BAD = { accepted: false, disposition: 'PRESERVE_INCOMPLETE' };
const CONTRACT = { visualContract: { required: true, name: '400-pixel scoreboard' } };
const NO_CONTRACT = {};

const MATCHES = { ok: true, evaluated: true, verdict: 'DISPLAY_MATCHES_EXPECTED', mismatched: [] };
const WRONG = { ok: true, evaluated: true, verdict: 'DISPLAY_DOES_NOT_MATCH_EXPECTED', mismatched: [{ step: 3 }, { step: 4 }] };
const NONCONFORMING = { ok: true, evaluated: false, verdict: 'LAYOUT_DOES_NOT_CONFORM', reason: 'the canvas is 200x100 and the layout spec describes 400x100' };

// ══ 1. a task WITH a supported visual contract ══════════════════════════════════════════════════
{
  console.log('\n1. the task requires the supported layout: conformance AND correct totals are required');
  const good = decide({ functional: OK, visual: MATCHES, task: CONTRACT });
  say(good.accepted, 'functional pass + matching display is ACCEPTED');
  say(good.visualStatus === 'MATCHES' && good.visualBlocking, 'and the visual arm is recorded as blocking');

  const wrong = decide({ functional: OK, visual: WRONG, task: CONTRACT });
  say(!wrong.accepted, 'functional pass + WRONG display is REJECTED');
  say(wrong.visualStatus === 'REQUIREMENT_FAILURE_WRONG_DISPLAY', `as a requirement failure (${wrong.visualStatus})`);
  say(wrong.functionallyAccepted === true, 'while the functional result is still reported as a PASS, separately');
  say(wrong.reasons.some((r) => /do not match/.test(r)), 'and the reason names the mismatch');

  const nonconf = decide({ functional: OK, visual: NONCONFORMING, task: CONTRACT });
  say(!nonconf.accepted, 'functional pass + NON-CONFORMING layout is REJECTED when the task required that layout');
  say(nonconf.visualStatus === 'REQUIREMENT_FAILURE_NONCONFORMING', `as a requirement failure, not a checker limitation (${nonconf.visualStatus})`);
  say(nonconf.reasons.some((r) => /requires the 400-pixel scoreboard layout/.test(r)), 'naming the contract it failed');

  const notrun = decide({ functional: OK, visual: null, task: CONTRACT });
  say(!notrun.accepted && notrun.visualStatus === 'REQUIRED_BUT_NOT_RUN',
    'a required visual check that was never run blocks rather than silently passing');
}

// ══ 2. a task WITHOUT a visual contract ═════════════════════════════════════════════════════════
{
  console.log('\n2. the task requires no layout: the same visual outcomes do NOT block');
  const nonconf = decide({ functional: OK, visual: NONCONFORMING, task: NO_CONTRACT });
  say(nonconf.accepted, 'a NON-CONFORMING page is still accepted - that is a fact about the checker');
  say(nonconf.visualStatus === 'NOT_EVALUATED', `and is reported as NOT_EVALUATED (${nonconf.visualStatus})`);
  say(nonconf.advisories.some((a) => /NOT EVALUATED/.test(a)), 'with an advisory saying visual correctness was not evaluated');
  say(nonconf.visualEvaluated === false, 'and `visualEvaluated` is false, so nothing can read it as a visual pass');

  const wrong = decide({ functional: OK, visual: WRONG, task: NO_CONTRACT });
  say(wrong.accepted, 'a MISMATCHING display does not block a task that declared no visual contract');
  say(wrong.visualStatus === 'MISMATCH_ADVISORY', `but it is recorded (${wrong.visualStatus})`);
  say(wrong.advisories.some((a) => /NOT blocking/.test(a)), 'and the advisory says plainly why it did not block');
}

// ══ 3. the functional gate is still decisive in the negative ════════════════════════════════════
{
  console.log('\n3. a visual pass never rescues a functional failure');
  const r = decide({ functional: BAD, visual: MATCHES, task: CONTRACT });
  say(!r.accepted, 'functional FAIL + matching display is REJECTED');
  say(r.reasons.some((x) => /functional checks did not pass/.test(x)), 'for the functional reason');
  say(r.summary.functional === 'FAIL' && r.summary.visual === 'MATCHES',
    'and the two outcomes are reported SEPARATELY in the summary');
}

// ══ 4. renderEvidence is advisory everywhere ════════════════════════════════════════════════════
{
  console.log('\n4. renderEvidence never rejects, under any task');
  const contra = { ok: true, verdict: 'RENDER_CONTRADICTS_STATE', coverage: { functionalRuleExercised: true, injectiveRuleExercised: true, revisitedStates: 2, distinctStates: 4 } };
  const withContract = decide({ functional: OK, visual: MATCHES, render: contra, task: CONTRACT });
  say(withContract.accepted, 'a render contradiction does not block even under a visual contract');
  say(withContract.renderStatus === 'RENDER_CONTRADICTS_STATE', 'the contradiction is still recorded');
  say(withContract.advisories.some((a) => /ADVISORY ONLY/.test(a)), 'as an advisory that says why it is not a verdict');
  say(!!withContract.renderCoverage && withContract.renderCoverage.revisitedStates === 2,
    'and its COVERAGE is carried through, so a reader can see which rules actually ran');

  const vac = decide({ functional: OK, visual: MATCHES, render: { ok: true, verdict: 'RENDER_EVIDENCE_VACUOUS', coverage: { functionalRuleExercised: false, injectiveRuleExercised: false } }, task: NO_CONTRACT });
  say(vac.accepted && /VACUOUS/.test(vac.advisories.join(' ')), 'a vacuous render result is recorded as supporting nothing either way');

  const none = decide({ functional: OK, visual: MATCHES, render: null, task: CONTRACT });
  say(none.renderStatus === 'NOT_RUN', 'and not running it at all is reported as NOT_RUN');
}

// ══ 5. the summary always separates the arms ════════════════════════════════════════════════════
{
  console.log('\n5. functional and visual are never read off one another');
  const r = decide({ functional: OK, visual: NONCONFORMING, render: null, task: NO_CONTRACT });
  say(r.summary.functional === 'PASS', 'the functional arm reports PASS');
  say(r.summary.visual === 'NOT_EVALUATED', 'the visual arm reports NOT_EVALUATED');
  say(r.accepted === true, 'and the overall decision is acceptance, on the functional arm alone');
  say(/advisory/.test(r.summary.render), 'the render arm is always labelled advisory in the summary');
}

console.log(`\n  acceptance decision: ${passed} passed, ${failed} failed -> ${failed ? 'THE RULE IS NOT ESTABLISHED' : 'a required contract blocks, an unsupported layout is not evaluated, and render evidence never rejects'}`);
process.exit(failed ? 1 : 0);
