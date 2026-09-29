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
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
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
  // The write HAPPENED and the bytes on disk are not the bytes intended. Distinct from COMMITTED,
  // because it is not verified progress, and distinct from REFUSED, because something did change.
  ACTION_EFFECTED_UNVERIFIED: 'ACTION_EFFECTED_UNVERIFIED',
  INVALIDATED: 'INVALIDATED',
  // VERIFIER-1. A declared expectation and an OBSERVED verdict are different facts, so the verdict is
  // its own event rather than a field on the commit. `validation` used to be recorded at prepare() and
  // executed NOWHERE - a declaration that read like a check. A promotion receipt may not cite a
  // verifier digest that no verifier produced.
  VERIFICATION: 'VERIFICATION',
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
  // An effect landed unverified on this scope. It is NOT unauthorised - the authority was valid and
  // the write occurred - it is UNUSABLE AS VERIFIED PROGRESS, so it may not become the base revision
  // for later work. The scope stays quarantined until a person reconciles or restores it.
  EFFECT_UNVERIFIED: 'PACKET_EFFECT_UNVERIFIED',
  SCOPE_UNVERIFIED: 'PACKET_SCOPE_UNVERIFIED',
  // VERIFIER-1. The bytes ARE the bytes intended - this is not an effect mismatch - but the declared
  // check does not hold of them. The change landed as written and does not do what was claimed, so it
  // is not verified progress and may not become a base for later work.
  VALIDATION_FAILED: 'PACKET_VALIDATION_FAILED',
  // ANCESTRY-1. A predecessor this candidate was verified WITH is defunct. STALE, never DENIED: the
  // same work may proceed once re-verified against a new ancestry receipt.
  STALE_ANCESTRY: 'PACKET_STALE_ANCESTRY',
});

const hash = (t) => createHash('sha256').update(String(t)).digest('hex');

/**
 * The lineage that permitted a promotion, as a digest. READ-ONLY over a token this layer did not make:
 * `ancestry` is the chain the calculus itself recorded through DELEGATE, so the digest names the route
 * from the independent root rather than merely asserting a token was present.
 *
 * It does NOT and must not make the token verifiable from the digest - membership in the calculus's
 * module-private WeakSet is the only thing that establishes authenticity, and a digest is copyable.
 * This records WHICH lineage acted; it never substitutes for asking the calculus.
 */
export const authorityLineageDigest = (authority) => (authority
  ? hash(JSON.stringify({
    kind: authority.kind,
    grant: [...(authority.grant || [])].sort(),
    context: Object.fromEntries(Object.entries(authority.context || {}).sort()),
    ancestry: authority.ancestry || [],
  }))
  : null);

/** A scope names what may conflict. Only `workspace` and `file` are implemented. */
export function fileScope(path) { return { kind: 'file', path }; }
export function workspaceScope() { return { kind: 'workspace', path: '.' }; }
export const sameScope = (a, b) => a && b && a.kind === b.kind && a.path === b.path;

// ── ANCESTRY-1: A WORLD, NOT A FILE ────────────────────────────────────────────────────────────────
//
// `baseRevision` pins ONE SCOPE, which answers CONFLICT ("do these packets touch the same target?")
// and cannot answer ANCESTRY ("was this candidate verified in a world containing these other
// changes?"). A packet had no field able to name a state of files it does not touch, so
// "C verified on base + A + B" was not unimplemented - it was INEXPRESSIBLE.
//
// `treeRevisionOf` digests the whole governed tree so a candidate can name a WORLD. It does NOT
// replace `baseRevision`: conflict stays scope-local, because that is what makes parallel work
// possible, and an unrelated file moving must never stale a candidate that never touched it.
const IGNORED_DIRS = new Set(['.git', 'node_modules']);
export function treeRevisionOf(root) {
  const entries = [];
  const walk = (dir) => {
    let names;
    try { names = readdirSync(dir).sort(); } catch { return; }
    for (const name of names) {
      if (IGNORED_DIRS.has(name)) continue;
      const full = join(dir, name);
      let st;
      try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) walk(full);
      else if (st.isFile()) {
        entries.push(relative(root, full).split(sep).join('/') + ':'
          + createHash('sha256').update(readFileSync(full)).digest('hex'));
      }
    }
  };
  if (!existsSync(root)) return null;
  walk(root);
  return createHash('sha256').update(entries.join(NL)).digest('hex');
}

// ── VERIFIER-1: AN EXECUTED CHECK, NOT A DECLARATION ───────────────────────────────────────────────
//
// THE VERIFIER READS THE BYTES ON DISK ITSELF. It is never handed the contents the packet proposed,
// because grading the declaration against the declaration is the same shape as the receipt that
// reported `Buffer.byteLength(action.contents)` and had never opened the file it wrote.
//
// It takes (root, scope, validation) and NOTHING from the packet. That signature is the guarantee.
export function runValidation({ root, scope, validation }) {
  if (!validation) return null;                       // declaring none is not failing one
  const target = join(root, scope.path);
  const present = existsSync(target);
  const bytes = present ? readFileSync(target) : null;
  const text = present ? bytes.toString('utf8') : null;
  const observedRevision = present ? createHash('sha256').update(bytes).digest('hex') : null;

  let passed = false;
  let detail = '';
  switch (validation.kind) {
    case 'expect-bytes':
      passed = present && text === validation.bytes;
      detail = passed ? 'the bytes on disk are exactly the bytes expected'
        : `expected ${Buffer.byteLength(validation.bytes || '')} bytes, disk holds `
          + (present ? String(bytes.length) : 'no such file');
      break;
    case 'expect-contains':
      passed = present && text.includes(validation.needle);
      detail = passed ? `the bytes on disk contain ${JSON.stringify(validation.needle)}`
        : `the bytes on disk do NOT contain ${JSON.stringify(validation.needle)}`;
      break;
    case 'expect-absent':
      passed = present && !text.includes(validation.needle);
      detail = passed ? `the bytes on disk are free of ${JSON.stringify(validation.needle)}`
        : `the bytes on disk still contain ${JSON.stringify(validation.needle)}`;
      break;
    default:
      // An unrecognised kind must FAIL, never pass by falling through. A check nobody implemented
      // silently succeeding is the `[].every()` shape: a branch that cannot report a problem.
      passed = false;
      detail = `unrecognised validation kind ${JSON.stringify(validation.kind)}; an unimplemented`
        + ' check reports FAIL, because passing would make the verdict meaningless';
  }
  return {
    verdict: passed ? 'PASS' : 'FAIL',
    kind: validation.kind,
    detail,
    observedRevision,
    // The digest a promotion receipt cites. It covers the VERDICT AND WHAT WAS OBSERVED, so a receipt
    // cannot cite a passing digest over bytes that were never the bytes checked.
    verifierReceiptDigest: createHash('sha256')
      .update([scope.kind, scope.path, validation.kind, passed ? 'PASS' : 'FAIL',
        String(observedRevision)].join('|')).digest('hex'),
  };
}

// `deps` is forwarded verbatim to the executor. It exists ONLY so the read-back check can be
// exercised from this layer - a quarantine nobody can trigger is a quarantine nobody has tested.
// `priorEvents` is how a workspace comes back after a restart. The quarantine is DERIVED from the
// log, so replaying the log restores it - there is no separate quarantine state that a reload could
// lose, which is the point of deriving it rather than holding it.
export function createWorkspace({ root, clock = () => Date.now(), deps = undefined, priorEvents = [] }) {
  /**
   * QUARANTINE IS DERIVED FROM THE LOG, NOT HELD IN A SET. The first version kept an in-memory Set
   * keyed by path, which had two defects tatte named: it died on reload, erasing the evidence that
   * a scope was damaged; and keyed by PATH alone it could never be cleared, so restoring the file
   * left the target frozen forever.
   *
   * Derived and revision-scoped fixes both. A scope is quarantined when the log holds an unverified
   * effect on it whose landed bytes are STILL the bytes on disk. Restore or reconcile the file and
   * the quarantine lifts by itself, because the condition stops being true - no clearing call, and
   * nothing to forget to call. It survives any reload that replays the log.
   */
  const quarantineOn = (scope) => {
    const now = revisionOfScope(scope);
    // Compared against `revisionOnDisk`, which THIS layer read with its own eyes at the moment of the
    // damage - not against the executor's `revisionAfter`. The two are the same file in production;
    // they differ only under a test seam that simulates a transforming filesystem, and a quarantine
    // that judged through one lens while being set by another would silently never fire.
    return events.find((e) => (
      e.type === EVENT.ACTION_EFFECTED_UNVERIFIED
      // VERIFIER-1 extends the SAME condition to a failed declared check. The bytes are exactly the
      // bytes intended, so this is not an effect mismatch - but an effect that does not do what was
      // claimed is equally not verified progress, and the invariant is about PROGRESS, not fidelity:
      // it may not be retained, published, or used as a base revision. Derived and revision-scoped
      // like the original, so restoring or reconciling the file lifts it with no clearing call.
      || (e.type === EVENT.VERIFICATION && e.verdict === 'FAIL' && e.effected === true)
    ) && sameScope(e.scope, scope) && e.revisionOnDisk === now) || null;
  };
  const events = [...priorEvents];
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

  // ── ANCESTRY-1. DERIVED FROM THE LOG, like the quarantine, so a reload that replays the log
  // restores it and there is no separate ancestry state a restart could lose. ──────────────────────

  /** Every promotion receipt in the record, addressed by the digest a descendant cites. */
  const receipts = () => {
    const m = new Map();
    for (const e of events) if (e.type === EVENT.ACTION_COMMITTED && e.receiptDigest) m.set(e.receiptDigest, e);
    return m;
  };

  /**
   * IS THIS RECEIPT DEFUNCT? The staleness test is deliberately NOT "the tree moved".
   *
   * Tree-revision equality would have been the obvious rule and it is WRONG: every commit moves the
   * tree, so every candidate would stale on every unrelated change, which destroys the parallelism the
   * whole design exists for and contradicts AN-1 directly.
   *
   * A receipt is defunct when, and only when:
   *   REJECTED    its event was explicitly invalidated
   *   SUPERSEDED  the scope it wrote no longer holds the bytes it wrote - overwritten, reverted, or
   *               replaced by a rival. Scope-local, so an unrelated file moving never fires it.
   */
  const receiptDefunct = (digest) => {
    const r = receipts().get(digest);
    if (!r) return { defunct: true, why: `no promotion receipt ${String(digest).slice(0, 12)} exists in the record`, reason: 'ABSENT' };
    if (isInvalidated(r.id)) return { defunct: true, why: `receipt ${r.id} was invalidated`, reason: 'REJECTED', receipt: r };
    const now = revisionOfScope(r.scope);
    if (now !== r.observedRevision) {
      return { defunct: true, reason: 'SUPERSEDED', receipt: r,
        why: `receipt ${r.id} wrote ${r.scope.path} at ${String(r.observedRevision).slice(0, 12)}`
          + ` and it now holds ${String(now).slice(0, 12)}` };
    }
    return { defunct: false, receipt: r };
  };

  /**
   * THE ONE OPERATION. The TRANSITIVE closure of what a candidate assumed, and which of it is defunct.
   * No re-generation, no reissue, no scheduler - ancestry made visible and invalidation correct.
   */
  const ancestryStatusOf = (assumedReceipts = []) => {
    const all = receipts();
    const seen = new Set();
    const chain = [];
    const defunct = [];
    const walk = (digests, depth) => {
      for (const d of digests) {
        if (seen.has(d)) continue;                     // a diamond is walked once, not twice
        seen.add(d);
        chain.push({ digest: d, depth });
        const verdict = receiptDefunct(d);
        if (verdict.defunct) defunct.push({ digest: d, depth, reason: verdict.reason, why: verdict.why });
        const r = all.get(d);
        // TRANSITIVE: a receipt carries what IT assumed, so C -> B -> A is reachable from C alone.
        if (r && r.assumedReceipts && r.assumedReceipts.length) walk(r.assumedReceipts, depth + 1);
      }
    };
    walk(assumedReceipts, 1);
    return { chain, defunct, stale: defunct.length > 0 };
  };

  /**
   * ALTERNATIVES ARE NOT DESCENDANTS. Two rivals for one scope are an ALTERNATIVE SET: same scope,
   * neither inside the other's assumed closure. Without this the record cannot distinguish a lost race
   * from an invalidated descendant - both just show the second packet refused.
   */
  const relationBetween = (idA, idB) => {
    const a = packets.get(idA);
    const b = packets.get(idB);
    if (!a || !b) return { relation: 'UNKNOWN', why: 'one or both packets are not prepared' };
    const aAssumes = new Set(ancestryStatusOf(a.assumedReceipts).chain.map((c) => c.digest));
    const bAssumes = new Set(ancestryStatusOf(b.assumedReceipts).chain.map((c) => c.digest));
    const bReceipt = b.promotedAs && aAssumes.has(b.promotedAs);
    const aReceipt = a.promotedAs && bAssumes.has(a.promotedAs);
    if (bReceipt && !aReceipt) return { relation: 'DESCENDANT', of: idB, why: `${idA} assumes a receipt promoted by ${idB}` };
    if (aReceipt && !bReceipt) return { relation: 'ANCESTOR', of: idB, why: `${idB} assumes a receipt promoted by ${idA}` };
    if (sameScope(a.scope, b.scope)) {
      return { relation: 'ALTERNATIVE', scope: a.scope,
        why: `both target ${a.scope.path} and neither assumes the other: rival candidates, not a chain.`
          + ' At most one may promote, and the loser lost a RACE - it was not invalidated.' };
    }
    return { relation: 'INDEPENDENT', why: 'different scopes and neither assumes the other' };
  };

  /** The alternative sets over a scope: rival candidates grouped, so a reader sees a choice not a chain. */
  const alternativeSetFor = (scope) => [...packets.entries()]
    .filter(([, p]) => sameScope(p.scope, scope))
    .map(([id]) => id)
    .filter((id, _i, ids) => ids.every((other) => other === id
      || relationBetween(id, other).relation === 'ALTERNATIVE'));

  /** Which prepared packets a defunct receipt has made STALE_ANCESTRY - transitive descendants only. */
  const staleDescendantsOf = (digest) => [...packets.entries()]
    .filter(([, p]) => ancestryStatusOf(p.assumedReceipts).chain.some((c) => c.digest === digest))
    .map(([id, p]) => ({ packetId: id, scope: p.scope,
      defunct: ancestryStatusOf(p.assumedReceipts).defunct }));

  /**
   * PREPARE. Records a proposal to act, and grants nothing whatsoever. The packet declares its resolved
   * target, the revision it was built against, the exact evidence it depends on, the authority it will
   * present, the contract, the effect, how it will be validated and how it would be rolled back.
   */
  function prepare({ scope, baseRevision, baseTreeRevision = null, assumedReceipts = [], dependsOn = [], evidence = [], authority, contract = EDIT_FIXTURE, contents, validation, rollback, expiresAt = null, by }) {
    const ev = append(EVENT.ACTION_PREPARED, {
      scope, baseRevision, dependsOn, contract: contract.operation, requires: contract.requires,
      // ANCESTRY-1. THREE DIFFERENT RELATIONS, and each was previously either conflated or absent:
      //   baseRevision      this scope's bytes           -> CONFLICT      (scope-local, unchanged)
      //   baseTreeRevision  the WORLD it began from      -> ancestry, declared
      //   assumedReceipts   the predecessors it was verified WITH -> ancestry, the one that matters
      // A candidate that assumed nothing is not a descendant of anything, and an unrelated file
      // moving must never stale it. That is AN-1, and it is why ancestry is receipt-based rather
      // than tree-equality-based.
      baseTreeRevision, assumedReceipts,
      // TWO DIFFERENT THINGS ARE BOTH CALLED EVIDENCE HERE, and conflating them is what broke this.
      // `dependsOn` holds EVENT IDS from this log, used below to refuse a packet resting on a withdrawn
      // finding. `evidence` holds ADMITTED EPISTEMIC TOKENS, which the EXECUTOR checks against the
      // contract's own obligations. This layer had the first and not the second: `p.evidenceTokens` was
      // read at the effect boundary and assigned nowhere, so any contract declaring an evidence
      // obligation could NEVER be satisfied through this layer. Its test asserted the refusal and would
      // have passed identically against an executor that always refused - an assertion that could not
      // fail. The executor's own E3 suite was never affected; it has a real positive control. This
      // layer did not, which is why 7c now exists.
      evidence: evidence.map((e) => ({ kind: e && e.kind, about: e && e.context && e.context.implementation })),
      effectHash: hash(contents), validation: validation || null,
      rollback: rollback || { kind: 'restore-bytes', note: 'the bytes present at baseRevision' },
      expiresAt, by,
      // Stated in the record itself, so nobody reading it can mistake preparation for permission.
      note: 'a prepared action is a PROPOSAL. It is not permission and cannot become an effect by itself.',
    });
    packets.set(ev.id, { ev, authority, contract, contents, scope, baseRevision, baseTreeRevision,
      assumedReceipts, dependsOn, evidence, validation: validation || null, expiresAt, promotedAs: null });
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

    // QUARANTINE. Enforced at the effect boundary rather than at prepare(), because proposing
    // against a damaged scope is harmless - only causing a further effect on it is not.
    const damaged = quarantineOn(p.scope);
    if (damaged) {
      const ev = append(EVENT.ACTION_REFUSED, {
        packetId, scope: p.scope, reason: PACKET.SCOPE_UNVERIFIED, damagedBy: damaged.id,
        damagedRevision: damaged.revisionOnDisk, retryable: false,
        why: `an earlier effect on ${p.scope.path} landed unverified and those bytes are still on disk;`
          + ' they may not be used as a base revision for further work. Restore or reconcile the file'
          + ' and this lifts on its own - retrying the same packet will not.',
      });
      return { committed: false, reason: PACKET.SCOPE_UNVERIFIED, retryable: false, event: ev, effected: false };
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

    // ── ANCESTRY-1. A VERIFICATION RESULT IS CONDITIONAL ON ITS SPECULATIVE ANCESTRY, so a candidate
    // verified in a world containing A may not promote once A is defunct. Checked HERE and not at the
    // effect boundary because the executor cannot see it: E1 binds the target's own bytes, and a
    // defunct predecessor may have touched a DIFFERENT file entirely - a world the executor has no
    // field for. STALE, never DENIED: the same work proceeds once re-verified against a new ancestry.
    const ancestry = ancestryStatusOf(p.assumedReceipts);
    if (ancestry.stale) {
      const ev = append(EVENT.ACTION_REFUSED, {
        packetId, scope: p.scope, reason: PACKET.STALE_ANCESTRY, retryable: true,
        assumedReceipts: p.assumedReceipts, defunct: ancestry.defunct,
        ancestryChain: ancestry.chain,
        why: `this candidate was verified in a world containing ${ancestry.defunct.length} predecessor(s)`
          + ` that no longer hold: ${ancestry.defunct.map((d) => d.why).join('; ')}.`
          + ' Its verification does not transfer to the current world. Re-verify against a new ancestry'
          + ' receipt and reissue: this is STALE ancestry, not a denial of authority.',
      });
      return { committed: false, reason: PACKET.STALE_ANCESTRY, retryable: true, event: ev, effected: false };
    }

    // ── FRESHNESS, AND ONLY WHERE THE EXECUTOR CANNOT DECIDE IT. The comment below is deliberate:
    // this layer does not pre-empt a conflict the effect boundary can settle, because that would make
    // the conflict outcome a property of this file. But E1 is CONDITIONAL - it fires only when the
    // AUTHORITY pins a revision, and the grant-minting call never requires one. A caller minting its
    // own unpinned grant therefore wrote over moved bytes and was ACTION_PERMITTED, which made the
    // packet's own baseRevision decorative. So: when the authority pins nothing, the packet's declared
    // base revision is enforced HERE, and nowhere else does behaviour change.
    const authorityPinsRevision = !!(p.authority && p.authority.context && p.authority.context.revision);
    if (!authorityPinsRevision && p.baseRevision) {
      const now = revisionOfScope(p.scope);
      if (now !== p.baseRevision) {
        const ev = append(EVENT.ACTION_REFUSED, {
          packetId, scope: p.scope, reason: PACKET.STALE_DEPENDENCY, retryable: true,
          baseRevision: p.baseRevision, currentRevision: now,
          why: `the packet was prepared against ${String(p.baseRevision).slice(0, 12)} and ${p.scope.path}`
            + ` is now at ${String(now).slice(0, 12)}. The authority pins no revision, so nothing below`
            + ' would have caught this. Re-observe and reissue: this is STALE, not denied.',
        });
        return { committed: false, reason: PACKET.STALE_DEPENDENCY, retryable: true, event: ev, effected: false };
      }
    }

    // ── THE EFFECT BOUNDARY. One call, the existing executor, unchanged. The authority is the one the
    // packet was prepared with; nothing here rebuilds, re-scopes or refreshes it.
    const r = governedEdit({
      authority: p.authority,
      action: editAction({ target: p.scope.path, contents: p.contents, evidence: p.evidence || [] }),
      root,
      contract: p.contract,
      ...(deps ? { deps } : {}),
    });

    if (!r.permitted) {
      const ev = append(EVENT.ACTION_REFUSED, {
        packetId, scope: p.scope, reason: r.outcome, why: r.why,
        refusedBy: 'governedEdit', disposition: r.disposition, retryable: r.retryable,
        pinnedRevision: r.pinnedRevision, currentRevision: r.currentRevision,
      });
      return { committed: false, reason: r.outcome, why: r.why, disposition: r.disposition,
        retryable: r.retryable, event: ev, effected: false, effect: r };
    }

    // ── THE EFFECT LANDED. Did it land as intended? `governedEdit` now reads the file back, so this
    // layer can tell a VERIFIED effect from a transformed one instead of assuming the write was
    // faithful. A mismatch is not unauthorised and cannot be undone by refusing it - the bytes are
    // already there. What it must never do is COUNT: it may not be published as progress and may not
    // become the base revision for later work, so the scope is quarantined.
    if (r.effectVerified === false) {
      const ev = append(EVENT.ACTION_EFFECTED_UNVERIFIED, {
        packetId, scope: p.scope, baseRevision: p.baseRevision, resolvedTarget: r.resolvedTarget,
        intendedRevision: r.intendedRevision, revisionAfter: r.revisionAfter,
        revisionOnDisk: revisionOfScope(p.scope), why: r.effectMismatch,
        note: 'the write was authorised and it occurred; the bytes on disk are not the bytes intended,'
          + ' so this is not verified progress and this scope is quarantined until reconciled or restored',
      });
      return { committed: false, reason: PACKET.EFFECT_UNVERIFIED, why: r.effectMismatch, event: ev, effected: true, effect: r };
    }

    // ── VERIFIER-1. THE DECLARED CHECK NOW RUNS, and against the bytes on disk. It is handed
    // (root, scope, validation) and nothing from the packet - not `p.contents` - because a check fed
    // the proposal would be grading the declaration against itself, which is the same shape as the
    // receipt that reported the length of its own input.
    const observedRevision = revisionOfScope(p.scope);
    const v = runValidation({ root, scope: p.scope, validation: p.validation });
    if (v) {
      append(EVENT.VERIFICATION, {
        packetId, scope: p.scope, verdict: v.verdict, kind: v.kind, detail: v.detail,
        observedRevision: v.observedRevision, revisionOnDisk: observedRevision,
        verifierReceiptDigest: v.verifierReceiptDigest,
        // `effected` records that a write preceded this verdict, which is what makes a FAIL
        // quarantine-worthy: bytes are on disk and they do not do what was claimed.
        effected: true,
      });
      if (v.verdict === 'FAIL') {
        const ev = append(EVENT.ACTION_REFUSED, {
          packetId, scope: p.scope, reason: PACKET.VALIDATION_FAILED, retryable: false,
          verifierReceiptDigest: v.verifierReceiptDigest, detail: v.detail,
          why: `the write was authorised and the bytes landed exactly as intended, but the declared`
            + ` check does not hold of them: ${v.detail}. This is not an effect mismatch and not an`
            + ' authority refusal - it is not verified progress, so no promotion receipt exists and'
            + ' this scope may not be used as a base revision for later work.',
        });
        // NOT committed, and effected: true - the bytes are there. Pretending otherwise would be a
        // second untruth on top of the first, which is the rule ACTION_EFFECTED_UNVERIFIED follows.
        return { committed: false, reason: PACKET.VALIDATION_FAILED, retryable: false,
          event: ev, effected: true, effect: r, verification: v };
      }
    }

    // ── THE PROMOTION RECEIPT. Six fields, because a candidate cannot merely say "I passed": what it
    // began from, what it assumed, what the world became, who verified it, and what permitted it.
    const observedTreeRevision = treeRevisionOf(root);
    const receiptDigest = hash([packetId, p.scope.path, observedRevision,
      String(p.baseTreeRevision), p.assumedReceipts.join(','),
      String(v ? v.verifierReceiptDigest : 'no-validation')].join('|'));
    const ev = append(EVENT.ACTION_COMMITTED, {
      packetId, scope: p.scope, baseRevision: p.baseRevision,
      resolvedTarget: r.resolvedTarget, authorizedTarget: r.authorizedTarget,
      newRevision: observedRevision, effectHash: hash(p.contents),
      // observedRevision is this SCOPE's bytes, read from disk - the field a descendant's
      // SUPERSEDED test compares against, which is why it must be observed and not declared.
      observedRevision,
      parentTreeRevision: p.baseTreeRevision,
      assumedReceipts: p.assumedReceipts,
      observedTreeRevision,
      // null when the packet declared no validation. A receipt must never carry a verifier digest
      // that no verifier produced, so the absence is recorded as absence rather than as a pass.
      verifierReceiptDigest: v ? v.verifierReceiptDigest : null,
      verified: v ? v.verdict === 'PASS' : null,
      authorityLineageDigest: authorityLineageDigest(p.authority),
      // The digest a descendant cites. Computed BEFORE the append, so exactly ONE ACTION_COMMITTED
      // event exists per promotion - a second, sealing event would have doubled the effect count that
      // the GOVERNED-WORKSPACE-1 invariant test asserts on.
      receiptDigest,
    });
    p.promotedAs = receiptDigest;
    return { committed: true, reason: EFFECT_OUTCOME.ACTION_PERMITTED, event: ev, receiptDigest,
      effected: true, effect: r, verification: v };
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

  /**
   * RE-VERIFICATION, exported so a verdict can be taken again later. This is what makes VERIFIER-1
   * falsifiable as a DISK read rather than a cached declaration: change the bytes underneath a passing
   * scope and the verdict must flip, which a check grading the packet's contents could never do.
   */
  function verify({ scope, validation }) {
    const v = runValidation({ root, scope, validation });
    if (!v) return null;
    append(EVENT.VERIFICATION, {
      scope, verdict: v.verdict, kind: v.kind, detail: v.detail,
      observedRevision: v.observedRevision, revisionOnDisk: revisionOfScope(scope),
      verifierReceiptDigest: v.verifierReceiptDigest,
      // No write preceded THIS verdict - it is an observation of the world, not of an effect - so it
      // must not quarantine the scope. Only a failed check on bytes a commit just wrote does that.
      effected: false,
    });
    return v;
  }

  return {
    root, publish, prepare, commit, staleFor, unaffectedBy, revisionOfScope,
    // VERIFIER-1
    verify,
    // ANCESTRY-1. Queries, not a scheduler: they make ancestry visible and invalidation correct, and
    // deliberately do not regenerate, reissue or reorder anything.
    treeRevision: () => treeRevisionOf(root),
    receiptDefunct, ancestryStatusOf, staleDescendantsOf, relationBetween, alternativeSetFor,
    receipts: () => receipts(),
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
