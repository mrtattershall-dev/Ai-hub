/**
 * reExerciseRule.test.mjs — pins the rule that decides whether a repeated assertion is worth running.
 *
 *   node server/reExerciseRule.test.mjs
 *
 * This rule has been wrong twice, in OPPOSITE directions, which is why it gets its own controls instead
 * of being validated only by whatever the three bench shapes happen to contain:
 *
 *   v1  byte-identical `expect` alone -> a repeat with nothing in between was kept, and a mutant that
 *       stopped responding after the first use ESCAPED. A syntactic relation is not a semantic one.
 *   v2  "was the observed perturbation applied in between" -> right for a repeated TRIGGER, wrong for a
 *       repeated ROUTE assertion. It FALSELY REFUSED "typing still narrows" and invented a node.
 *
 * The rule under test, in one line: a repeat is meaningful only when some INTERVENING ACTION could have
 * altered the property being asserted. There are two ways to know that, and they are not equal:
 *
 *   OBSERVED     the intervening action was measured on the DELIVERED baseline to leave the claim
 *   CONDITIONAL  the intervening action is the trigger itself - unobservable on the baseline because it
 *                does not exist there - so the repeat DEPENDS on the node that owns the trigger's first
 *                application, and that dependency is recorded rather than assumed
 *
 * These controls run derive() over hand-built tasks with a STUBBED observation. That is deliberate: the
 * subject here is the RULE, not the browser. graphNodeMutants.mjs exercises the same rule end to end.
 */
import { derive } from './featureGraph.mjs';

let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };

const PAGE = '<html><body><input id="q"><ul><li class="item">a</li></ul>'
  + '<script>function refresh(){} q.addEventListener("input", refresh);</script></body></html>';
const TYPE = { kind: 'type', selector: '#q', text: 'al' };
const CLICK = { kind: 'click', selector: '#go' };
const NARROWED = 'NARROWED';
const RESTORED = 'RESTORED';

// A stub observation: `#q` typing is the action observed to leave the claim's target state. Nothing in
// the rule under test looks at anything else on it.
const observation = { s0: { visible: ['a'], hidden: [], inputValues: { '#q': '' } }, claim: 'true', perturbation: { action: TYPE }, refusals: [] };
const deps = { topLevelFunctions: () => [], referencedElsewhere: () => false, observation };

const task = (steps, { addition, carried, invariants = [], trigger = { kind: 'click', selector: '#go' } }) => ({
  requirement: { trigger, effects: ['the effect'], invariants },
  provenance: { additionSteps: addition, carriedSteps: carried, noErrorStep: 99 },
  diagnostic: { spec: { entry: 'index.html', steps } },
});

const nodeAt = (g, n) => g.nodes.find((x) => x.step === n);
const refusalFor = (g, id) => g.refusals.find((r) => r.id === id);

// == CONTROL 1 - type -> trigger -> type MUST create a re-exercise edge ==========================
// The repeat is meaningful because the TRIGGER sits between the two filter actions and could have
// broken the filtering path. v2 of the rule refused this, which was a false refusal. The trigger does
// not exist on the baseline, so this can only ever be CONDITIONAL - and the condition must be an edge.
console.log('\ncontrol 1 - type, trigger, type: a valid edge, CONDITIONAL, dependency explicit');
{
  const g = derive(PAGE, task([
    { n: 1, name: 'load', do: [], expect: 'LOADED' },
    { n: 2, name: 'typing narrows', do: [TYPE], expect: NARROWED },
    { n: 3, name: 'the trigger restores', do: [CLICK], expect: RESTORED },
    { n: 4, name: 'typing still narrows', do: [TYPE], expect: NARROWED },
  ], { addition: [3], carried: [1, 2, 4], invariants: ['typing still narrows'] }), deps);
  const p1 = nodeAt(g, 4);
  const e1 = nodeAt(g, 3);
  say(!!p1, 'the repeated assertion is kept as a node, not refused');
  say(!!p1 && p1.reExerciseOf === 'step 2', `it is marked a re-exercise of the earlier step even though that step is not itself a node (got ${p1 && p1.reExerciseOf})`);
  say(!!p1 && p1.distinguishing === 'CONDITIONAL', `and CONDITIONAL, because the only thing in between is the trigger, which cannot be observed on the baseline (got ${p1 && p1.distinguishing})`);
  say(!!p1 && !!e1 && (p1.dependsOn || []).includes(e1.id), `and DEPENDS on ${e1 && e1.id} - the assumption that the trigger fired is a recorded edge, not a silent one`);
}

// == CONTROL 2 - trigger -> perturb -> trigger is OBSERVED, the stronger tier ====================
// Here the intervening action was measured on the DELIVERED page to leave the claim's state, so the
// repeat needs no assumption about the candidate at all.
console.log('\ncontrol 2 - trigger, perturb, trigger: OBSERVED, no assumption needed');
{
  const g = derive(PAGE, task([
    { n: 1, name: 'load', do: [], expect: 'LOADED' },
    { n: 2, name: 'typing narrows', do: [TYPE], expect: NARROWED },
    { n: 3, name: 'the trigger restores', do: [CLICK], expect: RESTORED },
    { n: 4, name: 'narrow it again', do: [TYPE], expect: NARROWED },
    { n: 5, name: 'the trigger restores again', do: [CLICK], expect: RESTORED },
  ], { addition: [3, 5], carried: [1, 2, 4] }), deps);
  const e2 = nodeAt(g, 5);
  say(!!e2 && e2.distinguishing === 'OBSERVED', `the second trigger application is OBSERVED-distinguishing (got ${e2 && e2.distinguishing})`);
  say(!!e2 && JSON.stringify(e2.distinguishedBy) === JSON.stringify(TYPE), 'and names the action that was measured to leave the claim');
}

// ══ CONTROL 3 — trigger, trigger, nothing in between: must NOT create an edge ════════════════════
// This is the g2 shape and the mutant that escaped. The second application starts from a state that
// already satisfies the assertion, so a dead handler is indistinguishable from a live one.
console.log('\ncontrol 3 - trigger, trigger with nothing in between: UNOBSERVABLE_REPEAT');
{
  const g = derive(PAGE, task([
    { n: 1, name: 'load', do: [], expect: 'LOADED' },
    { n: 2, name: 'perturb', do: [TYPE], expect: NARROWED },
    { n: 3, name: 'the trigger restores', do: [CLICK], expect: RESTORED },
    { n: 4, name: 'and again', do: [CLICK], expect: RESTORED },
  ], { addition: [3, 4], carried: [1, 2] }), deps);
  say(!nodeAt(g, 4), 'the repeat is NOT kept as a node');
  const r = refusalFor(g, 'E2');
  say(!!r && r.type === 'UNOBSERVABLE_REPEAT', `it is refused with a typed outcome, not a comment: ${r && r.type}`);
  say(g.nodes.some((n) => n.id === 'D' && n.sequence), 'and a DERIVED distinguishing sequence replaces it');
  const d = g.nodes.find((n) => n.id === 'D');
  const acts = d ? d.sequence.map((s) => JSON.stringify(s.do[0])) : [];
  say(acts.length === 4 && acts[0] === JSON.stringify(TYPE) && acts[2] === JSON.stringify(TYPE),
    `whose sequence perturbs BEFORE each application: ${acts.map((a) => (a === JSON.stringify(TYPE) ? 'perturb' : 'trigger')).join(' -> ')}`);
}

// ══ CONTROL 4 — an intervening step with an EMPTY `do` is not an intervening action ═══════════════
// The narrowest way to get this wrong: count a step that asserts something but does nothing.
console.log('\ncontrol 4 - an assertion-only step in between does not rescue the repeat');
{
  const g = derive(PAGE, task([
    { n: 1, name: 'load', do: [], expect: 'LOADED' },
    { n: 2, name: 'perturb', do: [TYPE], expect: NARROWED },
    { n: 3, name: 'the trigger restores', do: [CLICK], expect: RESTORED },
    { n: 4, name: 'still restored (no action)', do: [], expect: 'OTHER' },
    { n: 5, name: 'and again', do: [CLICK], expect: RESTORED },
  ], { addition: [3, 4, 5], carried: [1, 2] }), deps);
  say(!nodeAt(g, 5), 'the repeat at step 5 is still refused');
  const r = refusalFor(g, 'E3');
  say(!!r && r.type === 'UNOBSERVABLE_REPEAT', `with the same typed outcome: ${r && r.type}`);
}

// ══ CONTROL 5 — no perturbation available at all: refuse BOTH, never fabricate ═══════════════════
console.log('\ncontrol 5 - with no observed perturbation, nothing is invented');
{
  const blind = { ...observation, perturbation: null };
  const g = derive(PAGE, task([
    { n: 1, name: 'load', do: [], expect: 'LOADED' },
    { n: 2, name: 'the trigger restores', do: [CLICK], expect: RESTORED },
    { n: 3, name: 'and again', do: [CLICK], expect: RESTORED },
  ], { addition: [2, 3], carried: [1] }), { ...deps, observation: blind });
  say(!g.nodes.some((n) => n.id === 'D'), 'no durability node is fabricated');
  say(!!refusalFor(g, 'D') && refusalFor(g, 'D').type === 'NO_PERTURBATION', 'the inability is recorded as NO_PERTURBATION');
  say(!!refusalFor(g, 'W') && refusalFor(g, 'W').type === 'NO_PERTURBATION', 'and W is refused for the same reason rather than checked from a fresh load');
}

console.log(`\n  re-exercise rule: ${passed} passed, ${failed} failed -> ${failed
  ? 'THE RULE IS WRONG IN AT LEAST ONE DIRECTION'
  : 'meaningful repeats are kept, unobservable ones are refused with a typed outcome'}`);
process.exit(failed ? 1 : 0);
