// LEGASCREEN — AUTO-CF-1 + SEMANTIC-1. Counterfactual execution over a RECORDED witness.
//
// Slice 2 established that a counterfactual must be minted upstream of authority issuance, through
// the production constructor. AUTO-WITNESS-1 established that the recipe can be recorded from a run
// that was going to happen anyway. This joins them: take a recorded witness, delete one or more leaf
// facts, rebuild the whole DAG through the same production functions, and run the same target.
//
//     recorded facts    -> production constructors -> target -> baseline
//     facts MINUS some  -> THE SAME CONSTRUCTORS   -> target -> counterfactual
//
// No driver, no forge, no copied token, no test-only path. The screen's only power is to leave facts
// out; everything downstream is minted by production from the world that remains.
//
// ONE EXPERIMENT, DIFFERENT OBSERVERS. SURFACE-1 found that reading authority COORDINATES off an
// output cannot screen a predicate, because a predicate returns a boolean. The experiment is the
// same for both; what is read off the end is not:
//
//     SUPPORT    the authority coordinates of the output   producers and transducers
//     DECISION   the output value itself                   consumers
//
// They are kept apart deliberately. Nothing here claims they are one invariant.
//
// THE TWO VACUITY CASES ARE ALSO KEPT APART, because slice 1 collapsed them and produced a matrix in
// which everything depended on everything:
//
//     PERTURBATION_NO_EFFECT   the rebuilt INPUT was identical - the intervention did not happen
//     OBSERVED, delta empty    the input really changed and the OUTPUT did not - a real observation
//
// AND REFUSAL IS NEVER EVIDENCE. Which stage refused is decided by the SUBJECT'S OWN brand predicate
// - a node whose original result was authority and whose rebuild is not was refused - never by a
// refusal convention invented here.
import { journey, STATE } from './outcome.mjs';
import { semantic } from './witness.mjs';

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

export const OBSERVER = {
  // TRACK P. What authority emerged? An output with no readable authority is not an observation.
  SUPPORT: {
    name: 'SUPPORT',
    unreadableIsRefusal: true,
    read: (v, rec) => {
      const coords = coordinates(v);
      return { readable: rec.isAuthorityObject(v) || Object.keys(coords).length > 0, coords };
    },
    delta: (a, b) => {
      const out = [];
      for (const k of new Set([...Object.keys(a.coords), ...Object.keys(b.coords)])) {
        if (a.coords[k] !== b.coords[k]) {
          out.push({ coordinate: k, was: a.coords[k], now: b.coords[k],
            effect: b.coords[k] === undefined ? 'REMOVED' : a.coords[k] === undefined ? 'ADDED' : 'CHANGED' });
        }
      }
      return out;
    },
  },
  // TRACK C. What was decided? The screen does NOT label either value "permitted" - it has no way to
  // know which is which, and inventing one would be a convention rather than a measurement.
  DECISION: {
    name: 'DECISION',
    unreadableIsRefusal: false,
    read: (v) => ({ readable: v !== undefined, value: semantic(v) }),
    delta: (a, b) => (a.value === b.value ? []
      : [{ coordinate: 'DECISION', was: a.value, now: b.value, effect: 'CHANGED' }]),
  },
};

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

// Remove a SET of leaves, which may span several construction nodes. Returns a Map(node -> args).
function removeAll(rec, leaves) {
  const byNode = new Map();
  for (const l of leaves) {
    const base = byNode.get(l.node) || rec.node(l.node).args;
    const next = without(base, l.keys);
    if (!next) return null;
    byNode.set(l.node, next);
  }
  return byNode;
}

// ONE counterfactual. `leaves` is a single leaf or a set of them.
export function intervene(rec, w, leaves, { observer = OBSERVER.SUPPORT } = {}) {
  const set = Array.isArray(leaves) ? leaves : [leaves];
  const label = set.map((l) => '#' + l.node + l.path).join(' + ');
  const subject = w.root.op + '#' + w.root.id + ' ' + label;
  const j = journey(subject).mark(STATE.DISCOVERED, 'leaf facts recorded during a real run');
  const done = (why, extra = {}) => ({ subject, leaves: set, observer: observer.name,
    outcome: j.state(), journey: j, why, ...extra });

  const base = rec.replay(w);
  if (!base.ok) { j.mark(STATE.BASELINE_UNREPLAYABLE, base.why); return done(base.why); }
  j.mark(STATE.BASELINE_REPLAYED, 'semantically identical to the recorded result');

  const mut = removeAll(rec, set);
  if (!mut) {
    j.mark(STATE.PERTURBATION_NOT_APPLICABLE, 'not a removable object key');
    return done('the coordinate is an array element or a whole argument; removing it would renumber'
      + ' or restructure the call rather than remove a fact from it');
  }

  // PROVEN AT THE REBUILT ARGUMENT, NOT AT THE TEMPLATE.
  //
  // A DECODE FAILURE IS NOT "NOTHING CHANGED". An earlier version returned PERTURBATION_NO_EFFECT
  // when the perturbed world could not be built, which is this project's oldest defect class - could
  // not measure collapsing into a measured absence. The baseline decoded fine, so a decode that now
  // throws is CAUSED BY the removal.
  let changed = false, buildFailure = null;
  for (const [id, args] of mut) {
    const node = rec.node(id);
    const before = rec.argsOf(node, node.args);
    const after = rec.argsOf(node, args);
    if (!before.ok || !after.ok) { buildFailure = (after.why || before.why); break; }
    if (semantic(before.args) !== semantic(after.args)) changed = true;
  }
  if (buildFailure) {
    j.mark(STATE.PERTURBATION_APPLIED, 'the facts were removed from the recipe');
    j.mark(STATE.RECONSTRUCTION_FAILED, buildFailure);
    return done('the perturbed world could not be constructed at all (' + buildFailure + '), which'
      + ' is a fact about the CONSTRUCTOR and not evidence about the target');
  }
  if (!changed) {
    j.mark(STATE.PERTURBATION_NO_EFFECT, 'the reconstructed arguments are identical');
    return done('removing ' + label + ' left the rebuilt input semantically unchanged, so nothing'
      + ' was intervened on and NO evidence about the subject was produced');
  }
  j.mark(STATE.PERTURBATION_APPLIED, 'the rebuilt arguments differ at ' + label);

  const cf = rec.rebuild(w, mut);
  if (!cf.ok) {
    const where = cf.state.threwAt;
    if (where === w.root.id) j.mark(STATE.AUTHORITY_REFUSED, 'the target threw: ' + cf.state.error);
    else j.mark(STATE.TARGET_NOT_REACHED, 'node #' + where + ' threw: ' + cf.state.error);
    return done(j.path().join(' -> '));
  }

  // THE SUBJECT'S OWN PREDICATE decides what a reconstruction refusal is. A premise that was
  // authority and is no longer means the production constructor refused the perturbed world.
  for (const id of w.ids) {
    if (id === w.root.id) continue;
    if (rec.isAuthorityObject(rec.node(id).result)
        && !rec.isAuthorityObject(cf.state.results.get(id))) {
      j.mark(STATE.RECONSTRUCTION_FAILED, 'the constructor at #' + id + ' refused the perturbed facts');
      return done('no lawful neighbouring world exists for this intervention, which is a fact about'
        + ' the CONSTRUCTOR and not evidence about the target');
    }
  }

  const a = observer.read(base.result, rec);
  const b = observer.read(cf.result, rec);

  // A TARGET THAT STOPS PRODUCING A READABLE AUTHORITY OUTPUT HAS REFUSED - but only under an
  // observer for which that is meaningful. Under DECISION the output IS the observation, so a
  // changed value is the measurement rather than a refusal.
  if (observer.unreadableIsRefusal
      && ((rec.isAuthorityObject(w.root.result) && !rec.isAuthorityObject(cf.result))
        || (a.readable && !b.readable))) {
    j.mark(STATE.AUTHORITY_REFUSED, 'the target refused a legitimately reconstructed input');
    return done('the target declined to produce an authority result from a premise production itself'
      + ' minted; a refusal is not a dependency, which is exactly what slice 1 got wrong');
  }
  if (!a.readable && !b.readable) {
    j.mark(STATE.OUTPUT_UNOBSERVABLE, 'no readable output on either side of the comparison');
    return done('the target ran on the perturbed world, but neither side carries anything this'
      + ' observer can read, so the two agreeing is not a measurement');
  }

  j.mark(STATE.OBSERVED, 'the target ran on the perturbed world and produced a readable result');
  const delta = observer.delta(a, b);
  return { subject, leaves: set, observer: observer.name, outcome: STATE.OBSERVED, journey: j, delta,
    // DELTA EMPTY IS NOT VACUOUS. The intervention provably happened; the output provably did not
    // move. That is an observation about the subject, and the opposite of NO_EFFECT.
    why: delta.length ? 'removing ' + label + ' moved ' + delta.length + ' reading(s)'
      : 'the input changed and the observed reading did not' };
}

// Every removable leaf of one witness, one at a time. No judgment is issued anywhere in this module.
export function interveneAll(rec, w, opts = {}) {
  const results = w.leaves.map((leaf) => intervene(rec, w, leaf, opts));
  const by = {};
  for (const r of results) by[r.outcome] = (by[r.outcome] || 0) + 1;
  return { subject: w.root.op + '#' + w.root.id, results, stages: by,
    scored: results.filter((r) => r.outcome === STATE.OBSERVED).length };
}

export { coordinates };
