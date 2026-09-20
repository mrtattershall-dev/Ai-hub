// r4 — THE LAW-4 ADAPTER. Deliberately boring.
//
//     ADAPTERS MAY PRESERVE OR DISCARD DISTINCTIONS. THEY MAY NOT INVENT DISTINCTIONS THEIR SOURCE
//     CANNOT MAKE.
//
// The adapter's job is to say "the producer reported these observable facts", never "here is what I
// think the producer would have reported". Two consequences follow and both are enforced below:
//
//   NON-INVENTION    a native result with no honest Legasus equivalent becomes UNKNOWN_MAPPING, not the
//                    nearest familiar label. Guessing would mean Legasus GAINED information in
//                    translation, which is law 1 running backwards.
//   NON-VACUITY      producer failure and adapter failure are facts about the PRODUCER and the ADAPTER.
//                    Neither may become evidence about the subject.
//
// RAW SURVIVES ADAPTATION. Every adapted record carries its native result untouched, so a later revision
// with a better vocabulary can re-adapt the same observation without rerunning anything and without
// pretending its ontology existed when the observation was made.
//
// AND MAPPING SEVERAL NATIVE STATES ONTO ONE LEGASUS STATE IS A LOSSY COMPRESSION whose legality depends
// on the downstream authority decisions - exactly the illegalCompression test. A collapse is legitimate
// only when no consumer distinguishes the collapsed states.
import { OBSERVABILITY } from '../legaknow/observation.mjs';

// The declared mapping. Anything not named here is UNKNOWN_MAPPING by construction rather than by
// oversight, so adding a producer cannot silently acquire a default.
export const DOCTEST_MAPPING = {
  PASS: { observability: OBSERVABILITY.OBSERVED, assertion: 'HELD' },
  OUTPUT_MISMATCH: { observability: OBSERVABILITY.OBSERVED, assertion: 'REFUTED' },
  UNEXPECTED_EXCEPTION: { observability: OBSERVABILITY.OBSERVED, assertion: 'REFUTED' },
  IMPORT_FAILED: { observability: OBSERVABILITY.PREREQUISITE_MISSING, assertion: null },
};

export const UNKNOWN_MAPPING = 'UNKNOWN_MAPPING';

export function adaptRecord(rec, { mapping = DOCTEST_MAPPING } = {}) {
  const native = rec.nativeResult;
  const m = Object.hasOwn(mapping, native) ? mapping[native] : null;
  const base = {
    // RAW, verbatim, never rewritten.
    native: { result: native, details: rec.nativeDetails ?? null, want: rec.want ?? null,
      source: rec.source ?? null, optionflags: rec.optionflags ?? {} },
    identity: rec.identity,
    // SCOPE IS BUILT FROM WHAT THE PRODUCER ACTUALLY HAS.
    //
    // The first version hard-coded `history: document + '#' + ordinal`, which is doctest's shape. Handed
    // a git record - which has neither - it produced the literal string "undefined#undefined": a
    // fabricated coordinate where the honest answer is that the dimension DOES NOT APPLY. That is
    // UNKNOWN collapsing into a value, inside the very boundary built to prevent it, and producer #2
    // found it within minutes.
    //
    // A coordinate the producer cannot establish is now ABSENT rather than invented. Absent is not the
    // same as unknown and neither is the same as a string that looks like data.
    scope: (() => {
      const sc = { criterion: rec.identity.producer + ' ' + rec.identity.producerVersion };
      if (rec.identity.document !== undefined && rec.identity.ordinal !== undefined) {
        sc.history = rec.identity.document + '#' + rec.identity.ordinal;
      }
      if (rec.identity.object !== undefined) sc.implementation = rec.identity.object;
      if (rec.identity.head !== undefined && rec.identity.head !== null) {
        sc.repository = rec.identity.head;
      }
      return sc;
    })(),
  };
  if (m === null) {
    return { ...base, observability: UNKNOWN_MAPPING, assertion: null,
      why: 'the producer reported "' + native + '", for which this adapter declares no mapping. The'
        + ' nearest familiar label would be an invented distinction.' };
  }
  return { ...base, observability: m.observability, assertion: m.assertion };
}

export function adapt(producerResult, opts) {
  if (!producerResult || producerResult.ok !== true) {
    return { ok: false, producerFailed: true,
      why: 'the producer did not run. That is a fact about the producer and carries NO evidential force'
        + ' about the subject.',
      records: [] };
  }
  return {
    ok: true,
    producer: producerResult.producer,
    producerVersion: producerResult.producerVersion,
    records: producerResult.records.map((r) => adaptRecord(r, opts)),
  };
}

// REPLAYABILITY. Re-adapting preserved raw evidence must be deterministic and must not require the
// subject. Given the same records and the same mapping, the same adaptation.
export const readapt = (raw, opts) => raw.map((r) => adaptRecord(r, opts));
