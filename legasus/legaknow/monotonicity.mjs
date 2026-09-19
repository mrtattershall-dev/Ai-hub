// INFORMATION MONOTONICITY — the conservation law underneath the architecture.
//
//     AUTHORITY CANNOT BE CREATED BY DESTROYING INFORMATION.
//
// Four defects found separately in this project turn out to be one defect:
//
//     PRODUCER_FAILED and EMPTY_OBSERVED    both became the empty set
//     UNKNOWN and ZERO                      both became 0
//     two code objects on one source line   both became module:line
//     evidence at S0 and evidence at S1     both became "the evidence"
//
// In every case the downstream reasoning was CORRECT and the conclusion was unjustified, because an
// authority-relevant distinction had been erased before the reasoning ever saw it. That is stronger than
// garbage-in-garbage-out:
//
//     ONCE AN AUTHORITY-RELEVANT DISTINCTION IS ERASED, NO DOWNSTREAM REASONING CAN RECONSTRUCT WHETHER
//     THE RESULTING AUTHORITY WAS DESERVED.
//
// THE RULE IS NOT "never lose information" - a system that cannot compress cannot render, decide or
// report. It is narrower and it is testable:
//
//     A TRANSFORMATION MAY DISCARD INFORMATION ONLY IF THE DISCARDED DISTINCTION CANNOT CHANGE
//     DOWNSTREAM ENTITLEMENT.
//
// Formally: if x1 != x2 and T(x1) == T(x2), that merge is legal only when every authorised decision
// downstream is identical for x1 and x2. Otherwise T is an ILLEGAL COMPRESSION.
//
// WHY THIS IS A BETTER TEST THAN EXAMPLES. It is METAMORPHIC: it never needs to know the correct answer
// for any case. It only needs one thing never to happen - making the system less informed must not make
// it more entitled. That can be applied to any pipeline, including ones whose right answers nobody knows.
//
// LEGAL WAYS TO GAIN AUTHORITY: new observation, valid derivation, independent verification, explicit
// delegation. FORBIDDEN: "I know less, therefore I may claim more."

// A consumer is any authorised decision that reads the state. `grants` must be a pure predicate: does
// this state permit that decision?
export function permissionsOf(state, consumers) {
  return consumers.map((c) => {
    let granted;
    try { granted = !!c.grants(state); } catch (e) { granted = false; }
    return { name: c.name, granted };
  });
}

// THE CENTRAL CHECK. Erasing information may only ever REMOVE permissions.
export function informationMonotonicity({ rich, erase, consumers, label = 'erasure' }) {
  const before = permissionsOf(rich, consumers);
  const after = permissionsOf(erase(rich), consumers);
  const gained = [];
  for (let i = 0; i < consumers.length; i++) {
    if (after[i].granted && !before[i].granted) gained.push(consumers[i].name);
  }
  return {
    ok: gained.length === 0,
    gained,
    lost: consumers.filter((c, i) => before[i].granted && !after[i].granted).map((c) => c.name),
    why: gained.length
      ? 'FORBIDDEN TRANSITION: ' + label + ' destroyed information and GAINED permission for '
        + gained.join(', ') + '. Authority was manufactured out of information loss.'
      : null,
  };
}

// ILLEGAL COMPRESSION. Given states that a transformation merges, is the merge authority-preserving?
export function illegalCompression({ states, compress, consumers }) {
  const groups = new Map();
  for (const s of states) {
    const k = JSON.stringify(compress(s.value));
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(s);
  }
  const violations = [];
  for (const [k, members] of groups) {
    if (members.length < 2) continue;
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const a = permissionsOf(members[i].value, consumers);
        const b = permissionsOf(members[j].value, consumers);
        for (let c = 0; c < consumers.length; c++) {
          if (a[c].granted !== b[c].granted) {
            violations.push({ merged: k, a: members[i].name, b: members[j].name,
              consumer: consumers[c].name,
              why: members[i].name + ' and ' + members[j].name + ' are merged by this transformation,'
                + ' but they grant DIFFERENT permission for ' + consumers[c].name
                + '. The compression destroys an authority-relevant distinction.' });
          }
        }
      }
    }
  }
  return { ok: violations.length === 0, violations, groups: groups.size };
}

// ABLATING THE ONTOLOGY ITSELF. Two epistemic states must remain distinct IFF some authorised consumer
// treats them differently. This does not ask whether a vocabulary is tasteful; it asks whether each
// distinction is LOAD-BEARING, and reports the ones that are merely descriptive.
export function vocabularyMinimality({ values, consumers, asState = (v) => v }) {
  const loadBearing = []; const mergeable = [];
  for (let i = 0; i < values.length; i++) {
    for (let j = i + 1; j < values.length; j++) {
      const a = permissionsOf(asState(values[i]), consumers);
      const b = permissionsOf(asState(values[j]), consumers);
      const differing = consumers.filter((c, k) => a[k].granted !== b[k].granted).map((c) => c.name);
      (differing.length ? loadBearing : mergeable).push({ a: values[i], b: values[j], differing });
    }
  }
  return {
    minimal: mergeable.length === 0,
    loadBearing: loadBearing.length,
    mergeable,
    why: mergeable.length
      ? mergeable.length + ' pair(s) of states permit exactly the same downstream actions. Those'
        + ' distinctions are DESCRIPTIVE, not authoritative, and the vocabulary is not minimal with'
        + ' respect to these consumers - which may mean the vocabulary is too large, OR that a consumer'
        + ' that would distinguish them has not been built yet.'
      : null,
  };
}

// A catalogue of the erasures worth fault-injecting into any authoritative pipeline. Each names a
// distinction this project has already lost once.
export const ERASURES = {
  DROP_PRODUCER_STATUS: 'collapse how-it-was-produced into the value',
  DROP_EXECUTABLE_IDENTITY: 'collapse distinct code objects onto a source coordinate',
  DROP_HISTORY: 'treat an example with a prefix as an assertion about source alone',
  DROP_STATE_IDENTITY: 'use evidence gathered at S0 as evidence about S1',
  DROP_ATTRIBUTION: 'keep the observation, lose which subject it was about',
  DROP_CRITERION: 'compare results judged under different criteria',
  UNKNOWN_TO_ZERO: 'treat a missing measurement as a measured zero',
};

// THE ADAPTER LAW — the mirror of law 1, and the one an external integration breaks first.
//
//     ADAPTERS MAY PRESERVE OR DISCARD DISTINCTIONS. THEY MAY NOT INVENT EVIDENTIAL DISTINCTIONS
//     UNSUPPORTED BY THEIR SOURCE.
//
// An external system may expose only PASS / FAIL / ERROR while reality contains: the test never ran,
// collection failed, a fixture failed, the subject crashed, an assertion failed, the observer crashed,
// zero failures were observed. If its ERROR does not reveal whether the producer or the subject failed,
// the adapter must yield UNATTRIBUTABLE - not its best guess. A best guess would mean Legasus GAINED
// information during translation, which is law 1 running backwards.
//
// Two source states that the source itself cannot tell apart must not grant different permissions after
// adaptation. This is illegalCompression with the quantifier flipped.
export function illegalRefinement({ states, adapt, consumers }) {
  const groups = new Map();
  for (const s of states) {
    const k = JSON.stringify(s.source);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(s);
  }
  const violations = [];
  for (const [k, members] of groups) {
    if (members.length < 2) continue;
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const a = permissionsOf(adapt(members[i]), consumers);
        const b = permissionsOf(adapt(members[j]), consumers);
        for (let c = 0; c < consumers.length; c++) {
          if (a[c].granted !== b[c].granted) {
            violations.push({ source: k, a: members[i].name, b: members[j].name,
              consumer: consumers[c].name,
              why: 'the source reports ' + k + ' for both ' + members[i].name + ' and ' + members[j].name
                + ', but the adapter grants different permission for ' + consumers[c].name
                + '. The adapter INVENTED a distinction its source does not support.' });
          }
        }
      }
    }
  }
  return { ok: violations.length === 0, violations };
}
