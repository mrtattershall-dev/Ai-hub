/**
 * verifyGodotTool.test.mjs - the verify_godot tool: wired in all five places, and pointed
 * at a verifier that actually answers the question.
 *
 *   node server/verifyGodotTool.test.mjs
 *
 * WHY THIS EXISTS
 * ---------------
 * The gap this tool closes is not "Godot is unverified" - verify_project already parses
 * every .gd file. It is that PARSING IS NOT RUNNING: an unattended chain could finish a
 * Godot step on a scene that builds nothing and prints nothing, because --check-only says
 * yes to it. So the test does two separate jobs:
 *
 *   1. the wiring - agent.js's own note says adding a tool means touching five places and
 *      the parser is the silent one, so each place is asserted rather than assumed;
 *   2. the discrimination - a real headless Godot run must FAIL an inert script and PASS
 *      one that does something. A tool wired to a verifier that says yes to everything
 *      would pass job 1 and be worthless.
 *
 * Job 2 needs the Godot binary; without one those checks report SKIP rather than a false
 * pass. Nothing here touches the live workspace, queue or hub.json.
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Point the agent at a scratch workspace BEFORE importing it: WORKSPACE is resolved at
// module load, and importing agent.js against the real one is how a test starts writing
// into somebody's game.
process.env.AGENT_WORKSPACE = join(__dirname, '..', '.tmp-verify-godot-tool');
process.env.AGENT_QUEUE_FILE = join(__dirname, '..', '.tmp-verify-godot-queue.json');

const { __toolPolicyTest, __godotToolTest } = await import('./agent.js');
const { verifyGodotFiles } = await import('./godotVerify.js');

let passed = 0, skipped = 0;
const test = async (name, fn) => {
  try { await fn(); passed++; }
  catch (e) {
    if (e && e.__skip) { skipped++; console.log(`SKIP  ${name} — ${e.message}`); return; }
    console.error(`FAIL  ${name}\n      ${e.message}`);
    process.exitCode = 1;
  }
};
const skip = (why) => { const e = new Error(why); e.__skip = true; throw e; };

const godotPresent = existsSync(join(__dirname, '..', 'vendor', 'godot', 'godot_console.exe'))
  || existsSync(join(__dirname, '..', 'vendor', 'godot', 'godot.exe'))
  || existsSync(join(__dirname, '..', 'vendor', 'godot', 'godot'))
  || !!process.env.GODOT_BIN;

// ---- 1. the wiring ------------------------------------------------------------------
await test('the tool is callable by the name the model will emit', () => {
  assert.equal(__toolPolicyTest.hasTool('verify_godot'), true);
});

await test('it runs without a human, like every other proof-of-work tool', () => {
  const auto = __toolPolicyTest.autoTools();
  assert.ok(auto.has('verify_godot'), 'verify_godot must be auto-approved');
  // Pinned against its sibling: if verify_project ever needs a human, this one does too.
  assert.equal(auto.has('verify_project'), true);
});

await test('the parser recognises a bare ACTION line', () => {
  const a = __toolPolicyTest.parseAction('THOUGHT: check it runs\nACTION: verify_godot');
  assert.equal(a.tool, 'verify_godot');
  assert.equal(a.args.main, undefined);
});

await test('PATH on the action names the entry, not a file to read', () => {
  const a = __toolPolicyTest.parseAction('THOUGHT: run the main scene\nACTION: verify_godot\nPATH: main.gd');
  assert.equal(a.tool, 'verify_godot');
  assert.equal(a.args.main, 'main.gd');
});

// ---- 2. the discrimination ----------------------------------------------------------
const INERT = 'extends Node\n\nfunc _ready():\n\tpass\n';
const ALIVE = [
  'extends Node',
  '',
  'func _ready():',
  '\tvar s = Sprite2D.new()',
  '\ts.name = "Player"',
  '\tadd_child(s)',
  '\tprint("player ready")',
  '',
].join('\n');

await test('a script that parses but does nothing is REFUSED', async () => {
  if (!godotPresent) skip('no Godot binary (set GODOT_BIN or bundle vendor/godot)');
  const r = await verifyGodotFiles({ files: [{ path: 'main.gd', content: INERT }], main: 'main.gd', run: true });
  assert.equal(r.ok, false, `inert script passed: ${r.verdict}`);
  // The verdict has to say what is missing, not just "failed" - this text is the entire
  // instruction the agent gets about how to fix it.
  assert.match(String(r.verdict), /nothing|observable|printed|node/i);
});

await test('a script that builds a node and prints is ACCEPTED', async () => {
  if (!godotPresent) skip('no Godot binary (set GODOT_BIN or bundle vendor/godot)');
  const r = await verifyGodotFiles({ files: [{ path: 'main.gd', content: ALIVE }], main: 'main.gd', run: true });
  assert.equal(r.ok, true, `live script failed: ${r.verdict} :: ${JSON.stringify(r.errors || [])}`);
  assert.ok((r.prints || []).some((p) => /player ready/.test(String(p))), 'print not captured');
});

await test('a syntax error is reported with a file and a line', async () => {
  if (!godotPresent) skip('no Godot binary (set GODOT_BIN or bundle vendor/godot)');
  const r = await verifyGodotFiles({ files: [{ path: 'main.gd', content: 'extends Node\n\nfunc _ready(:\n' }], main: 'main.gd', run: true });
  assert.equal(r.ok, false);
  const e = (r.errors || [])[0];
  assert.ok(e, 'no error reported for a syntax error');
  assert.match(String(e.file || ''), /main\.gd/);
});

// ---- 3. which files get sent, and how the answer reads ------------------------------
const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
const { tmpdir } = await import('node:os');

await test('collects scripts and scenes from subdirectories, skipping the harness leftovers', () => {
  const root = mkdtempSync(join(tmpdir(), 'hub-gdcollect-'));
  try {
    mkdirSync(join(root, 'scripts'));
    mkdirSync(join(root, '.godot'));
    writeFileSync(join(root, 'project.godot'), '[application]');
    writeFileSync(join(root, 'main.tscn'), '[gd_scene]');
    writeFileSync(join(root, 'scripts', 'player.gd'), 'extends Node');
    writeFileSync(join(root, 'README.md'), 'not a godot file');
    writeFileSync(join(root, '__hub_probe.gd'), 'extends Node');       // the verifier generates this
    writeFileSync(join(root, '.godot', 'cache.gd'), 'extends Node');   // editor cache, never source

    const paths = __godotToolTest.collect(root).map((x) => x.path).sort();
    assert.deepEqual(paths, ['main.tscn', 'project.godot', 'scripts/player.gd']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

await test('an empty or non-Godot directory collects nothing, so the tool can say so', () => {
  const root = mkdtempSync(join(tmpdir(), 'hub-gdcollect-'));
  try {
    writeFileSync(join(root, 'index.html'), '<html></html>');
    assert.deepEqual(__godotToolTest.collect(root), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

await test('the verdict names the file and line of an error', () => {
  const out = __godotToolTest.format({
    ok: false, verdict: 'Parse failed', mode: 'scene', main: 'main.gd',
    stages: [{ stage: 'parse', ok: false }],
    errors: [{ message: 'Unexpected token', file: 'res://main.gd', line: 3 }],
  });
  assert.match(out, /FAIL/);
  assert.ok(out.includes('res://main.gd line 3'), out);
  assert.match(out, /Unexpected token/);
});

await test('missing assets are stated as a failure with their names', () => {
  const out = __godotToolTest.format({
    ok: false, verdict: 'Missing assets', stages: [],
    assetsMissing: [{ path: 'hero.png', from: ['main.gd'] }],
  });
  assert.match(out, /MISSING ASSETS/);
  assert.match(out, /hero.png/);
  assert.match(out, /list_assets/);   // the fix, not just the complaint
});

await test('a verifier error is passed through rather than rendered as a pass', () => {
  assert.match(__godotToolTest.format({ error: 'Godot not found. Set GODOT_BIN.' }), /^ERROR: Godot not found/);
  assert.match(__godotToolTest.format(null), /^ERROR:/);
});

console.log(`verify_godot tool: ${passed} passed${skipped ? `, ${skipped} skipped` : ''}`);
