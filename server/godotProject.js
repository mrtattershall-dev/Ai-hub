/**
 * godotProject.js - turn a set of files into a REAL Godot project and run it headless.
 *
 * WHY THIS EXISTS
 * ---------------
 * The Godot tab used to accept exactly one file, that file had to `extends SceneTree`,
 * and the strongest thing it could say was "it parses". That is the least representative
 * shape of GDScript there is: real Godot code is Node-shaped, lives in a project next to
 * a `.tscn` scene, and loads resources through `res://`. A model trained for Godot work
 * emits *projects*, so the verifier has to be able to run one.
 *
 * Three facts about the Godot CLI this is built on, all re-verified on 4.6.3 before a
 * line of it was written:
 *
 *   1. `--headless --path <dir> --quit-after <N>` runs the project's main scene for N
 *      iterations and exits on its own. That is what makes a Node2D with `_ready` and
 *      `_process` verifiable at all - no `quit()` required in the code under test.
 *   2. Godot exits 0 on parse failure, on script error, on missing resource. The exit
 *      code carries no information; the OUTPUT decides, every time.
 *   3. An autoload runs in any scene, including one the caller supplied. That is how the
 *      scene-tree dump below gets taken without editing the user's scene.
 *
 * Nothing here spawns anything - see godotVerify.js for the router and the process. This
 * file is the part worth testing without a 4GB binary, so it is kept pure: strings and
 * file layout in, strings and file layout out (`godotProject.test.mjs`).
 */
import { basename, dirname, join } from 'path';
import { mkdirSync, writeFileSync, copyFileSync } from 'fs';

/** Markers the probe autoload prints around its scene-tree dump. */
export const TREE_BEGIN = '__HUB_TREE_BEGIN__';
export const TREE_END = '__HUB_TREE_END__';

/** Files this module generates. Named with a `__hub_` prefix so a caller's own files
 *  can never collide with them, and so they can be filtered back out of a verdict. */
export const PROBE_FILE = '__hub_probe.gd';
export const HARNESS_SCENE = '__hub_main.tscn';
export const GENERATED = [PROBE_FILE, HARNESS_SCENE, 'project.godot'];

/** How many engine iterations a scene run gets before Godot quits it. ~1s of game time
 *  at 60fps: enough for `_ready`, several `_process` passes and a physics tick or two,
 *  short enough that a hung project is a fast failure rather than a 15s stall. */
export const DEFAULT_FRAMES = 60;

/**
 * Bases that are NOT scene nodes. Everything else is assumed to be a Node subclass,
 * which is the right default: Godot has hundreds of node classes and only a handful of
 * non-node roots, so an allowlist would reject valid code for being unusual. If the
 * guess is wrong Godot says so precisely, which is a better error than ours would be.
 */
const NON_NODE_BASES = new Set(['SceneTree', 'MainLoop', 'Resource', 'RefCounted', 'Object']);

const EXTENDS_RE = /^[ \t]*extends[ \t]+("[^"]+"|[A-Za-z_][\w.]*)/m;
const CLASS_NAME_RE = /^[ \t]*class_name[ \t]+([A-Za-z_]\w*)/m;

/**
 * What shape is this script, and therefore how can it be run?
 *
 *   scenetree - runnable directly with `--script`; must call quit() itself
 *   node      - needs a scene to live in; we build one (see harnessScene)
 *   resource  - not runnable at all; can only be parsed
 *
 * `base` is the extends token, `named` the class_name if it declares one - both are
 * needed to build a harness scene whose node type matches what the script expects.
 */
export function detectKind(code) {
  const src = String(code || '');
  const m = src.match(EXTENDS_RE);
  const named = (src.match(CLASS_NAME_RE) || [])[1] || null;
  if (!m) return { kind: named ? 'resource' : 'unknown', base: null, named };
  const base = m[1].replace(/^"|"$/g, '');
  if (base === 'SceneTree' || base === 'MainLoop') return { kind: 'scenetree', base, named };
  if (NON_NODE_BASES.has(base) || /Resource$/.test(base)) return { kind: 'resource', base, named };
  return { kind: 'node', base, named };
}

/** res:// -> project-relative, with every escape attempt refused rather than sanitised.
 *  Returns null for anything that would land outside the temp project. */
export function normalizePath(p) {
  let s = String(p || '').trim().replace(/\\/g, '/');
  s = s.replace(/^res:\/\//i, '').replace(/^\.\//, '').replace(/^\/+/, '');
  if (!s) return null;
  if (/^[A-Za-z]:/.test(s)) return null;                 // C:/...
  if (s.split('/').some((seg) => seg === '..')) return null;
  return s;
}

/** The res:// form of a project-relative path. */
export const resPath = (p) => `res://${normalizePath(p) || ''}`;

const SCRIPT_REF_RE = /\b(?:preload|load)\s*\(\s*["']([^"']+)["']/g;
const SCENE_REF_RE = /\bpath\s*=\s*"([^"]+)"/g;
const BARE_RES_RE = /["']((?:res|user):\/\/[^"']+)["']/g;

/**
 * Every resource the file set asks the engine for.
 *
 * Both syntaxes matter and they look nothing alike: GDScript reaches for a resource
 * through `preload("res://...")`, a `.tscn` through `[ext_resource path="res://..."]`.
 * A scan that only understood scripts would let a scene reference a sprite that does not
 * exist and still call the project verified.
 */
export function scanResourceRefs(files) {
  const refs = new Map();       // project-relative path -> Set of files that ask for it
  const note = (raw, from) => {
    const norm = normalizePath(raw);
    if (!norm) return;
    if (!refs.has(norm)) refs.set(norm, new Set());
    refs.get(norm).add(from);
  };
  for (const f of files || []) {
    const path = normalizePath(f.path) || '?';
    const content = String(f.content || '');
    for (const re of [SCRIPT_REF_RE, SCENE_REF_RE, BARE_RES_RE]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(content))) note(m[1], path);
    }
  }
  return [...refs.entries()].map(([path, from]) => ({ path, from: [...from] }));
}

/**
 * The probe autoload: prints the live scene tree a few frames in.
 *
 * This is the Godot answer to the Game tab's "is the canvas non-zero" check. A project
 * can load without a parse error, run its sixty frames and build absolutely nothing -
 * and with only stdout to go on that is indistinguishable from a project that works
 * silently. The tree dump is the evidence: node count, class names, hierarchy.
 *
 * It waits three frames rather than reading the tree in `_ready` because an autoload is
 * ready BEFORE the main scene is - measured; a zero-frame dump shows the probe alone and
 * nothing else, which reads as "your scene built nothing" for every project on earth.
 */
export function probeScript() {
  return [
    'extends Node',
    '',
    "# Generated by the hub's Godot verifier. Not part of the project under test.",
    'func _ready() -> void:',
    '\tfor _i in range(3):',
    '\t\tawait get_tree().process_frame',
    '\tvar lines: Array[String] = []',
    '\t_walk(get_tree().root, 0, lines)',
    `\tprint("${TREE_BEGIN}")`,
    '\tfor l in lines:',
    '\t\tprint(l)',
    `\tprint("${TREE_END}")`,
    '',
    'func _walk(n: Node, depth: int, out: Array[String]) -> void:',
    '\tif depth > 8 or out.size() > 400:',
    '\t\treturn',
    '\tout.append("%s%s (%s)" % ["  ".repeat(depth), n.name, n.get_class()])',
    '\tfor c in n.get_children():',
    '\t\t_walk(c, depth + 1, out)',
    '',
  ].join('\n');
}

/**
 * A scene that hosts a bare Node script so it can actually run.
 *
 * The node's `type` is the script's own `extends` token, not a safe generic like Node:
 * Godot refuses a CharacterBody2D script attached to a Node, so a "safe" default would
 * fail every script that extends anything specific - which is most of them.
 */
export function harnessScene(scriptPath, base) {
  const type = base && /^[A-Za-z_]\w*$/.test(base) ? base : 'Node';
  return [
    '[gd_scene load_steps=2 format=3]',
    '',
    `[ext_resource type="Script" path="${resPath(scriptPath)}" id="1_hub"]`,
    '',
    '[node name="Main" type="' + type + '"]',
    'script = ExtResource("1_hub")',
    '',
  ].join('\n');
}

/**
 * `project.godot` for the temp project.
 *
 * Written even when the caller supplied one, because two settings are the verifier's to
 * decide and not the project's: the probe autoload, and the main scene we are actually
 * being asked to run. Everything else the caller wrote is preserved verbatim - an
 * autoload list, input maps and window size are exactly the kind of thing a Godot task
 * is about, and silently dropping them would verify a different project than the one
 * under test.
 */
export function projectFile(mainScene, existing = '') {
  const src = String(existing || '').trim();
  const probeLine = `HubProbe="*${resPath(PROBE_FILE)}"`;

  if (!src) {
    return [
      'config_version=5',
      '',
      '[application]',
      'config/name="hub-verify"',
      ...(mainScene ? [`run/main_scene="${resPath(mainScene)}"`] : []),
      '',
      '[autoload]',
      probeLine,
      '',
      '[rendering]',
      'renderer/rendering_method="gl_compatibility"',
      '',
    ].join('\n');
  }

  // Merge into what was supplied. Section-aware, because `run/main_scene` written outside
  // [application] is silently ignored by Godot and would look like our bug, not theirs.
  const out = [];
  let section = '';
  let wroteMain = false;
  let wroteProbe = false;
  const closeSection = () => {
    if (section === 'application' && mainScene && !wroteMain) {
      out.push(`run/main_scene="${resPath(mainScene)}"`);
      wroteMain = true;
    }
    if (section === 'autoload' && !wroteProbe) { out.push(probeLine); wroteProbe = true; }
  };

  for (const line of src.split(/\r?\n/)) {
    const sec = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (sec) { closeSection(); section = sec[1].trim().toLowerCase(); out.push(line); continue; }
    if (section === 'application' && /^\s*run\/main_scene\s*=/.test(line)) {
      if (mainScene) { out.push(`run/main_scene="${resPath(mainScene)}"`); wroteMain = true; continue; }
    }
    if (section === 'autoload' && /^\s*HubProbe\s*=/.test(line)) continue;   // ours; re-added below
    out.push(line);
  }
  closeSection();

  if (mainScene && !wroteMain) out.push('', '[application]', `run/main_scene="${resPath(mainScene)}"`);
  if (!wroteProbe) out.push('', '[autoload]', probeLine);
  return out.join('\n') + '\n';
}

/**
 * Choose what to run, and generate whatever is missing to make that possible.
 *
 * Returns { mode, main, files, notes }, where `files` is the caller's set plus anything
 * generated. `notes` explains a generated file in one line, because a verdict about a
 * scene the user never wrote is baffling without it.
 */
export function planRun(files, { main = '', mode = 'auto' } = {}) {
  const set = (files || [])
    .map((f) => ({ path: normalizePath(f.path), content: String(f.content ?? '') }))
    .filter((f) => f.path);
  const scenes = set.filter((f) => /\.tscn$/i.test(f.path));
  const scripts = set.filter((f) => /\.gd$/i.test(f.path));
  const notes = [];

  const wanted = normalizePath(main);
  const explicit = wanted ? set.find((f) => f.path === wanted) : null;
  const kindOf = (f) => detectKind(f.content).kind;

  if (mode === 'parse' || (!scripts.length && !scenes.length)) {
    return { mode: 'parse', main: (explicit || scripts[0] || set[0] || {}).path || '', files: set, notes };
  }

  // An explicitly chosen scene wins outright.
  if (explicit && /\.tscn$/i.test(explicit.path)) {
    return { mode: 'scene', main: explicit.path, files: set, notes };
  }

  const entryScript = explicit && /\.gd$/i.test(explicit.path) ? explicit : null;

  // A SceneTree script is the one thing Godot can run entirely on its own.
  const sceneTree = entryScript
    ? (kindOf(entryScript) === 'scenetree' ? entryScript : null)
    : scripts.find((f) => kindOf(f) === 'scenetree');
  if (sceneTree && mode !== 'scene') {
    return { mode: 'script', main: sceneTree.path, files: set, notes };
  }

  if (scenes.length && !entryScript) {
    const pick = scenes.find((f) => /main/i.test(basename(f.path))) || scenes[0];
    return { mode: 'scene', main: pick.path, files: set, notes };
  }

  // A Node script with no scene to live in: build the scene it needs.
  const node = entryScript || scripts.find((f) => kindOf(f) === 'node');
  if (node && detectKind(node.content).kind === 'node') {
    const { base } = detectKind(node.content);
    notes.push(`No scene was supplied, so ${HARNESS_SCENE} was generated to host ${resPath(node.path)} as a ${base}.`);
    return {
      mode: 'scene',
      main: HARNESS_SCENE,
      files: [...set, { path: HARNESS_SCENE, content: harnessScene(node.path, base), generated: true }],
      notes,
    };
  }

  if (scenes.length) {
    const pick = scenes.find((f) => /main/i.test(basename(f.path))) || scenes[0];
    return { mode: 'scene', main: pick.path, files: set, notes };
  }

  // Resources and anything unrecognised: parsing is the honest ceiling.
  notes.push('Nothing here runs on its own - no SceneTree script, no scene, no Node script - so this is a parse check only.');
  return { mode: 'parse', main: (scripts[0] || set[0] || {}).path || '', files: set, notes };
}

/**
 * Write a plan to disk as a real project, pulling in any asset it references.
 *
 * Assets are COPIED IN rather than served, because Godot reads `res://` off the
 * filesystem - there is no request to intercept the way the Chromium verifier does. The
 * effect is the same and so is the rule: an asset that is not in the library never gets
 * created, so the run fails on the missing resource exactly as it would for a real user.
 * (See gameVerify.js - a missing asset is a FAILURE, not a warning. Godot is even blunter
 * about it than Phaser: `load()` returns null and the next line usually crashes.)
 */
export function materialize(dir, plan, { assets = null } = {}) {
  const written = [];
  const assetsUsed = [];
  const assetsMissing = [];
  const own = new Set(plan.files.map((f) => f.path));

  const put = (rel, content) => {
    const full = join(dir, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content, 'utf8');
    written.push(rel);
  };

  for (const f of plan.files) put(f.path, f.content);
  put(PROBE_FILE, probeScript());

  const supplied = plan.files.find((f) => f.path === 'project.godot');
  put('project.godot', projectFile(plan.mode === 'scene' ? plan.main : '', supplied ? supplied.content : ''));

  if (assets) {
    for (const ref of scanResourceRefs(plan.files)) {
      if (own.has(ref.path) || ref.path === PROBE_FILE) continue;
      if (/^user:/i.test(ref.path)) continue;             // a runtime write path, not an asset
      let hit = null;
      try { hit = assets.resolve(ref.path); } catch { hit = null; }
      if (!hit) { assetsMissing.push({ path: resPath(ref.path), from: ref.from }); continue; }
      try {
        const full = join(dir, ref.path);
        mkdirSync(dirname(full), { recursive: true });
        copyFileSync(hit.full, full);
        if (!assetsUsed.includes(hit.path)) assetsUsed.push(hit.path);
        written.push(ref.path);
      } catch (e) {
        assetsMissing.push({ path: resPath(ref.path), from: ref.from, error: e.message });
      }
    }
  }

  return { written, assetsUsed, assetsMissing };
}

const AT_RE = /^\s*at:\s.*?\(([^()]+):(\d+)\)\s*$/;
const FRAME_RE = /^\s*\[\d+\]\s+.*?\((res:\/\/[^()]+):(\d+)\)\s*$/;
const HEAD_RE = /^(SCRIPT ERROR|USER SCRIPT ERROR|ERROR|USER ERROR|WARNING|USER WARNING):\s*(.*)$/;

/**
 * Godot's console output -> structured errors, prints and the scene-tree dump.
 *
 * Attribution is the whole point. Godot reports one error over three or four lines: the
 * message, an `at:` line that usually points into Godot's own C++ source, and then a
 * GDScript backtrace whose frames point at the actual `.gd` file. A model handed
 * "Invalid access to property 'foo'" fixes nothing; handed "Player.gd:7" it fixes the
 * line. So a `res://` backtrace frame always wins over the `at:` line above it.
 */
export function parseGodotOutput(text) {
  const lines = String(text || '').split(/\r?\n/);
  const errors = [];
  const warnings = [];
  const prints = [];
  const tree = [];
  let inTree = false;
  let current = null;

  const flush = () => {
    if (!current) return;
    (current.severity === 'warning' ? warnings : errors).push(current);
    current = null;
  };

  for (const raw of lines) {
    const line = raw.replace(/\u001b\[[0-9;]*m/g, '');
    const trimmed = line.trim();

    if (trimmed === TREE_BEGIN) { inTree = true; continue; }
    if (trimmed === TREE_END) { inTree = false; continue; }
    if (inTree) { tree.push(line.replace(/\s+$/, '')); continue; }

    const head = trimmed.match(HEAD_RE);
    if (head) {
      flush();
      current = {
        severity: /WARNING/.test(head[1]) ? 'warning' : 'error',
        message: head[2].trim(),
        file: null,
        line: null,
        kind: /Parse Error/i.test(head[2]) ? 'parse' : 'runtime',
      };
      continue;
    }

    if (current) {
      const frame = line.match(FRAME_RE);
      if (frame) { current.file = frame[1]; current.line = Number(frame[2]); continue; }
      const at = line.match(AT_RE);
      if (at) {
        // Only take the `at:` location when it names a res:// file. Otherwise it is
        // Godot's own C++ and would send the model off editing the engine.
        if (/^res:\/\//.test(at[1]) && current.file == null) { current.file = at[1]; current.line = Number(at[2]); }
        continue;
      }
      if (/^\s*GDScript backtrace/.test(line)) continue;
      if (!trimmed) { flush(); continue; }
    }

    if (/^Godot Engine v|^https:\/\/godotengine\.org/.test(trimmed)) continue;
    if (trimmed) { flush(); prints.push(line.replace(/\s+$/, '')); }
  }
  flush();

  return { errors, warnings, prints, tree };
}

/**
 * What the project actually built, ignoring the scaffolding.
 *
 * `built` deliberately excludes the root Window and the probe autoload: both exist in
 * every run whether or not the code under test did anything, so counting them would make
 * "built nothing" impossible to detect - which is the one thing this measurement is for.
 */
export function treeStats(tree) {
  const rows = (tree || []).filter((l) => l.trim());
  const scaffold = /^\s*(root \(Window\)|HubProbe \(Node\))\s*$/;
  const built = rows.filter((l) => !scaffold.test(l));
  const classes = [...new Set(built.map((l) => (l.match(/\(([^()]+)\)\s*$/) || [])[1]).filter(Boolean))];
  return { total: rows.length, built: built.length, classes };
}

/** Is this a file the verifier generated, rather than something the caller wrote? */
export const isGenerated = (path) => GENERATED.includes(normalizePath(path) || '');
