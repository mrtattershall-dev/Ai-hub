// LAW 2 — REFERENT INVARIANCE.
//
//     AUTHORITY CANNOT BE TRANSFERRED BY CHANGING WHAT THE EVIDENCE IS ABOUT.
//
// Law 1 governs information LOSS. This governs something different, where nothing is lost at all:
//
//     evidence about criterion K0  ->  criterion becomes K1  ->  evidence still read as though about K0
//
// That is REFERENT DRIFT, and it is what the five doctest mutations actually were. The examples did not
// disappear; they stopped being about the same thing. Schematically:
//
//     E licenses C about X under K
//     X -> X'   or   K -> K'   or   observer -> observer'   or   scope -> scope'
//     does NOT imply  E licenses C about X' under K'
//
// A transfer requires an INDEPENDENTLY JUSTIFIED BRIDGE. With no bridge the honest answers are STALE and
// INCOMPARABLE - never "probably still fine".
//
// THE BRIDGE RELATIONS ARE THE DOMAIN ALGEBRA AGAIN, one level up, and transfer is POLARITY-DEPENDENT,
// which is the part that is easy to get wrong:
//
//     PRESERVED   K1 == K0          everything transfers
//     NARROWED    K1 is stricter    a FAILURE transfers (failing the looser implies failing the stricter);
//                                   a PASS does NOT
//     EXPANDED    K1 is looser      a PASS transfers (passing the stricter implies passing the looser);
//                                   a FAILURE does NOT
//     REPLACED    unrelated         nothing transfers
//     UNKNOWN     unestablished     nothing transfers - and "merely known to be different" is UNKNOWN,
//                                   not REPLACED
//
// PURPOSE IS NOT PHILOSOPHICALLY SPECIAL UNDER THIS LAW. It is a criterion with unusually high project
// authority, so ADVANCEMENT(S41 -> S42 | PURPOSE1) is an ordinary scoped claim. Changing the constitution
// does not make that claim false; it removes permission to silently reread it as being about PURPOSE2.
// Which is exactly the protection against making progress by redefining success.

export const REFERENT_DIMENSIONS = ['subject', 'criterion', 'observer', 'scope'];

export const BRIDGE = {
  PRESERVED: 'PRESERVED',
  NARROWED: 'NARROWED',
  EXPANDED: 'EXPANDED',
  REPLACED: 'REPLACED',
  UNKNOWN: 'UNKNOWN',
};

export const POLARITY = { POSITIVE: 'POSITIVE', NEGATIVE: 'NEGATIVE' };

// Which referent coordinates moved between two claims.
export function referentDelta(from, to) {
  return REFERENT_DIMENSIONS.filter((d) => (from[d] ?? null) !== (to[d] ?? null));
}

// Does a bridge license carrying a claim of this polarity across?
export function bridgeTransfers(relation, polarity) {
  if (relation === BRIDGE.PRESERVED) return true;
  if (relation === BRIDGE.NARROWED) return polarity === POLARITY.NEGATIVE;
  if (relation === BRIDGE.EXPANDED) return polarity === POLARITY.POSITIVE;
  return false;
}

// THE CENTRAL CHECK. Evidence established about one referent, queried about another.
export function transfer({ from, to, polarity = POLARITY.POSITIVE, bridges = {} }) {
  const moved = referentDelta(from, to);
  if (!moved.length) {
    return { ok: true, moved: [], why: 'the referent did not move; this is the same claim' };
  }
  const blocked = [];
  const used = [];
  for (const d of moved) {
    const b = bridges[d];
    if (!b) {
      blocked.push({ dimension: d, relation: BRIDGE.UNKNOWN,
        why: d + ' changed and no bridge was established. Evidence about one ' + d
          + ' is not evidence about another, however similar they look.' });
      continue;
    }
    if (!bridgeTransfers(b, polarity)) {
      blocked.push({ dimension: d, relation: b,
        why: 'a ' + b + ' bridge does not carry a ' + polarity + ' claim across ' + d
          + (b === BRIDGE.NARROWED ? ': passing the looser criterion does not imply passing the stricter'
            : b === BRIDGE.EXPANDED ? ': failing the stricter criterion does not imply failing the looser'
              : '') });
      continue;
    }
    used.push({ dimension: d, relation: b });
  }
  if (blocked.length) {
    return { ok: false, moved, blocked, used,
      verdict: blocked.every((b) => b.relation === BRIDGE.UNKNOWN) ? 'STALE' : 'INCOMPARABLE' };
  }
  return { ok: true, moved, used,
    why: 'every moved coordinate is covered by a bridge that carries this polarity' };
}

// A claim as it must be recorded once criterion is a scope coordinate: never "the project advanced", but
// "the project advanced UNDER THIS CRITERION". Rewriting the criterion is then visibly a transfer.
export function scopedClaim({ proposition, referent, polarity = POLARITY.POSITIVE, evidence = [] }) {
  const missing = REFERENT_DIMENSIONS.filter((d) => referent[d] === undefined);
  if (missing.length) {
    return { rejected: true,
      why: 'a scoped claim must name its ' + missing.join(', ') + '. A claim that cannot say what it is'
        + ' about cannot be told apart from a claim about something else.' };
  }
  return { proposition, referent: { ...referent }, polarity, evidence };
}

// Reading a recorded claim as though it were about a different referent. This is the operation that must
// never be free, and naming it makes the silent version impossible.
export function reinterpret(claim, newReferent, bridges) {
  const t = transfer({ from: claim.referent, to: newReferent, polarity: claim.polarity, bridges });
  if (!t.ok) {
    return { ok: false, ...t,
      original: claim.proposition,
      why: 'the original claim REMAINS TRUE about its own referent. What is refused is permission to'
        + ' reread it as being about this one.' };
  }
  return { ok: true, claim: { ...claim, referent: { ...newReferent }, transferredVia: t.used } };
}
