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
import { createHash } from 'node:crypto';
import { admit, STATE } from './admission.mjs';
import { adapt } from './adapter.mjs';
import { relationClaim } from './authority-store.mjs';
import { JOURNAL_VERSION } from './replay.mjs';

export const MERGE_VERSION = 'merged-journal-1.0.0-frozen-2026-09-21';

// WITNESS REQUIREMENT MODES. What would SATISFY this consumer's obligation - a different question
// from "has everything relevant been exposed", which is exhaustion and is not built here.
//
// A MODE IS A PROPERTY OF THE OBLIGATION AND IS NEVER READ FROM THE CERTIFICATE. A producer
// declaring EXISTENTIAL on its own witness would be choosing its own burden of proof, which is the
// defect v1.2 removed when producers stopped supplying `requires`. It is resolved here from an
// explicit RUNTIME policy, because no registry rule may be added or changed in this run - a
// recorded hazard: that is weaker than the registry, and the runtime author can still choose the
// burden. The producer still cannot.
// WHAT HAPPENS WHEN GOVERNANCE FAILS TO ATTACH.
//
// G5 made an unattached obligation visible; it did not prevent its consequence. An unresolved entry
// denotes NOTHING in this merged set, so there is no way to determine which consumers it meant:
// THE AFFECTED SET IS UNKNOWN, not merely unenumerated. BLOCK therefore cannot be implemented as an
// approximation and is refused instead - a plausible-looking BLOCK that blocked whatever seemed
// nearby would read as precision and be invention.
//
// INVALIDATE is the default, because proceeding under a weaker default is an unauthorized reduction
// of the burden the governor intended - the same defect A1 refuses on the request channel, arriving
// through absence rather than through asking.
export const UNATTACHED = Object.freeze({
  INVALIDATE: 'INVALIDATE',   // default: no admissions at all
  DIAGNOSE: 'DIAGNOSE',       // report and proceed. AUTHORIZED DOWNGRADE, never the default
  BLOCK: 'BLOCK',             // refused: the affected set is not computable
});

export const MODE = Object.freeze({
  DESIGNATED: 'DESIGNATED',     // only that exact source satisfies. Designation REDUCES the search.
  EXISTENTIAL: 'EXISTENTIAL',   // any one admissible support that actually binds. A further
                                // agreeing support changes nothing.
  COMPLETE: 'COMPLETE',         // a decision over the WHOLE candidate set. Not satisfiable today.
});

// A NUL separator got into the first version of this line. It made the module a BINARY file to
// grep and - worse - made a mutation control silently fail to apply while reporting the suite as
// insensitive. JSON encoding is unambiguous and printable.
const key = (origin, ref) => JSON.stringify([origin, ref]);

// THE SUBJECT OF GOVERNANCE: a RECORD OCCURRENCE - this record, as merged from this origin.
//
// Not a positional label (A6: an unchanged label can name a different record after reordering),
// not bytes (two byte-identical records in different origins are two occurrences, and content
// equality establishes neither common origin nor ownership nor independent evidence), and not a
// lineage. A governance entry written against an occurrence cannot silently land on a different
// consumer, because the occurrence changes when the record or its origin does.
export const occurrenceOf = (origin, entry) =>
  createHash('sha256').update(JSON.stringify([origin, entry.ref, entry])).digest('hex');

// CONTENT IDENTITY, WITHOUT THE ORIGIN. Stable under reordering; different after a revision. It is
// deliberately NOT an identity: two byte-identical records are two occurrences in two histories,
// and equality alone merges nothing. It is one half of what a governor names when authorizing a
// successor - the other half is the merger-assigned origin, which a copied journal cannot supply.
export const contentOf = (entry) =>
  createHash('sha256').update(JSON.stringify(entry)).digest('hex');

// WHO MAY ESTABLISH CONTINUITY. A journal may carry { predecessor, content } - that IDENTIFIES a
// predecessor and authorizes nothing. Authorization comes from the governor and names what it is
// authorizing: which origin the successor must be merged under, what content it must have, and
// whether the predecessor obligations transfer at all. Continuity and governance transfer are
// SEPARATE PERMISSIONS: an authorized revision can change precisely the content an obligation
// governed, and a reorder revises nothing.
export function resolveContinuity(merged, continuity) {
  const findings = [];
  for (const [predecessor, auth] of Object.entries(continuity || {})) {
    const claimants = merged.records.filter((r) => r.entry.continuity
      && r.entry.continuity.predecessor === predecessor);
    const qualified = claimants.filter((r) => r.origin === auth.successorOrigin
      && contentOf(r.entry) === auth.successorContent);
    if (qualified.length > 1) {
      findings.push({ predecessor, ok: false, kind: 'FORK',
        claimants: qualified.map((r) => ({ origin: r.origin, ref: r.ref, occurrence: r.occurrence })),
        // Sorted, because L5 found the DECISION order-invariant while the MESSAGE was not: the
        // claimants were listed in record order, so the same refusal read differently under a
        // permutation. A refusal that changes with input order is not a refusal anyone can compare.
        why: 'more than one record satisfies this continuity authorization ('
          + qualified.map((r) => r.origin + '/' + r.ref).sort().join(', ') + '). NEITHER inherits:'
          + ' an ambiguous authorization is not resolved by insertion order' });
      continue;
    }
    if (qualified.length === 0) {
      findings.push({ predecessor, ok: false, kind: claimants.length ? 'UNAUTHORIZED' : 'ABSENT',
        claimants: claimants.map((r) => ({ origin: r.origin, ref: r.ref })),
        why: claimants.length
          ? 'record(s) assert continuity from this predecessor but none matches the authorized'
            + ' successor (origin ' + auth.successorOrigin + ', content '
            + String(auth.successorContent).slice(0, 12) + '...). Identifying a predecessor is not'
            + ' being authorized to continue it'
          : 'no record asserts continuity from this predecessor' });
      continue;
    }
    const r = qualified[0];
    findings.push({ predecessor, ok: true, kind: 'CONTINUED',
      successor: { origin: r.origin, ref: r.ref, occurrence: r.occurrence },
      transferGovernance: auth.transferGovernance === true,
      why: auth.transferGovernance === true
        ? 'continuity authorized AND the predecessor obligations transfer to this successor'
        : 'continuity authorized; governance does NOT transfer. Continuing a history and'
          + ' inheriting its obligations are different permissions' });
  }
  return findings;
}

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
      if (!prev) {
        records.set(k, { origin, ref: e.ref, entry: e, occurrence: occurrenceOf(origin, e) });
        continue;
      }
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
export function replayMerged(merged, { authorityStore: st, witnessModes, governingByRecord,
  governingByOccurrence, requestedModes, obligationContractId,
  unattachedPolicy, requestedUnattachedPolicy, continuity } = {}) {
  // TWO CHANNELS, AND ONLY ONE OF THEM DECIDES.
  //
  //     governing   the authorized obligation. Decides. Named in every outcome it decides.
  //     requested   what the party seeking admission asked for. RECORDED. Never decides.
  //
  // `witnessModes` is hereby named as the GOVERNING channel - it always was one; it simply had no
  // counterpart to be distinguished from. `governingByRecord` governs one consumer specifically,
  // keyed by (origin, ref), which is merger-assigned: a consumer cannot name its own key.
  //
  // NO STRENGTH LATTICE. DESIGNATED, EXISTENTIAL and COMPLETE are not totally ordered, so the rule
  // is not "refuse weaker requests" - it is that ANY requested mode differing from the governing
  // one is refused as a substitution and recorded as refused. Sameness is decidable; strength is
  // not, and inventing an order would invent a distinction reality has not demanded.
  //
  // Absent governance means the DEFAULT, which is none of the three modes and never had a name: try
  // the designated address within its own origin, and failing that fall back to candidates found by
  // claim, requiring exactly one eligible, else refuse. T1 pins it so vocabulary cannot move it.
  const governingFor = (r, c) => governedOccurrences[r.occurrence]
    || (governingByRecord && governingByRecord[key(r.origin, r.ref)])
    || (witnessModes && witnessModes[c.relation]) || null;
  const basisFor = (r, c) => (governedOccurrences[r.occurrence] !== undefined)
    ? (inheritedFor(r.occurrence) ? 'GOVERNING_BY_AUTHORIZED_CONTINUITY' : 'GOVERNING_BY_OCCURRENCE')
    : ((governingByRecord && governingByRecord[key(r.origin, r.ref)])
      ? 'GOVERNING_BY_RECORD'
      : ((witnessModes && witnessModes[c.relation]) ? 'GOVERNING_BY_RELATION' : 'DEFAULT'));
  const obligationOf = (r, c) => {
    const mode = governingFor(r, c);
    const requested = (requestedModes && requestedModes[c.relation]) || null;
    return { relation: c.relation, mode, governedBy: basisFor(r, c), requested,
      // A REQUEST IS DOCUMENTED, NEVER AUTHORIZED. Recording it alone would document the choice
      // without authorizing it, which is why this is a field and not an inference.
      requestAccepted: requested === null ? null : requested === mode };
  };
  const modeFor = (c) => (witnessModes && witnessModes[c.relation]) || null;
  // CONTINUITY IS RESOLVED BEFORE GOVERNANCE, because an authorized transfer decides which
  // occurrence an obligation attaches to. A transfer happens only where the governor authorized
  // BOTH the continuity and the governance transfer.
  const continuityFindings = resolveContinuity(merged, continuity);
  const inherited = {};
  for (const f of continuityFindings) {
    if (f.ok && f.transferGovernance && governingByOccurrence
        && governingByOccurrence[f.predecessor] !== undefined) {
      inherited[f.successor.occurrence] = governingByOccurrence[f.predecessor];
    }
  }
  const governedOccurrences = { ...(governingByOccurrence || {}), ...inherited };
  const inheritedFor = (occ) => Object.prototype.hasOwnProperty.call(inherited, occ);

  const unresolvedGovernance = [];
  for (const [k, mode] of Object.entries(governingByOccurrence || {})) {
    if (!merged.records.some((r) => r.occurrence === k)
        && !continuityFindings.some((f) => f.ok && f.transferGovernance && f.predecessor === k)) {
      unresolvedGovernance.push({ by: 'OCCURRENCE', denoting: k, mode,
        why: 'this occurrence is not in the merged set. The governed subject is absent, so this'
          + ' obligation governed nothing - it did not fall through to the default' });
    }
  }
  for (const [k, mode] of Object.entries(governingByRecord || {})) {
    if (!merged.records.some((r) => key(r.origin, r.ref) === k)) {
      unresolvedGovernance.push({ by: 'RECORD', denoting: k, mode,
        why: 'no record sits at these coordinates in this merged set' });
    }
  }
  const contract = () => contractOf(obligationContractId, witnessModes, governingByRecord,
    governingByOccurrence, merged);
  const policy = unattachedPolicy || UNATTACHED.INVALIDATE;
  const requestedPolicy = requestedUnattachedPolicy || null;
  const policyRecord = { policy, governedBy: unattachedPolicy ? 'GOVERNOR' : 'DEFAULT',
    requested: requestedPolicy,
    requestAccepted: requestedPolicy === null ? null : requestedPolicy === policy };

  if (policy === UNATTACHED.BLOCK) {
    return { ok: false, outcomes: [], unresolvedGovernance, unattached: policyRecord,
      continuity: continuityFindings, obligationContract: contract(),
      why: 'BLOCK is refused, not approximated. An unresolved governance entry denotes nothing in'
        + ' this merged set, so which consumers it was meant to govern is UNKNOWN - not merely'
        + ' unenumerated. Blocking whatever seemed nearby would read as precision and be invention' };
  }
  const forks = continuityFindings.filter((f) => f.kind === 'FORK');
  if (forks.length) {
    return { ok: false, outcomes: [], unresolvedGovernance, unattached: policyRecord,
      continuity: continuityFindings, obligationContract: contract(),
      why: forks.map((f) => f.why).join(' | ') };
  }
  if (unresolvedGovernance.length && policy === UNATTACHED.INVALIDATE) {
    return { ok: false, outcomes: [], unresolvedGovernance, unattached: policyRecord,
      continuity: continuityFindings, obligationContract: contract(),
      why: 'governance did not attach: ' + unresolvedGovernance.length + ' obligation(s) denote no'
        + ' record here (' + unresolvedGovernance.map((u) => u.by + ' ' + u.denoting).join('; ')
        + '). No admission is produced. The governor intended a burden that was not applied, and'
        + ' proceeding under the default would substitute a weaker one without authorization' };
  }

  const ord = orderWithinOrigins(merged.records);
  if (ord.cycle) {
    return { ok: false, why: 'records refer to one another in a cycle within one origin: '
      + ord.cycle.map((k) => JSON.parse(k).join('/')).join(' -> '),
    unresolvedGovernance, unattached: policyRecord,
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
    // A DESIGNATED witness never waits on a claim: nothing but its own source can satisfy it, so
    // no arriving supplier could change the answer. Designation reduces the search.
    if (governingFor(r, c) === MODE.DESIGNATED) return true;
    // COMPLETE refuses today whatever else happens; waiting would not make it satisfiable.
    if (governingFor(r, c) === MODE.COMPLETE) return true;
    const need = needOf(c);
    if (couldStillEstablish(need)) return false;          // a supplier may still arrive: wait
    return true;                                          // decidable now, one way or the other
  });

  const run = (r) => {
    const e = r.entry;
    const at = { origin: r.origin, ref: r.ref, occurrence: r.occurrence };
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
      const mode = governingFor(r, c);
      const obligation = obligationOf(r, c);
      if (mode) from.mode = mode;
      // A5: EVERY admission path carries the obligation it enforced - the reference path included.
      from.obligation = obligation;
      if (!fresh && mode === MODE.COMPLETE) {
        blocked = { ...at, state: STATE.FRONTIER_OPEN, minted: false, mode, obligation,
          why: 'this witness requires a decision over the COMPLETE candidate set, and completeness'
            + ' is not established here. A stalled pass shows only that nothing can advance under'
            + ' the current scheduling rules - not that every possible supplier has been exposed,'
            + ' because replayability itself depends on consumers still being postponed' };
        break;
      }
      if (!fresh && mode === MODE.DESIGNATED) {
        blocked = { ...at, state: STATE.FRONTIER_OPEN, minted: false, mode, obligation,
          why: 'the DESIGNATED source "' + c.ref + '" in origin ' + r.origin + ' did not resolve.'
            + ' Another record establishing the same claim is not this source, and a designated'
            + ' obligation is not satisfied by an equally true substitute'
            + (obligation.requested && obligation.requested !== mode
              ? '. A request for ' + obligation.requested + ' was recorded and REFUSED: the party'
                + ' seeking admission does not choose which burden applies' : '') };
        break;
      }
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
        // A STABLE TOTAL ORDER, not the input order. T5 found EXISTENTIAL picking a different
        // support depending on which journal was passed first: satisfaction was invariant but the
        // PROVENANCE was not, and provenance that moves with argument order is not provenance.
        // The order is arbitrary - it is (origin, ref) - and being arbitrary is fine here only
        // because the obligation said any one eligible support would do. Every candidate is still
        // named regardless of which was used.
        }).sort((x, y) => (x.origin + ' ' + x.ref).localeCompare(y.origin + ' ' + y.ref));
        if (cands.length > 1 && mode === MODE.EXISTENTIAL) {
          // ONE admissible support that binds is what this obligation asked for. A second agreeing
          // support leaves satisfaction unchanged - it does not strengthen the claim and it does
          // not create an impasse. Every eligible support is still named in the provenance.
          fresh = cands[0].fresh;
          from = { origin: cands[0].origin, ref: cands[0].ref, by: 'CLAIM', claim: need,
            mode, obligation, candidates: cands.map((x) => ({ origin: x.origin, ref: x.ref })),
            completenessBasis: 'NOT_REQUIRED_BY_THIS_MODE' };
        } else if (cands.length > 1) {
          // WHAT THIS REFUSAL KNOWS, and no more. Several records are eligible to support the same
          // proposition. That is NOT a report that the evidence disagrees, and it is not a report
          // that the claim is better supported: two histories can replay one observation, which is
          // two histories and ONE reason. Composition of multiple eligible supports is undefined in
          // this contract, so nothing is composed and nothing is chosen.
          blocked = { ...at, state: STATE.UNRESOLVED, minted: false, obligation,
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
            obligation, candidates: [{ origin: cands[0].origin, ref: cands[0].ref }],
            // EXISTENTIAL never needed the candidate set to be complete, so it must not report a
            // completeness basis it did not rely on - in either branch.
            completenessBasis: mode === MODE.EXISTENTIAL ? 'NOT_REQUIRED_BY_THIS_MODE'
              : 'DECLARED_CLAIMS_OF_PENDING_RECORDS' };
          if (mode) from.mode = mode;
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

  return { ok: true, outcomes, unresolvedGovernance, unattached: policyRecord,
    continuity: continuityFindings, obligationContract: contract() };
}

/** WHICH OBLIGATION CONTRACT AN OUTCOME WAS PRODUCED UNDER.
 *
 *  Without this, two runs under different governing obligations are indistinguishable after the
 *  fact - a result that looks like reproduction because nothing recorded what it was reproducing.
 *  That is the replay defect R3 guards against, one level up. */
function contractOf(id, byRelation, byRecord, byOccurrence, merged) {
  const canonical = JSON.stringify({
    byRelation: Object.entries(byRelation || {}).sort(),
    byRecord: Object.entries(byRecord || {}).sort(),
    byOccurrence: Object.entries(byOccurrence || {}).sort(),
  });
  // TWO FINGERPRINTS, BECAUSE THEY ANSWER DIFFERENT QUESTIONS. G3 predicted that a digest of the
  // governance MAP is insufficient on its own: two runs can share a map and govern different
  // subjects. `fingerprint` is the map; `subjects` is what the map actually landed on.
  const landed = (merged.records || []).map((r) => [r.origin, r.ref, r.occurrence]).sort();
  return { id: id || null,
    fingerprint: createHash('sha256').update(canonical).digest('hex'),
    subjects: createHash('sha256').update(JSON.stringify(landed)).digest('hex') };
}

/** Do two results rest on the SAME governing obligations? A replay under a different contract is
 *  not a reproduction of the same admission, however similar its outcomes look. */
export function sameObligationContract(a, b) {
  return !!(a && b && a.obligationContract && b.obligationContract
    && a.obligationContract.fingerprint === b.obligationContract.fingerprint);
}

/** Did two runs govern the SAME SUBJECTS? An identical governance map over a different assignment
 *  of records to origins is not the same admission contract, however well the maps match. */
export function sameGovernedSubjects(a, b) {
  return !!(a && b && a.obligationContract && b.obligationContract
    && a.obligationContract.subjects === b.obligationContract.subjects);
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
