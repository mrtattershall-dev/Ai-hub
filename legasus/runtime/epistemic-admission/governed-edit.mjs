// THE ENFORCEMENT POINT — E0. The first place in Legasus where authority governs an ACTUAL EFFECT.
//
// Everything before this governed a verdict. commit() is pure authorization and writes nothing, so a
// `committed: true` for a mismatched action established an authorization failure and NOT that a write
// could occur. This module is where authorization has to meet the filesystem.
//
// THE ONE STRUCTURAL RULE, and the reason this file exists rather than a check bolted onto a caller:
//
//     THE CHECK AND THE WRITE CONSUME THE SAME RESOLVED TARGET.
//
// `resolvedTarget` is computed ONCE, below, and is the only value passed to both the authorization
// comparison and writeFileSync. A check that validates a label while a different argument determines the
// file recreates the hole with a check in front of it — the baseline probe demonstrated exactly that by
// passing `action: 'edit OTHER.js'` as a string while nothing derived a path from it.
//
// SCOPE OF THIS FILE, and the numbering, stated because it drifted once already:
//     E0  target binding        DONE  (subsumes amendment 3's E1, which was the same claim)
//     E1  revision binding      DONE  below, conditional on the authority pinning a revision
//     E3  evidence obligations  DONE  below, conditional on the CONTRACT declaring them
// NOT here, each its own prediction, none of them satisfied by anything in this file:
//     E4 single use    E5 allowance    E6 expiry    E7 ancestor revocation
//     E8 re-delegation policy
//     E9 the check-then-change RACE. This module resolves once, checks the CURRENT revision, and writes
//        immediately — which narrows the window and does NOT close it. Nothing here is a race proof.
//
// AND ONE CONTAINMENT BOUNDARY, recorded because rejecting `..` is easy to mistake for containment:
// refusing a traversing path does NOT establish filesystem containment through SYMLINKS or WINDOWS
// JUNCTIONS. `resolve()` does not dereference them, so an in-root name aliasing an out-of-root target is
// UNTESTED and outside the demonstrated coverage.
import { writeFileSync, readFileSync, existsSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, relative, sep, dirname } from 'node:path';
import { commit, isAuthority, KIND } from '../../legaknow/calculus.mjs';

export const OUTCOME = {
  ACTION_PERMITTED: 'ACTION_PERMITTED',
  ACTION_DENIED_NO_NORMATIVE_AUTHORITY: 'ACTION_DENIED_NO_NORMATIVE_AUTHORITY',
  ACTION_DENIED_SCOPE_MISMATCH: 'ACTION_DENIED_SCOPE_MISMATCH',
  ACTION_DENIED_TARGET_ESCAPES_ROOT: 'ACTION_DENIED_TARGET_ESCAPES_ROOT',
  ACTION_DENIED_OPERATION_UNSUPPORTED: 'ACTION_DENIED_OPERATION_UNSUPPORTED',
  ACTION_DENIED_REVISION_MISMATCH: 'ACTION_DENIED_REVISION_MISMATCH',
  ACTION_DENIED_UNADMITTED_EVIDENCE: 'ACTION_DENIED_UNADMITTED_EVIDENCE',
};

// ══ WHY A REFUSAL HAPPENED IS NOT THE SAME QUESTION AS WHETHER RETRYING COULD HELP. ══════════════
// Every outcome above is lexically a DENIAL, so a caller wanting to tell 'the world moved,
// re-observe and reissue' from 'you may not touch this file' had to string-match an outcome name.
// The names stay - they are load-bearing and pre-registered - and the retryability becomes its own
// first-class field instead of being inferred from wording.
//
//   STALE    the permission or evidence was about bytes that no longer exist. NOTHING was written.
//            Re-observing the target and reissuing the packet can legitimately proceed.
//   DENIED   the authority does not cover this action at all. Retrying changes nothing; only a
//            DIFFERENT authority would, and that is a new decision rather than a refresh.
//   INVALID  the action is malformed for this contract. Neither re-observation nor a new grant helps.
export const DISPOSITION = Object.freeze({ STALE: 'STALE', DENIED: 'DENIED', INVALID: 'INVALID' });

const DISPOSITION_OF = Object.freeze({
  [OUTCOME.ACTION_DENIED_OPERATION_UNSUPPORTED]: DISPOSITION.INVALID,
  [OUTCOME.ACTION_DENIED_TARGET_ESCAPES_ROOT]: DISPOSITION.DENIED,
  [OUTCOME.ACTION_DENIED_SCOPE_MISMATCH]: DISPOSITION.DENIED,
  [OUTCOME.ACTION_DENIED_NO_NORMATIVE_AUTHORITY]: DISPOSITION.DENIED,
  // The grant was issued FOR a revision that has since moved. Re-observe, reissue, proceed.
  [OUTCOME.ACTION_DENIED_REVISION_MISMATCH]: DISPOSITION.STALE,
  // Evidence splits: evidence ABOUT STALE BYTES is refreshable; missing or wrong-target evidence
  // is not a freshness problem and re-observing the same thing will not produce it.
  [OUTCOME.ACTION_DENIED_UNADMITTED_EVIDENCE]: DISPOSITION.DENIED,
});

// THE REVISION OF A TARGET IS THE DIGEST OF ITS CURRENT BYTES. Not an mtime, not a version label - both
// of those can agree while the content differs, which is the whole failure being guarded against.
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
export const revisionOf = (absPath) => (existsSync(absPath) ? sha256(readFileSync(absPath)) : null);

// The declared contract for the one operation E0 governs. Evidence obligations are a property of the
// CONTRACT, not a universal precondition — an operation declaring none is unaffected by E3.
export const EDIT_FIXTURE = Object.freeze({
  operation: 'edit',
  requires: ['edit:fixture'],
  evidenceObligations: [],        // E0 declares none; E3 will exercise a contract that declares some
});

// A SECOND CONTRACT, for E3. Evidence obligations belong to the OPERATION, never to every action: an
// operation declaring none is unaffected, which is why EDIT_FIXTURE above stays as it is.
export const EDIT_FIXTURE_EVIDENCED = Object.freeze({
  operation: 'edit',
  requires: ['edit:fixture'],
  evidenceObligations: ['observed:target'],
});

// A structured action. `target` is a path RELATIVE TO root — never a sentence, never a label.
export function editAction({ target, contents, evidence = [] }) {
  return Object.freeze({ operation: 'edit', target, contents, evidence: Object.freeze([...evidence]) });
}

// `deps.readBack` is a seam, and it exists so the read-back check is FALSIFIABLE. Without it there
// is no way to exercise a filesystem that transforms bytes on write, and a verification nobody can
// make fail is decoration. The default is the real filesystem; only a test passes anything else.
export function governedEdit({ authority, action, root, contract = EDIT_FIXTURE,
  deps = { readBack: (p) => readFileSync(p) } }) {
  const deny = (outcome, why, extra = {}) => {
    // An evidence refusal is STALE only when what was supplied was about THIS target at OTHER bytes.
    // None supplied, or supplied about another file, is a denial: re-observing cannot conjure it.
    const disposition = (outcome === OUTCOME.ACTION_DENIED_UNADMITTED_EVIDENCE && extra.staleRevisionCount)
      ? DISPOSITION.STALE
      : DISPOSITION_OF[outcome] || DISPOSITION.DENIED;
    return {
      outcome, permitted: false, effected: false, why, disposition,
      retryable: disposition === DISPOSITION.STALE,
      ...extra,
    };
  };

  if (!action || action.operation !== contract.operation) {
    return deny(OUTCOME.ACTION_DENIED_OPERATION_UNSUPPORTED,
      'the contract governs operation "' + contract.operation + '"; the action is "'
      + (action && action.operation) + '"');
  }

  // ---- RESOLVE ONCE. Every subsequent use — the authorization comparison AND the write — reads this.
  const resolvedRoot = resolve(root);
  const resolvedTarget = resolve(resolvedRoot, action.target);
  const targetWithinRoot = relative(resolvedRoot, resolvedTarget);

  if (targetWithinRoot.startsWith('..' + sep) || targetWithinRoot === '..' || !targetWithinRoot) {
    return deny(OUTCOME.ACTION_DENIED_TARGET_ESCAPES_ROOT,
      'the resolved target leaves the declared root', { resolvedTarget });
  }

  // ---- PHYSICAL CONTAINMENT (E10). The lexical check above is necessary and NOT sufficient, and
  // B-COMP-1 (153c4d7f) demonstrated the difference by consequence: a junction named `escape/` is
  // lexically inside, so `relative()` does not begin with `..`, the guard passed, this module
  // reported ACTION_PERMITTED, wrote, and read back successfully - and the bytes landed outside.
  //
  // THE PROPERTY, which is what this restores: a governed effect must occur inside the PHYSICAL
  // OBJECT denoted by the granted root. Not "the text must not traverse". The check above and the
  // write AGREED with each other because both used the same lexical resolution, so no consistency
  // requirement between components could ever have caught it.
  //
  // WHY THE DEEPEST EXISTING ANCESTOR, and not the target. The target legitimately may not exist -
  // creating a new in-root file has to keep working (E10 P4). A path component that does not exist
  // cannot be a reparse point, so resolving the deepest ancestor that DOES exist is sufficient:
  // everything below it is plain names. When the target itself exists this resolves the target,
  // which is what catches a symlinked leaf.
  //
  // This NARROWS the check-then-change race; it does not close it. A reparse point created between
  // this comparison and the write still escapes, for the same reason recorded at the top of this
  // file. E10 R5 covers "created before the call", not true TOCTOU.
  {
    const physical = (p) => { try { return realpathSync(p); } catch { return null; } };
    const realRoot = physical(resolvedRoot);
    if (!realRoot) {
      return deny(OUTCOME.ACTION_DENIED_TARGET_ESCAPES_ROOT,
        'the declared root could not be physically resolved, so containment cannot be established',
        { resolvedRoot });
    }
    let probe = resolvedTarget;
    let realProbe = physical(probe);
    while (!realProbe) {
      const up = dirname(probe);
      if (up === probe) break;                 // reached a filesystem root without finding anything
      probe = up;
      realProbe = physical(probe);
    }
    if (!realProbe) {
      return deny(OUTCOME.ACTION_DENIED_TARGET_ESCAPES_ROOT,
        'no existing ancestor of the target could be physically resolved', { resolvedTarget });
    }
    // Case-insensitive on win32 only, matching how the platform actually compares paths.
    const norm = (s) => (process.platform === 'win32' ? s.toLowerCase() : s);
    const inside = norm(realProbe) === norm(realRoot)
      || norm(realProbe).startsWith(norm(realRoot + sep));
    if (!inside) {
      return deny(OUTCOME.ACTION_DENIED_TARGET_ESCAPES_ROOT,
        'the target is lexically inside the declared root but PHYSICALLY resolves outside it'
        + ' (its nearest existing ancestor is "' + realProbe + '", and the root is "' + realRoot
        + '"). A path that merely reads as contained is not contained.',
        { resolvedTarget, physicalTarget: realProbe, physicalRoot: realRoot });
    }
  }

  // ---- TARGET BINDING. The gap G3 measured: the authority's context pins a target and commit() never
  // compares it. Compared here, against the RELATIVE path — not the basename, or `sub/fixture.js` would
  // satisfy a grant pinned to `fixture.js`.
  const authorizedTarget = authority && authority.context && authority.context.implementation;
  if (!authorizedTarget) {
    return deny(OUTCOME.ACTION_DENIED_SCOPE_MISMATCH,
      'the authority pins no implementation, so it authorizes no specific target');
  }
  const requested = targetWithinRoot.split(sep).join('/');
  if (requested !== authorizedTarget) {
    return deny(OUTCOME.ACTION_DENIED_SCOPE_MISMATCH,
      'the authority is scoped to "' + authorizedTarget + '"; this action targets "' + requested
      + '". A grant over one target is not a grant over another.',
      { authorizedTarget, requestedTarget: requested, resolvedTarget });
  }

  // ---- REVISION BINDING (E1). Only when the authority PINS a revision. A grant issued against revision
  // A must not authorize a change to a target that has since become revision B: the evidence and the
  // permission were about bytes that no longer exist. Checked against the CURRENT bytes on disk, here,
  // immediately before the write - not at issuance, where it would prove nothing about now.
  const pinnedRevision = authority && authority.context && authority.context.revision;
  const currentRevision = revisionOf(resolvedTarget);
  if (pinnedRevision && pinnedRevision !== currentRevision) {
    return deny(OUTCOME.ACTION_DENIED_REVISION_MISMATCH,
      'the authority is pinned to revision ' + String(pinnedRevision).slice(0, 12) + ' and the target is'
      + ' now at ' + String(currentRevision).slice(0, 12) + '. Permission granted over one revision is'
      + ' not permission over another.',
      { pinnedRevision, currentRevision, resolvedTarget });
  }

  // ---- EVIDENCE OBLIGATIONS (E3). Only those the CONTRACT declares. Each must be an admitted EPISTEMIC
  // token whose own context names THIS target and, where a revision is pinned, THIS revision - so
  // evidence about another file, or about bytes that have since changed, cannot satisfy the obligation.
  const obligations = contract.evidenceObligations || [];
  if (obligations.length) {
    const supplied = Array.isArray(action.evidence) ? action.evidence : [];
    for (const need of obligations) {
      const ok = supplied.find((e) => isAuthority(e) && e.kind === KIND.EPISTEMIC
        && e.context && e.context.implementation === requested
        && (!pinnedRevision || e.context.revision === currentRevision));
      if (!ok) {
        const wrongTarget = supplied.filter((e) => isAuthority(e)
          && e.context && e.context.implementation !== requested)
          .map((e) => e.context.implementation);
        const staleRev = supplied.filter((e) => isAuthority(e) && pinnedRevision
          && e.context && e.context.implementation === requested
          && e.context.revision !== currentRevision).length;
        return deny(OUTCOME.ACTION_DENIED_UNADMITTED_EVIDENCE,
          'the contract requires admitted evidence "' + need + '" about ' + requested
          + (wrongTarget.length ? '; supplied evidence is about ' + wrongTarget.join(', ') : '')
          + (staleRev ? '; ' + staleRev + ' item(s) are about a different revision' : '')
          + (!supplied.length ? '; none was supplied' : ''),
          { obligation: need, suppliedCount: supplied.length, wrongTarget, staleRevisionCount: staleRev });
      }
    }
  }

  // ---- NORMATIVE AUTHORIZATION. Structured, and carrying the resolved target so the record shows what
  // was actually authorized rather than a description of it.
  const c = commit({
    authority,
    action: { operation: contract.operation, target: requested },
    requires: contract.requires,
  });
  if (!c.committed) {
    return deny(OUTCOME.ACTION_DENIED_NO_NORMATIVE_AUTHORITY, c.why);
  }

  // ---- THE EFFECT. Same `resolvedTarget` the comparison used. No second derivation exists.
  const existedBefore = existsSync(resolvedTarget);
  const before = existedBefore ? readFileSync(resolvedTarget) : null;
  writeFileSync(resolvedTarget, action.contents);

  // ---- THE READ-BACK. `bytesAfter` used to be Buffer.byteLength(action.contents) - the length of what
  // was HANDED IN, never what landed. That is a receipt describing an INTENTION, and an intention is
  // exactly what a receipt must not describe: in-toto's own documentation warns that its links record
  // the artifacts a caller declares, so a caller can omit what actually changed. The same shape, one
  // layer down: nothing here had ever opened the file it just wrote.
  //
  // It is not theoretical for this project. `core.autocrlf` once made a RESTORED file git-normalised
  // rather than byte-exact, and a write that lands transformed - by encoding, by a normalising
  // filesystem, by a partial write - would previously have produced a receipt claiming the right byte
  // count over different bytes on disk.
  //
  // So the effect is now OBSERVED, not declared. `effectVerified` is false when the bytes on disk are
  // not the bytes intended. The outcome stays ACTION_PERMITTED because the write DID happen and
  // pretending otherwise would be a second lie; what the caller gets is the truth about what landed.
  const after = deps.readBack(resolvedTarget);
  const intendedRevision = sha256(Buffer.from(action.contents));
  const revisionAfter = sha256(after);

  return {
    outcome: OUTCOME.ACTION_PERMITTED,
    permitted: true,
    effected: true,
    resolvedTarget,
    authorizedTarget,
    consumed: c.consumed,
    bytesBefore: before ? before.length : 0,
    bytesAfter: after.length,
    revisionBefore: before ? sha256(before) : null,
    revisionAfter,
    intendedRevision,
    effectVerified: revisionAfter === intendedRevision,
    ...(revisionAfter === intendedRevision ? {} : {
      effectMismatch: `wrote ${Buffer.byteLength(action.contents)} bytes and read back ${after.length}; `
        + `intended ${intendedRevision.slice(0, 12)}, on disk ${revisionAfter.slice(0, 12)}`,
    }),
  };
}
