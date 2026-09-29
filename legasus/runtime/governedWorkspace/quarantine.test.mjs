// AN UNVERIFIED EFFECT MUST NEVER COUNT AS PROGRESS.
//
//   node --test legasus/runtime/governedWorkspace/quarantine.test.mjs
//
// The executor now reads back what it wrote, so this layer can tell a VERIFIED effect from a
// transformed one. The invariant that follows, stated by tatte and implemented here:
//
//     an effect mismatch may never be retained, published, or used as the base revision for later
//     work. It is NOT unauthorized. It is unusable as verified progress.
//
// Three facts have to be preserved at once, and conflating any two of them is the failure mode:
//     permission   the authority was valid          -> the outcome is not a denial
//     effect       the bytes on disk DID change     -> refusing it does not undo it
//     verification what landed is not what was meant -> it does not count, and nothing may build on it
//
// A refusal that pretends nothing happened would be a second lie on top of the first.
import test from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { delegate } from '../../legaknow/calculus.mjs';
import { createWorkspace, fileScope, EVENT, PACKET, revisionOf, EDIT_FIXTURE } from './workspace.mjs';

const A_ORIGINAL = 'export const a = 1;\n';
const B_ORIGINAL = 'export const b = 1;\n';
const A_PROPOSED = 'export const a = 2;\n';

/** A filesystem that turns every LF into CRLF on the way out. This is the autocrlf case. */
const CRLF = { readBack: (p) => Buffer.from(readFileSync(p, 'utf8').replace(/\n/g, '\r\n'), 'utf8') };

function setup(deps) {
  const root = mkdtempSync(join(tmpdir(), 'quar-'));
  mkdirSync(join(root, 'src'), { recursive: true });
  const a = join(root, 'src', 'a.js');
  const b = join(root, 'src', 'b.js');
  writeFileSync(a, A_ORIGINAL);
  writeFileSync(b, B_ORIGINAL);
  return { root, a, b, ws: createWorkspace({ root, deps }) };
}

const grantFor = (root, target) => delegate({
  from: 'OWNER', grant: EDIT_FIXTURE.requires, to: 'controller',
  context: { repository: 'QUAR', implementation: target, revision: revisionOf(join(root, target)) },
});

const propose = (f, path, contents) => {
  const scope = fileScope(path);
  return f.ws.prepare({
    scope, baseRevision: f.ws.revisionOfScope(scope),
    authority: grantFor(f.root, path), contents, by: 'planner',
  });
};

// ══ POSITIVE CONTROL FIRST ════════════════════════════════════════════════════════════════════════
// Without this, every refusal below could be a workspace that refuses everything.
test('QUAR-CONTROL — with an honest filesystem the same packet commits normally', () => {
  const f = setup();
  try {
    const r = f.ws.commit(propose(f, 'src/a.js', A_PROPOSED).id);
    assert.equal(r.committed, true, r.why || r.reason);
    assert.equal(readFileSync(f.a, 'utf8'), A_PROPOSED);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

// ══ THE THREE FACTS, PRESERVED SEPARATELY ═════════════════════════════════════════════════════════
test('QUAR-MISMATCH — an unverified effect is not committed, not denied, and not pretended away', () => {
  const f = setup(CRLF);
  try {
    const r = f.ws.commit(propose(f, 'src/a.js', A_PROPOSED).id);

    assert.equal(r.committed, false, 'it does not count as progress');
    assert.equal(r.effected, true, 'but something DID change - refusing it does not undo the write');
    assert.equal(r.reason, PACKET.EFFECT_UNVERIFIED);
    assert.notEqual(r.reason, PACKET.SCOPE_UNVERIFIED);
    assert.equal(r.effect.permitted, true, 'and the AUTHORITY was valid: this is not a denial');
    assert.equal(r.effect.effectVerified, false);

    const ev = r.event;
    assert.equal(ev.type, EVENT.ACTION_EFFECTED_UNVERIFIED,
      'recorded under its own event type, so a reader cannot mistake it for a commit or a refusal');
    assert.ok(ev.intendedRevision && ev.revisionAfter && ev.intendedRevision !== ev.revisionAfter,
      'with both digests named');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('QUAR-NO-COMMIT-EVENT — no ACTION_COMMITTED is written for an unverified effect', () => {
  const f = setup(CRLF);
  try {
    f.ws.commit(propose(f, 'src/a.js', A_PROPOSED).id);
    assert.equal(f.ws.events().filter((e) => e.type === EVENT.ACTION_COMMITTED).length, 0,
      'nothing in the record claims this scope advanced');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

// ══ THE INVARIANT ITSELF ══════════════════════════════════════════════════════════════════════════
test('QUAR-NO-BASE — the damaged scope may not be built on afterwards', () => {
  const f = setup(CRLF);
  try {
    f.ws.commit(propose(f, 'src/a.js', A_PROPOSED).id);
    const onDisk = readFileSync(f.a, 'utf8');

    // A second, entirely well-formed proposal against the scope's CURRENT bytes.
    const second = f.ws.commit(propose(f, 'src/a.js', 'export const a = 3;\n').id);
    assert.equal(second.committed, false);
    assert.equal(second.reason, PACKET.SCOPE_UNVERIFIED, 'refused for the quarantine, not for anything else');
    assert.equal(second.effected, false, 'and this time nothing was written');
    assert.equal(readFileSync(f.a, 'utf8'), onDisk, 'the damaged file is left exactly as it was found');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('QUAR-SCOPED — the quarantine is per scope, and does not halt unrelated work', () => {
  const f = setup(CRLF);
  try {
    f.ws.commit(propose(f, 'src/a.js', A_PROPOSED).id);
    // b.js is untouched by any of this. If the quarantine were global, this would be refused - which
    // would make the mechanism a workspace-wide stop button rather than a scoped one.
    const other = f.ws.commit(propose(f, 'src/b.js', 'export const b = 2;\n').id);
    assert.equal(other.reason, PACKET.EFFECT_UNVERIFIED,
      'b.js is under the same transforming filesystem, so it is unverified for its OWN reason');
    assert.notEqual(other.reason, PACKET.SCOPE_UNVERIFIED,
      'and specifically NOT refused because a.js is quarantined');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('QUAR-SCOPED-HONEST — under an honest filesystem an unrelated scope commits while one is quarantined', () => {
  // The sharper version: quarantine one scope by hand, then show another still works.
  const f = setup();
  try {
    // a.js is fine here; use a workspace whose executor transforms only when asked.
    const bad = createWorkspace({ root: f.root, deps: CRLF });
    const scopeA = fileScope('src/a.js');
    bad.commit(bad.prepare({
      scope: scopeA, baseRevision: bad.revisionOfScope(scopeA),
      authority: grantFor(f.root, 'src/a.js'), contents: A_PROPOSED, by: 'planner',
    }).id);

    // A DIFFERENT workspace over the same root, honest executor, different file: unaffected.
    const ok = f.ws.commit(propose(f, 'src/b.js', 'export const b = 9;\n').id);
    assert.equal(ok.committed, true, ok.why || ok.reason);
    assert.equal(readFileSync(f.b, 'utf8'), 'export const b = 9;\n');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
