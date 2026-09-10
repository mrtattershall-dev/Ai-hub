/**
 * godotVerify.test.mjs - the Godot verifier, end to end, against the real engine.
 *
 *   node server/godotVerify.test.mjs
 *
 * Boots its own hub on a spare port rather than talking to yours, so running it while
 * something else is working is safe. It writes nothing outside its own temp dirs.
 *
 * `godotProject.test.mjs` covers the string handling without the binary. This covers the
 * claims that are only true if Godot really behaves the way the router assumes, and every
 * one of them is a claim the OLD verifier could not have made:
 *
 *   - a Node-shaped script runs at all (it needed a scene, and there was none)
 *   - a multi-file project runs, with one file preloading another
 *   - a stub that parses and does nothing FAILS (this is the training-eval hole:
 *     `--check-only` scored it a pass)
 *   - a res:// path that is in no file and no asset pack FAILS
 *   - the single-`code` shorthand still behaves exactly as it always did
 *
 * Slow by nature - each case spawns Godot once or twice, ~1-3s apiece.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3400 + Math.floor(Math.random() * 300);
const BASE = `http://127.0.0.1:${PORT}/api`;
const T = '\t';

let passed = 0;
const test = async (name, fn) => {
  try { await fn(); passed++; }
  catch (e) { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; }
};

const api = async (path, body) => {
  const res = await fetch(BASE + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};
const verify = (payload) => api('/godot/verify', payload).then((r) => r.body);

const child = spawn(process.execPath, [join(__dirname, 'index.js')], {
  env: { ...process.env, PORT: String(PORT), AGENT_SUPERVISOR: '0' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
child.stdout.on('data', (d) => { serverLog += d; });
child.stderr.on('data', (d) => { serverLog += d; });

async function waitForServer(deadlineMs = 20000) {
  const until = Date.now() + deadlineMs;
  while (Date.now() < until) {
    try { if ((await fetch(BASE + '/health')).ok) return true; } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`server did not start on ${PORT}\n${serverLog.slice(-800)}`);
}

try {
  await waitForServer();

  const status = (await api('/godot/status')).body;
  if (!status.found) {
    console.log('godotVerify: SKIPPED - no Godot binary (set GODOT_BIN or bundle vendor/godot/)');
    child.kill();
    process.exit(0);
  }

  await test('status advertises what this verifier can actually do', () => {
    assert.equal(status.capabilities.sceneRun, true);
    assert.equal(status.capabilities.multiFile, true);
    assert.notEqual(status.version, 'unknown');
  });

  // ---- the capability the old verifier did not have --------------------------------
  await test('a Node2D script runs in a generated scene, with no quit() of its own', async () => {
    const r = await verify({
      files: [{
        path: 'Player.gd',
        content: [
          'extends Node2D',
          '',
          'var ticks := 0',
          '',
          'func _ready() -> void:',
          T + 'var s := Sprite2D.new()',
          T + 's.name = "Art"',
          T + 'add_child(s)',
          T + 'print("player ready")',
          '',
          'func _process(_d: float) -> void:',
          T + 'ticks += 1',
          '',
        ].join('\n'),
      }],
      frames: 30,
    });
    assert.equal(r.ok, true, r.verdict);
    assert.equal(r.mode, 'scene');
    assert.ok(r.generated.length, 'the harness scene is declared as ours, not silently inserted');
    assert.ok(r.treeStats.built >= 2, `built ${r.treeStats.built} nodes: ${JSON.stringify(r.tree)}`);
    assert.ok(r.treeStats.classes.includes('Sprite2D'), 'the node the script created is visible in the tree');
    assert.ok(r.prints.includes('player ready'));
  });

  await test('a multi-file project runs, one script preloading another', async () => {
    const r = await verify({
      files: [
        { path: 'Main.tscn', content: [
          '[gd_scene load_steps=2 format=3]',
          '',
          '[ext_resource type="Script" path="res://Game.gd" id="1"]',
          '',
          '[node name="Game" type="Node2D"]',
          'script = ExtResource("1")',
          '',
        ].join('\n') },
        { path: 'Game.gd', content: [
          'extends Node2D',
          '',
          'func _ready() -> void:',
          T + 'var e = preload("res://Enemy.gd").new()',
          T + 'e.name = "Enemy"',
          T + 'add_child(e)',
          '',
        ].join('\n') },
        { path: 'Enemy.gd', content: 'extends Node2D\n\nfunc _ready() -> void:\n' + T + 'print("enemy alive")\n' },
      ],
      frames: 30,
    });
    assert.equal(r.ok, true, r.verdict);
    assert.equal(r.main, 'res://Main.tscn', 'the supplied scene is used, not a generated one');
    assert.ok(r.prints.includes('enemy alive'));
    assert.equal(r.treeStats.built, 2);
  });

  // ---- the hole this was built to close ---------------------------------------------
  await test('a stub that parses and does nothing FAILS', async () => {
    // `--check-only` scored exactly this a pass, which is why the training eval could not
    // tell working GDScript from syntactically-valid filler.
    const r = await verify({
      files: [{ path: 'Stub.gd', content: 'extends Node\n\nfunc _ready() -> void:\n' + T + 'pass\n' }],
      frames: 20,
    });
    assert.equal(r.ok, false, `a do-nothing stub must not pass: ${r.verdict}`);
    assert.ok(/nothing observable/i.test(r.verdict), r.verdict);
    const activity = r.stages.find((s) => s.stage === 'activity');
    assert.equal(activity.ok, false);
    assert.equal(r.stages.find((s) => s.stage === 'parse').ok, true, 'and it is not blamed on parsing');
  });

  await test('a res:// resource that exists nowhere FAILS the run', async () => {
    const r = await verify({
      files: [{
        path: 'Art.gd',
        content: 'extends Node2D\n\nfunc _ready() -> void:\n' + T + 'var t = load("res://art/definitely_not_real_12345.png")\n' + T + 'print("loaded ", t)\n',
      }],
      frames: 20,
    });
    assert.equal(r.ok, false, r.verdict);
    assert.ok(r.assetsMissing.some((a) => /definitely_not_real_12345/.test(a.path)), JSON.stringify(r.assetsMissing));
  });

  await test('a parse error in a HELPER file is caught and attributed to that file', async () => {
    const r = await verify({
      files: [
        { path: 'Main.gd', content: 'extends Node2D\n\nfunc _ready() -> void:\n' + T + 'print("fine")\n' },
        { path: 'Broken.gd', content: 'extends Node\n\nfunc bad() -> void\n' + T + 'pass\n' },
      ],
    });
    assert.equal(r.ok, false);
    assert.ok(/parse/i.test(r.verdict), r.verdict);
    assert.ok(r.errors.some((e) => e.file === 'res://Broken.gd'), JSON.stringify(r.errors));
    assert.ok(r.errors.some((e) => e.line > 0), 'with a line number, so the model knows where to look');
  });

  await test('a runtime error names the file and line, not the engine source', async () => {
    const r = await verify({
      files: [{ path: 'Crash.gd', content: 'extends Node2D\n\nfunc _ready() -> void:\n' + T + 'var n = null\n' + T + 'print(n.missing)\n' }],
      frames: 20,
    });
    assert.equal(r.ok, false);
    const e = r.errors.find((x) => x.file);
    assert.equal(e.file, 'res://Crash.gd');
    assert.equal(e.line, 5);
    assert.ok(!r.errors.some((x) => /\.cpp/.test(x.file || '')), 'no C++ paths ever reach the client');
  });

  // ---- everything the old callers relied on ------------------------------------------
  await test('the single-`code` shorthand still passes a good SceneTree script', async () => {
    const r = await verify({ code: 'extends SceneTree\nfunc _init():\n' + T + 'print("ok")\n' + T + 'quit()\n' });
    assert.equal(r.ok, true, r.verdict);
    assert.equal(r.mode, 'script', 'a SceneTree script is still run standalone, not wrapped in a scene');
    assert.equal(r.ranScript, true);
  });

  await test('the shorthand still reports a parse error as a parse error', async () => {
    const r = await verify({ code: 'extends SceneTree\nfunc _init():\n' + T + 'print("oops"\n' + T + 'quit()\n' });
    assert.equal(r.ok, false);
    assert.ok(/parse/i.test(r.verdict), r.verdict);
  });

  await test('the shorthand still reports a runtime error as the cause, not the hang', async () => {
    const r = await verify({ code: 'extends SceneTree\nfunc _init():\n' + T + 'var a = null\n' + T + 'a.nope()\n' + T + 'quit()\n' });
    assert.equal(r.ok, false);
    assert.ok(/errored while running/i.test(r.verdict), r.verdict);
  });

  await test('run:false parses without executing', async () => {
    const r = await verify({
      files: [{ path: 'Player.gd', content: 'extends Node2D\n\nfunc _ready() -> void:\n' + T + 'print("would run")\n' }],
      run: false,
    });
    assert.equal(r.ok, true, r.verdict);
    assert.equal(r.ranScript, false);
    assert.ok(!r.prints.includes('would run'), 'nothing executed, so nothing printed');
  });

  await test('an entry point chosen by hand overrides the guess', async () => {
    const files = [
      { path: 'Main.tscn', content: '[gd_scene format=3]\n\n[node name="Main" type="Node2D"]\n' },
      { path: 'tool.gd', content: 'extends SceneTree\nfunc _init():\n' + T + 'print("tool ran")\n' + T + 'quit()\n' },
    ];
    const auto = await verify({ files, frames: 20 });
    assert.equal(auto.mode, 'script', 'a SceneTree script wins by default');
    const forced = await verify({ files, main: 'Main.tscn', frames: 20 });
    assert.equal(forced.mode, 'scene');
    assert.equal(forced.main, 'res://Main.tscn');
  });

  await test('a path that tries to escape the project is refused, not sanitised', async () => {
    const r = await api('/godot/verify', { files: [{ path: '../../escape.gd', content: 'extends Node\n' }] });
    assert.equal(r.status, 400);
    assert.ok(/unusable file path/.test(r.body.error), r.body.error);
  });

  await test('an empty request is a 400, not a crash', async () => {
    assert.equal((await api('/godot/verify', {})).status, 400);
  });
} finally {
  child.kill();
}

console.log(`godotVerify: ${passed} passed${process.exitCode ? ', SOME FAILED' : ''}`);
