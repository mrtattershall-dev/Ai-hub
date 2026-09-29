// CHAIN-1 — the controller routed through the receipt/ancestry layer, and ONE REAL CHAIN exercised.
//
// Frozen definition: ./ANCESTRY-1_PREREG.md (the routing claim is stated below, and it is narrow)
//
// WHAT THIS ESTABLISHES, and nothing wider:
//
//     Through the REAL agent tool dispatch, with the governed workspace installed, a write whose
//     declared ancestry contains a DEFUNCT promotion receipt is refused STALE_ANCESTRY before the
//     bytes change - and the same write with an INTACT ancestry promotes.
//
// WHAT IT DOES NOT ESTABLISH: that the live hub does this. AGENT_GOVERNED_WRITES is still off by
// default and no production path sets it or installs a workspace. There is no scheduler, no automatic
// retry, and no queue. The chain is DRIVEN here, not discovered.
//
// AND THE NO-EFFECT ASSERTIONS BELOW ARE ABOUT CONTENT, NOT ABOUT ALL EFFECTS. `write_file` runs
// mkdirSync(dirname) at agent.js:1091, ~90 lines BEFORE the gate, so a refused write can still create
// directory entries. These fixtures write into an already-existing src/, so no directory was created
// during the refusals observed here - which means this file neither establishes nor refutes directory
// containment, it never exercised it. A general "a refusal causes no effect" claim requires asserting
// directory bytes and metadata too, and is NOT made here.
import test from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHILD = join(HERE, 'chain-child.mjs');
const A_ORIGINAL = 'export const a = 1;\n';
const B_ORIGINAL = 'export const b = 1;\n';

function workspaceWithTwoFiles() {
  const root = mkdtempSync(join(tmpdir(), 'chain1-'));
  mkdirSync(join(root, 'src'), { recursive: true });
  writeFileSync(join(root, 'src', 'a.js'), A_ORIGINAL);
  writeFileSync(join(root, 'src', 'b.js'), B_ORIGINAL);
  return root;
}

/** Run the child in its OWN process - AGENT_WORKSPACE and the governance flag bind at import time. */
function runScenario(root, scenario) {
  const stdout = execFileSync(process.execPath, [CHILD, root, scenario], {
    encoding: 'utf8',
    env: { ...process.env, AGENT_WORKSPACE: root, AGENT_GOVERNED_WRITES: '1' },
  });
  const marker = stdout.lastIndexOf('__RESULT__');
  assert.notEqual(marker, -1, 'the child produced no result block:\n' + stdout.slice(-2000));
  return JSON.parse(stdout.slice(marker + '__RESULT__'.length).trim());
}

test('CHAIN-1 — A promotes; A goes defunct; B assuming A is REFUSED stale ancestry, bytes unchanged', () => {
  const root = workspaceWithTwoFiles();
  try {
    const r = runScenario(root, 'chain');
    assert.equal(r.error, undefined, r.error || '');
    const [a, b] = r.steps;

    // A promoted through the real tool, and the effect is real
    assert.equal(a.refused, false, 'A must promote: ' + a.result);
    assert.equal(a.aChanged, true, "A's bytes changed on disk");
    assert.equal(a.promotions, 1, 'and exactly one promotion receipt was produced');
    assert.ok(r.receiptA, 'the receipt a descendant would cite exists');

    // A is defunct by the scope-local test, for the stated reason
    assert.equal(r.defunct.defunct, true);
    assert.equal(r.defunct.reason, 'SUPERSEDED');

    // B is refused BEFORE the filesystem changes
    assert.equal(b.refused, true, 'B must be refused: ' + b.result);
    assert.match(b.result, /PACKET_STALE_ANCESTRY/);
    assert.match(b.result, /verified in a world containing/);
    assert.equal(b.bChanged, false, 'PREVENTION, not detection: b.js bytes never changed');
    assert.equal(readFileSync(join(root, 'src', 'b.js'), 'utf8'), B_ORIGINAL);
    assert.equal(b.promotions, 1, 'and no second receipt was issued');

    // the refusal is in the record as a coordination decision, not an authority one
    assert.ok(r.events.some((e) => e.type === 'ACTION_REFUSED' && e.reason === 'PACKET_STALE_ANCESTRY'));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('CHAIN-CONTROL — the same B, with an INTACT ancestry, PROMOTES through the same path', () => {
  const root = workspaceWithTwoFiles();
  try {
    // Without this the refusal above could be a layer that refuses every descendant, or a controller
    // that cannot write through the coordination layer at all.
    const r = runScenario(root, 'chain-control');
    assert.equal(r.error, undefined, r.error || '');
    const [a, b] = r.steps;
    assert.equal(a.refused, false, a.result);
    assert.equal(b.refused, false, 'B must promote when its ancestry holds: ' + b.result);
    assert.equal(b.bChanged, true, 'and the bytes really changed');
    assert.equal(b.promotions, 2, 'two receipts: the chain advanced');
    assert.match(readFileSync(join(root, 'src', 'b.js'), 'utf8'), /assuming A/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('CHAIN-FORGED — the model cannot erase its ancestry through tool arguments', () => {
  const root = workspaceWithTwoFiles();
  try {
    // Declaring `assumedReceipts: []` in args would make every descendant promote over a defunct
    // predecessor while the record showed a clean chain - self-issued ancestry. Nothing reads args
    // for it, so this is unrepresentable rather than merely forbidden.
    const r = runScenario(root, 'forged-ancestry');
    assert.equal(r.error, undefined, r.error || '');
    const b = r.steps[1];
    assert.equal(b.refused, true, 'the forged empty ancestry must be ignored: ' + b.result);
    assert.match(b.result, /PACKET_STALE_ANCESTRY/);
    assert.equal(b.bChanged, false);
    assert.equal(readFileSync(join(root, 'src', 'b.js'), 'utf8'), B_ORIGINAL);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('CHAIN-A4 — with no workspace installed the direct executor path is unchanged', () => {
  const root = workspaceWithTwoFiles();
  try {
    // The A-4 result must survive this wiring: the coordination layer is an ADDED gate, not a
    // replacement, and removing it must not remove authority enforcement.
    const r = runScenario(root, 'no-workspace');
    assert.equal(r.error, undefined, r.error || '');
    const [ok, wrong] = r.steps;
    assert.equal(ok.refused, false, 'an authorized write still lands: ' + ok.result);
    assert.equal(ok.aChanged, true);
    assert.equal(wrong.refused, true, 'and a write outside the grant is still refused: ' + wrong.result);
    assert.match(wrong.result, /SCOPE_MISMATCH/);
    assert.equal(wrong.bChanged, false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('CHAIN-ROOT — a workspace rooted at a different tree is refused, not silently governed', () => {
  const root = workspaceWithTwoFiles();
  try {
    // A receipt about the wrong tree is worse than no receipt: it is well-formed and false.
    const r = runScenario(root, 'root-mismatch');
    assert.equal(r.error, undefined, r.error || '');
    const [a] = r.steps;
    assert.equal(a.refused, true, a.result);
    assert.match(a.result, /A receipt about the wrong tree is worse than none/);
    assert.equal(a.aChanged, false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
