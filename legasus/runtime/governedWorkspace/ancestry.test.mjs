// ANCESTRY-1 — speculative state. A verification result is CONDITIONAL ON ITS ANCESTRY.
//
// Frozen definition: ./ANCESTRY-1_PREREG.md
//
// THE DIVIDING LINE THIS FILE EXISTS TO HOLD:
//     conflict   do these packets touch the same scope?                        -> baseRevision
//     ancestry   was this candidate verified in a world containing these?      -> assumedReceipts
//
// `baseRevision` could only ever answer the first. A packet had no field able to name a state of files
// it does not touch, so "C verified on base + A + B" was INEXPRESSIBLE rather than unimplemented.
//
// WHY STALENESS IS NOT TREE-EQUALITY, which is the obvious design and is wrong: every commit moves the
// tree, so a tree-digest comparison would stale every candidate on every unrelated change - destroying
// the parallelism the whole layer exists for, and contradicting AN-1 directly. A receipt is defunct only
// when it was REJECTED or SUPERSEDED, both of which are scope-local.
import test from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { delegate } from '../../legaknow/calculus.mjs';
import {
  createWorkspace, fileScope, EVENT, PACKET, revisionOf, EDIT_FIXTURE, treeRevisionOf,
} from './workspace.mjs';

const ORIGINAL = (n) => `export const ${n} = 1;\n`;
const CHANGED = (n) => `export const ${n} = 2;\n`;

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'an1-'));
  mkdirSync(join(root, 'src'), { recursive: true });
  for (const n of ['a', 'b', 'c', 'd', 'e']) writeFileSync(join(root, 'src', `${n}.js`), ORIGINAL(n));
  return { root, ws: createWorkspace({ root }), file: (n) => join(root, 'src', `${n}.js`) };
}
const scopeOf = (n) => fileScope(`src/${n}.js`);
const grantFor = (f, n) => delegate({
  from: 'OWNER', grant: EDIT_FIXTURE.requires, to: 'controller',
  context: { repository: 'AN1', implementation: `src/${n}.js`, revision: revisionOf(f.file(n)) },
});
/** Prepare a candidate: its own scope for CONFLICT, its assumed receipts for ANCESTRY. */
const candidate = (f, n, assumedReceipts = [], contents = CHANGED(n)) => f.ws.prepare({
  scope: scopeOf(n), baseRevision: f.ws.revisionOfScope(scopeOf(n)),
  baseTreeRevision: f.ws.treeRevision(), assumedReceipts,
  authority: grantFor(f, n), contents, by: 'agent',
});
/** Commit and hand back the receipt digest a descendant will cite. */
function promote(f, n, assumedReceipts = [], contents = CHANGED(n)) {
  const r = f.ws.commit(candidate(f, n, assumedReceipts, contents).id);
  assert.equal(r.committed, true, `promoting ${n} should succeed: ${r.why || ''}`);
  assert.ok(r.receiptDigest, 'a promotion must yield a receipt digest');
  return r;
}

// ══ AN-1 ═════════════════════════════════════════════════════════════════════════════════════════
test('AN-1 — an unrelated change does NOT stale a candidate that neither read nor assumed it', () => {
  const f = setup();
  try {
    const pending = candidate(f, 'a', []);            // assumes nothing
    const treeBefore = f.ws.treeRevision();

    promote(f, 'b');                                  // an unrelated world change
    assert.notEqual(f.ws.treeRevision(), treeBefore,
      'the TREE genuinely moved - so a tree-equality rule would have staled the a.js candidate here');

    assert.equal(f.ws.ancestryStatusOf(f.ws.events()
      .find((e) => e.id === pending.id).assumedReceipts).stale, false);
    const r = f.ws.commit(pending.id);
    assert.equal(r.committed, true, r.why || '');
    assert.equal(readFileSync(f.file('a'), 'utf8'), CHANGED('a'));
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

// ══ AN-2 ═════════════════════════════════════════════════════════════════════════════════════════
test('AN-2 — a candidate verified WITH predecessor A becomes STALE_ANCESTRY when A is superseded', () => {
  const f = setup();
  try {
    const A = promote(f, 'a');
    const descendant = candidate(f, 'b', [A.receiptDigest]);

    // A's effect is undone underneath it: the receipt no longer describes the world
    writeFileSync(f.file('a'), 'export const a = 999; // reverted by someone else\n');
    const verdict = f.ws.receiptDefunct(A.receiptDigest);
    assert.equal(verdict.defunct, true);
    assert.equal(verdict.reason, 'SUPERSEDED');

    const bBefore = readFileSync(f.file('b'), 'utf8');
    const r = f.ws.commit(descendant.id);
    assert.equal(r.committed, false);
    assert.equal(r.reason, PACKET.STALE_ANCESTRY);
    assert.equal(r.retryable, true, 'STALE, never DENIED: the same work may proceed once re-verified');
    assert.equal(r.effected, false);
    assert.equal(readFileSync(f.file('b'), 'utf8'), bBefore, 'and nothing was written');
    assert.match(r.event.why, /verified in a world containing/);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('AN-2b — REJECTED is a distinct ground from SUPERSEDED, and both stale a descendant', () => {
  const f = setup();
  try {
    const A = promote(f, 'a');
    const descendant = candidate(f, 'b', [A.receiptDigest]);
    // a.js is untouched; the FINDING is withdrawn instead
    f.ws.publish.invalidated({ eventId: A.event.id, why: 'the predecessor was rejected on review', by: 'reviewer' });

    const verdict = f.ws.receiptDefunct(A.receiptDigest);
    assert.equal(verdict.defunct, true);
    assert.equal(verdict.reason, 'REJECTED', 'not SUPERSEDED: the bytes still match, the receipt does not');
    assert.equal(f.ws.commit(descendant.id).reason, PACKET.STALE_ANCESTRY);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

// ══ AN-CONTROL ═══════════════════════════════════════════════════════════════════════════════════
test('AN-CONTROL — a descendant whose ancestry is INTACT does promote', () => {
  const f = setup();
  try {
    // Without this, AN-2 and AN-4 would pass identically against a layer that stales everything.
    const A = promote(f, 'a');
    assert.equal(f.ws.receiptDefunct(A.receiptDigest).defunct, false);
    const r = f.ws.commit(candidate(f, 'b', [A.receiptDigest]).id);
    assert.equal(r.committed, true, r.why || '');
    assert.equal(readFileSync(f.file('b'), 'utf8'), CHANGED('b'));
    assert.deepEqual(r.event.assumedReceipts, [A.receiptDigest],
      'and the receipt records what it assumed, so its own descendants can be traced');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

// ══ AN-3 ═════════════════════════════════════════════════════════════════════════════════════════
test('AN-3 — two rivals for one scope are an ALTERNATIVE SET, not falsely modelled as parent/child', () => {
  const f = setup();
  try {
    const rival1 = candidate(f, 'a', [], 'export const a = 10; // proposal one\n');
    const rival2 = candidate(f, 'a', [], 'export const a = 20; // proposal two\n');

    const rel = f.ws.relationBetween(rival1.id, rival2.id);
    assert.equal(rel.relation, 'ALTERNATIVE');
    assert.match(rel.why, /neither assumes the other/);
    const set = f.ws.alternativeSetFor(scopeOf('a'));
    assert.ok(set.includes(rival1.id) && set.includes(rival2.id), 'both are named in the set');

    // AND THE CONTRAST THAT MAKES IT A REAL DISCRIMINATION: a genuine descendant is NOT called an
    // alternative. Without this the function could return ALTERNATIVE for everything and still pass.
    const A = promote(f, 'c');
    const child = candidate(f, 'd', [A.receiptDigest]);
    assert.equal(f.ws.relationBetween(child.id, f.ws.packetIds()
      .find((id) => id !== child.id && f.ws.relationBetween(child.id, id).relation === 'DESCENDANT')).relation,
    'DESCENDANT', 'a chain is reported as a chain');
    assert.equal(f.ws.relationBetween(rival1.id, child.id).relation, 'INDEPENDENT',
      'and different scopes with no assumption between them are independent, not rivals');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('AN-3b — the loser of a RACE is refused by the effect boundary, not marked stale ancestry', () => {
  const f = setup();
  try {
    // Two rivals, one revision. The record must distinguish this from an invalidated descendant.
    const rival1 = candidate(f, 'a', [], 'export const a = 10;\n');
    const rival2 = candidate(f, 'a', [], 'export const a = 20;\n');
    const won = f.ws.commit(rival1.id);
    const lost = f.ws.commit(rival2.id);

    assert.equal(won.committed, true);
    assert.equal(lost.committed, false);
    assert.equal(lost.event.refusedBy, 'governedEdit',
      'a lost race is settled at the EFFECT boundary by revision binding');
    assert.notEqual(lost.reason, PACKET.STALE_ANCESTRY,
      'and is never reported as stale ancestry - it assumed nothing that could go defunct');
    assert.equal(readFileSync(f.file('a'), 'utf8'), 'export const a = 10;\n', 'exactly one effect');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

// ══ AN-4 ═════════════════════════════════════════════════════════════════════════════════════════
test('AN-4 — a stale descendant cannot promote until re-verified against a NEW ancestry receipt', () => {
  const f = setup();
  try {
    const A = promote(f, 'a');
    const stale = candidate(f, 'b', [A.receiptDigest]);
    writeFileSync(f.file('a'), 'export const a = 999;\n');           // A is superseded

    // it may not promote, and retrying the SAME packet does not help - the ancestry is what moved
    assert.equal(f.ws.commit(stale.id).reason, PACKET.STALE_ANCESTRY);
    assert.equal(f.ws.commit(stale.id).reason, PACKET.STALE_ANCESTRY, 'a bare retry changes nothing');
    assert.equal(readFileSync(f.file('b'), 'utf8'), ORIGINAL('b'));

    // THE PATH FORWARD IS RE-VERIFICATION AGAINST A NEW ANCESTRY, not a bypass: redo the predecessor,
    // obtain its new receipt, and reissue the descendant citing that one.
    const A2 = promote(f, 'a', [], 'export const a = 3; // redone on the current world\n');
    assert.notEqual(A2.receiptDigest, A.receiptDigest, 'a new world yields a new receipt');
    const reissued = f.ws.commit(candidate(f, 'b', [A2.receiptDigest]).id);
    assert.equal(reissued.committed, true, reissued.why || '');
    assert.equal(readFileSync(f.file('b'), 'utf8'), CHANGED('b'));
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

// ══ AN-TRANSITIVE ════════════════════════════════════════════════════════════════════════════════
test('AN-TRANSITIVE — invalidating A stales BOTH B and C; an unrelated sibling is untouched', () => {
  const f = setup();
  try {
    const A = promote(f, 'a');                            // A
    const B = promote(f, 'b', [A.receiptDigest]);          // B assumes A
    const C = candidate(f, 'c', [B.receiptDigest]);        // C assumes B, and only transitively A
    const D = candidate(f, 'd', [A.receiptDigest]);        // D assumes A directly
    const E = candidate(f, 'e', []);                       // E assumes nothing

    // C reaches A through B without naming it - that is the transitive closure being real
    const closure = f.ws.ancestryStatusOf([B.receiptDigest]).chain.map((x) => x.digest);
    assert.deepEqual(closure, [B.receiptDigest, A.receiptDigest]);

    f.ws.publish.invalidated({ eventId: A.event.id, why: 'A was rejected', by: 'reviewer' });

    const stale = f.ws.staleDescendantsOf(A.receiptDigest).map((s) => s.packetId);
    assert.ok(stale.includes(C.id), 'C is stale THROUGH B, having never named A');
    assert.ok(stale.includes(D.id), 'D is stale directly');
    assert.equal(stale.includes(E.id), false, 'E assumed nothing and must not be swept up');

    assert.equal(f.ws.commit(C.id).reason, PACKET.STALE_ANCESTRY);
    assert.equal(f.ws.commit(D.id).reason, PACKET.STALE_ANCESTRY);
    const eResult = f.ws.commit(E.id);
    assert.equal(eResult.committed, true, `E must still promote: ${eResult.why || ''}`);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

// ══ the receipt itself ═══════════════════════════════════════════════════════════════════════════
test('AN-RECEIPT — a promotion receipt carries all six fields, and the observed ones are OBSERVED', () => {
  const f = setup();
  try {
    const A = promote(f, 'a');
    const r = f.ws.commit(f.ws.prepare({
      scope: scopeOf('b'), baseRevision: f.ws.revisionOfScope(scopeOf('b')),
      baseTreeRevision: f.ws.treeRevision(), assumedReceipts: [A.receiptDigest],
      authority: grantFor(f, 'b'), contents: CHANGED('b'),
      validation: { kind: 'expect-contains', needle: 'b = 2' }, by: 'agent',
    }).id);
    assert.equal(r.committed, true, r.why || '');
    const rec = r.event;

    assert.ok(rec.parentTreeRevision, 'parentTreeRevision');
    assert.deepEqual(rec.assumedReceipts, [A.receiptDigest], 'assumedReceipts');
    assert.ok(rec.observedTreeRevision, 'observedTreeRevision');
    assert.ok(rec.verifierReceiptDigest, 'verifierReceiptDigest');
    assert.ok(rec.authorityLineageDigest, 'authorityLineageDigest');
    assert.ok(rec.receiptDigest, 'receiptDigest, which its own descendants cite');

    // OBSERVED, NOT DECLARED: both tree digests are independently recomputable from disk, and the
    // post-state is the one the tree actually reached - not the one the packet intended.
    assert.notEqual(rec.parentTreeRevision, rec.observedTreeRevision, 'the world moved');
    assert.equal(rec.observedTreeRevision, treeRevisionOf(f.root),
      'and an independent walk of the tree agrees, so it came from disk');
    assert.equal(rec.observedRevision, revisionOf(f.file('b')));
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('AN-REPLAY — ancestry survives a restart, because it is DERIVED from the log', () => {
  const f = setup();
  try {
    const A = promote(f, 'a');
    const prior = f.ws.events();
    writeFileSync(f.file('a'), 'export const a = 999;\n');       // A superseded

    // a fresh workspace over the same root, rebuilt from the record alone
    const revived = createWorkspace({ root: f.root, priorEvents: prior });
    const verdict = revived.receiptDefunct(A.receiptDigest);
    assert.equal(verdict.defunct, true, 'the reloaded workspace sees the same defunct receipt');
    assert.equal(verdict.reason, 'SUPERSEDED');

    const r = revived.commit(revived.prepare({
      scope: scopeOf('b'), baseRevision: revived.revisionOfScope(scopeOf('b')),
      assumedReceipts: [A.receiptDigest], authority: grantFor(f, 'b'),
      contents: CHANGED('b'), by: 'agent',
    }).id);
    assert.equal(r.reason, PACKET.STALE_ANCESTRY, 'and enforces it after the restart');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('AN-ABSENT — citing a receipt that does not exist is stale, not silently accepted', () => {
  const f = setup();
  try {
    const invented = 'f'.repeat(64);
    const verdict = f.ws.receiptDefunct(invented);
    assert.equal(verdict.defunct, true);
    assert.equal(verdict.reason, 'ABSENT');
    const r = f.ws.commit(candidate(f, 'a', [invented]).id);
    assert.equal(r.reason, PACKET.STALE_ANCESTRY, 'an unknown ancestor is not a satisfied one');
    assert.equal(r.effected, false);
    assert.equal(readFileSync(f.file('a'), 'utf8'), ORIGINAL('a'));
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
