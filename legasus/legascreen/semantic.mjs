// LEGASCREEN — SEMANTIC-1. Roles, support formulas, and decision profiles.
//
// SURFACE-1 found that reading authority coordinates off an output cannot screen a predicate,
// because a predicate returns a boolean. So the role of a transformation has to be established
// before the right question can be asked of it - and established from what a call actually DID,
// never from what it is called:
//
//     PRODUCER     consumed no authority, produced authority        facts     -> authority
//     CONSUMER     consumed authority, produced none                authority -> decision/effect
//     TRANSDUCER   consumed authority AND produced authority        authority -> authority
//
// The discriminator is the SUBJECT'S OWN brand predicate, the one production asks.
//
// THE SUPPORT FORMULA IS THE POINT. C2 proved that a dependency EDGE does not tell you the LOGIC of
// the dependency: both of these draw the same arrows.
//
//     A ─┐                     A ─┐
//        ├──→ C  (A AND B)        ├──→ C  (A OR B)
//     B ─┘                     B ─┘
//
// The vocabulary is deliberately tiny, and UNKNOWN is always available. A formula this cannot
// establish must come out UNKNOWN rather than as the nearest word that fits.
import { intervene, OBSERVER, coordinates } from './intervene.mjs';
import { STATE } from './outcome.mjs';

export const ROLE = { PRODUCER: 'PRODUCER', CONSUMER: 'CONSUMER', TRANSDUCER: 'TRANSDUCER',
  NEITHER: 'NEITHER' };

export const FORMULA = { ALL_OF: 'ALL_OF', ANY_OF: 'ANY_OF', CONSTANT: 'CONSTANT',
  UNKNOWN: 'UNKNOWN', NTH: (i) => 'NTH(' + i + ')', SOME_OF: (k, m) => 'SOME_OF(' + k + '/' + m + ')' };

// The vocabulary the calculus can express. SOME_OF is deliberately NOT in it: a partial cover is a
// real observation with no counterpart in the specification, and that is what UNMAPPABLE is for.
export const SPEC_VOCABULARY = [FORMULA.ALL_OF, FORMULA.ANY_OF, FORMULA.CONSTANT,
  FORMULA.NTH(0), FORMULA.NTH(1), FORMULA.NTH(2), FORMULA.NTH(3)];

export function roleOf(rec, w) {
  const produced = rec.isAuthorityObject(w.root.result);
  let consumed = false;
  const refs = JSON.stringify(w.root.args).match(/"__(ref|foreign)":\d+/g) || [];
  for (const r of refs) {
    if (r.startsWith('"__foreign')) { consumed = true; break; }
    const n = rec.node(Number(r.split(':')[1]));
    if (n && rec.isAuthorityObject(n.result)) { consumed = true; break; }
  }
  if (produced && consumed) return ROLE.TRANSDUCER;
  if (produced) return ROLE.PRODUCER;
  if (consumed) return ROLE.CONSUMER;
  return ROLE.NEITHER;
}

// TRACK P. The support formula for one output coordinate, inferred from counterfactual cells.
//
// The INPUT GROUPS are the construction nodes that carry leaves - "premise 0", "premise 1" - and a
// group is identified by its node, NEVER by a name shared with the output. That is the whole reason
// lineage exists.
export function supportFormula(rec, w, coordinate) {
  // THE INPUT GROUPS ARE THE CONSTRUCTED PREMISES - the NON-ROOT nodes. The first version counted
  // the target's own configuration facts (a rule name, a claim string) as one more input group, so
  // a two-premise derive had three groups, two of them carried the coordinate, and every call came
  // out SOME_OF(2/3). ALL_OF was structurally unreachable for any derive in the repository.
  //
  // The distinction is structural, not nominal: a premise is something a recorded call CONSTRUCTED
  // and handed in; the root's own scalars are direct facts about the operation, not premises of an
  // aggregation over premises. Asking "is this coordinate the intersection of its premises" over a
  // set that includes the rule name is asking a different question.
  const groups = [...new Set(w.leaves.map((l) => l.node))].filter((id) => id !== w.root.id)
    .sort((a, b) => a - b);
  const cells = [];
  if (groups.length < 2) {
    return { coordinate, formula: FORMULA.UNKNOWN, groups: groups.length, cells,
      why: 'aggregation is undefined over fewer than two CONSTRUCTED inputs; one input cannot be'
        + ' ALL_OF or ANY_OF of itself' };
  }

  const changes = (r) => r.outcome === STATE.OBSERVED
    && r.delta.some((d) => d.coordinate === coordinate);

  // Per group: supported / not supported / unknown. UNKNOWN when no removal in the group could be
  // measured at all - a group whose every perturbation was refused tells us nothing, and reading
  // that as "not supported" would be an absence treated as a negative.
  const support = new Map();
  for (const g of groups) {
    let measurable = 0, moved = 0;
    for (const leaf of w.leaves.filter((l) => l.node === g)) {
      const r = intervene(rec, w, leaf, { observer: OBSERVER.SUPPORT });
      cells.push({ group: g, path: leaf.path, outcome: r.outcome, moved: changes(r) });
      if (r.outcome === STATE.OBSERVED) { measurable++; if (changes(r)) moved++; }
    }
    support.set(g, measurable === 0 ? 'UNKNOWN' : moved > 0 ? 'YES' : 'NO');
  }
  if ([...support.values()].includes('UNKNOWN')) {
    return { coordinate, formula: FORMULA.UNKNOWN, groups: groups.length, cells,
      why: 'at least one input group had no measurable perturbation, so its contribution is'
        + ' unestablished. An absence of measurement is not an absence of support.' };
  }

  const yes = groups.filter((g) => support.get(g) === 'YES');
  if (yes.length === groups.length) {
    return { coordinate, formula: FORMULA.ALL_OF, groups: groups.length, cells,
      why: 'removing a fact from EVERY input group individually removes the coordinate' };
  }
  if (yes.length === 1) {
    return { coordinate, formula: FORMULA.NTH(groups.indexOf(yes[0])), groups: groups.length, cells,
      why: 'only input group ' + groups.indexOf(yes[0]) + ' carries it' };
  }
  if (yes.length > 1) {
    return { coordinate, formula: FORMULA.SOME_OF(yes.length, groups.length), groups: groups.length,
      cells, why: yes.length + ' of ' + groups.length + ' input groups carry it, which is neither'
        + ' ALL_OF nor a single source' };
  }

  // Nothing single moved it. The all-removed cell separates "redundantly supported" from "not
  // supported by the facts at all" - the two opposite readings slice 1 shared one label for. Only
  // the PREMISE leaves are removed, for the same reason the groups exclude the root.
  const all = intervene(rec, w, w.leaves.filter((l) => groups.includes(l.node)),
    { observer: OBSERVER.SUPPORT });
  cells.push({ group: 'ALL', path: '(every leaf)', outcome: all.outcome, moved: changes(all) });
  if (all.outcome !== STATE.OBSERVED) {
    return { coordinate, formula: FORMULA.UNKNOWN, groups: groups.length, cells,
      why: 'no single removal moved the coordinate, and the all-removed cell was ' + all.outcome
        + ', so ANY_OF and CONSTANT cannot be told apart' };
  }
  return changes(all)
    ? { coordinate, formula: FORMULA.ANY_OF, groups: groups.length, cells,
      why: 'no single removal moved it, but removing every fact did: it is redundantly supported' }
    : { coordinate, formula: FORMULA.CONSTANT, groups: groups.length, cells,
      why: 'removing every fact left it in place, so it does not come from the facts at all' };
}

export const observedCoordinates = (rec, w) => Object.keys(coordinates(w.root.result));

// TRACK C. What a consumer DECIDES, and whether a legitimately weakened input changes it.
//
// The screen does not label either value "permitted": it has no way to know which is which, and
// inventing one would be a convention rather than a measurement.
export function decisionProfile(rec, w) {
  const cells = w.leaves.map((leaf) => {
    const r = intervene(rec, w, leaf, { observer: OBSERVER.DECISION });
    return { node: leaf.node, path: leaf.path, outcome: r.outcome,
      changed: r.outcome === STATE.OBSERVED ? r.delta.length > 0 : null,
      was: r.delta && r.delta[0] && r.delta[0].was, now: r.delta && r.delta[0] && r.delta[0].now };
  });
  const measured = cells.filter((c) => c.changed !== null);
  return { subject: w.root.op + '#' + w.root.id, cells,
    measured: measured.length,
    required: measured.filter((c) => c.changed).length,
    irrelevant: measured.filter((c) => !c.changed).length };
}
