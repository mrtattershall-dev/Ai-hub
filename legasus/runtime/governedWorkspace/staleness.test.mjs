// STALE IS AN OPERATIONAL STATE, NOT A FANCY DENIAL.
//
//   node --test legasus/runtime/governedWorkspace/staleness.test.mjs
//
// Every executor outcome was lexically a DENIAL, so a caller wanting to tell "the world moved,
// re-observe and reissue" from "you may not touch this file" had to string-match an outcome name. And
// `PACKET.STALE_DEPENDENCY` was declared in the enum and NEVER EMITTED anywhere in the repository.
//
// The three states, and the difference that matters is what a retry does:
//     STALE    the permission or evidence was about bytes that no longer exist. Nothing was written.
//              Re-observe, reissue, and the SAME work can proceed.
//     DENIED   the authority does not cover this action. Retrying changes nothing; only a different
//              authority would, and that is a new decision rather than a refresh.
//     INVALID  the action is malformed for this contract. Neither helps.
//
// AND THE HOLE THIS CLOSES: E1's revision binding is CONDITIONAL - it fires only when the AUTHORITY
// pins a revision, and the grant-minting call never requires one. A caller minting its own unpinned
// grant wrote over moved bytes and was ACTION_PERMITTED, which made the packet's own `baseRevision`
// decorative. The coordination layer now enforces it exactly where the executor structurally cannot.
import test from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { delegate } from '../../legaknow/calculus.mjs';
import { createWorkspace, fileScope, EVENT, PACKET, EFFECT_OUTCOME, revisionOf, EDIT_FIXTURE } from './workspace.mjs';
import { DISPOSITION } from '../epistemic-admission/governed-edit.mjs';

const A_ORIGINAL = 'export const a = 1;\n';
const A_PROPOSED = 'export const a = 2;\n';
const MOVED = 'export const a = 77; // changed underneath\n';

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'stale-'));
  mkdirSync(join(root, 'src'), { recursive: true });
  const a = join(root, 'src', 'a.js');
  writeFileSync(a, A_ORIGINAL);
  return { root, a, ws: createWorkspace({ root }) };
}

/** A grant that pins a revision — the executor can then decide freshness itself (E1). */
const pinned = (root, target) => delegate({
  from: 'OWNER', grant: EDIT_FIXTURE.requires, to: 'controller',
  context: { repository: 'ST', implementation: target, revision: revisionOf(join(root, target)) },
});
/** A grant that pins NO revision — legal to mint, and E1 will skip. This is the hole. */
const unpinned = (target) => delegate({
  from: 'OWNER', grant: EDIT_FIXTURE.requires, to: 'controller',
  context: { repository: 'ST', implementation: target },
});

// ══ POSITIVE CONTROL ══════════════════════════════════════════════════════════════════════════════
test('STALE-CONTROL — nothing here refuses a fresh packet', () => {
  const f = setup();
  try {
    const scope = fileScope('src/a.js');
    const r = f.ws.commit(f.ws.prepare({
      scope, baseRevision: f.ws.revisionOfScope(scope),
      authority: unpinned('src/a.js'), contents: A_PROPOSED, by: 'planner',
    }).id);
    assert.equal(r.committed, true, r.why || r.reason);
    assert.equal(readFileSync(f.a, 'utf8'), A_PROPOSED);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

// ══ THE HOSTILE STALE CASE ════════════════════════════════════════════════════════════════════════
test('STALE-UNPINNED — an unpinned grant over MOVED bytes is refused as STALE, and nothing is written', () => {
  const f = setup();
  try {
    const scope = fileScope('src/a.js');
    const packet = f.ws.prepare({
      scope, baseRevision: f.ws.revisionOfScope(scope),
      authority: unpinned('src/a.js'), contents: A_PROPOSED, by: 'planner',
    });
    writeFileSync(f.a, MOVED);                       // the world moves underneath

    const r = f.ws.commit(packet.id);
    assert.equal(r.committed, false);
    assert.equal(r.reason, PACKET.STALE_DEPENDENCY,
      'this is the refusal that was declared in the enum and never emitted anywhere');
    assert.equal(r.retryable, true, 'and it is marked retryable - re-observe and reissue');
    assert.equal(r.effected, false);
    assert.equal(readFileSync(f.a, 'utf8'), MOVED, 'refusing is not repairing: the new bytes stay');
    assert.equal(r.event.type, EVENT.ACTION_REFUSED);
    assert.ok(r.event.baseRevision !== r.event.currentRevision, 'the record names both revisions');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('STALE-WOULD-HAVE-WRITTEN — before this check, that exact packet was PERMITTED', () => {
  const f = setup();
  try {
    // The same situation with the coordination check bypassed: baseRevision omitted, so the layer has
    // nothing to compare and E1 skips because the grant pins nothing. This is what every unpinned
    // caller used to get, and it is why `baseRevision` being decorative mattered.
    const scope = fileScope('src/a.js');
    const packet = f.ws.prepare({
      scope, authority: unpinned('src/a.js'), contents: A_PROPOSED, by: 'planner',
    });
    writeFileSync(f.a, MOVED);
    const r = f.ws.commit(packet.id);
    assert.equal(r.committed, true, 'unchanged behaviour when the packet declares no base revision');
    assert.equal(readFileSync(f.a, 'utf8'), A_PROPOSED, 'it wrote straight over the moved bytes');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('STALE-THEN-REISSUE — re-observing and reissuing lets the SAME work proceed', () => {
  const f = setup();
  try {
    const scope = fileScope('src/a.js');
    const first = f.ws.prepare({
      scope, baseRevision: f.ws.revisionOfScope(scope),
      authority: unpinned('src/a.js'), contents: A_PROPOSED, by: 'planner',
    });
    writeFileSync(f.a, MOVED);
    assert.equal(f.ws.commit(first.id).reason, PACKET.STALE_DEPENDENCY);

    // Re-observe. Same contents, same authority, new base revision.
    const again = f.ws.prepare({
      scope, baseRevision: f.ws.revisionOfScope(scope),
      authority: unpinned('src/a.js'), contents: A_PROPOSED, by: 'planner',
    });
    const r = f.ws.commit(again.id);
    assert.equal(r.committed, true, r.why || r.reason);
    assert.equal(readFileSync(f.a, 'utf8'), A_PROPOSED,
      'STALE really is retryable: nothing about the work was wrong, only its view of the world');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

// ══ DENIED IS NOT STALE, AND A RETRY WILL NOT HELP ════════════════════════════════════════════════
test('DENIED-SCOPE — an authority over another target is DENIED, not stale, and is not retryable', () => {
  const f = setup();
  try {
    const scope = fileScope('src/a.js');
    const r = f.ws.commit(f.ws.prepare({
      scope, baseRevision: f.ws.revisionOfScope(scope),
      authority: pinned(f.root, 'src/OTHER.js'), contents: A_PROPOSED, by: 'planner',
    }).id);
    assert.equal(r.reason, EFFECT_OUTCOME.ACTION_DENIED_SCOPE_MISMATCH);
    assert.equal(r.disposition, DISPOSITION.DENIED, 'a wrong-target grant is not a freshness problem');
    assert.equal(r.retryable, false, 'and re-observing would produce the same refusal forever');
    assert.equal(readFileSync(f.a, 'utf8'), A_ORIGINAL);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('DENIED-VS-STALE at the executor — the same layer produces both, and they differ', () => {
  const f = setup();
  try {
    const scope = fileScope('src/a.js');
    // A PINNED grant over moved bytes: the executor catches it (E1), and it is STALE.
    const packet = f.ws.prepare({
      scope, authority: pinned(f.root, 'src/a.js'), contents: A_PROPOSED, by: 'planner',
    });
    writeFileSync(f.a, MOVED);
    const stale = f.ws.commit(packet.id);
    assert.equal(stale.reason, EFFECT_OUTCOME.ACTION_DENIED_REVISION_MISMATCH,
      'the outcome NAME is unchanged - it is pre-registered and load-bearing');
    assert.equal(stale.disposition, DISPOSITION.STALE, 'but its disposition now says the world moved');
    assert.equal(stale.retryable, true);
    assert.equal(stale.event.refusedBy, 'governedEdit', 'and the record still names which boundary refused');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

// ══ THE QUARANTINE GUARDRAIL: SURVIVES RELOAD, SCOPED TO THE DAMAGED REVISION ═════════════════════
const CRLF = { readBack: (p) => Buffer.from(readFileSync(p, 'utf8').replace(/\n/g, '\r\n'), 'utf8') };

test('QUAR-RELOAD — a quarantine survives a restart, because it is DERIVED from the log', () => {
  const f = setup();
  try {
    const bad = createWorkspace({ root: f.root, deps: CRLF });
    const scope = fileScope('src/a.js');
    bad.commit(bad.prepare({
      scope, baseRevision: bad.revisionOfScope(scope),
      authority: pinned(f.root, 'src/a.js'), contents: A_PROPOSED, by: 'planner',
    }).id);

    // Restart: a brand new workspace object, given only the event log.
    const reloaded = createWorkspace({ root: f.root, priorEvents: bad.events() });
    const r = reloaded.commit(reloaded.prepare({
      scope, baseRevision: reloaded.revisionOfScope(scope),
      authority: pinned(f.root, 'src/a.js'), contents: 'export const a = 3;\n', by: 'planner',
    }).id);
    assert.equal(r.reason, PACKET.SCOPE_UNVERIFIED,
      'the restart did not erase the evidence that this scope was damaged');
    assert.equal(r.effected, false);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('QUAR-LIFTS — restoring the file clears the quarantine, with no clearing call to forget', () => {
  const f = setup();
  try {
    const bad = createWorkspace({ root: f.root, deps: CRLF });
    const scope = fileScope('src/a.js');
    bad.commit(bad.prepare({
      scope, baseRevision: bad.revisionOfScope(scope),
      authority: pinned(f.root, 'src/a.js'), contents: A_PROPOSED, by: 'planner',
    }).id);

    // Someone restores the file. The quarantine condition simply stops being true.
    writeFileSync(f.a, A_ORIGINAL);

    const ws = createWorkspace({ root: f.root, priorEvents: bad.events() });
    const r = ws.commit(ws.prepare({
      scope, baseRevision: ws.revisionOfScope(scope),
      authority: pinned(f.root, 'src/a.js'), contents: A_PROPOSED, by: 'planner',
    }).id);
    assert.equal(r.committed, true, r.why || r.reason);
    assert.notEqual(r.reason, PACKET.SCOPE_UNVERIFIED,
      'keyed by the damaged REVISION, not by the path - otherwise one bad write freezes a file forever');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
