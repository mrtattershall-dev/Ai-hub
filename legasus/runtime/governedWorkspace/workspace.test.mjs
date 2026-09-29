// GOVERNED-WORKSPACE-1 — the ten required tests, through the REAL effect path.
//
// Frozen definition: ../epistemic-admission/GOVERNED-WORKSPACE-1_PREREG.md
//
// Every negative test asserts BOTH the refusal reason AND byte-level non-effect. Every positive test
// asserts real bytes changed through `governedEdit`. No predicate is reimplemented here: refusals come
// from the executor, and the test reads which boundary produced them.
//
// THE CONFLICT TEST IS THE POINT. Two packets built on the same revision both PREPARE. The first commits
// and the target's digest changes. The second then hits E1's revision binding inside `governedEdit`.
// There is no mutex in the coordination layer, deliberately: a lock would produce the same external
// behaviour while proving nothing about authority.
import test from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { delegate } from '../../legaknow/calculus.mjs';
import {
  createWorkspace, replay, fileScope, EVENT, PACKET, EFFECT_OUTCOME, revisionOf, EDIT_FIXTURE,
} from './workspace.mjs';
import { EDIT_FIXTURE_EVIDENCED } from '../epistemic-admission/governed-edit.mjs';

const A_ORIGINAL = 'export const a = 1;\n';
const B_ORIGINAL = 'export const b = 1;\n';
const A_PROPOSED = 'export const a = 2;\n';
const A_RIVAL = 'export const a = 3; // a second proposal\n';

/** A workspace with two independent files, so scoped conflict can be shown rather than asserted. */
function setup() {
  const root = mkdtempSync(join(tmpdir(), 'gw1-'));
  mkdirSync(join(root, 'src'), { recursive: true });
  const a = join(root, 'src', 'a.js');
  const b = join(root, 'src', 'b.js');
  writeFileSync(a, A_ORIGINAL);
  writeFileSync(b, B_ORIGINAL);
  const ws = createWorkspace({ root });
  return { root, a, b, ws };
}

/** An owner-issued grant over one target at one revision. Minted by legaknow, never by this layer. */
const grantFor = (root, target, contract = EDIT_FIXTURE) => delegate({
  from: 'OWNER', grant: contract.requires, to: 'controller',
  context: { repository: 'GW1', implementation: target, revision: revisionOf(join(root, target)) },
});

// ══ 1. the positive control: a valid packet produces the exact intended bytes ═══════════════════
test('1 — valid authority, current revision: the exact intended bytes are written by governedEdit', () => {
  const f = setup();
  try {
    const scope = fileScope('src/a.js');
    const obs = f.ws.publish.observation({ scope, by: 'reader', content: { reads: 'a = 1' } });
    const packet = f.ws.prepare({
      scope, baseRevision: f.ws.revisionOfScope(scope), dependsOn: [obs.id],
      authority: grantFor(f.root, 'src/a.js'), contents: A_PROPOSED,
      validation: { kind: 'expect-bytes', bytes: A_PROPOSED }, by: 'planner',
    });
    const r = f.ws.commit(packet.id);
    assert.equal(r.committed, true, r.why || '');
    assert.equal(readFileSync(f.a, 'utf8'), A_PROPOSED, 'the exact proposed bytes');
    assert.equal(r.event.type, EVENT.ACTION_COMMITTED);
    assert.ok(r.effect.resolvedTarget.endsWith('a.js'), 'the executor reports the resolved target it wrote');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

// ══ 2. only the target changes → refusal, all files byte-identical ══════════════════════════════
test('2 — authority pinned to a.js, action targets b.js: refused, and BOTH files unchanged', () => {
  const f = setup();
  try {
    const scope = fileScope('src/b.js');
    const packet = f.ws.prepare({
      scope, baseRevision: f.ws.revisionOfScope(scope),
      authority: grantFor(f.root, 'src/a.js'),          // a grant over a DIFFERENT target
      contents: 'export const b = 99;\n', by: 'planner',
    });
    const r = f.ws.commit(packet.id);
    assert.equal(r.committed, false);
    assert.equal(r.reason, EFFECT_OUTCOME.ACTION_DENIED_SCOPE_MISMATCH);
    assert.equal(r.event.refusedBy, 'governedEdit', 'the refusal came from the effect boundary');
    assert.equal(readFileSync(f.a, 'utf8'), A_ORIGINAL);
    assert.equal(readFileSync(f.b, 'utf8'), B_ORIGINAL);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

// ══ 3. only the revision changes → refusal, the current bytes preserved ═════════════════════════
test('3 — the target moved after the grant: refused as a revision mismatch, current bytes preserved', () => {
  const f = setup();
  try {
    const scope = fileScope('src/a.js');
    const packet = f.ws.prepare({
      scope, baseRevision: f.ws.revisionOfScope(scope),
      authority: grantFor(f.root, 'src/a.js'), contents: A_PROPOSED, by: 'planner',
    });
    const moved = 'export const a = 77; // changed underneath\n';
    writeFileSync(f.a, moved);
    const r = f.ws.commit(packet.id);
    assert.equal(r.committed, false);
    assert.equal(r.reason, EFFECT_OUTCOME.ACTION_DENIED_REVISION_MISMATCH);
    assert.equal(readFileSync(f.a, 'utf8'), moved, 'refusing is not repairing: the new bytes stay');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

// ══ 4. a cited dependency is withdrawn → refusal, no write ══════════════════════════════════════
test('4 — a cited finding is invalidated: refused as needing revalidation, and nothing is written', () => {
  const f = setup();
  try {
    const scope = fileScope('src/a.js');
    const hyp = f.ws.publish.hypothesis({ scope, by: 'diagnostic', content: { guess: 'a is unused' }, confidence: 0.6 });
    const packet = f.ws.prepare({
      scope, baseRevision: f.ws.revisionOfScope(scope), dependsOn: [hyp.id],
      authority: grantFor(f.root, 'src/a.js'), contents: A_PROPOSED, by: 'planner',
    });
    f.ws.publish.invalidated({ eventId: hyp.id, why: 'a second reader found a use', by: 'reader' });
    const r = f.ws.commit(packet.id);
    assert.equal(r.committed, false);
    assert.equal(r.reason, PACKET.DEPENDENCY_INVALIDATED);
    assert.match(r.event.why, /revalidated, not applied/);
    assert.equal(readFileSync(f.a, 'utf8'), A_ORIGINAL, 'no write');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

// ══ 5. an UNRELATED file changing leaves the packet eligible ════════════════════════════════════
test('5 — b.js changes while a packet for a.js is prepared: the packet is still eligible and commits', () => {
  const f = setup();
  try {
    const scope = fileScope('src/a.js');
    const packet = f.ws.prepare({
      scope, baseRevision: f.ws.revisionOfScope(scope),
      authority: grantFor(f.root, 'src/a.js'), contents: A_PROPOSED, by: 'planner',
    });
    writeFileSync(f.b, 'export const b = 42; // unrelated churn\n');
    assert.deepEqual(f.ws.staleFor(fileScope('src/a.js')), [], 'a.js has no stale packets');
    assert.ok(f.ws.unaffectedBy(fileScope('src/b.js')).includes(packet.id), 'and the packet is named unaffected');
    const r = f.ws.commit(packet.id);
    assert.equal(r.committed, true, r.why || '');
    assert.equal(readFileSync(f.a, 'utf8'), A_PROPOSED);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

// ══ 6. two conflicting packets → exactly one effect, and E1 refuses the other ═══════════════════
test('6 — two packets on one file at one revision: exactly ONE effect, the loser refused by E1', () => {
  const f = setup();
  try {
    const scope = fileScope('src/a.js');
    const rev = f.ws.revisionOfScope(scope);
    // BOTH prepare. Parallel thought is not the thing being serialized.
    const first = f.ws.prepare({ scope, baseRevision: rev, authority: grantFor(f.root, 'src/a.js'), contents: A_PROPOSED, by: 'planner-1' });
    const second = f.ws.prepare({ scope, baseRevision: rev, authority: grantFor(f.root, 'src/a.js'), contents: A_RIVAL, by: 'planner-2' });
    assert.equal(f.ws.packetIds().length, 2, 'both were allowed to prepare');

    const r1 = f.ws.commit(first.id);
    const r2 = f.ws.commit(second.id);

    assert.equal(r1.committed, true, r1.why || '');
    assert.equal(r2.committed, false, 'exactly one effect');
    assert.equal(r2.reason, EFFECT_OUTCOME.ACTION_DENIED_REVISION_MISMATCH,
      'the loser is refused by E1 at the effect boundary, not by a lock in the coordinator');
    assert.equal(r2.event.refusedBy, 'governedEdit');
    assert.equal(readFileSync(f.a, 'utf8'), A_PROPOSED, 'the winner\'s bytes, and only those');
    assert.notEqual(readFileSync(f.a, 'utf8'), A_RIVAL);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

// ══ 7. no authority, and a bare epistemic token → no write ══════════════════════════════════════
test('7 — no authority at all: refused, and nothing is written', () => {
  const f = setup();
  try {
    const scope = fileScope('src/a.js');
    const packet = f.ws.prepare({ scope, baseRevision: f.ws.revisionOfScope(scope), authority: undefined, contents: A_PROPOSED, by: 'planner' });
    const r = f.ws.commit(packet.id);
    assert.equal(r.committed, false);
    assert.equal(r.reason, EFFECT_OUTCOME.ACTION_DENIED_SCOPE_MISMATCH, 'an absent authority pins no target');
    assert.equal(readFileSync(f.a, 'utf8'), A_ORIGINAL);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('7b — a contract requiring evidence, with none supplied: refused, and nothing is written', () => {
  const f = setup();
  try {
    const scope = fileScope('src/a.js');
    const packet = f.ws.prepare({
      scope, baseRevision: f.ws.revisionOfScope(scope),
      authority: grantFor(f.root, 'src/a.js', EDIT_FIXTURE_EVIDENCED),
      contract: EDIT_FIXTURE_EVIDENCED, contents: A_PROPOSED, by: 'planner',
    });
    const r = f.ws.commit(packet.id);
    assert.equal(r.committed, false);
    assert.equal(r.reason, EFFECT_OUTCOME.ACTION_DENIED_UNADMITTED_EVIDENCE);
    assert.equal(readFileSync(f.a, 'utf8'), A_ORIGINAL);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

// ══ 8. expiry, and the positive control that the system does not refuse everything ══════════════
test('8 — a packet past its freshness window is refused; a fresh one still commits', () => {
  const f = setup();
  try {
    let now = 1000;
    const ws = createWorkspace({ root: f.root, clock: () => now });
    const scope = fileScope('src/a.js');
    const stale = ws.prepare({ scope, baseRevision: ws.revisionOfScope(scope), authority: grantFor(f.root, 'src/a.js'), contents: A_PROPOSED, expiresAt: 1500, by: 'planner' });
    now = 2000;
    const r = ws.commit(stale.id);
    assert.equal(r.committed, false);
    assert.equal(r.reason, PACKET.EXPIRED);
    assert.equal(readFileSync(f.a, 'utf8'), A_ORIGINAL);

    // POSITIVE CONTROL, in the same file and the same clock: the layer is not simply refusing.
    const fresh = ws.prepare({ scope, baseRevision: ws.revisionOfScope(scope), authority: grantFor(f.root, 'src/a.js'), contents: A_PROPOSED, expiresAt: 9999, by: 'planner' });
    const r2 = ws.commit(fresh.id);
    assert.equal(r2.committed, true, r2.why || '');
    assert.equal(readFileSync(f.a, 'utf8'), A_PROPOSED);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

// ══ 9. replay reaches the same admissibility decisions ══════════════════════════════════════════
test('9 — replaying the event log reaches the same decisions, from the record alone', () => {
  const f = setup();
  try {
    const scope = fileScope('src/a.js');
    const rev = f.ws.revisionOfScope(scope);
    const hyp = f.ws.publish.hypothesis({ scope, by: 'diagnostic', content: { guess: 'x' }, confidence: 0.4 });
    const p1 = f.ws.prepare({ scope, baseRevision: rev, authority: grantFor(f.root, 'src/a.js'), contents: A_PROPOSED, by: 'p1' });
    const p2 = f.ws.prepare({ scope, baseRevision: rev, dependsOn: [hyp.id], authority: grantFor(f.root, 'src/a.js'), contents: A_RIVAL, by: 'p2' });
    f.ws.publish.invalidated({ eventId: hyp.id, why: 'withdrawn', by: 'reader' });
    const r1 = f.ws.commit(p1.id);
    const r2 = f.ws.commit(p2.id);

    const rp = replay(f.ws.events());
    const live = [{ packetId: p1.id, admitted: r1.committed }, { packetId: p2.id, admitted: r2.committed }];
    for (const l of live) {
      const d = rp.decisions.find((x) => x.packetId === l.packetId);
      assert.ok(d, `replay reconstructed a decision for ${l.packetId}`);
      assert.equal(d.admitted, l.admitted, `replay agrees about ${l.packetId}`);
    }
    assert.deepEqual(rp.restedOnWithdrawn, [p2.id], 'and the log alone shows which packet rested on a withdrawn finding');
    assert.ok(rp.counts[EVENT.HYPOTHESIS] === 1, 'the hypothesis is still a hypothesis in the record');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

// ══ 10. unrelated observers keep publishing while a packet is prepared ══════════════════════════
test('10 — observers publish freely while a packet waits; only the relevant revision blocks commit', () => {
  const f = setup();
  try {
    const aScope = fileScope('src/a.js');
    const bScope = fileScope('src/b.js');
    const packet = f.ws.prepare({ scope: aScope, baseRevision: f.ws.revisionOfScope(aScope), authority: grantFor(f.root, 'src/a.js'), contents: A_PROPOSED, by: 'planner' });

    // Independent producers, none of which waits for the packet or for each other.
    f.ws.publish.observation({ scope: bScope, by: 'reader-2', content: { reads: 'b = 1' } });
    f.ws.publish.hypothesis({ scope: bScope, by: 'diagnostic', content: { guess: 'b unused' }, confidence: 0.5 });
    f.ws.publish.evaluation({ scope: bScope, by: 'tester', content: { suite: 'green' } });
    f.ws.publish.observation({ scope: aScope, by: 'reader-3', content: { reads: 'a still 1' } });

    const published = f.ws.events().filter((e) => [EVENT.OBSERVATION, EVENT.HYPOTHESIS, EVENT.EVALUATION].includes(e.type));
    assert.equal(published.length, 4, 'four independent findings landed while the packet sat prepared');

    const r = f.ws.commit(packet.id);
    assert.equal(r.committed, true, 'none of that publishing blocked the commit');

    // Now the relevant revision moves, and only then is a second packet on a.js refused.
    const after = f.ws.prepare({ scope: aScope, baseRevision: 'a-revision-that-is-no-longer-current', authority: grantFor(f.root, 'src/a.js'), contents: A_RIVAL, by: 'planner' });
    writeFileSync(f.a, 'export const a = 5; // moved again\n');
    const r2 = f.ws.commit(after.id);
    assert.equal(r2.committed, false);
    assert.equal(r2.reason, EFFECT_OUTCOME.ACTION_DENIED_REVISION_MISMATCH);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

// ══ the invariant, asserted directly ════════════════════════════════════════════════════════════
test('INVARIANT — preparing a packet writes nothing; only commit can, and only through the executor', () => {
  const f = setup();
  try {
    const scope = fileScope('src/a.js');
    for (let i = 0; i < 5; i++) {
      f.ws.prepare({ scope, baseRevision: f.ws.revisionOfScope(scope), authority: grantFor(f.root, 'src/a.js'), contents: `export const a = ${i};\n`, by: `planner-${i}` });
    }
    assert.equal(f.ws.events().filter((e) => e.type === EVENT.ACTION_PREPARED).length, 5);
    assert.equal(readFileSync(f.a, 'utf8'), A_ORIGINAL, 'five prepared proposals, zero effects');
    assert.equal(f.ws.events().filter((e) => e.type === EVENT.ACTION_COMMITTED).length, 0);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
