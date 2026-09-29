// ══════════════════════════════════════════════════════════════════════════════════════════════════
// behaviorModel.mjs — a bounded behavioural model of the DELIVERED page, used to build sequences that
// can actually tell two implementations apart.
//
// WHY THIS EXISTS. `graphNodeMutants.mjs` found a mutant that could not be caught: on the keyboard
// shape the emitter presses the trigger twice with nothing in between, so by the second press the page
// is already in the target state and a handler that has stopped responding is OBSERVATIONALLY
// IDENTICAL to a correct one. The step was not wrong. It was NON-DISTINGUISHING - it contained no
// sequence that separates the required transition from a no-op.
//
// THE CRITERION, and it is the whole module in one sentence:
//
//   An action is a VALID PERTURBATION for a claim K if, ON THE BASELINE, applying it produces a state
//   in which K IS FALSE.
//
// That is checkable without any candidate. If K is false after the perturbation and true after the
// trigger, then the trigger is the only thing that could have made it true - which is exactly what a
// "does this control actually do its job" check has to establish, and exactly what pressing a key
// twice from a state that already satisfies K does not.
//
// THE MODEL IS DELIBERATELY SMALL. It is not a learned automaton over the whole page. It is: the load
// state, the actions the task itself already uses, and which of them move the page out of the claim's
// target state. Nothing here reads a candidate - only the delivered baseline, which is input.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/** The observed page as a user sees it, reduced to what a claim can talk about. */
const snap = (o) => (o ? { visible: o.visible || [], hidden: o.hidden || [], inputValues: o.inputValues || {} } : null);

/**
 * THE RESTORE CLAIM, built from the observed load state.
 *
 * It is SUBSET-INCLUSION on visible text plus EQUALITY on the baseline's own input fields, and not
 * equality on the whole visible list, because a correct candidate ADDS a control whose text is then
 * visible. An equality claim would fail every correct candidate; that is the trap the emitter avoids
 * by scoping to governed items, and the same reasoning applies here.
 *
 * NAMED LIMIT: subset-inclusion cannot see SPURIOUS added text. A candidate that restores everything
 * and also prints something extra satisfies this claim. That is a real gap in this claim, not a gap in
 * the sequence machinery, and no node here should be read as covering it.
 */
export function restoreClaim(s0) {
  const texts = JSON.stringify(s0.visible);
  const fields = JSON.stringify(s0.inputValues);
  return `${texts}.every((t) => dom.visible.includes(t))`
    + ` && Object.keys(${fields}).every((k) => dom.inputValues[k] === ${fields}[k])`;
}

/** Evaluate a claim written for the browser against a snapshot captured in Node. One source of truth. */
export function holds(claim, state) {
  try { return !!new Function('dom', `return (${claim});`)(state); } catch { return false; }
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Observe the delivered page and work out which of the task's own actions can be used to make a claim
 * meaningful. Takes the BASELINE, never a candidate.
 *
 * Returns { s0, claim, vocabulary, perturbation, refusals }. `perturbation` is null when the page
 * offers no action that leaves the claim's target state - in which case a distinguishing sequence
 * cannot be built and the caller must REFUSE the node rather than emit a sequence that proves nothing.
 */
export async function observeBaseline(html, task, deps) {
  const spec = task.diagnostic.spec;
  const entry = spec.entry || 'index.html';
  const ws = mkdtempSync(join(tmpdir(), 'behav-'));
  const refusals = [];
  try {
    writeFileSync(join(ws, entry), html, 'utf8');
    const run = async (steps) => deps.playCheck(ws, { ...spec, contract: 'behavioural observation', steps });
    // Every step asserts `false`, so every step fails and records what the page looked like. That is the
    // only way playCheck reports a state rather than a verdict, and the emitter reads it the same way.
    const obsOf = (r, n) => { const c = ((r && r.cases) || []).find((x) => x.n === n); return c && c.observed ? snap(c.observed) : null; };

    const load = await run([{ n: 1, name: 'load', do: [], expect: 'false' }]);
    const s0 = obsOf(load, 1);
    if (!s0) return { s0: null, claim: null, vocabulary: [], perturbation: null, refusals: [{ id: 'observation', type: 'UNOBSERVABLE_BASELINE', why: 'the delivered page could not be observed at all' }] };
    const claim = restoreClaim(s0);

    // The action vocabulary is the task's OWN actions, minus anything aimed at the control the task is
    // asking for - that control does not exist on the baseline, so it cannot be used to establish state.
    const trig = task.requirement.trigger;
    const isTrigger = (a) => (trig.selector && a.selector === trig.selector) || (trig.key && a.kind === 'key' && a.key === trig.key);
    const seen = new Set();
    const vocabulary = [];
    for (const s of spec.steps) {
      for (const a of s.do || []) {
        const k = JSON.stringify(a);
        if (isTrigger(a) || seen.has(k)) continue;
        seen.add(k); vocabulary.push(a);
      }
    }
    if (!vocabulary.length) refusals.push({ id: 'perturbation', type: 'NO_ACTION_VOCABULARY', why: 'the task uses no action other than the trigger itself, so no state can be established before it' });

    // Which of them actually leaves the claim's target state? Observed, on the baseline, one at a time
    // from a fresh load so none contaminates another.
    const tried = [];
    for (const [i, a] of vocabulary.entries()) {
      const r = await run([{ n: 100 + i, name: 'perturb', do: [a], expect: 'false' }]);
      const after = obsOf(r, 100 + i);
      tried.push({ action: a, after, movesState: after ? !same(after, s0) : false, leavesClaim: after ? !holds(claim, after) : false });
    }
    const perturbation = tried.find((t) => t.leavesClaim) || null;
    if (vocabulary.length && !perturbation) {
      refusals.push({ id: 'perturbation', type: 'NO_PERTURBATION', why: `none of the task's ${vocabulary.length} non-trigger actions leaves the claim's target state on the delivered page, so no sequence here can separate a working control from a dead one` });
    }
    return { s0, claim, vocabulary, tried, perturbation, refusals };
  } finally { if (existsSync(ws)) { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } } }
}

// REMOVED ON PURPOSE: `perturbsBetween(task, first, second, perturbation)`.
//
// It asked only "was the OBSERVED PERTURBATION applied between the two assertions". That is right for a
// repeated TRIGGER and WRONG for a repeated ROUTE assertion, and applying it to every byte-identical
// pair produced a FALSE REFUSAL: on the filter shape it threw away P1 ("typing still narrows") and
// invented a durability node in its place. What makes P1 worth asserting twice is that THE TRIGGER
// fired in between and undid the narrowing - not that more text was typed.
//
// The replacement lives in featureGraph.derive, because it needs the node set, and it is two-tier:
//   OBSERVED     an intervening action was measured ON THE BASELINE to leave the claim's state
//   CONDITIONAL  the intervening action is the trigger, which cannot be observed on the baseline
//                because it does not exist there - so the repeat is recorded as DEPENDING on the node
//                that owns the trigger's first application, rather than assumed
//   otherwise    UNOBSERVABLE_REPEAT: refused, and a derived distinguishing sequence built if possible
//
// The rule is pinned by reExerciseRule.test.mjs. A syntactic relation is not a semantic one, and this
// function was the place that mistook one for the other.
