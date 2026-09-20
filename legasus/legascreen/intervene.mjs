// LEGASCREEN — AUTO-CF-1. Counterfactual execution over a RECORDED witness.
//
// Slice 2 established that a counterfactual must be minted upstream of authority issuance, through
// the production constructor. AUTO-WITNESS-1 established that the recipe for doing so can be
// recorded from a run that was going to happen anyway. This joins them: take a recorded witness,
// delete ONE leaf fact, rebuild the whole DAG through the same production functions, and run the
// same target.
//
//     recorded facts   -> production constructors -> target -> baseline
//     facts MINUS one  -> THE SAME CONSTRUCTORS   -> target -> counterfactual
//
// No driver, no forge, no copied token, no test-only path. The screen's only power is to leave a
// fact out; everything downstream is minted by production from the world that remains.
//
// THE TWO VACUITY CASES ARE KEPT APART, because slice 1 collapsed them and produced a matrix in
// which everything depended on everything:
//
//     PERTURBATION_NO_EFFECT   the rebuilt INPUT was identical - the intervention did not happen
//     OBSERVED, delta empty    the input really changed and the OUTPUT did not - a real observation
//
// The first carries zero evidence. The second is a finding about the subject. They are not degrees
// of the same thing.
//
// AND REFUSAL IS NEVER EVIDENCE. Which stage refused is decided by the SUBJECT'S OWN brand predicate
// - a node whose original result was authority and whose rebuild is not was refused - never by a
// refusal convention invented here. A screen that invents one is reading its own guess back.
import { journey, STATE } from './outcome.mjs';
import { semantic } from './witness.mjs';

// Delete the leaf at `keys` from a copy of the argument templates. Templates are plain JSON, so this
// touches FACTS ONLY; no object under a __ref or __foreign is reachable by this route.
function without(args, keys) {
  const copy = JSON.parse(JSON.stringify(args));
  let node = copy[keys[0]];
  for (let i = 1; i < keys.length - 1; i++) {
    const k = keys[i];
    node = Object.hasOwn(node, '__array') ? node.__array[k] : node.__object[k];
    if (!node) return null;
  }
  const last = keys[keys.length - 1];
  if (keys.length === 1) return null;                       // a whole argument, not a leaf within one
  if (Object.hasOwn(node, '__array')) return null;          // removing an array element renumbers it
  if (!Object.hasOwn(node, '__object') || !Object.hasOwn(node.__object, last)) return null;
  delete node.__object[last];
  return copy;
}

// The authority coordinates of a result, read the way slice 2 read them. Reporting only.
const MAPS = ['context', 'scope', 'identity'];
function coordinates(o) {
  const flat = {};
  if (!o || typeof o !== 'object') return flat;
  for (const k of MAPS) {
    if (o[k] && typeof o[k] === 'object') {
      for (const [d, v] of Object.entries(o[k])) {
        if (v !== null && v !== undefined) flat[k + '.' + d] = String(v);
      }
    }
  }
  return flat;
}

// ONE counterfactual: remove one leaf fact and re-run the recorded construction.
export function intervene(rec, w, leaf) {
  const subject = w.root.op + '#' + w.root.id + ' ' + leaf.path;
  const j = journey(subject).mark(STATE.DISCOVERED, 'leaf fact recorded during a real run');

  const base = rec.replay(w);
  if (!base.ok) {
    j.mark(STATE.BASELINE_UNREPLAYABLE, base.why);
    return { subject, leaf, outcome: j.state(), why: base.why, journey: j };
  }
  j.mark(STATE.BASELINE_REPLAYED, 'semantically identical to the recorded result');

  const node = rec.node(leaf.node);
  const mutArgs = without(node.args, leaf.keys);
  if (!mutArgs) {
    j.mark(STATE.PERTURBATION_NOT_APPLICABLE, 'this leaf is not a removable object key');
    return { subject, leaf, outcome: j.state(), journey: j,
      why: 'the coordinate is an array element or a whole argument; removing it would renumber or'
        + ' restructure the call rather than remove a fact from it' };
  }

  // PROVEN AT THE REBUILT ARGUMENT, NOT AT THE TEMPLATE.
  //
  // A DECODE FAILURE IS NOT "NOTHING CHANGED". The first version returned PERTURBATION_NO_EFFECT
  // when the perturbed world could not be built, which is this project's oldest defect class - could
  // not measure collapsing into a measured absence - committed once more in the layer built to
  // prevent it. The baseline decoded fine, so a decode that now throws is CAUSED BY the removal:
  // the perturbation was applied, and reconstruction failed because of it.
  const before = rec.argsOf(node, node.args);
  const after = rec.argsOf(node, mutArgs);
  if (!after.ok || !before.ok) {
    j.mark(STATE.PERTURBATION_APPLIED, 'the fact was removed from the recipe');
    j.mark(STATE.RECONSTRUCTION_FAILED, (after.why || before.why));
    return { subject, leaf, outcome: j.state(), journey: j,
      why: 'the perturbed world could not be constructed at all (' + (after.why || before.why)
        + '), which is a fact about the CONSTRUCTOR and not evidence about the target' };
  }
  if (semantic(before.args) === semantic(after.args)) {
    j.mark(STATE.PERTURBATION_NO_EFFECT,
      'the reconstructed argument is identical with the fact removed');
    return { subject, leaf, outcome: j.state(), journey: j,
      why: 'removing ' + leaf.path + ' left the rebuilt input semantically unchanged, so nothing was'
        + ' intervened on and NO evidence about the subject was produced' };
  }
  j.mark(STATE.PERTURBATION_APPLIED, 'the rebuilt argument differs at ' + leaf.path);

  const cf = rec.rebuild(w, { node: leaf.node, args: mutArgs });
  if (!cf.ok) {
    // Something threw. If it was the target, the target refused; if it was upstream, the target
    // never ran and this says nothing about the target at all.
    const where = cf.state.threwAt;
    if (where === w.root.id) {
      j.mark(STATE.AUTHORITY_REFUSED, 'the target threw: ' + cf.state.error);
    } else {
      j.mark(STATE.TARGET_NOT_REACHED, 'node #' + where + ' threw: ' + cf.state.error);
    }
    return { subject, leaf, outcome: j.state(), journey: j, why: j.path().join(' -> ') };
  }

  // THE SUBJECT'S OWN PREDICATE decides what a refusal is. A premise that was authority and is no
  // longer means the production constructor refused the perturbed world.
  for (const id of w.ids) {
    if (id === w.root.id) continue;
    const was = rec.node(id).result;
    if (rec.isAuthorityObject(was) && !rec.isAuthorityObject(cf.state.results.get(id))) {
      j.mark(STATE.RECONSTRUCTION_FAILED,
        'the production constructor at #' + id + ' refused the perturbed facts');
      return { subject, leaf, outcome: j.state(), journey: j,
        why: 'no lawful neighbouring world exists for this intervention, which is a fact about the'
          + ' CONSTRUCTOR and not evidence about the target' };
    }
  }
  const observable = (v) => rec.isAuthorityObject(v) || Object.keys(coordinates(v)).length > 0;
  // A TARGET THAT STOPS PRODUCING A READABLE AUTHORITY OUTPUT HAS REFUSED, whether or not it is
  // branded. The branded test alone missed every subject whose outputs carry coordinates but no
  // brand: its refusal has no coordinates, so the screen read the missing ones as a dependency edge
  // - slice 1's defect, surviving for exactly the subjects the brand cannot speak about.
  if ((rec.isAuthorityObject(w.root.result) && !rec.isAuthorityObject(cf.result))
      || (observable(base.result) && !observable(cf.result))) {
    j.mark(STATE.AUTHORITY_REFUSED, 'the target refused a legitimately reconstructed input');
    return { subject, leaf, outcome: j.state(), journey: j,
      why: 'the target declined to produce an authority result from a premise production itself'
        + ' minted; a refusal is not a dependency, which is exactly what slice 1 got wrong' };
  }
  // NEITHER SIDE CARRIES A READABLE AUTHORITY OUTPUT -> NOTHING WAS OBSERVED.
  //
  // The first run scored six counterfactuals on a witness whose BASELINE was already a refusal: two
  // refusals compared equal, and the screen reported "measured, no dependency" six times over a call
  // that never produced anything to read. That is the slice-1 defect wearing the new architecture -
  // false confidence manufactured out of an absence.
  //
  // The test is NOT "the baseline must be observable". A baseline refusal whose counterfactual
  // SUCCEEDS is the most informative case there is: removing one fact from one premise turns
  // derive's different-worlds refusal into a conclusion, because it refuses on CONFLICT and drops on
  // ABSENCE. Discarding those would throw away the real finding to fix the fake one.
  if (cf.result === undefined || (!observable(base.result) && !observable(cf.result))) {
    j.mark(STATE.OUTPUT_UNOBSERVABLE, 'no authority output on either side of the comparison');
    return { subject, leaf, outcome: j.state(), journey: j,
      why: 'the target ran on the perturbed world, but neither the baseline nor the counterfactual'
        + ' carries a readable authority output, so the two agreeing is not a measurement' };
  }

  j.mark(STATE.OBSERVED, 'the target ran on the perturbed world and produced a readable result');
  const a = coordinates(base.result);
  const b = coordinates(cf.result);
  const delta = [];
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (a[k] !== b[k]) {
      delta.push({ coordinate: k, was: a[k], now: b[k],
        effect: b[k] === undefined ? 'REMOVED' : a[k] === undefined ? 'ADDED' : 'CHANGED' });
    }
  }
  return { subject, leaf, outcome: STATE.OBSERVED, journey: j, delta,
    changed: semantic(base.result) !== semantic(cf.result),
    // DELTA EMPTY IS NOT VACUOUS. The intervention provably happened; the output provably did not
    // move. That is an observation about the subject, and the opposite of NO_EFFECT.
    why: delta.length ? 'removing ' + leaf.path + ' moved ' + delta.length + ' output coordinate(s)'
      : 'the input changed and the authority coordinates did not' };
}

// Every removable leaf of one witness. No judgment is issued anywhere in this module.
export function interveneAll(rec, w) {
  const results = w.leaves.map((leaf) => intervene(rec, w, leaf));
  const by = {};
  for (const r of results) by[r.outcome] = (by[r.outcome] || 0) + 1;
  return { subject: w.root.op + '#' + w.root.id, results, stages: by,
    scored: results.filter((r) => r.outcome === STATE.OBSERVED).length };
}
