// MERGING JOURNALS — can two individually valid histories produce an authority neither justified?
//
// THE REFERENCE SEMANTICS, frozen in MERGE_PREREG.md before this file existed:
//
//     Combining journals adds available records. It does not itself mint authority, equate
//     references, select between conflicting records, or establish claims.
//
// THE DANGEROUS CASE, which is also the ordinary one: nextRef is a module-level counter plus six
// random characters and THE COUNTER RESTARTS AT ZERO IN EVERY PROCESS. `auth:1:...` is the first
// address every run ever issues. A bare ref string therefore cannot say WHICH history a dependency
// meant, and a merger that re-pointed it at whichever record turned up first would manufacture a
// dependency silently.
//
// So a reference is (origin, ref), and ORIGIN IS ASSIGNED BY THE MERGER - a path, a fetch, a
// caller's label. A journal may not name its own origin, for the same reason a producer may not
// declare its own `requires`: the artefact would be choosing the identity under which it is
// believed. There is no syntax for a cross-origin reference.
//
// WHAT CROSSES IS THE PROPOSITION, NOT THE ADDRESS. A witness needing COVERAGE(s, o) is satisfied
// when some record, from any origin, independently replays into authority for exactly that claim.
// Candidate selection is by claim identity only; whether it BINDS is left to resolveEvidenceRoot,
// which already owns world identity. A second implementation of that check would be a second place
// to be wrong.
import { admit, STATE } from './admission.mjs';
import { adapt } from './adapter.mjs';
import { relationClaim } from './authority-store.mjs';
import { JOURNAL_VERSION } from './replay.mjs';

export const MERGE_VERSION = 'merged-journal-1.0.0-frozen-2026-09-21';

// A NUL separator got into the first version of this line. It made the module a BINARY file to
// grep and - worse - made a mutation control silently fail to apply while reporting the suite as
// insensitive. JSON encoding is unambiguous and printable.
const key = (origin, ref) => JSON.stringify([origin, ref]);

/** Combine journals under merger-assigned origins. A PURE DATA OPERATION: it touches no store,
 *  calls no constructor, and cannot mint. Conflicts are REPORTED, never resolved. */
export function merge(sources) {
  const records = new Map();
  const ambiguities = [];
  for (const src of sources) {
    const { origin, journal } = src;
    if (!origin || typeof origin !== 'string') {
      return { ok: false, why: 'every journal must be given an origin BY THE MERGER; a bare journal'
        + ' has no identity of its own to merge under' };
    }
    if (journal && journal.origin !== undefined) {
      return { ok: false, why: 'journal for origin "' + origin + '" names its own origin "'
        + journal.origin + '". An artefact does not get to choose the identity under which it is'
        + ' believed; that is the producer declaring its own burden again' };
    }
    for (const e of (journal && journal.entries) || []) {
      const k = key(origin, e.ref);
      const prev = records.get(k);
      if (!prev) { records.set(k, { origin, ref: e.ref, entry: e }); continue; }
      // IDENTICAL CONTENT IS THE SAME RECORD, NOT A CONFLICT. Duplication is not ambiguity.
      if (JSON.stringify(prev.entry) === JSON.stringify(e)) continue;
      prev.ambiguous = true;
      ambiguities.push({ origin, ref: e.ref,
        why: 'two DIFFERENT records are filed under (' + origin + ', ' + e.ref + '). Neither is'
          + ' chosen: first-wins and last-wins are both a merger deciding which history is true' });
    }
  }
  return { ok: true, merged: { version: MERGE_VERSION, journalVersion: JOURNAL_VERSION,
    records: [...records.values()] }, ambiguities };
}

/** Filing-cabinet lookup across the merged set. Takes no store and returns no token, ever. */
export function locateIn(merged, origin, ref) {
  const r = merged.records.find((x) => x.origin === origin && x.ref === ref);
  if (!r) {
    return { ok: false, why: 'no record under (' + origin + ', ' + ref + '). An address from'
      + ' another origin is a different address, not this one' };
  }
  if (r.ambiguous) {
    return { ok: false, why: 'the identity (' + origin + ', ' + ref + ') is AMBIGUOUS: more than'
      + ' one distinct record is filed under it, and merging does not choose between them' };
  }
  return { ok: true, record: Object.freeze({ ...r.entry.record }), hasEvidence: !!r.entry.evidence };
}

// Dependency order WITHIN each origin. Cross-origin edges do not exist, so they cannot order.
function orderWithinOrigins(records) {
  const byKey = new Map(records.map((r) => [key(r.origin, r.ref), r]));
  const state = new Map(), out = [], stack = [];
  let cycle = null;
  const visit = (k) => {
    if (cycle) return;
    const r = byKey.get(k);
    if (!r || state.get(k) === 'done') return;
    if (state.get(k) === 'open') { cycle = stack.slice(stack.indexOf(k)).concat(k); return; }
    state.set(k, 'open'); stack.push(k);
    for (const c of r.entry.consumed || []) visit(key(r.origin, c.ref));
    stack.pop(); state.set(k, 'done'); out.push(r);
  };
  for (const r of records) visit(key(r.origin, r.ref));
  return cycle ? { cycle } : { order: out };
}

/** Re-execute the merged set. Every outcome names the (origin, ref) it belongs to, so a caller can
 *  never read a neighbour's result by position. */
export function replayMerged(merged, { authorityStore: st } = {}) {
  const ord = orderWithinOrigins(merged.records);
  if (ord.cycle) {
    return { ok: false, why: 'records refer to one another in a cycle within one origin: '
      + ord.cycle.map((k) => JSON.parse(k).join('/')).join(' -> '),
    outcomes: merged.records.map((r) => ({ origin: r.origin, ref: r.ref, state: STATE.UNRESOLVED,
      minted: false, why: 'part of a cycle of records' })) };
  }

  const live = new Map();       // (origin, ref) -> fresh ref in THIS store
  const byClaim = new Map();    // claim -> [{ origin, ref, fresh }]   established SO FAR, this pass
  const outcomes = [];
  const push = (o) => { outcomes.push(o); return o; };

  // READINESS WAVES, not input order. Found by M5 failing against the first version, which walked
  // the merged set once in input order: a consumer in journal A that its supplier in journal B
  // could satisfy was reached BEFORE the supplier and reported open, so the same two journals gave
  // different answers depending on which was passed first - M5 and M7 in direct contradiction.
  //
  // THE TWO INVARIANTS ARE UNCHANGED, and they are what stops a cycle: every record is admitted AT
  // MOST ONCE, and a cross-origin supply may only come from a record ALREADY replayed in this pass.
  // Only the ORDER is now chosen by readiness. Two histories that each need the other's conclusion
  // never become ready, make no progress, and both end open.
  //
  // A record's DECLARED claim is used here to decide ORDER only - never to decide authority. If a
  // still-pending record declares the claim a consumer needs, that consumer waits, so the answer
  // cannot depend on which journal was passed first.
  const pending = ord.order.slice();
  const couldStillEstablish = (need) => pending.some((x) => x.entry.record
    && x.entry.record.claim === need);
  const needOf = (c) => relationClaim(c.relation, c.subject, c.object);
  const ready = (r) => (r.entry.consumed || []).every((c) => {
    if (live.has(key(r.origin, c.ref))) return true;
    const need = needOf(c);
    if (couldStillEstablish(need)) return false;          // a supplier may still arrive: wait
    return true;                                          // decidable now, one way or the other
  });

  const run = (r) => {
    const e = r.entry;
    const at = { origin: r.origin, ref: r.ref };
    if (r.ambiguous) {
      push({ ...at, state: STATE.UNRESOLVED, minted: false,
        why: 'this identity is ambiguous in the merged set; nothing is chosen' });
      return;
    }
    if (!e.evidence) {
      push({ ...at, state: STATE.UNRESOLVED, minted: false,
        why: 'a saved outcome is not a reason; there is nothing here to re-execute' });
      return;
    }

    const cert = structuredClone(e.evidence);
    const supply = [];          // what actually satisfied each consumed reference, for conservation
    let blocked = null;
    for (const c of e.consumed || []) {
      // 1. THE REFERENCE, resolved only within its OWN origin.
      let fresh = live.get(key(r.origin, c.ref)), from = { origin: r.origin, ref: c.ref, by: 'REFERENCE' };
      if (!fresh) {
        // 2. THE PROPOSITION. A record from any origin that has ALREADY replayed into authority for
        //    exactly this claim. Selection is by claim; binding is still resolveEvidenceRoot's call.
        const need = relationClaim(c.relation, c.subject, c.object);
        // ELIGIBILITY IS DECIDED BY ACTUALLY BINDING, NOT BY CLAIM IDENTITY.
        //
        // Found by S3 failing: a record establishing the same claim string in ANOTHER WORLD was
        // being counted as eligible support, so apparent agreement was reported as multiplicity.
        // Claim identity is only a way to find CANDIDATES; whether one is support for THIS witness
        // is a question the adapter already answers, and it is asked here by trying the bind. No
        // world check is reimplemented - the trial token is discarded and nothing is filed.
        const cands = (byClaim.get(need) || []).filter((x) => {
          const trial = structuredClone(cert);
          for (const alt of trial.derivation ? trial.derivation.alternatives || [] : []) {
            for (const w of alt.relation_witnesses || []) {
              if (w.relation === c.relation && w.subject === c.subject && w.object === c.object) {
                w.evidence_root = x.fresh;
              }
            }
          }
          return (adapt(trial, { authorityStore: st }).bound || []).includes(c.relation);
        });
        if (cands.length > 1) {
          // WHAT THIS REFUSAL KNOWS, and no more. Several records are eligible to support the same
          // proposition. That is NOT a report that the evidence disagrees, and it is not a report
          // that the claim is better supported: two histories can replay one observation, which is
          // two histories and ONE reason. Composition of multiple eligible supports is undefined in
          // this contract, so nothing is composed and nothing is chosen.
          blocked = { ...at, state: STATE.UNRESOLVED, minted: false,
            candidates: cands.map((x) => ({ origin: x.origin, ref: x.ref })),
            why: 'MULTIPLE ELIGIBLE SUPPORTS for "' + need + '" (' + cands.map((x) =>
              x.origin + '/' + x.ref).join(', ') + '). Composition of several supports is undefined'
              + ' here, so none is chosen. This is not a finding that the evidence disagrees, and'
              + ' not a finding that the claim is better supported' };
          break;
        }
        if (cands.length === 1) {
          fresh = cands[0].fresh;
          // THE PROVENANCE STAYS EXPLICIT, including the basis on which the candidate set was
          // believed complete. That basis is the DECLARED claim of still-pending records - a hint,
          // never an authority - and saying so in the outcome is the only honest option while it
          // remains the basis. See S6 in MULTIPLICITY_PREREG.md.
          from = { origin: cands[0].origin, ref: cands[0].ref, by: 'CLAIM', claim: need,
            candidates: [{ origin: cands[0].origin, ref: cands[0].ref }],
            completenessBasis: 'DECLARED_CLAIMS_OF_PENDING_RECORDS' };
        }
      }
      if (!fresh) {
        blocked = { ...at, state: STATE.FRONTIER_OPEN, minted: false,
          why: 'nothing available establishes ' + c.relation + '(' + c.subject + ', ' + c.object
            + '), recorded under "' + c.ref + '" in origin ' + r.origin
            + '. Unresolved, not disproven' };
        break;
      }
      for (const alt of cert.derivation ? cert.derivation.alternatives || [] : []) {
        for (const w of alt.relation_witnesses || []) {
          if (w.relation === c.relation && w.subject === c.subject && w.object === c.object) {
            w.evidence_root = fresh;
          }
        }
      }
      supply.push(from);
    }
    if (blocked) { push(blocked); return; }

    const res = admit(cert, { authorityStore: st });
    const out = adapt(cert, { authorityStore: st });
    let fresh = null;
    if (out.token && st) {
      const filed = st.admitToken(out.token, { fromCertificate: e.record.fromCertificate || e.ref });
      if (filed.ok) {
        fresh = filed.ref;
        live.set(key(r.origin, r.ref), fresh);
        for (const s of supply) {
          const dep = live.get(key(s.origin, s.ref));
          if (dep) st.dependsOn(fresh, dep);
        }
        if (res.state === STATE.ESTABLISHED) {
          const cl = out.token.claim;
          if (!byClaim.has(cl)) byClaim.set(cl, []);
          byClaim.get(cl).push({ origin: r.origin, ref: r.ref, fresh });
        }
      }
    }
    push({ ...at, newRef: fresh, state: res.state, minted: !!out.token, bound: out.bound || [],
      supply, why: res.why });
  };

  for (let progress = true; progress && pending.length;) {
    progress = false;
    for (let i = 0; i < pending.length; i++) {
      const r = pending[i];
      if (!ready(r)) continue;
      pending.splice(i, 1);
      run(r);
      progress = true;
      i = -1;                       // readiness may have changed for earlier entries
    }
  }
  // WHATEVER IS LEFT NEVER BECAME READY. Nothing is forced through; each is reported where it
  // stopped. A cycle lands here, as do records waiting on a supplier that never established.
  for (const r of pending) run(r);

  return { ok: true, outcomes };
}

/** THE APPARATUS REQUIREMENT from the seventh wrong-referent defect: an assertion names the record
 *  whose outcome it measures, and FAILS LOUDLY if that record was never produced. Never read an
 *  outcome by index, by [length - 1], or by an optional find(). */
export function outcomeFor(result, origin, ref) {
  const o = (result.outcomes || []).find((x) => x.origin === origin && x.ref === ref);
  if (!o) {
    throw new Error('no outcome was produced for (' + origin + ', ' + ref + '). This assertion has'
      + ' no subject: it would otherwise measure a neighbour and look meaningful while never'
      + ' running. Produced: ' + (result.outcomes || []).map((x) => x.origin + '/' + x.ref).join(', '));
  }
  return o;
}
