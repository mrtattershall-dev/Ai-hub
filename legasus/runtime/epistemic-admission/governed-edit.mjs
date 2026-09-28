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
// SCOPE OF THIS FILE: E0 only — target binding, on a declared operation contract, against a real write.
// NOT here, and each is its own prediction:
//     E2 revision binding     E3 evidence obligations     E4 single use     E5 allowance
//     E6 expiry               E7 ancestor revocation      E9 the check-then-change RACE
// E9 in particular: this module resolves once and writes immediately, which narrows the window but is NOT
// a race proof. E0 passing establishes nothing about E9.
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';
import { commit } from '../../legaknow/calculus.mjs';

export const OUTCOME = {
  ACTION_PERMITTED: 'ACTION_PERMITTED',
  ACTION_DENIED_NO_NORMATIVE_AUTHORITY: 'ACTION_DENIED_NO_NORMATIVE_AUTHORITY',
  ACTION_DENIED_SCOPE_MISMATCH: 'ACTION_DENIED_SCOPE_MISMATCH',
  ACTION_DENIED_TARGET_ESCAPES_ROOT: 'ACTION_DENIED_TARGET_ESCAPES_ROOT',
  ACTION_DENIED_OPERATION_UNSUPPORTED: 'ACTION_DENIED_OPERATION_UNSUPPORTED',
};

// The declared contract for the one operation E0 governs. Evidence obligations are a property of the
// CONTRACT, not a universal precondition — an operation declaring none is unaffected by E3.
export const EDIT_FIXTURE = Object.freeze({
  operation: 'edit',
  requires: ['edit:fixture'],
  evidenceObligations: [],        // E0 declares none; E3 will exercise a contract that declares some
});

// A structured action. `target` is a path RELATIVE TO root — never a sentence, never a label.
export function editAction({ target, contents }) {
  return Object.freeze({ operation: 'edit', target, contents });
}

export function governedEdit({ authority, action, root, contract = EDIT_FIXTURE }) {
  const deny = (outcome, why, extra = {}) =>
    ({ outcome, permitted: false, effected: false, why, ...extra });

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

  return {
    outcome: OUTCOME.ACTION_PERMITTED,
    permitted: true,
    effected: true,
    resolvedTarget,
    authorizedTarget,
    consumed: c.consumed,
    bytesBefore: before ? before.length : 0,
    bytesAfter: Buffer.byteLength(action.contents),
  };
}
