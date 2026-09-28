// LEGAKNOW — THE CLAIM LEDGER. The repository remembers code. Something has to remember KNOWLEDGE.
//
// Without it, a two-month run looks like: day 4 proves architecture A does not work; day 11 forgets; day
// 19 tries again; day 37 "maybe architecture A...". But the naive fix is WORSE than the disease:
//
//     THE HAZARD OF A KNOWLEDGE LEDGER IS NOT FORGETTING. IT IS SUPERSTITION.
//
// A wrong positive fails LOUDLY the next time it is exercised. A wrong negative fails SILENTLY, forever,
// by never being retried. So the ledger stores no eternal truths. It never records
//
//     A is false
//
// It records
//
//     EVIDENCE E FALSIFIED A UNDER WORLD STATE S, WITH INVALIDATION SET D.
//
// and D is what lets the claim expire when the ground it stood on moves. That is the EPISTEMIC RATCHET,
// and it is the same principle as the other two, one level up:
//
//     COMMIT    ratchet   wrong code cannot silently survive
//     PROGRESS  ratchet   work cannot silently become advancement
//     EPISTEMIC ratchet   historical evidence cannot silently become eternal truth
//
//     AUTHORITY LASTS ONLY AS LONG AS ITS EVIDENCE JUSTIFIES IT.
//
// THE LAWS
//     LAW 1  EXPIRY.      A claim goes STALE when anything in its INVALIDATION SET changes, and a stale
//                         claim may not be relied upon until re-derived. Conservative by construction:
//                         a touched dependency stales the claim. Narrowing that is a later optimisation
//                         and must never be a default.
//     LAW 2  ASYMMETRY.   Negative knowledge expires MORE EAGERLY, because its failure mode is silent.
//                         Negatives watch the capability envelope and the apparatus as well as the source:
//                         a negative can be overturned by the SYSTEM improving, not only by the program
//                         changing.
//     LAW 3  CONTESTED.   Contradicting live claims are not settled by recency. CONTESTED blocks reliance
//                         and owes an experiment.
//     LAW 4  ATTEMPT FAILURE IS NOT WORLD FALSITY.
//                         ATTEMPT AUTHORITY != COMMIT AUTHORITY, one level up. That a 1.5B could not build
//                         fishing is a fact about the attempt. It may NEVER become "fishing is impossible".
//     LAW 5  SCOPED REFUTATION.
//                         FALSIFIED requires evidence AND a non-empty invalidation set. A refutation that
//                         does not say what it depended on cannot ever be re-examined, and is therefore
//                         indistinguishable from dogma.
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';

const sha = (s) => createHash('sha256').update(String(s)).digest('hex').slice(0, 16);

// ONE VOCABULARY for knowledge and for capability. A capability claim and a hypothesis claim are the same
// object: a proposition whose warrant is some quantity of evidence. This is why LegaProgress is a VIEW
// over the ledger rather than a parallel ledger of its own.
export const STATE = {
  UNTESTED: 'UNTESTED',                     // never examined
  CLAIMED: 'CLAIMED',                       // asserted, no evidence yet - the weakest thing on record
  REACHABLE: 'REACHABLE',                   // an execution witness can make it happen: OPPORTUNITY exists
  VERIFIED: 'VERIFIED',                     // witness + an assertion that held
  FALSIFIED: 'FALSIFIED',                   // a counterexample, under a stated scope
  ATTEMPTED_FAILED: 'ATTEMPTED_FAILED',     // THIS system failed at it. Not a claim about the world.
  UNOBSERVABLE: 'UNOBSERVABLE',             // the apparatus cannot see it - never a clean negative
  UNSUPPORTED: 'UNSUPPORTED',               // outside the capability envelope, so unattemptable
  CONTESTED: 'CONTESTED',                   // evidence disagrees; reliance blocked
};

// Strictly ordered evidentiary strength, for asking whether something ADVANCED. Only these four are
// ordered: the rest are not weaker evidence, they are different answers.
export const EVIDENCE_ORDER = [STATE.UNTESTED, STATE.CLAIMED, STATE.REACHABLE, STATE.VERIFIED];
export const strengthOf = (s) => EVIDENCE_ORDER.indexOf(s);

export const LIFECYCLE = {
  VALID: 'VALID', STALE: 'STALE', REVALIDATED: 'REVALIDATED', INVALID: 'INVALID',
};

export const BASIS = {
  EXECUTION_WITNESS: 'EXECUTION_WITNESS',   // strongest: reality was made to touch the code
  PROOF: 'PROOF',
  REPOSITORY_FACT: 'REPOSITORY_FACT',
  ATTEMPT_RECORD: 'ATTEMPT_RECORD',         // weakest, and never licenses FALSIFIED
  ASSUMPTION: 'ASSUMPTION',
};

// LAW 2.
const NEGATIVE = new Set([STATE.FALSIFIED, STATE.ATTEMPTED_FAILED, STATE.UNSUPPORTED]);
export const expiryScope = (state) => (NEGATIVE.has(state) ? 'BROAD' : 'NARROW');

// What a claim watches beyond its own invalidation set.
export function watchKeys(entry) {
  return expiryScope(entry.state) === 'BROAD' ? ['capabilityVersion', 'apparatusVersion'] : [];
}

export const claimId = ({ subject, predicate, object }) =>
  sha([subject, predicate, object === undefined ? '' : JSON.stringify(object)].join('|'));

// A snapshot of the world, kept as PER-FILE digests so that a claim can depend on part of it. The whole
// point of the invalidation set is that not every claim is disturbed by every commit.
export function worldState({ files = [], capabilityVersion = 'r2',
  apparatusVersion = 'exercise-r1' } = {}) {
  const digests = {};
  for (const f of files) digests[f] = existsSync(f) ? sha(readFileSync(f, 'utf8')) : 'ABSENT';
  return { digests, capabilityVersion, apparatusVersion };
}

// LAW 4 and LAW 5, enforced rather than described.
export function assertClaim({ subject, predicate, object, state, basis, world,
  invalidationSet = [], evidence = [], note }) {
  if (state === STATE.FALSIFIED && basis === BASIS.ATTEMPT_RECORD) {
    return { rejected: true, why:
      'ATTEMPT FAILURE IS NOT WORLD FALSITY: an attempt record supports ATTEMPTED_FAILED, never'
      + ' FALSIFIED. Refuting a proposition requires evidence about the proposition.' };
  }
  if (state === STATE.FALSIFIED && (!evidence.length || !invalidationSet.length)) {
    return { rejected: true, why:
      'SCOPED REFUTATION: a refutation must record its evidence AND what it depended on, or it can never'
      + ' be re-examined and is indistinguishable from dogma.' };
  }
  if (state === STATE.VERIFIED && basis !== BASIS.EXECUTION_WITNESS && basis !== BASIS.PROOF) {
    return { rejected: true, why:
      'VERIFIED requires an execution witness or a proof. Anything else is CLAIMED.' };
  }
  if (state === STATE.VERIFIED && !evidence.length) {
    return { rejected: true, why: 'VERIFIED without evidence is a declaration, not a verification' };
  }
  const validAgainst = {
    digests: Object.fromEntries(invalidationSet.map((f) => [f, world?.digests?.[f] ?? 'UNKNOWN'])),
    capabilityVersion: world?.capabilityVersion ?? null,
    apparatusVersion: world?.apparatusVersion ?? null,
  };
  return {
    id: claimId({ subject, predicate, object }),
    subject, predicate, object: object ?? null,
    state, basis, evidence, note: note ?? null,
    invalidationSet: [...invalidationSet],
    validAgainst, lifecycle: LIFECYCLE.VALID,
    assertedAt: new Date().toISOString(),
  };
}

// LAW 1 + LAW 2.
export function freshness(entry, now) {
  const changed = [];
  for (const f of entry.invalidationSet) {
    const then = entry.validAgainst.digests[f];
    const nowD = now?.digests?.[f] ?? 'UNKNOWN';
    if (then !== nowD) changed.push(f);
  }
  for (const k of watchKeys(entry)) {
    if (now?.[k] !== entry.validAgainst[k]) changed.push(k);
  }
  if (!changed.length) return { ...entry, fresh: true };
  return { ...entry, fresh: false, lifecycle: LIFECYCLE.STALE, changed,
    why: 'the claim was established against a different ' + changed.join(', ')
      + '; it may not be relied upon until re-derived'
      + (expiryScope(entry.state) === 'BROAD'
        ? '. NEGATIVE knowledge watches the envelope and apparatus too, because a stale negative is'
        + ' never retried and so never corrects itself.' : '') };
}

// THE SINGLE GATE. Nothing downstream reads .state directly.
export function mayRely(entry) {
  if (!entry) return { ok: false, reason: 'UNTESTED', why: 'no claim on record' };
  if (entry.lifecycle === LIFECYCLE.STALE) {
    return { ok: false, reason: 'STALE', why: entry.why || 'the claim is stale' };
  }
  if (entry.lifecycle === LIFECYCLE.INVALID) {
    return { ok: false, reason: 'INVALID', why: 'the claim failed re-derivation' };
  }
  for (const [s, why] of [
    [STATE.CONTESTED, 'evidence disagrees about this claim; an experiment is owed before use'],
    [STATE.UNOBSERVABLE, 'the apparatus could not observe this, which is not a negative result'],
    [STATE.UNTESTED, 'never examined'],
  ]) if (entry.state === s) return { ok: false, reason: s, why };
  return { ok: true, state: entry.state };
}

// LAW 3.
const CONTRADICTS = (a, b) =>
  (a === STATE.VERIFIED && b === STATE.FALSIFIED) || (a === STATE.FALSIFIED && b === STATE.VERIFIED);

export function record(ledger, entry) {
  if (entry.rejected) return { ledger, rejected: true, why: entry.why };
  const prior = ledger[entry.id];
  if (prior && CONTRADICTS(prior.state, entry.state) && prior.lifecycle !== LIFECYCLE.STALE) {
    const contested = { ...entry, state: STATE.CONTESTED,
      priorState: prior.state, priorEvidence: prior.evidence,
      why: 'two live claims disagree: ' + prior.state + ' and ' + entry.state
        + '. Neither may be relied upon until an experiment separates them.' };
    return { ledger: { ...ledger, [entry.id]: contested }, contested: true, entry: contested };
  }
  return { ledger: { ...ledger, [entry.id]: entry }, entry };
}

export function recall(ledger, key, now) {
  const e = ledger[claimId(key)];
  if (!e) return { state: STATE.UNTESTED, known: false };
  return now ? freshness(e, now) : e;
}

// Re-derivation is the ONLY exit from STALE, and "could not tell" must not restore the old answer.
export function rederive(entry, now, deriver) {
  const out = deriver(entry);
  if (!out) {
    return { ...entry, lifecycle: LIFECYCLE.INVALID,
      why: 'the claim went stale and could not be re-derived; it is no longer knowledge' };
  }
  const same = out.state === entry.state;
  const validAgainst = {
    digests: Object.fromEntries(entry.invalidationSet.map((f) => [f, now?.digests?.[f] ?? 'UNKNOWN'])),
    capabilityVersion: now?.capabilityVersion ?? null,
    apparatusVersion: now?.apparatusVersion ?? null,
  };
  return { ...entry, ...out, validAgainst,
    lifecycle: same ? LIFECYCLE.REVALIDATED : LIFECYCLE.VALID,
    previousState: entry.state,
    why: same ? 're-derived to the same state against the current world'
      : 'the world changed and so did the answer: ' + entry.state + ' -> ' + out.state };
}

// Sweep the whole ledger against a new world. This is what runs after every commit, and being
// conservative here is the entire safety property.
export function reassess(ledger, now) {
  const out = {};
  const staled = [];
  for (const [id, e] of Object.entries(ledger)) {
    const f = freshness(e, now);
    out[id] = f.fresh ? e : f;
    if (!f.fresh) staled.push({ id, subject: e.subject, state: e.state, changed: f.changed });
  }
  return { ledger: out, staled };
}

// What the ledger owes work to. This is the input a scheduler would need, which is exactly why a
// scheduler cannot be built before the ledger exists.
export function openQuestions(ledger) {
  return Object.values(ledger)
    .filter((e) => !mayRely(e).ok)
    .map((e) => ({ id: e.id, subject: e.subject, predicate: e.predicate,
      blocked: mayRely(e).reason, state: e.state }));
}
