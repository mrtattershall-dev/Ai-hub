/**
 * godot.js - the Godot tab's brain: what to ask a model for, and what to do with the
 * files it sends back.
 *
 * WHY THIS EXISTS
 * ---------------
 * The Godot tab had no model in it at all. Every other tab could generate; Godot could
 * only verify something you had pasted in by hand, which made it the one step of the
 * pipeline a 24/7 loop could not drive. And the thing it verified was a single file that
 * had to `extends SceneTree` - a shape almost no real Godot code takes.
 *
 * So this file is two contracts, and they have to agree or the tab lies:
 *
 *   1. What we ASK the model for  - `buildGodotSystem` states the output format and the
 *      rules the verifier actually enforces, in the verifier's own terms.
 *   2. What we ACCEPT back        - `parseFileSet` reads a multi-file project out of an
 *      ordinary markdown reply, in every shape models really emit it.
 *
 * Rule 1 without rule 2 is a model told to emit paths into a parser that ignores them.
 * Rule 2 without rule 1 is a parser guessing. The pair is what makes "generate a Godot
 * scene" a thing the tab can do unattended.
 *
 * Kept as plain functions over text so it is testable without a browser - see
 * `godot.test.mjs`. Deliberately NOT in `lib/flow.js`: that file is another session's
 * lane, and the Godot repair brief here calls `sendHandoff` exactly the way GamePage's
 * `verdictToFix` does, so nothing is lost by keeping them apart.
 */

/** GDScript indents with tabs. A template that ships spaces is a template that fails to
 *  parse the first time someone edits it, so every starter below is tab-indented. */
const T = '\t';

/**
 * The starting points, one per shape of Godot work.
 *
 * `node` is the default rather than `scenetree`, which is the reverse of how this tab
 * used to open. A SceneTree script is the shape the OLD verifier could run, not the shape
 * anyone writes - leading with it taught every user, and every model reading the tab's
 * output, that Godot code looks like a console program.
 */
export const STARTERS = {
  node: {
    label: 'Node script',
    hint: 'A script in a scene. Runs for a fixed number of frames - no quit() needed.',
    files: [{
      path: 'res://Player.gd',
      content: [
        'extends Node2D',
        '',
        '# A normal Godot script: it lives on a node in a scene.',
        '# The hub runs it for 60 frames and reports what it built, so there is no',
        '# need to call quit() - that is only for standalone SceneTree scripts.',
        '',
        'var speed := 120.0',
        'var _sprite: Sprite2D',
        '',
        'func _ready() -> void:',
        T + '_sprite = Sprite2D.new()',
        T + '_sprite.name = "Art"',
        T + 'add_child(_sprite)',
        T + 'print("player ready at ", position)',
        '',
        'func _process(delta: float) -> void:',
        T + 'position.x += speed * delta',
        '',
      ].join('\n'),
    }],
  },
  scene: {
    label: 'Scene + script',
    hint: 'A .tscn with a script attached - the unit a real Godot project is made of.',
    files: [
      {
        path: 'res://Main.tscn',
        content: [
          '[gd_scene load_steps=2 format=3]',
          '',
          '[ext_resource type="Script" path="res://Main.gd" id="1_main"]',
          '',
          '[node name="Main" type="Node2D"]',
          'script = ExtResource("1_main")',
          '',
          '[node name="Label" type="Label" parent="."]',
          'text = "Hello from a scene"',
          '',
        ].join('\n'),
      },
      {
        path: 'res://Main.gd',
        content: [
          'extends Node2D',
          '',
          'func _ready() -> void:',
          T + 'print("scene ready with ", get_child_count(), " child node(s)")',
          T + 'var enemy := preload("res://Enemy.gd").new()',
          T + 'enemy.name = "Enemy"',
          T + 'add_child(enemy)',
          '',
        ].join('\n'),
      },
      {
        path: 'res://Enemy.gd',
        content: [
          'extends Node2D',
          '',
          'func _ready() -> void:',
          T + 'print("enemy spawned")',
          '',
        ].join('\n'),
      },
    ],
  },
  scenetree: {
    label: 'Standalone script',
    hint: 'A console-style script Godot runs directly. Must call quit() itself.',
    files: [{
      path: 'res://tool.gd',
      content: [
        'extends SceneTree',
        '',
        '# A standalone GDScript must extend SceneTree and call quit() when it is done,',
        '# otherwise headless Godot runs forever.',
        'func _init():',
        T + 'var total := 0',
        T + 'for i in range(1, 6):',
        T + T + 'total += i',
        T + 'print("sum 1..5 = ", total)',
        T + 'assert(total == 15, "arithmetic is broken")',
        T + 'print("ok")',
        T + 'quit()',
        '',
      ].join('\n'),
    }],
  },
};

export const STARTER_IDS = Object.keys(STARTERS);

/**
 * What a model is asked to do here.
 *
 * These are Godot OPERATIONS, not generic code tasks. "Refactor" is the same everywhere;
 * "wire these signals" and "port this Phaser scene to Godot" are not, and a generic
 * instruction produces generic code that happens to mention Godot. Each one names the
 * artefact it must produce, because a 14B model that is not told "a .tscn as well" will
 * write the script and describe the scene in prose.
 */
export const GODOT_OPS = [
  {
    id: 'scene',
    label: 'Build scene',
    instruction:
      'Build the Godot 4 scene described below. Produce BOTH a `.tscn` scene file AND the ' +
      '`.gd` script(s) it attaches, as separate files. The scene must declare its node ' +
      'hierarchy in the `.tscn` - do not build the whole tree in code and leave the scene empty.',
  },
  {
    id: 'script',
    label: 'Write script',
    instruction:
      'Write the Godot 4 GDScript described below. It attaches to a node in a scene, so it ' +
      'extends a Node type (Node2D, CharacterBody2D, Control, …) - NOT SceneTree. Implement ' +
      'the behaviour in `_ready` and `_process`/`_physics_process` as appropriate.',
  },
  {
    id: 'game',
    label: 'Small game',
    instruction:
      'Build a small, complete, playable Godot 4 project for the request below: a main scene, ' +
      'the scripts it needs, and any helper scenes. Keep it to a handful of files. Input goes ' +
      'through `Input.is_action_pressed` with the default UI actions (`ui_left`, `ui_right`, ' +
      '`ui_up`, `ui_down`, `ui_accept`) so it runs with no input map of its own.',
  },
  {
    id: 'debug',
    label: 'Debug',
    instruction:
      'Find and fix the problem in the Godot project below. Respond in three parts:\n' +
      '1. **Diagnosis** - what is wrong, at which file and line, and why it causes this failure.\n' +
      '2. **Fix** - the corrected file(s) in full.\n' +
      '3. **Verification** - what the verifier should now print or build that it did not before.\n' +
      'Change only what the failure requires; leave the rest of the project intact.',
  },
  {
    id: 'signals',
    label: 'Signals & nodes',
    instruction:
      'Wire the Godot 4 nodes and signals described below. Declare signals with `signal`, ' +
      'connect them with `Callable` (`node.pressed.connect(_on_pressed)`) - not the Godot 3 ' +
      '`connect("pressed", self, "_on_pressed")` form - and show where each connection is made. ' +
      'Give the scene file too if the connection depends on the node hierarchy.',
  },
  {
    id: 'resource',
    label: 'Resource / data',
    instruction:
      'Write the Godot 4 custom Resource described below: a script that `extends Resource` with ' +
      '`class_name` and `@export` properties, plus a short script showing how it is created, ' +
      'saved with `ResourceSaver` and loaded back. Note that a Resource script cannot run on ' +
      'its own - include a SceneTree or Node script that exercises it.',
  },
  {
    id: 'port',
    label: 'Port to Godot',
    instruction:
      'Port the code below to Godot 4 GDScript. Map each concept explicitly rather than ' +
      'transliterating: a game loop becomes `_process`, a sprite becomes a Sprite2D node, a ' +
      'collision check becomes an Area2D/CharacterBody2D. Produce the scene file as well as ' +
      'the scripts, then list anything that has no Godot equivalent and say what you did instead.',
  },
  {
    id: 'tests',
    label: 'Assertions',
    instruction:
      'Write a self-checking Godot 4 test script for the code below. It `extends SceneTree`, ' +
      'exercises the behaviour with `assert()` on normal cases, edge cases and error paths, ' +
      'prints a line per case, and calls `quit()` at the end. Include the code under test as a ' +
      'separate file so the test can `preload` it.',
  },
  {
    id: 'explain',
    label: 'Explain',
    instruction:
      'Explain what the Godot project below does. Start with one sentence on its purpose, then ' +
      'walk through the node tree and the order the lifecycle callbacks fire in (`_init`, ' +
      '`_ready`, `_process`, `_physics_process`). Call out anything Godot-specific that would ' +
      'surprise someone coming from another engine. Do not rewrite the code.',
  },
  {
    id: 'refactor',
    label: 'Refactor',
    instruction:
      'Refactor the Godot project below for readability and structure while preserving its exact ' +
      'behaviour and node paths. Prefer typed variables, `@onready` over `_ready` lookups, and ' +
      'signals over polling where it fits. Give every changed file in full, then list what ' +
      'changed and why.',
  },
  {
    id: 'review',
    label: 'Review',
    instruction:
      'Review the Godot project below. Group findings under **Correctness**, **Godot 4 idiom** ' +
      '(Godot 3 APIs, untyped code, `get_node` in `_process`), **Performance** and **Structure**. ' +
      'Quote the file and line for each, give a concrete fix, and say so in one line if a ' +
      'category is clean. End with the top 1-3 things to fix first.',
  },
];

export const GODOT_OP_MAP = Object.fromEntries(GODOT_OPS.map((o) => [o.id, o]));

/**
 * The rules the verifier ACTUALLY enforces, told to the model in the verifier's terms.
 *
 * Every line here is a failure this tab can produce, not general advice. That is the
 * point: a model that is going to be graded by `godotVerify.js` should be told what
 * `godotVerify.js` checks, and nothing else. The Game tab learned this the expensive way
 * - 71% of its Phaser training data loaded assets from a server that does not exist, and
 * one sentence of instruction about it recovered 2/6 prompts.
 */
const GODOT_RULES = [
  'How your answer is checked - all of this runs for real, in headless Godot 4:',
  '- Every `.gd` file is parse-checked. A parse error fails the whole project.',
  '- Then it RUNS. A scene runs for a fixed number of frames and is stopped for you, so a',
  '  Node script must NOT call `quit()`. Only a `SceneTree` script quits itself, and it must.',
  '- Running is not enough: the run has to DO something. A script whose `_ready` is `pass`',
  '  fails - either build child nodes or `print()` what happened.',
  '- Every `res://` path you reference must exist. Anything not in the files you write is',
  '  looked up in the asset library, and a path that is not there FAILS the run - Godot',
  '  returns null from `load()` and the next line usually crashes. Never invent an art path.',
  '- Godot 4 only. `Callable` signal connections, `@export`/`@onready`, `Vector2` not `Vector`,',
  '  `PackedScene.instantiate()` not `instance()`. Godot 3 syntax is a parse error here.',
  '- GDScript indents with TABS. Spaces will not parse.',
].join('\n');

/**
 * The output contract. Stated as a format because a model that describes files in prose
 * produces a project that cannot be run, and the tab would have nothing to verify.
 */
const OUTPUT_CONTRACT = [
  'Output format - one fenced block per file, each with its res:// path on the fence:',
  '',
  '```gdscript res://Player.gd',
  'extends Node2D',
  '```',
  '',
  '```tscn res://Main.tscn',
  '[gd_scene load_steps=2 format=3]',
  '```',
  '',
  '- Write every file out IN FULL. Never elide with `# ...` or `# unchanged`.',
  '- One block per file. Do not put two files in one block.',
  '- Paths are `res://`-relative, and a script referenced by a scene must be a file you wrote.',
].join('\n');

/** The system frame for a Godot conversation in this tab. */
export function buildGodotSystem(opId, { multiTurn = true } = {}) {
  const op = GODOT_OP_MAP[opId] || GODOT_OP_MAP.script;
  const parts = [op.instruction, GODOT_RULES, OUTPUT_CONTRACT];
  if (multiTurn) {
    parts.push(
      'This is an ongoing conversation. Read the previous turns and build on them: when the ' +
      'verifier reports a failure, fix the file it names rather than starting the project over, ' +
      'and keep filenames, node names and structure stable across turns.',
    );
  }
  return parts.join('\n\n');
}

/**
 * The user turn: the request, with the current project attached when there is one.
 *
 * The project travels with the request rather than living only in conversation history,
 * because the editor is live - by the time you press Generate the buffer may have been
 * hand-edited, pulled from somewhere else, or repaired by a previous turn. The model has
 * to act on the files that are actually there.
 */
export function buildGodotPrompt(opId, input, files = []) {
  const req = String(input || '').trim();
  const body = filesToBlocks(files);
  if (!body) return req;
  const needsProject = ['debug', 'explain', 'refactor', 'review', 'tests', 'port'].includes(opId);
  const lead = needsProject ? 'The current project:' : 'The project as it stands (change it, or start again if that is cleaner):';
  return `${req}\n\n---\n${lead}\n\n${body}`;
}

const LANG_FOR = (path) => {
  if (/\.tscn$|\.tres$/i.test(path)) return 'tscn';
  if (/\.godot$/i.test(path)) return 'ini';
  if (/\.gdshader$/i.test(path)) return 'glsl';
  return 'gdscript';
};

/** A file set rendered back into the same fenced format the model is asked to emit. */
export function filesToBlocks(files) {
  return (files || [])
    .filter((f) => f && f.path)
    .map((f) => `\`\`\`${LANG_FOR(f.path)} ${resPath(f.path)}\n${String(f.content ?? '').replace(/\s+$/, '')}\n\`\`\``)
    .join('\n\n');
}

/** Normalise any of the path spellings a model might use into `res://x/y.gd`. */
export function resPath(p) {
  const s = String(p || '').trim().replace(/\\/g, '/').replace(/^res:\/\//i, '').replace(/^\.\//, '').replace(/^\/+/, '');
  return s ? `res://${s}` : '';
}

/** The bare project-relative path, for display and for sending to the verifier. */
export const shortPath = (p) => resPath(p).replace(/^res:\/\//, '');

const FENCE_RE = /^([ \t]*)(`{3,}|~{3,})[ \t]*([^\n]*)\n([\s\S]*?)^\1\2[ \t]*$/gm;
// A path is only a path if it looks like one. "gdscript Player.gd" is a path; "gdscript
// for a moving platform" is a caption, and treating a caption as a filename produces a
// project full of files called `for a moving platform`.
const PATH_TOKEN = /(?:res:\/\/)?[\w./-]+\.(gd|tscn|tres|godot|gdshader|cfg)$/i;
const HEADING_PATH = /^[ \t]*(?:#{1,6}[ \t]*|\*\*|__|`)?\s*((?:res:\/\/)?[\w./-]+\.(?:gd|tscn|tres|godot|gdshader|cfg))\s*(?:\*\*|__|`)?\s*:?\s*$/;

/**
 * A markdown reply -> the project it describes.
 *
 * Models label files in at least four ways and none of them is wrong:
 *
 *     ```gdscript res://Player.gd        on the fence         (what we ask for)
 *     **res://Player.gd**                heading above it     (what chat models do)
 *     ### Player.gd                      heading above it
 *     # res://Player.gd                  first line inside    (what code models do)
 *
 * All four are accepted, in that priority order, because refusing three of them would
 * mean the tab worked with the model we prompted and no other - and the whole reason the
 * hub exists is to compare models against each other.
 *
 * A reply with exactly one unlabelled code block is still a project: one file, named for
 * its `class_name` if it has one. That is the single most common reply shape there is,
 * and rejecting it would make the tab useless with every model that has not been told
 * about the format yet - including, notably, the ones being evaluated.
 */
export function parseFileSet(text) {
  const src = String(text || '');
  const files = [];
  const seen = new Map();

  const push = (rawPath, content, source) => {
    const path = resPath(rawPath);
    if (!path) return;
    // Normalise the trailing newline to exactly one. The fence capture keeps whatever
    // whitespace preceded the closing fence, and `filesToBlocks` adds one of its own, so
    // without this a file grows a blank line every time it round-trips through a repair.
    const raw = stripPathComment(content, path);
    if (!raw.trim()) return;
    const body = `${raw.replace(/\s+$/, '')}\n`;
    if (seen.has(path)) {
      // A later block for the same path wins: a reply that shows a file twice is showing
      // you the before and then the after, in that order.
      files[seen.get(path)] = { path, content: body, source };
      return;
    }
    seen.set(path, files.length);
    files.push({ path, content: body, source });
  };

  const blocks = [];
  const unlabelled = [];
  FENCE_RE.lastIndex = 0;
  let m;
  while ((m = FENCE_RE.exec(src))) {
    blocks.push({ info: m[3].trim(), content: m[4], start: m.index, end: FENCE_RE.lastIndex });
  }

  for (const b of blocks) {
    // 1. path on the fence
    const infoPath = b.info.split(/\s+/).find((tok) => PATH_TOKEN.test(tok));
    if (infoPath) { push(infoPath, b.content, 'fence'); continue; }

    // 2. a heading or bold line immediately above the fence
    const before = src.slice(0, b.start).split('\n').filter((l) => l.trim()).slice(-2).reverse();
    const heading = before.map((l) => (l.match(HEADING_PATH) || [])[1]).find(Boolean);
    if (heading) { push(heading, b.content, 'heading'); continue; }

    // 3. a path comment on the first line inside the block
    const first = b.content.split('\n')[0] || '';
    const inner = first.match(/^\s*(?:#|\/\/|;)\s*((?:res:\/\/)?[\w./-]+\.(?:gd|tscn|tres|godot|gdshader|cfg))\s*$/);
    if (inner) { push(inner[1], b.content, 'comment'); continue; }

    unlabelled.push(b);
  }

  // 4. nothing labelled: fall back to naming the code by what it is.
  if (!files.length) {
    const candidates = unlabelled.filter((b) => b.content.trim());
    const code = candidates.find((b) => /gd|godot|tscn/i.test(b.info)) || candidates[0];
    if (code) push(inferName(code.content, code.info), code.content, 'inferred');
  }

  return files;
}

/** Drop the `# res://Player.gd` marker line once it has done its job as a filename. */
function stripPathComment(content, path) {
  const lines = String(content).split('\n');
  const first = lines[0] || '';
  const marked = first.match(/^\s*(?:#|\/\/|;)\s*((?:res:\/\/)?[\w./-]+\.\w+)\s*$/);
  if (marked && resPath(marked[1]) === path) return lines.slice(1).join('\n').replace(/^\n+/, '');
  return content;
}

/** Name an unlabelled block after what it declares, so the file set is still meaningful. */
export function inferName(content, info = '') {
  const src = String(content || '');
  if (/^\s*\[gd_scene/m.test(src)) return 'res://Main.tscn';
  if (/^\s*\[gd_resource/m.test(src)) return 'res://data.tres';
  if (/^\s*config_version\s*=/m.test(src)) return 'res://project.godot';
  const named = (src.match(/^[ \t]*class_name[ \t]+([A-Za-z_]\w*)/m) || [])[1];
  if (named) return `res://${named}.gd`;
  if (/^\s*extends\s+SceneTree/m.test(src)) return 'res://tool.gd';
  const base = (src.match(/^[ \t]*extends[ \t]+([A-Za-z_]\w*)/m) || [])[1];
  if (base) return `res://${base === 'Node' ? 'Main' : base}.gd`;
  if (/shader_type/i.test(src) || /gdshader/i.test(info)) return 'res://shader.gdshader';
  return 'res://snippet.gd';
}

/** Longest run of code carried into a repair brief before it is truncated. */
export const MAX_FIX_CODE = 14000;
/** Distinct errors worth passing on. Past this it is the same failure repeating. */
export const MAX_FIX_ERRORS = 8;

/**
 * A failed Godot verdict -> a repair brief for the Code tab, or null when it passed.
 *
 * This is the link that closes the loop, and it is the same argument as the Game tab's:
 * verification could already tell you the project was broken and then left you to retype
 * the failure somewhere useful, which is the copy-paste step the flow exists to remove -
 * and the step where the useful detail quietly gets dropped because it is tedious to
 * transcribe.
 *
 * What Godot gives us that Chromium does not is an ADDRESS. Every error carries
 * `res://File.gd:LINE`, so the brief can name the line instead of quoting a message and
 * hoping the model finds it. That address is the most valuable thing in the payload and
 * it goes first, before the code.
 */
export function godotVerdictToFix(verdict, files = []) {
  if (!verdict || verdict.ok) return null;

  const parts = ['This Godot 4 project failed verification in the real engine, headless. Fix it.'];
  if (verdict.verdict) parts.push(`Verdict: ${verdict.verdict}`);

  const failed = (verdict.stages || []).filter((s) => !s.ok);
  if (failed.length) {
    parts.push(`Failed stage(s): ${failed.map((s) => `${s.stage}${s.timedOut ? ' (timed out)' : ''}`).join(', ')}`);
  }

  // Deduplicated by address AND message: the same error inside `_process` fires once per
  // frame, so an unfiltered list is one message copied sixty times with the real second
  // error scrolled off the end.
  const seen = new Set();
  const errors = [];
  for (const e of verdict.errors || []) {
    const key = `${e.file || ''}:${e.line || ''}:${e.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    errors.push(e.file ? `${e.file}:${e.line} — ${e.message}` : e.message);
  }
  if (errors.length) {
    parts.push(`Errors:\n${errors.slice(0, MAX_FIX_ERRORS).map((e) => `- ${e}`).join('\n')}`);
    if (errors.length > MAX_FIX_ERRORS) parts.push(`(${errors.length - MAX_FIX_ERRORS} further distinct errors omitted)`);
  }

  if (verdict.assetsMissing?.length) {
    parts.push(
      `These resources do not exist: ${verdict.assetsMissing.map((a) => a.path).join(', ')}.\n` +
      'Every res:// path must be either a file in this project or a real asset from the library. ' +
      'Do not invent art paths - draw with generated nodes (ColorRect, Polygon2D, Label) instead.',
    );
  }

  // The activity stage failing is a different instruction from an error, and saying
  // "fix the error" when there was no error sends the model looking for one.
  const activity = (verdict.stages || []).find((s) => s.stage === 'activity' && !s.ok);
  if (activity && !errors.length) {
    parts.push(
      'The project ran without erroring but did nothing observable. Give it real behaviour: ' +
      'create the child nodes the request calls for, and print() what happened so the run is verifiable.',
    );
  }

  const body = filesToBlocks(files);
  if (body) {
    const truncated = body.length > MAX_FIX_CODE;
    parts.push(
      'Return every changed file in full, in the same fenced format, not a diff.\n\n' +
      (truncated ? `${body.slice(0, MAX_FIX_CODE)}\n\n/* …project truncated… */` : body),
    );
  }

  return { task: 'debug', input: parts.join('\n\n'), from: 'godot' };
}

/**
 * What the tab should say a run will do, before it does it.
 *
 * Mirrors `planRun` in `server/godotProject.js`. The duplication is deliberate and narrow:
 * the server decides, but a button whose label you only learn the meaning of after
 * pressing it is a button people stop pressing. If the two ever disagree the server wins
 * and the verdict says so - it reports the mode it actually used.
 */
export function describeRun(files, main = '') {
  const set = (files || []).filter((f) => f && f.path);
  if (!set.length) return { mode: 'none', label: 'Nothing to run', detail: 'Add a file first.' };

  const wanted = main ? set.find((f) => resPath(f.path) === resPath(main)) : null;
  const scenes = set.filter((f) => /\.tscn$/i.test(f.path));
  const scripts = set.filter((f) => /\.gd$/i.test(f.path));

  if (wanted && /\.tscn$/i.test(wanted.path)) {
    return { mode: 'scene', label: 'Run scene', detail: `${resPath(wanted.path)} for N frames.` };
  }
  const isSceneTree = (f) => /^[ \t]*extends[ \t]+SceneTree\b/m.test(f.content || '');
  const st = wanted ? (isSceneTree(wanted) ? wanted : null) : scripts.find(isSceneTree);
  if (st) return { mode: 'script', label: 'Run script', detail: `${resPath(st.path)} standalone - it must call quit().` };
  if (scenes.length && !wanted) {
    const pick = scenes.find((f) => /main/i.test(f.path)) || scenes[0];
    return { mode: 'scene', label: 'Run scene', detail: `${resPath(pick.path)} for N frames.` };
  }
  const node = wanted || scripts.find((f) => /^[ \t]*extends[ \t]+\w/m.test(f.content || ''));
  if (node && !isSceneTree(node)) {
    return { mode: 'scene', label: 'Run in scene', detail: `A scene will be generated to host ${resPath(node.path)}.` };
  }
  return { mode: 'parse', label: 'Parse only', detail: 'Nothing here runs on its own.' };
}
