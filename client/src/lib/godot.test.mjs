/**
 * godot.test.mjs - the Godot tab's derivations, without a browser.
 *
 *   node client/src/lib/godot.test.mjs
 *
 * The parser is the part that earns tests. Everything downstream of it - what gets
 * verified, what the repair brief says, which file the editor opens - is decided by
 * whether a reply was read as one project or as four files called "for a moving
 * platform". The fixtures below are the reply shapes real models actually produce.
 */
import assert from 'assert';
import {
  parseFileSet, filesToBlocks, resPath, shortPath, inferName,
  buildGodotSystem, buildGodotPrompt, describeRun,
  GODOT_OPS, GODOT_OP_MAP, STARTERS,
} from './godot.js';

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; } catch (e) { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; } };
const T = '\t';
const fence = (info, body) => '```' + info + '\n' + body + '\n```';

// ------------------------------------------------------------------- paths

t('every spelling of a path normalises to res://', () => {
  assert.equal(resPath('Player.gd'), 'res://Player.gd');
  assert.equal(resPath('res://Player.gd'), 'res://Player.gd');
  assert.equal(resPath('./scripts/Player.gd'), 'res://scripts/Player.gd');
  assert.equal(resPath('scripts\\Player.gd'), 'res://scripts/Player.gd');
  assert.equal(resPath(''), '');
  assert.equal(shortPath('res://a/b.gd'), 'a/b.gd');
});

// ------------------------------------------------------- parseFileSet shapes

t('the format we ask for: path on the fence', () => {
  const files = parseFileSet(
    'Here you go.\n\n' +
    fence('gdscript res://Player.gd', 'extends Node2D') + '\n\n' +
    fence('tscn res://Main.tscn', '[gd_scene format=3]'),
  );
  assert.equal(files.length, 2);
  assert.deepEqual(files.map((f) => f.path), ['res://Player.gd', 'res://Main.tscn']);
  assert.equal(files[0].content, 'extends Node2D\n', 'exactly one trailing newline');
});

t('a bold heading above the fence is accepted', () => {
  const files = parseFileSet('**res://Player.gd**\n\n' + fence('gdscript', 'extends Node2D'));
  assert.equal(files.length, 1);
  assert.equal(files[0].path, 'res://Player.gd');
  assert.equal(files[0].source, 'heading');
});

t('a markdown heading above the fence is accepted, res:// or not', () => {
  const files = parseFileSet('### Player.gd\n\n' + fence('gdscript', 'extends Node2D'));
  assert.equal(files[0].path, 'res://Player.gd');
});

t('a path comment on the first line inside the block is accepted, and removed', () => {
  const files = parseFileSet(fence('gdscript', '# res://Player.gd\nextends Node2D\n\nfunc _ready():\n' + T + 'pass'));
  assert.equal(files[0].path, 'res://Player.gd');
  assert.ok(files[0].content.startsWith('extends Node2D'), 'the marker is not left in the file');
});

t('a caption is not mistaken for a filename', () => {
  // "```gdscript for a moving platform" is prose. Naming a file after it would put
  // `res://for a moving platform` in the project and verify nothing.
  const files = parseFileSet(fence('gdscript for a moving platform', 'extends Node2D'));
  assert.equal(files.length, 1);
  assert.equal(files[0].path, 'res://Node2D.gd', 'falls back to naming it after what it is');
});

t('one unlabelled block is still a project', () => {
  const files = parseFileSet('Sure:\n\n' + fence('gdscript', 'class_name Enemy\nextends Node2D'));
  assert.equal(files.length, 1);
  assert.equal(files[0].path, 'res://Enemy.gd', 'named after its class_name');
  assert.equal(files[0].source, 'inferred');
});

t('an unlabelled scene is recognised as a scene, not a script', () => {
  const files = parseFileSet(fence('', '[gd_scene load_steps=2 format=3]\n\n[node name="Main" type="Node2D"]'));
  assert.equal(files[0].path, 'res://Main.tscn');
});

t('a SceneTree script gets a tool name, not a node name', () => {
  assert.equal(inferName('extends SceneTree\nfunc _init():\n' + T + 'quit()'), 'res://tool.gd');
});

t('prose with no code at all yields no files', () => {
  assert.deepEqual(parseFileSet('You could use a CharacterBody2D for that.'), []);
  assert.deepEqual(parseFileSet(''), []);
});

t('the same path twice keeps the LAST version', () => {
  // A reply that shows a file twice is showing the before and then the after.
  const files = parseFileSet(
    fence('gdscript res://Player.gd', 'extends Node2D # broken') + '\n\n' +
    'and fixed:\n\n' +
    fence('gdscript res://Player.gd', 'extends Node2D # fixed'),
  );
  assert.equal(files.length, 1);
  assert.ok(files[0].content.includes('fixed'));
});

t('an empty block is not turned into an empty file', () => {
  assert.deepEqual(parseFileSet(fence('gdscript res://Player.gd', '   ')), []);
});

t('a shell block alongside real files is ignored, not filed', () => {
  const files = parseFileSet(
    fence('gdscript res://Player.gd', 'extends Node2D') + '\n\n' +
    'Run it with:\n\n' + fence('bash', 'godot --headless --path .'),
  );
  assert.equal(files.length, 1);
  assert.equal(files[0].path, 'res://Player.gd');
});

t('tabs inside GDScript survive the round trip', () => {
  const body = 'extends Node2D\n\nfunc _ready():\n' + T + 'print("hi")';
  const files = parseFileSet(fence('gdscript res://A.gd', body));
  assert.equal(files[0].content, body + '\n');
  // A repair round-trips the project through render -> parse. If that were not stable,
  // a file would grow a blank line on every fix cycle.
  assert.equal(parseFileSet(filesToBlocks(files))[0].content, files[0].content, 'render -> parse is stable');
});

t('a four-backtick fence around a reply containing backticks still parses', () => {
  const files = parseFileSet('````gdscript res://A.gd\nextends Node2D\n# ``` not a fence\n````');
  assert.equal(files.length, 1);
  assert.ok(files[0].content.includes('not a fence'));
});

// ------------------------------------------------------------- prompt frames

t('every op has an instruction, and the system frame carries the verifier rules', () => {
  for (const op of GODOT_OPS) assert.ok(op.instruction.length > 40, `${op.id} has a real instruction`);
  const sys = buildGodotSystem('script');
  assert.ok(/Godot 4/.test(sys));
  assert.ok(/TABS/.test(sys), 'the tab-indent rule is stated - spaces do not parse');
  assert.ok(/must NOT call `quit\(\)`/.test(sys), 'the rule the OLD tab got backwards');
  assert.ok(/FAILS the run/.test(sys), 'the missing-asset rule matches what the verifier enforces');
  assert.ok(/```gdscript res:\/\//.test(sys), 'the output contract is shown, not described');
});

t('an unknown op falls back rather than producing an empty system prompt', () => {
  assert.equal(buildGodotSystem('nonsense'), buildGodotSystem('script'));
});

t('the current project is attached to the request', () => {
  const p = buildGodotPrompt('debug', 'it crashes on start', [{ path: 'res://A.gd', content: 'extends Node2D' }]);
  assert.ok(p.includes('it crashes on start'));
  assert.ok(p.includes('```gdscript res://A.gd'));
});

t('with no project, the prompt is just the request', () => {
  assert.equal(buildGodotPrompt('script', 'a jumping player', []), 'a jumping player');
});

// ---------------------------------------------------------------- describeRun

t('describeRun agrees with the server about what will happen', () => {
  const st = describeRun([{ path: 'res://tool.gd', content: 'extends SceneTree\nfunc _init():\n' + T + 'quit()' }]);
  assert.equal(st.mode, 'script');

  const node = describeRun([{ path: 'res://P.gd', content: 'extends CharacterBody2D\n' }]);
  assert.equal(node.mode, 'scene');
  assert.ok(/generated/.test(node.detail), 'and it says the scene is ours, not theirs');

  const scene = describeRun([
    { path: 'res://P.gd', content: 'extends Node2D\n' },
    { path: 'res://Main.tscn', content: '[gd_scene format=3]\n' },
  ]);
  assert.equal(scene.mode, 'scene');
  assert.ok(scene.detail.includes('Main.tscn'));

  assert.equal(describeRun([]).mode, 'none');
});

t('an explicitly chosen entry changes what describeRun promises', () => {
  const files = [
    { path: 'res://Main.tscn', content: '[gd_scene format=3]\n' },
    { path: 'res://tool.gd', content: 'extends SceneTree\nfunc _init():\n' + T + 'quit()' },
  ];
  assert.equal(describeRun(files, 'res://tool.gd').mode, 'script');
  assert.equal(describeRun(files, 'res://Main.tscn').mode, 'scene');
});

// The repair brief moved to lib/flow.js (one home for tab-to-tab handoffs); its tests
// moved with it, into flow.test.mjs. Tests belong beside the code they pin.

// ----------------------------------------------------------------- starters

t('every starter is tab-indented and internally consistent', () => {
  for (const [id, s] of Object.entries(STARTERS)) {
    assert.ok(s.files.length, `${id} has files`);
    for (const f of s.files) {
      assert.ok(resPath(f.path), `${id}: ${f.path} is a path`);
      if (/\.gd$/.test(f.path)) {
        assert.ok(!/^ {2,}\S/m.test(f.content), `${id}: ${f.path} uses tabs, not spaces`);
      }
    }
  }
});

t('the scene starter references only files it ships', () => {
  const scene = STARTERS.scene;
  const own = new Set(scene.files.map((f) => resPath(f.path)));
  const refs = scene.files.flatMap((f) => [...String(f.content).matchAll(/["'](res:\/\/[^"']+)["']/g)].map((m) => m[1]));
  for (const r of refs) assert.ok(own.has(r), `${r} is a file the starter actually ships`);
});

t('the node starter does NOT call quit() and the standalone one does', () => {
  assert.ok(!/^\s*quit\(\)/m.test(STARTERS.node.files[0].content), 'a Node script must not quit - the frame budget ends the run');
  assert.ok(/^\s*quit\(\)/m.test(STARTERS.scenetree.files[0].content), 'a SceneTree script must quit or it runs forever');
});

t('op ids are unique and the map covers them', () => {
  const ids = GODOT_OPS.map((o) => o.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.ok(GODOT_OP_MAP[id]);
});

console.log(`godot: ${passed} passed${process.exitCode ? ', SOME FAILED' : ''}`);
