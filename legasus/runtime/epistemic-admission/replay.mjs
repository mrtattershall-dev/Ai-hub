// REPLAY — a process forgets every grant of authority, retains the evidence, and recovers exactly
// what re-execution justifies.
//
// THE BOUNDARY, frozen in REPLAY_PREREG.md before any of this existed:
//
//     A persisted admission record is an INPUT to a new admission attempt.
//     A saved acceptance verdict cannot itself authorize anything.
//
// So there is no deserializer for a token here and none can be written: legaknow's brand is a
// module-private WeakSet, and the only way in is observe/derive. A journal entry carries the
// EVIDENCE (the certificate bytes) and the RECORD (what was concluded last time). Replay feeds the
// evidence back through admission. The record is never consulted to decide anything.
//
// TWO OPERATIONS, DELIBERATELY DIFFERENT NAMES AND SHAPES:
//
//     locate(journal, ref)   -> { ok, record }   a filing-cabinet lookup. NEVER a token.
//     store.resolve(ref)     -> { ok, token }    only for refs THIS store issued, this process.
//
// If locate() could ever hand back authority, loading a file would be an accidental minting
// operation. It returns a frozen copy of the record and has no access to a store at all.
import { admit, STATE } from './admission.mjs';
import { adapt } from './adapter.mjs';

export const JOURNAL_VERSION = 'replay-journal-1.0.0-frozen-2026-09-21';

// The only keys a persisted record may carry. `token` is not among them and cannot be added: the
// writer refuses an entry that carries one rather than silently dropping it, because a silent drop
// would make a caller believe it had persisted something it had not.
const RECORD_KEYS = ['claim', 'constructor', 'context', 'ancestry', 'fromCertificate'];

const FORBIDDEN_IN_RECORD = new Set(['token', 'authority', 'isAuthority', 'brand']);

/** Build one journal entry. `consumed` names the relation witnesses this certificate rooted in
 *  other entries, by the ref that was live AT THE TIME. Those refs are dead addresses after a
 *  restart; they are kept only so replay can rebuild the dependency order. */
export function journalEntry({ ref, store, certificate, consumed = [] }) {
  const rec = store.recordOf(ref);
  if (!rec) return { ok: false, why: 'no record under "' + ref + '" to journal' };
  for (const k of Object.keys(rec)) {
    if (FORBIDDEN_IN_RECORD.has(k)) {
      return { ok: false, why: 'a record carrying "' + k + '" is not a record, it is a token in'
        + ' disguise; persisting it would make loading a file a minting operation' };
    }
  }
  const record = {};
  for (const k of RECORD_KEYS) if (rec[k] !== undefined) record[k] = rec[k];
  return { ok: true, entry: { ref, record, evidence: certificate, consumed } };
}

export function serialize(entries) {
  for (const e of entries) {
    if (!e.evidence) {
      return { ok: false, why: 'entry "' + e.ref + '" has no evidence. A journal of verdicts'
        + ' without evidence is a list of assertions; nothing could be re-executed from it' };
    }
  }
  return { ok: true, text: JSON.stringify({ version: JOURNAL_VERSION, entries }, null, 2) };
}

export function parse(text) {
  let j;
  try { j = JSON.parse(text); } catch (err) { return { ok: false, why: 'unreadable journal: ' + err.message }; }
  if (!j || j.version !== JOURNAL_VERSION) {
    return { ok: false, why: 'journal version "' + (j && j.version) + '" is not '
      + JOURNAL_VERSION + '. A journal written under another contract is not evidence under this one' };
  }
  return { ok: true, entries: j.entries || [] };
}

/** A FILING-CABINET LOOKUP. Takes no store, returns no token, and cannot be made to. */
export function locate(journal, ref) {
  const e = (journal.entries || []).find((x) => x.ref === ref);
  if (!e) {
    return { ok: false, why: 'reference "' + ref + '" names no persisted record. An address that'
      + ' outlived its store is not an establishment' };
  }
  return { ok: true, record: Object.freeze({ ...e.record }), hasEvidence: !!e.evidence };
}

// Dependency order over the journal's own refs. Returns either an order or the cycle it found.
function order(entries) {
  const byRef = new Map(entries.map((e) => [e.ref, e]));
  const state = new Map();     // ref -> 'open' | 'done'
  const out = [], stack = [];
  let cycle = null;
  const visit = (ref) => {
    if (cycle) return;
    const e = byRef.get(ref);
    if (!e) return;                                   // absent: R5's business, not ordering's
    if (state.get(ref) === 'done') return;
    if (state.get(ref) === 'open') {
      cycle = stack.slice(stack.indexOf(ref)).concat(ref);
      return;
    }
    state.set(ref, 'open');
    stack.push(ref);
    for (const c of e.consumed || []) visit(c.ref);
    stack.pop();
    state.set(ref, 'done');
    out.push(e);
  };
  for (const e of entries) visit(e.ref);
  return cycle ? { cycle } : { order: out };
}

/** RE-EXECUTE. Each entry's certificate goes back through the ordinary admission path, with its
 *  relation witnesses re-pointed at refs THIS process issued. Nothing is carried forward from the
 *  recorded verdict - it is not read, not compared, and not used to skip work. */
export function replayJournal(journal, { authorityStore: st } = {}) {
  const entries = journal.entries || [];
  const ord = order(entries);
  if (ord.cycle) {
    return { ok: false, why: 'these records refer to one another in a cycle: '
      + ord.cycle.join(' -> ') + '. Records cannot bootstrap authority by citing each other;'
      + ' a cycle has no evidence at its root, only more records',
    outcomes: entries.map((e) => ({ ref: e.ref, state: STATE.UNRESOLVED, minted: false,
      why: 'part of a cycle of records' })) };
  }

  const remap = new Map();       // old dead address -> ref this process issued
  const outcomes = [];

  for (const e of ord.order) {
    if (!e.evidence) {
      outcomes.push({ ref: e.ref, state: STATE.UNRESOLVED, minted: false,
        why: 'this entry carries a verdict and no evidence. A saved outcome is not a reason;'
          + ' there is nothing here to re-execute' });
      continue;
    }
    const cert = structuredClone(e.evidence);

    // Re-point every consumed witness at live authority, or say which one is missing.
    let missing = null;
    for (const c of e.consumed || []) {
      const fresh = remap.get(c.ref);
      if (!fresh) {
        missing = c;
        break;
      }
      for (const alt of cert.derivation ? cert.derivation.alternatives || [] : []) {
        for (const w of alt.relation_witnesses || []) {
          if (w.relation === c.relation && w.subject === c.subject && w.object === c.object) {
            w.evidence_root = fresh;
          }
        }
      }
    }
    if (missing) {
      // OPEN, NOT REFUSED. A dependency that is absent is unresolved, not disproven, and the
      // distinction is the whole difference between "we do not know" and "it is false".
      outcomes.push({ ref: e.ref, state: STATE.FRONTIER_OPEN, minted: false,
        why: 'the dependency ' + missing.relation + '(' + missing.subject + ', ' + missing.object
          + ') was recorded under "' + missing.ref + '", which this journal does not reconstruct.'
          + ' Unresolved, not disproven' });
      continue;
    }

    const r = admit(cert, { authorityStore: st });
    const out = adapt(cert, { authorityStore: st });
    let fresh = null;
    if (out.token && st) {
      const filed = st.admitToken(out.token, { fromCertificate: e.record.fromCertificate || e.ref });
      if (filed.ok) {
        fresh = filed.ref;
        remap.set(e.ref, filed.ref);
        for (const c of e.consumed || []) {
          const dep = remap.get(c.ref);
          if (dep) st.dependsOn(filed.ref, dep);
        }
      }
    }
    outcomes.push({ ref: e.ref, newRef: fresh, state: r.state, minted: !!out.token,
      bound: out.bound || [], why: r.why });
  }

  return { ok: true, outcomes, remap };
}
