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
import { UNADMITTED } from '../legaknow/justification.mjs';

// The declared mapping. Anything not named here is UNKNOWN_MAPPING by construction rather than by
// oversight, so adding a producer cannot silently acquire a default.
// A MAPPING IS FOR ONE PRODUCER'S VOCABULARY. The first adaptRecord applied whatever mapping it was
// handed - the doctest one by default - to any record, so a git record whose native result happened to
// be spelled PASS received doctest's semantics, OBSERVED / HELD (composition attack W2-g): same name,
// same authority, at the one boundary whose job is to refuse exactly that. A mapping now declares the
// producer it is for under a Symbol key - a Symbol so that it can never collide with a native result
// name, and so that a mapping extended by spread (`{...DOCTEST_MAPPING, NEW: ...}`, the re-adaptation
// path) keeps its declaration. A record from any other producer, or a mapping that declares no
// producer, is UNKNOWN_MAPPING with the mismatch named.
export const FOR_PRODUCER = Symbol('mapping-for-producer');

export const DOCTEST_MAPPING = {
  [FOR_PRODUCER]: 'CPython doctest',
  PASS: { observability: OBSERVABILITY.OBSERVED, assertion: 'HELD' },
  OUTPUT_MISMATCH: { observability: OBSERVABILITY.OBSERVED, assertion: 'REFUTED' },
  UNEXPECTED_EXCEPTION: { observability: OBSERVABILITY.OBSERVED, assertion: 'REFUTED' },
  IMPORT_FAILED: { observability: OBSERVABILITY.PREREQUISITE_MISSING, assertion: null },
};

// PRODUCER #3's MAPPING, declared under benchmarks/PYTEST_MAPPING_PREREG.md and argued from pytest's
// documented outcomes (passed / failed / skipped, and a setup phase that did not pass). FAILED covers
// both an assertion that failed and a body that raised - pytest reports one word for both, so the
// adapter may not distinguish them: the same forced collapse as OUTPUT_MISMATCH / UNEXPECTED_EXCEPTION
// above, legal while no consumer distinguishes them. Anything not listed - xfail and xpass wrinkles,
// reruns, plugin outcomes - is UNKNOWN_MAPPING by construction.
export const PYTEST_MAPPING = {
  [FOR_PRODUCER]: 'pytest',
  PASSED: { observability: OBSERVABILITY.OBSERVED, assertion: 'HELD' },
  FAILED: { observability: OBSERVABILITY.OBSERVED, assertion: 'REFUTED' },
  SKIPPED: { observability: OBSERVABILITY.NOT_ATTEMPTED, assertion: null },
  SETUP_FAILED: { observability: OBSERVABILITY.PREREQUISITE_MISSING, assertion: null },
  SETUP_SKIPPED: { observability: OBSERVABILITY.NOT_ATTEMPTED, assertion: null },
};

export const UNKNOWN_MAPPING = 'UNKNOWN_MAPPING';

// The mappings this adapter knows, by the producer they are for. git has none on purpose: its
// evidence is identity, not an assertion, and producer2.test declares a git mapping locally to show
// that a declared one derives (E6).
const REGISTERED = new Map([
  [DOCTEST_MAPPING[FOR_PRODUCER], DOCTEST_MAPPING],
  [PYTEST_MAPPING[FOR_PRODUCER], PYTEST_MAPPING],
]);

export function adaptRecord(rec, { mapping } = {}) {
  const id = rec.identity || {};
  // A RECORD THAT CANNOT SAY WHO PRODUCED IT IS MALFORMED, NOT ADAPTABLE. The first version built
  // `criterion: undefined + ' ' + undefined` for it (composition attack W2-e).
  if (typeof id.producer !== 'string' || !id.producer) {
    return { rejected: true, identity: rec.identity ?? null, native: { result: rec.nativeResult },
      why: 'the record names no producer, so nothing can say whose semantics its native result carries;'
        + ' it is refused rather than adapted under a guessed criterion' };
  }
  const chosen = mapping === undefined ? (REGISTERED.get(id.producer) || null) : mapping;
  const declaredFor = chosen ? chosen[FOR_PRODUCER] : null;
  const native = rec.nativeResult;
  let m = null; let mismatch = null;
  if (!chosen) mismatch = 'no mapping is declared for producer "' + id.producer + '"';
  else if (!declaredFor) mismatch = 'the mapping declares no producer, so it may be applied to none';
  else if (declaredFor !== id.producer) {
    mismatch = 'the mapping is declared for "' + declaredFor + '" and this record is from "'
      + id.producer + '"; a matching native word is not a matching meaning';
  } else m = Object.hasOwn(chosen, native) ? chosen[native] : null;
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
    // AND A COORDINATE THE ADAPTER CANNOT MAP IS CARRIED, NOT DROPPED.
    //
    // Producer #3 found this the hard way. scope() was repaired to record an unmappable coordinate under
    // UNADMITTED instead of dropping it - and the repair was UNREACHED, because the adapter discarded
    // pytest's collectionCohort before scope() ever saw it. The fix passed its own tests while the defect
    // survived one layer up. THE DECIDING PATH IS THE ONE THAT MUST BE FIXED, and finding it took
    // executing the pipeline rather than reasoning about it.
    //
    // So the mapping is DECLARED, and every identity key it does not consume is carried explicitly.
    // Carrying is not squeezing: an unmapped coordinate never becomes a value of a declared dimension.
    scope: (() => {
      // An unversioned producer is a criterion of its own, not the string "undefined" (W2-e): covers()
      // will refuse to equate "pytest" with "pytest 9.1.1", which is the honest relation between them.
      const sc = { criterion: (id.producerVersion === undefined || id.producerVersion === null)
        ? id.producer : id.producer + ' ' + id.producerVersion };
      const consumed = new Set(['producer', 'producerVersion']);
      if (id.document !== undefined && id.ordinal !== undefined) {
        sc.history = id.document + '#' + id.ordinal;
        consumed.add('document'); consumed.add('ordinal');
      }
      if (id.object !== undefined) { sc.implementation = id.object; consumed.add('object'); }
      if (id.head !== undefined && id.head !== null) { sc.repository = id.head; consumed.add('head'); }
      if (id.invocation !== undefined) { sc.invocation = id.invocation; consumed.add('invocation'); }
      const unmapped = Object.keys(id).filter((k) => !consumed.has(k) && id[k] !== undefined);
      if (unmapped.length) {
        sc[UNADMITTED] = Object.fromEntries(unmapped.map((k) => [k, id[k]]));
      }
      return sc;
    })(),
  };
  if (m === null) {
    return { ...base, observability: UNKNOWN_MAPPING, assertion: null,
      why: mismatch
        ? 'the producer reported "' + native + '" but ' + mismatch + '. The nearest familiar label'
          + ' would be an invented distinction.'
        : 'the producer reported "' + native + '", for which this adapter declares no mapping. The'
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
