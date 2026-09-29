// ══════════════════════════════════════════════════════════════════════════════════════════════════
// workspace.mjs — GOVERNED-WORKSPACE-1. Parallel thought, serialized conflicting effect.
//
// Frozen definition: ../epistemic-admission/GOVERNED-WORKSPACE-1_PREREG.md
//
// THE INVARIANT THIS FILE EXISTS TO HOLD:
//
//     An ACTION_PREPARED event must NEVER become an effect by itself.
//
// Preparing a packet records a proposal. It grants nothing. Every commit still passes the current
// revision, the contract's evidence obligations and the owner-issued authority through `governedEdit`,
// which resolves the target once and writes to the same resolved path it authorized against.
//
// HOW CONFLICTING EFFECTS SERIALIZE, and it is worth being precise because the obvious design is wrong:
// there is NO LOCK HERE. Two packets built on the same revision may both prepare, and both may reach
// commit. The first writes, which changes the target's bytes, which changes its digest. The second then
// hits E1's revision binding INSIDE `governedEdit` and is refused as a revision mismatch.
//
// A coordinator-level mutex would have produced the same external behaviour while proving nothing about
// authority: the refusal has to come from the effect boundary, or "serialized conflicting effect" is a
// property of this file rather than of the system.
//
// WHAT THIS LAYER MAY NOT DO, and does not:
//   mint, elevate or re-scope an authority token
//   write to a target by any route other than `governedEdit`
//   treat a HYPOTHESIS as an OBSERVATION because something depended on it
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import {
  governedEdit, editAction, revisionOf, OUTCOME as EFFECT_OUTCOME, EDIT_FIXTURE,
} from '../epistemic-admission/governed-edit.mjs';

const NL = String.fromCharCode(10);

/** Event kinds. Uncertainty is a KIND, so a hypothesis cannot quietly become an observation. */
export const EVENT = Object.freeze({
  OBSERVATION: 'OBSERVATION',
  HYPOTHESIS: 'HYPOTHESIS',
  PROPOSAL: 'PROPOSAL',
  EVALUATION: 'EVALUATION',
  AUTHORITY: 'AUTHORITY',
  ACTION_PREPARED: 'ACTION_PREPARED',
  ACTION_COMMITTED: 'ACTION_COMMITTED',
  ACTION_REFUSED: 'ACTION_REFUSED',
  INVALIDATED: 'INVALIDATED',
});

/**
 * Refusals this COORDINATION layer adds. Named distinctly from `governedEdit`'s outcomes so a
 * coordination decision can never be read as an authority decision, and so a reader of a record can
 * always tell which boundary refused.
 */
export const PACKET = Object.freeze({
  STALE_DEPENDENCY: 'PACKET_STALE_DEPENDENCY',
  EXPIRED: 'PACKET_EXPIRED',
  DEPENDENCY_INVALIDATED: 'PACKET_DEPENDENCY_INVALIDATED',
  NOT_PREPARED: 'PACKET_NOT_PREPARED',
});

const hash = (t) => createHash('sha256').update(String(t)).digest('hex');

/** A scope names what may conflict. Only `workspace` and `file` are implemented. */
export function fileScope(path) { return { kind: 'file', path }; }
export function workspaceScope() { return { kind: 'workspace', path: '.' }; }
export const sameScope = (a, b) => a && b && a.kind === b.kind && a.path === b.path;

export function createWorkspace({ root, clock = () => Date.now() }) {
  const events = [];
  const packets = new Map();
  let seq = 0;

  const append = (type, body) => {
    const ev = Object.freeze({
      id: `${type.toLowerCase()}-${++seq}`,
      type, at: clock(), ...body,
    });
    events.push(ev);
    return ev;
  };

  /** The digest of a file scope's current bytes, read from disk. Never an mtime, never a label. */
  const revisionOfScope = (scope) => (scope.kind === 'file' ? revisionOf(join(root, scope.path)) : null);

  // ── publishing. Independent producers call these concurrently; nothing here waits on anything. ──
  const publish = {
    observation: ({ scope, content, by }) => append(EVENT.OBSERVATION, {
      scope, by, content, contentHash: hash(JSON.stringify(content)),
      revision: revisionOfScope(scope), certainty: 'OBSERVED',
    }),
    /** A hypothesis carries its uncertainty and is never promoted by being depended upon. */
    hypothesis: ({ scope, content, by, confidence = null, dependsOn = [] }) => append(EVENT.HYPOTHESIS, {
      scope, by, content, contentHash: hash(JSON.stringify(content)),
      revision: revisionOfScope(scope), certainty: 'HYPOTHESISED', confidence, dependsOn,
    }),
    proposal: ({ scope, content, by, dependsOn = [] }) => append(EVENT.PROPOSAL, {
      scope, by, content, contentHash: hash(JSON.stringify(content)), dependsOn,
      revision: revisionOfScope(scope),
    }),
    evaluation: ({ scope, content, by, dependsOn = [] }) => append(EVENT.EVALUATION, {
      scope, by, content, contentHash: hash(JSON.stringify(content)), dependsOn,
    }),
    /** Recording that an authority EXISTS. This does not create one and cannot widen one. */
    authority: ({ scope, by, note }) => append(EVENT.AUTHORITY, { scope, by, note }),
    /** A dependency is withdrawn - the finding it recorded no longer holds. */
    invalidated: ({ eventId, why, by }) => append(EVENT.INVALIDATED, { eventId, why, by }),
  };

  const isInvalidated = (eventId) => events.some((e) => e.type === EVENT.INVALIDATED && e.eventId === eventId);

  /**
   * PREPARE. Records a proposal to act, and grants nothing whatsoever. The packet declares its resolved
   * target, the revision it was built against, the exact evidence it depends on, the authority it will
   * present, the contract, the effect, how it will be validated and how it would be rolled back.
   */
  function prepare({ scope, baseRevision, dependsOn = [], authority, contract = EDIT_FIXTURE, contents, validation, rollback, expiresAt = null, by }) {
    const ev = append(EVENT.ACTION_PREPARED, {
      scope, baseRevision, dependsOn, contract: contract.operation, requires: contract.requires,
      effectHash: hash(contents), validation: validation || null,
      rollback: rollback || { kind: 'restore-bytes', note: 'the bytes present at baseRevision' },
      expiresAt, by,
      // Stated in the record itself, so nobody reading it can mistake preparation for permission.
      note: 'a prepared action is a PROPOSAL. It is not permission and cannot become an effect by itself.',
    });
    packets.set(ev.id, { ev, authority, contract, contents, scope, baseRevision, dependsOn, expiresAt });
    return ev;
  }

  /**
   * COMMIT. The only path to an effect, and every gate below `governedEdit` is `governedEdit`'s own.
   *
   * This layer checks only what it is entitled to check - that the packet exists, has not expired, and
   * does not rest on a withdrawn finding. It does NOT pre-check the revision: doing so would make the
   * conflict outcome a property of this file. The revision is settled at the effect boundary.
   */
  function commit(packetId) {
    const p = packets.get(packetId);
    if (!p) {
      const ev = append(EVENT.ACTION_REFUSED, { packetId, reason: PACKET.NOT_PREPARED, why: 'no prepared packet with that id' });
      return { committed: false, reason: PACKET.NOT_PREPARED, event: ev, effected: false };
    }

    if (p.expiresAt !== null && clock() > p.expiresAt) {
      const ev = append(EVENT.ACTION_REFUSED, {
        packetId, scope: p.scope, reason: PACKET.EXPIRED,
        why: `the packet's freshness window closed at ${p.expiresAt}`,
      });
      return { committed: false, reason: PACKET.EXPIRED, event: ev, effected: false };
    }

    const withdrawn = p.dependsOn.filter((id) => isInvalidated(id));
    if (withdrawn.length) {
      const ev = append(EVENT.ACTION_REFUSED, {
        packetId, scope: p.scope, reason: PACKET.DEPENDENCY_INVALIDATED, withdrawn,
        why: `the packet depends on ${withdrawn.join(', ')}, which has been withdrawn; it must be revalidated, not applied`,
      });
      return { committed: false, reason: PACKET.DEPENDENCY_INVALIDATED, event: ev, effected: false };
    }

    // ── THE EFFECT BOUNDARY. One call, the existing executor, unchanged. The authority is the one the
    // packet was prepared with; nothing here rebuilds, re-scopes or refreshes it.
    const r = governedEdit({
      authority: p.authority,
      action: editAction({ target: p.scope.path, contents: p.contents, evidence: p.evidenceTokens || [] }),
      root,
      contract: p.contract,
    });

    if (!r.permitted) {
      const ev = append(EVENT.ACTION_REFUSED, {
        packetId, scope: p.scope, reason: r.outcome, why: r.why,
        refusedBy: 'governedEdit', pinnedRevision: r.pinnedRevision, currentRevision: r.currentRevision,
      });
      return { committed: false, reason: r.outcome, why: r.why, event: ev, effected: false, effect: r };
    }

    const ev = append(EVENT.ACTION_COMMITTED, {
      packetId, scope: p.scope, baseRevision: p.baseRevision,
      resolvedTarget: r.resolvedTarget, authorizedTarget: r.authorizedTarget,
      newRevision: revisionOfScope(p.scope), effectHash: hash(p.contents),
    });
    return { committed: true, reason: EFFECT_OUTCOME.ACTION_PERMITTED, event: ev, effected: true, effect: r };
  }

  /**
   * Which prepared packets a scope's current state has made stale. LOCAL: a packet scoped to another
   * file is untouched, and one scope moving never halts another.
   */
  function staleFor(scope) {
    const now = revisionOfScope(scope);
    return [...packets.entries()]
      .filter(([, p]) => sameScope(p.scope, scope) && p.baseRevision !== now)
      .map(([id, p]) => ({ packetId: id, baseRevision: p.baseRevision, currentRevision: now }));
  }

  /** Packets untouched by a change to `scope` - the whole point of scoping conflict. */
  function unaffectedBy(scope) {
    return [...packets.entries()].filter(([, p]) => !sameScope(p.scope, scope)).map(([id]) => id);
  }

  return {
    root, publish, prepare, commit, staleFor, unaffectedBy, revisionOfScope,
    events: () => [...events],
    packetIds: () => [...packets.keys()],
  };
}

/**
 * REPLAY. Rebuild the admissibility decisions from the event log alone, with no disk access, and no
 * ability to re-derive them from anything the log does not contain.
 *
 * The point is falsifiable: if a decision cannot be reconstructed from the record, the record is
 * missing something it claimed to carry.
 */
export function replay(events) {
  const decisions = [];
  const invalidated = new Set(events.filter((e) => e.type === EVENT.INVALIDATED).map((e) => e.eventId));
  const prepared = new Map(events.filter((e) => e.type === EVENT.ACTION_PREPARED).map((e) => [e.id, e]));
  for (const e of events) {
    if (e.type === EVENT.ACTION_COMMITTED) {
      decisions.push({ packetId: e.packetId, admitted: true, reason: EFFECT_OUTCOME.ACTION_PERMITTED, scope: e.scope });
    } else if (e.type === EVENT.ACTION_REFUSED) {
      decisions.push({ packetId: e.packetId, admitted: false, reason: e.reason, scope: e.scope, refusedBy: e.refusedBy || 'coordination' });
    }
  }
  return {
    decisions,
    // Independently derivable from the log: which packets rested on a withdrawn finding.
    restedOnWithdrawn: [...prepared.values()]
      .filter((p) => (p.dependsOn || []).some((d) => invalidated.has(d)))
      .map((p) => p.id),
    counts: events.reduce((m, e) => { m[e.type] = (m[e.type] || 0) + 1; return m; }, {}),
  };
}

export { EFFECT_OUTCOME, revisionOf, EDIT_FIXTURE };
