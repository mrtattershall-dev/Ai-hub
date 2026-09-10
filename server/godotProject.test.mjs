/**
 * godotProject.test.mjs - the Godot project builder, without the 4GB binary.
 *
 *   node server/godotProject.test.mjs
 *
 * Everything here is string-in/string-out on purpose. The parts that decide whether a
 * verdict is trustworthy - which file an error belongs to, whether a scene actually built
 * anything, whether a `res://` path can escape the temp project - are all decidable
 * without spawning Godot, and a test that needs the engine is a test nobody runs.
 *
 * The Godot output fixtures below are VERBATIM captures from 4.6.3, not invented. The
 * whole value of the parser is that it matches what the engine really prints.
 */
import assert from 'assert';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  detectKind, normalizePath, resPath, scanResourceRefs, harnessScene, projectFile,
  planRun, materialize, parseGodotOutput, treeStats, probeScript,
  PROBE_FILE, HARNESS_SCENE, TREE_BEGIN, TREE_END,
} from './godotProject.js';

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; } catch (e) { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; } };
const T = '\t';

// ---------------------------------------------------------------- detectKind

t('SceneTree script is standalone-runnable', () => {
  assert.equal(detectKind('extends SceneTree\nfunc _init():\n' + T + 'quit()').kind, 'scenetree');
});

t('a Node script is node-shaped, and its base is kept for the harness', () => {
  const k = detectKind('extends CharacterBody2D\n\nfunc _ready():\n' + T + 'pass');
  assert.equal(k.kind, 'node');
  assert.equal(k.base, 'CharacterBody2D');
});

t('Resource and RefCounted are not runnable', () => {
  assert.equal(detectKind('extends Resource').kind, 'resource');
  assert.equal(detectKind('extends RefCounted').kind, 'resource');
  assert.equal(detectKind('extends MyThingResource').kind, 'resource');
});

t('class_name is read alongside extends', () => {
  const k = detectKind('class_name Enemy\nextends Node2D\n');
  assert.equal(k.named, 'Enemy');
  assert.equal(k.kind, 'node');
});

t('a script with neither extends nor class_name is unknown, not assumed runnable', () => {
  assert.equal(detectKind('var x = 1\n').kind, 'unknown');
});

t('extends by path still counts as a node', () => {
  // `extends "res://Base.gd"` is legal GDScript and the base is not a class name, so the
  // harness must fall back rather than emit `type="res://Base.gd"`.
  const k = detectKind('extends "res://Base.gd"\n');
  assert.equal(k.kind, 'node');
  assert.ok(harnessScene('Child.gd', k.base).includes('type="Node"'));
});

// ------------------------------------------------------------- path handling

t('res:// is stripped to a project-relative path', () => {
  assert.equal(normalizePath('res://scenes/Main.tscn'), 'scenes/Main.tscn');
  assert.equal(normalizePath('./Player.gd'), 'Player.gd');
  assert.equal(resPath('Player.gd'), 'res://Player.gd');
});

t('traversal and absolute paths are REFUSED, not sanitised', () => {
  // Sanitising "../../x" into "x" would quietly verify a different file than the one
  // asked for. Refusing is the only answer that cannot mislead.
  assert.equal(normalizePath('../../etc/passwd'), null);
  assert.equal(normalizePath('res://../escape.gd'), null);
  assert.equal(normalizePath('C:/Windows/system32/x.gd'), null);
  assert.equal(normalizePath('/abs/path.gd'), 'abs/path.gd');
  assert.equal(normalizePath(''), null);
});

// ------------------------------------------------------------ resource scan

t('preload/load in GDScript and path= in a scene are both found', () => {
  const refs = scanResourceRefs([
    { path: 'Player.gd', content: 'const T = preload("res://art/hero.png")\nvar s = load("res://sfx/hit.wav")' },
    { path: 'Main.tscn', content: '[ext_resource type="Texture2D" path="res://art/tile.png" id="1"]' },
  ]);
  const paths = refs.map((r) => r.path).sort();
  assert.deepEqual(paths, ['art/hero.png', 'art/tile.png', 'sfx/hit.wav']);
});

t('a reference records every file that asks for it', () => {
  const refs = scanResourceRefs([
    { path: 'A.gd', content: 'preload("res://art/hero.png")' },
    { path: 'B.gd', content: 'preload("res://art/hero.png")' },
  ]);
  assert.equal(refs.length, 1);
  assert.deepEqual(refs[0].from.sort(), ['A.gd', 'B.gd']);
});

// -------------------------------------------------------------- project file

t('a generated project.godot points at the main scene and installs the probe', () => {
  const p = projectFile('Main.tscn');
  assert.ok(p.includes('run/main_scene="res://Main.tscn"'));
  assert.ok(p.includes(`HubProbe="*res://${PROBE_FILE}"`));
});

t("a supplied project.godot keeps the author's own settings", () => {
  const supplied = [
    'config_version=5', '',
    '[application]', 'config/name="My Game"', 'run/main_scene="res://Old.tscn"', '',
    '[autoload]', 'GameState="*res://GameState.gd"', '',
    '[input]', 'jump={"deadzone":0.5}',
  ].join('\n');
  const p = projectFile('New.tscn', supplied);
  assert.ok(p.includes('config/name="My Game"'), 'name kept');
  assert.ok(p.includes('GameState="*res://GameState.gd"'), 'their autoload kept');
  assert.ok(p.includes('jump={"deadzone":0.5}'), 'input map kept');
  assert.ok(p.includes('run/main_scene="res://New.tscn"'), 'main scene retargeted');
  assert.ok(!p.includes('Old.tscn'), 'old main scene replaced, not duplicated');
  assert.ok(p.includes(`HubProbe="*res://${PROBE_FILE}"`), 'probe added to their autoloads');
});

t('a project.godot with no [autoload] section gets one', () => {
  const p = projectFile('Main.tscn', 'config_version=5\n\n[application]\nconfig/name="X"\n');
  assert.ok(p.includes('[autoload]'));
  assert.ok(p.includes('HubProbe='));
});

t('the probe is never installed twice', () => {
  const once = projectFile('Main.tscn');
  const twice = projectFile('Main.tscn', once);
  assert.equal(twice.match(/HubProbe=/g).length, 1);
});

// -------------------------------------------------------------------- planRun

t('a SceneTree script runs as a script, with no scene invented for it', () => {
  const plan = planRun([{ path: 'snippet.gd', content: 'extends SceneTree\nfunc _init():\n' + T + 'quit()' }]);
  assert.equal(plan.mode, 'script');
  assert.equal(plan.main, 'snippet.gd');
  assert.ok(!plan.files.some((f) => f.generated));
});

t('a Node script with no scene gets a harness scene generated for it', () => {
  const plan = planRun([{ path: 'Player.gd', content: 'extends Node2D\nfunc _ready():\n' + T + 'pass' }]);
  assert.equal(plan.mode, 'scene');
  assert.equal(plan.main, HARNESS_SCENE);
  const gen = plan.files.find((f) => f.path === HARNESS_SCENE);
  assert.ok(gen.generated);
  assert.ok(gen.content.includes('type="Node2D"'), 'the harness node type matches extends');
  assert.ok(plan.notes.length, 'and it says so, since the user never wrote that file');
});

t("a supplied scene is preferred over generating one", () => {
  const plan = planRun([
    { path: 'Player.gd', content: 'extends Node2D\n' },
    { path: 'Main.tscn', content: '[gd_scene format=3]\n' },
  ]);
  assert.equal(plan.mode, 'scene');
  assert.equal(plan.main, 'Main.tscn');
  assert.ok(!plan.files.some((f) => f.generated));
});

t('a scene called Main wins over other scenes', () => {
  const plan = planRun([
    { path: 'ui/Menu.tscn', content: '[gd_scene format=3]\n' },
    { path: 'Main.tscn', content: '[gd_scene format=3]\n' },
  ]);
  assert.equal(plan.main, 'Main.tscn');
});

t('an explicitly chosen entry overrides every guess', () => {
  const files = [
    { path: 'Main.tscn', content: '[gd_scene format=3]\n' },
    { path: 'tool.gd', content: 'extends SceneTree\nfunc _init():\n' + T + 'quit()' },
  ];
  assert.equal(planRun(files, { main: 'tool.gd' }).mode, 'script');
  assert.equal(planRun(files, { main: 'Main.tscn' }).main, 'Main.tscn');
});

t('a Resource-only file set is honestly reported as parse-only', () => {
  const plan = planRun([{ path: 'Item.gd', content: 'extends Resource\n@export var name: String' }]);
  assert.equal(plan.mode, 'parse');
  assert.ok(/parse check only/i.test(plan.notes[0]));
});

t('mode:"parse" is obeyed even when the set is runnable', () => {
  const plan = planRun([{ path: 'a.gd', content: 'extends SceneTree\nfunc _init():\n' + T + 'quit()' }], { mode: 'parse' });
  assert.equal(plan.mode, 'parse');
});

// ---------------------------------------------------------------- materialize

t('materialize writes the project, the probe and a project.godot', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gdtest-'));
  try {
    const plan = planRun([{ path: 'Player.gd', content: 'extends Node2D\n' }]);
    const out = materialize(dir, plan);
    assert.ok(existsSync(join(dir, 'Player.gd')));
    assert.ok(existsSync(join(dir, PROBE_FILE)));
    assert.ok(existsSync(join(dir, 'project.godot')));
    assert.ok(existsSync(join(dir, HARNESS_SCENE)));
    assert.ok(out.written.includes('project.godot'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

t('nested paths are created, not flattened', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gdtest-'));
  try {
    materialize(dir, planRun([{ path: 'scripts/enemies/Orc.gd', content: 'extends Node2D\n' }]));
    assert.ok(existsSync(join(dir, 'scripts', 'enemies', 'Orc.gd')));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

t('a referenced asset that IS in the library is copied in; one that is not is reported', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gdtest-'));
  const fakeLib = mkdtempSync(join(tmpdir(), 'gdlib-'));
  try {
    const realFile = join(fakeLib, 'hero.png');
    writeFileSync(realFile, 'PNGDATA', 'utf8');
    const assets = {
      resolve: (p) => (p.endsWith('hero.png') ? { full: realFile, path: 'assets/hero.png' } : null),
    };
    const plan = planRun([{
      path: 'Player.gd',
      content: 'extends Node2D\nconst A = preload("res://art/hero.png")\nconst B = preload("res://art/nope.png")\n',
    }]);
    const out = materialize(dir, plan, { assets });
    assert.equal(readFileSync(join(dir, 'art', 'hero.png'), 'utf8'), 'PNGDATA', 'real asset copied to where the code looks for it');
    assert.deepEqual(out.assetsUsed, ['assets/hero.png']);
    assert.equal(out.assetsMissing.length, 1);
    assert.equal(out.assetsMissing[0].path, 'res://art/nope.png');
    assert.deepEqual(out.assetsMissing[0].from, ['Player.gd']);
    assert.ok(!existsSync(join(dir, 'art', 'nope.png')), 'a missing asset is NOT conjured into existence');
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(fakeLib, { recursive: true, force: true });
  }
});

t("a file the project supplies itself is not looked up in the asset library", () => {
  const dir = mkdtempSync(join(tmpdir(), 'gdtest-'));
  try {
    let asked = 0;
    const assets = { resolve: () => { asked++; return null; } };
    const plan = planRun([
      { path: 'Main.gd', content: 'extends Node2D\nconst S = preload("res://Bullet.gd")\n' },
      { path: 'Bullet.gd', content: 'extends Node2D\n' },
    ]);
    const out = materialize(dir, plan, { assets });
    assert.equal(asked, 0, 'the library was never consulted for a file already in the set');
    assert.equal(out.assetsMissing.length, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// --------------------------------------------------------------- output parse

t('a parse error is attributed to the file and line', () => {
  // Verbatim 4.6.3 output.
  const out = parseGodotOutput([
    'Godot Engine v4.6.3.stable.official.7d41c59c4 - https://godotengine.org',
    '',
    'SCRIPT ERROR: Parse Error: Unexpected "Indent" in class body.',
    '   at: GDScript::reload (res://Player.gd:4)',
    'ERROR: Failed to load script "res://Player.gd" with error "Parse error".',
    '   at: load (modules/gdscript/gdscript.cpp:2907)',
  ].join('\n'));
  assert.equal(out.errors.length, 2);
  assert.equal(out.errors[0].kind, 'parse');
  assert.equal(out.errors[0].file, 'res://Player.gd');
  assert.equal(out.errors[0].line, 4);
});

t('a C++ `at:` location is never reported as the user\'s file', () => {
  // "modules/gdscript/gdscript.cpp:2907" is Godot's own source. Handing that to a model
  // as the place to fix is worse than handing it nothing.
  const out = parseGodotOutput([
    'ERROR: Failed to load script "res://Player.gd" with error "Parse error".',
    '   at: load (modules/gdscript/gdscript.cpp:2907)',
  ].join('\n'));
  assert.equal(out.errors[0].file, null);
  assert.equal(out.errors[0].line, null);
});

t('a runtime error takes its address from the GDScript backtrace', () => {
  const out = parseGodotOutput([
    "SCRIPT ERROR: Invalid access to property or key 'foo' on a base object of type 'Nil'.",
    '   at: _ready (res://Player.gd:7)',
    '   GDScript backtrace (most recent call first):',
    '       [0] _ready (res://Player.gd:7)',
  ].join('\n'));
  assert.equal(out.errors.length, 1);
  assert.equal(out.errors[0].kind, 'runtime');
  assert.equal(out.errors[0].file, 'res://Player.gd');
  assert.equal(out.errors[0].line, 7);
});

t('a missing resource error is captured with the script that asked for it', () => {
  const out = parseGodotOutput([
    'ERROR: Resource file not found: res://art/missing.png (expected type: unknown)',
    '   at: _load (core/io/resource_loader.cpp:351)',
    '   GDScript backtrace (most recent call first):',
    '       [0] _ready (res://Player.gd:4)',
    'tex=<Object#null>',
  ].join('\n'));
  assert.equal(out.errors.length, 1);
  assert.equal(out.errors[0].file, 'res://Player.gd');
  assert.equal(out.errors[0].line, 4);
  assert.deepEqual(out.prints, ['tex=<Object#null>']);
});

t('warnings are kept apart from errors', () => {
  const out = parseGodotOutput('WARNING: something is deprecated\n   at: x (res://A.gd:2)\nERROR: real problem');
  assert.equal(out.warnings.length, 1);
  assert.equal(out.errors.length, 1);
});

t("the engine banner is not mistaken for the program's output", () => {
  const out = parseGodotOutput('Godot Engine v4.6.3.stable.official - https://godotengine.org\n\nhello\n');
  assert.deepEqual(out.prints, ['hello']);
});

t('the tree dump is lifted out of the output, not left in the prints', () => {
  const out = parseGodotOutput([
    'player ready',
    TREE_BEGIN,
    'root (Window)',
    '  HubProbe (Node)',
    '  Main (Node2D)',
    '    Art (Sprite2D)',
    TREE_END,
  ].join('\n'));
  assert.deepEqual(out.prints, ['player ready']);
  assert.equal(out.tree.length, 4);
});

// ----------------------------------------------------------------- treeStats

t('the scaffolding does not count as something the project built', () => {
  // This is the whole point of stage 3: an empty scene must read as empty even though
  // the root Window and the probe autoload are always present.
  const empty = treeStats(['root (Window)', '  HubProbe (Node)']);
  assert.equal(empty.built, 0);

  const real = treeStats(['root (Window)', '  HubProbe (Node)', '  Main (Node2D)', '    Art (Sprite2D)']);
  assert.equal(real.built, 2);
  assert.deepEqual(real.classes, ['Node2D', 'Sprite2D']);
});

t('no tree at all is zero built, not a crash', () => {
  assert.equal(treeStats([]).built, 0);
  assert.equal(treeStats(undefined).built, 0);
});

// ------------------------------------------------------------------- probe

t('the probe is tab-indented GDScript, as Godot requires', () => {
  const src = probeScript();
  assert.ok(src.startsWith('extends Node'));
  assert.ok(src.includes('\tfor _i in range(3):'), 'waits for the main scene to exist');
  assert.ok(!/^ {2,}\S/m.test(src), 'no space indentation anywhere');
});

console.log(`godotProject: ${passed} passed${process.exitCode ? ', SOME FAILED' : ''}`);
