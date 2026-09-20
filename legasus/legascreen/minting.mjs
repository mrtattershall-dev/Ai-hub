// LEGASCREEN v2 — THE MINTING PROBES, on a WITNESS -> PERTURBATION -> INVARIANT architecture.
//
// WHY THE ARCHITECTURE CHANGED. Pointed at calculus.mjs, v1's erasure probe produced seven positives
// over eight functions, nearly all because a wrong-shape call returns a plausible object and the
// screen inspected the nonsense. It could not tell a semantic abnormality from having called the
// function with rubbish. legaexercise/witness.mjs has said since r2 that there is NO OBSERVATION
// WITHOUT EXECUTION; the screening layer ignored its own project's rule and paid the usual price.
//
// So nothing here concludes anything from an output until the call that produced it is WITNESSED:
//
//     1 OPPORTUNITY    a call that SUCCEEDS and returns an authority-bearing object
//     2 PERTURBATION   exactly ONE controlled change to that witnessed call's inputs
//     3 INVARIANT      what must, or must not, change in the output's authority
//
// A probe that cannot complete step 1 reports UNSCREENED. It never reports clean.
//
// TWO INVARIANTS, DELIBERATELY NOT COLLAPSED. Recorded in the preregistration before either was
// written, because the difference is the whole finding:
//
//     I-ANCESTRY   strip D from EVERY input -> the output must not establish D.
//                  Universal. Catches authority minted from nothing.
//                  IT DOES NOT CATCH C2, and that was predicted: C2's S1 was in the closure of its
//                  inputs - premise two established it - so nothing was minted from nothing.
//     I-WEAKENING  strip D from ONE input -> the output must not establish D.
//                  Only for operations whose OWN SOURCE declares conjunctive combination. This is
//                  the hand-authored part and it is named rather than hidden; calculus.derive
//                  qualifies because its source says "the output context is the INTERSECTION".
//
// The two may turn out to be one graph invariant. The data has not earned that reduction and this
// file does not assume it.

// Where a transformation's authority lives. Both names are used in this repository: tokens carry
// `context`, graph nodes and adapted records carry `scope`.
const AUTHORITY_MAP = ['context', 'scope'];

const mapOf = (o) => {
  if (!o || typeof o !== 'object') return null;
  for (const k of AUTHORITY_MAP) if (o[k] && typeof o[k] === 'object') return { key: k, map: o[k] };
  return null;
};

// A dimension is ESTABLISHED when it is present and is neither null nor undefined. That is the
// repository's own reading of absence, from covers(): null licenses nothing.
const established = (map) => Object.entries(map)
  .filter(([, v]) => v !== null && v !== undefined).map(([k]) => k);

const strip = (obj, dim) => {
  const m = mapOf(obj);
  if (!m) return obj;
  const next = { ...m.map };
  delete next[dim];
  return { ...obj, [m.key]: next };
};

// A PERTURBATION THAT CHANGES NOTHING CANNOT TEST ANYTHING, and the first version of this file had no
// such check. Run at HEAD it reported adapt.adaptRecord minting `criterion` and `history` - because
// the INPUT identity is keyed {producer, document, ordinal} while the OUTPUT scope is keyed
// {criterion, history}. Stripping `criterion` from an input that has no `criterion` was a no-op, so
// the invariant "failed" without anything having been changed.
//
// That is hazard 3 in this project's own ledger - a control that could not fire - committed inside a
// screen whose purpose is to catch exactly that. A dimension the inputs never carried is a
// DERIVATION the probe cannot perturb by name, and the honest answer is UNSCREENED.
const perturbed = (before, after) => before.some((b, i) => {
  const mb = mapOf(b); const ma = mapOf(after[i]);
  if (!mb || !ma) return false;
  return Object.keys(mb.map).length !== Object.keys(ma.map).length;
});

// ONE screened operation. `call(inputs)` must be pure with respect to the inputs it is handed.
//
//   name     what to report
//   inputs   the array of authority-bearing arguments, as a legitimate call would supply them
//   call     (inputs) => output
//   conjunctive  whether the operation's own documentation declares intersection semantics, and the
//                source line that says so. Absent means I-WEAKENING is not applied and says so.
export function screenTransform({ name, inputs, call, conjunctive = null }) {
  const positives = [];
  const unscreened = [];

  // ---- 1 OPPORTUNITY. The witness. Without it nothing below is evidence about anything.
  let witness;
  try { witness = call(inputs); } catch (e) {
    return { name, positives: [],
      unscreened: [{ subject: name, why: 'the legitimate call THREW (' + e.message + '), so no'
        + ' witnessed execution exists and nothing is screened here. NOT FLAGGED means NOT EXAMINED.' }],
      witnessed: false };
  }
  const out = mapOf(witness);
  if (!out) {
    return { name, positives: [],
      unscreened: [{ subject: name, why: 'the call succeeded but returned no authority map (context or'
        + ' scope), so there is no authority to perturb. Nothing is screened here.' }],
      witnessed: false };
  }
  const outDims = established(out.map);
  if (!outDims.length) {
    return { name, positives: [], witnessed: true,
      unscreened: [{ subject: name, why: 'the witnessed output establishes no dimension, so every'
        + ' perturbation below would be vacuous. A pass here would mean nothing.' }] };
  }

  let perturbations = 0;
  for (const dim of outDims) {
    const value = out.map[dim];

    // ---- 2/3 I-ANCESTRY. Strip the dimension from EVERY input; it must not survive in the output.
    const allStripped = inputs.map((i) => strip(i, dim));
    let a;
    if (!perturbed(inputs, allStripped)) {
      unscreened.push({ subject: name + ' [' + dim + ']',
        why: 'no input carries a key named ' + dim + ', so stripping it changed nothing and the'
          + ' perturbation is VACUOUS. The output dimension is DERIVED from differently-named inputs,'
          + ' which this probe cannot perturb by name. NOT FLAGGED means NOT EXAMINED.' });
      continue;
    }
    try { a = call(allStripped); } catch (e) { a = null; }
    if (a === null) {
      unscreened.push({ subject: name + ' [' + dim + ']',
        why: 'the ANCESTRY perturbation could not be run (the call threw), so that invariant was not'
          + ' evaluated for this dimension' });
    } else {
      perturbations++;
      const am = mapOf(a);
      if (am && am.map[dim] !== null && am.map[dim] !== undefined) {
        positives.push({ probe: 'I-ANCESTRY', subject: name, dimension: dim,
          value: String(am.map[dim]),
          why: name + ' establishes ' + dim + ' = ' + String(am.map[dim]) + ' in its output after '
            + dim + ' was removed from EVERY input. The authority has no ancestry in the inputs.' });
      }
    }

    // ---- 2/3 I-WEAKENING. Conjunctive operations only, and the declaration is quoted.
    if (conjunctive && inputs.length > 1) {
      for (let k = 0; k < inputs.length; k++) {
        const weakened = inputs.map((i, j) => (j === k ? strip(i, dim) : i));
        let w;
        try { w = call(weakened); } catch (e) { w = null; }
        if (w === null) continue;
        perturbations++;
        const wm = mapOf(w);
        if (wm && wm.map[dim] === value) {
          positives.push({ probe: 'I-WEAKENING', subject: name, dimension: dim, input: k,
            value: String(value),
            why: name + ' declares conjunctive combination (' + conjunctive + ') and still establishes '
              + dim + ' = ' + String(value) + ' after ' + dim + ' was removed from input ' + k
              + '. A conjunction that survives the loss of a conjunct is not a conjunction.' });
          break;   // one witness per dimension is enough; the rest is the same finding
        }
      }
    }
  }
  return { name, positives, unscreened, witnessed: true, perturbations };
}

// POSITIVE CONTROL, exported so a caller can prove the probe is not simply hostile to every output
// that retains a dimension: when the inputs JOINTLY establish D, retaining D must NOT be flagged.
export function screenAll(transforms) {
  const positives = []; const unscreened = [];
  let witnessed = 0; let perturbations = 0;
  for (const t of transforms) {
    const r = screenTransform(t);
    positives.push(...r.positives);
    unscreened.push(...(r.unscreened || []));
    if (r.witnessed) witnessed++;
    perturbations += r.perturbations || 0;
  }
  return { positives, unscreened,
    coverage: { transforms: transforms.length, witnessed, perturbations },
    why: 'a transform with no witnessed call is UNSCREENED, never clean; positives are suspicions for'
      + ' a diagnostic, never verdicts.' };
}
