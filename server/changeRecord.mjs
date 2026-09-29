// ══════════════════════════════════════════════════════════════════════════════════════════════════
// changeRecord.mjs — an append-only evidence record for ONE proposed software change.
//
// v1.0.0. FROZEN SCHEMA, NO NEW BEHAVIOUR. Nothing in Legasus is gated on this record yet; components
// dual-write into it and a replay view reads it back. Letting it control an effect path is a separate,
// later decision, and doing it now would mean testing the protocol and trusting it at the same time.
//
// WHY A RECORD RATHER THAN MORE PLUMBING. Every failure this project has hit was a HANDOFF failure -
// meaning corrupted as it crossed a boundary, then rebuilt downstream from an assumption nobody stated:
//
//   a requirement effect got paired with a test BY ARRAY POSITION, and the order was inverted
//   two "independent" nodes secretly read ONE measurement
//   an assertion was repeated in a state where correct and dead behaviour look identical
//   an acceptance was recorded for a page that threw at load
//   a suffix-recovery rule was nearly retrofitted onto results collected before it existed
//
// None of those were arithmetic mistakes. Each was a downstream component confidently reconstructing
// something upstream never actually said.
//
// ══ THE ONE RULE THE SCHEMA EXISTS TO ENFORCE ═════════════════════════════════════════════════════
//
//     FACT  ≠  CLAIM  ≠  PERMISSION  ≠  EFFECT
//
//   FACT        something observed or received. A model completion is a fact. A browser trace is a
//               fact. Facts are never derived from claims.
//   CLAIM       an interpretation OF cited facts. "The feature is complete" is a claim. A claim that
//               cites nothing is refused at append time.
//   PERMISSION  a scoped authorisation. Holding one is not evidence that anything was verified.
//   EFFECT      something that actually changed outside the record - a file write. An effect must cite
//               both the evidence and the permission that allowed it, or it is refused.
//   UNCERTAINTY a typed statement of what could NOT be established. First-class, never a comment.
//
// No layer may recreate one of these from another downstream. That is the whole protocol.
//
// ══ THE OTHER LAWS ════════════════════════════════════════════════════════════════════════════════
//
//   APPEND, NEVER OVERWRITE. Corrections are new events citing the old one. `supersede` adds; nothing
//   removes. The withdrawn farm acceptance and the reclassified suffix outputs must both remain
//   readable in their original form forever, alongside what replaced them.
//
//   SOURCE FACTS ARE SEPARATE FROM PROJECTIONS. A raw browser trace is a fact; "C is missing" is a
//   projection over it. Projections live in changeRecordReplay.mjs and are recomputed, never stored,
//   so improving the graph does not require rewriting history to match.
//
//   EVERY EVENT IS CHAINED. Each event carries the digest of the one before it, so a record that was
//   edited in place rather than appended to can be detected instead of trusted.
//
//   THE SCHEMA IS VERSIONED. Projections will change. A record written under 1.0.0 must still replay.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { createHash } from 'node:crypto';

export const SCHEMA_VERSION = '1.0.0';

/** The four kinds of thing, plus the typed absence of a thing. Nothing else may be appended. */
export const CLASSES = ['FACT', 'CLAIM', 'PERMISSION', 'EFFECT', 'UNCERTAINTY'];

/** Who may own which section. A section's owner is recorded so a later reader can ask who said it. */
export const SECTIONS = {
  TASK: { owner: 'emitter', class: 'FACT' },
  BASELINE: { owner: 'observer', class: 'FACT' },
  GRAPH: { owner: 'derivation', class: 'CLAIM' },
  PROPOSAL: { owner: 'model', class: 'FACT' },
  VERIFICATION: { owner: 'checker', class: 'FACT' },
  DIAGNOSIS: { owner: 'checker', class: 'CLAIM' },
  DECISION: { owner: 'policy', class: 'CLAIM' },
  AUTHORITY: { owner: 'executor', class: 'PERMISSION' },
  WRITE: { owner: 'executor', class: 'EFFECT' },
  LESSON: { owner: 'learner', class: 'CLAIM' },
  UNKNOWN: { owner: 'any', class: 'UNCERTAINTY' },
};

/**
 * Typed uncertainties. A thing that could not be established gets one of these, never a comment and
 * never silence. Extend deliberately - an unknown type is refused, because the whole point is that a
 * reader can enumerate what was not established.
 */
export const UNCERTAINTY_TYPES = [
  // derivation could not build a node
  'NO_SURFACE_REQUIRED', 'NO_UPDATE_ROUTE', 'NO_ROUTE_EVIDENCE', 'NO_POST_ADDITION_EXERCISE',
  'UNOBSERVABLE_REPEAT', 'NO_PERTURBATION', 'NO_ACTION_VOCABULARY', 'UNOBSERVABLE_BASELINE',
  // the run could not produce a judgeable answer
  'NOT_EVALUATED', 'UNSUPPORTED_OBSERVATION', 'AMBIGUOUS_SUFFIX_BOUNDARY', 'OUTPUT_CAP_EXHAUSTED',
  'NO_VERIFIED_BASELINE', 'REFUSED_DERIVATION',
];

const digest = (v) => createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex');

/**
 * Deterministic serialisation, RECURSIVELY. The first version was `JSON.stringify(o, Object.keys(o))`,
 * which is the REPLACER-ARRAY form: it keeps only the listed keys AT EVERY LEVEL, so every nested key
 * inside `body` was silently dropped from the digest. Event bodies were therefore not covered by the
 * chain at all, and editing one in place was undetectable. Its own test caught it.
 */
function stable(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  const keys = Object.keys(v).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
}

/** Open a record for one proposed change. `runId` groups changes; `changeId` names this one. */
export function openChange({ runId, changeId, opened, tool }) {
  if (!runId || !changeId) throw new Error('changeRecord: a record needs both a runId and a changeId');
  return { schema: SCHEMA_VERSION, runId, changeId, opened: opened || null, tool: tool || null, events: [] };
}

/**
 * Append one event. Returns its id. THE VALIDATIONS ARE THE PROTOCOL - each one refuses a specific way
 * a boundary has actually been crossed wrongly in this project before.
 */
export function append(rec, { section, body, cites = [], authority = null, uncertainty = null, by = null }) {
  const spec = SECTIONS[section];
  if (!spec) throw new Error(`changeRecord: unknown section ${section}`);
  const cls = spec.class;
  const known = new Map(rec.events.map((e) => [e.id, e]));
  for (const c of cites) if (!known.has(c)) throw new Error(`changeRecord: ${section} cites ${c}, which is not in this record`);

  // A CLAIM that cites nothing is an assertion with no evidence. That is the shape of every finding
  // this project later had to withdraw, so it is refused at the boundary rather than audited later.
  if (cls === 'CLAIM' && !cites.length) throw new Error(`changeRecord: a ${section} claim must cite the facts it rests on`);

  // An EFFECT must name BOTH the evidence and the permission. Holding a token is not evidence that
  // anything was checked, and a passing check is not authorisation to write.
  if (cls === 'EFFECT') {
    if (!authority) throw new Error('changeRecord: an effect must cite the permission that allowed it');
    const auth = known.get(authority);
    if (!auth || auth.class !== 'PERMISSION') throw new Error('changeRecord: an effect\'s authority must be a PERMISSION event in this record');
    if (!cites.length) throw new Error('changeRecord: an effect must cite the evidence it rests on');
  }
  if (cls === 'PERMISSION' && !(body && body.scope)) throw new Error('changeRecord: a permission must state its scope');
  if (cls === 'UNCERTAINTY') {
    if (!uncertainty) throw new Error('changeRecord: an uncertainty must carry a type');
    if (!UNCERTAINTY_TYPES.includes(uncertainty)) throw new Error(`changeRecord: ${uncertainty} is not a declared uncertainty type`);
  }

  const prev = rec.events.length ? rec.events[rec.events.length - 1].id : null;
  const seq = rec.events.length;
  const core = { seq, section, class: cls, by: by || spec.owner, cites, authority, uncertainty, body: body ?? null, prev };
  const id = `${rec.changeId}:${seq}:${digest(stable(core)).slice(0, 12)}`;
  rec.events.push(Object.freeze({ id, ...core }));
  return id;
}

/**
 * A correction. It APPENDS - the superseded event stays exactly as written, forever. Reading the record
 * later must show both what was claimed and what replaced it, because the sequence of corrections is
 * the strongest evidence this project produces and deleting the first half destroys it.
 */
export function supersede(rec, { supersedes, why, body = null, by = null }) {
  const target = rec.events.find((e) => e.id === supersedes);
  if (!target) throw new Error(`changeRecord: cannot supersede ${supersedes}, which is not in this record`);
  if (target.class === 'FACT') throw new Error('changeRecord: a FACT cannot be superseded - it was observed. Append a new fact and let a claim choose between them.');
  return append(rec, { section: target.section, by, cites: [supersedes], body: { supersedes, why, ...(body || {}) } });
}

/** Has this record only ever been appended to? Recomputes every id and every link in the chain. */
export function verifyChain(rec) {
  const problems = [];
  let prev = null;
  for (const [i, e] of rec.events.entries()) {
    const core = { seq: e.seq, section: e.section, class: e.class, by: e.by, cites: e.cites, authority: e.authority, uncertainty: e.uncertainty, body: e.body, prev: e.prev };
    const expect = `${rec.changeId}:${e.seq}:${digest(stable(core)).slice(0, 12)}`;
    if (e.seq !== i) problems.push({ id: e.id, why: `sequence ${e.seq} at position ${i}` });
    if (e.prev !== prev) problems.push({ id: e.id, why: 'does not link to the event before it' });
    if (e.id !== expect) problems.push({ id: e.id, why: 'content does not match its own digest - this event was edited in place' });
    prev = e.id;
  }
  return { intact: problems.length === 0, problems };
}

/** Everything a given event rests on, transitively. The causal chain, read backwards. */
export function provenanceOf(rec, id) {
  const byId = new Map(rec.events.map((e) => [e.id, e]));
  const out = [];
  const seen = new Set();
  const walk = (x) => {
    if (seen.has(x)) return;
    seen.add(x);
    const e = byId.get(x);
    if (!e) return;
    out.push(e);
    for (const c of e.cites) walk(c);
    if (e.authority) walk(e.authority);
  };
  walk(id);
  return out;
}

export const _internal = { digest, stable };
