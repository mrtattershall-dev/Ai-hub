/**
 * scoreGodot.test.mjs - the Godot eval axis, on generations with known answers.
 *
 *   node training-data/factory/scoreGodot.test.mjs
 *
 * Scores a synthetic eval set through the real `score_run.mjs`, in its own EVAL_DIR, so it
 * never touches factory/eval/. Needs the Godot binary (vendor/godot/ or GODOT_BIN); it
 * SKIPS rather than fails without one, because a missing binary is a harness fact and this
 * suite must not turn that into a red build.
 *
 * WHY THIS EXISTS
 * ---------------
 * The Godot axis used to be `--check-only` on the first fenced block: it scored "does it
 * parse". run6 read 3/15 on that bar and told us nothing, because a model emitting
 * syntactically-valid GDScript that creates no nodes and prints nothing scored the same as
 * one that built a working scene. A grader is the instrument every training decision is
 * read off, so it is worth pinning with cases whose answers are known in advance:
 *
 *   good      builds a node and prints           -> must PASS
 *   stub      parses perfectly, does nothing     -> must FAIL   (the whole point)
 *   parse     syntax error                       -> must FAIL
 *   asset     invents a res:// path              -> must FAIL   (same rule as Phaser)
 *   prose     no code at all                     -> must FAIL
 *
 * The `stub` case is the one that matters. If it ever passes again, the axis has gone back
 * to measuring compilation and every Godot number after that point is uninterpretable.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const T = '\t';
const fence = (body, info = 'gdscript') => '```' + info + '\n' + body + '\n```';

const GODOT_PRESENT = !!process.env.GODOT_BIN
  || ['godot.exe', 'godot_console.exe', 'godot']
    .some((n) => existsSync(join(__dirname, '..', '..', 'vendor', 'godot', n)));

if (!GODOT_PRESENT) {
  console.log('scoreGodot: SKIPPED - no Godot binary (vendor/godot/ or GODOT_BIN)');
  process.exit(0);
}

const dir = mkdtempSync(join(tmpdir(), 'scoregodot-'));
mkdirSync(join(dir, 'eval'), { recursive: true });

const ROWS = [
  {
    id: 'gd_good', axis: 'godot', prompt: 'A Node2D that spawns a sprite',
    text: 'Here you go.\n\n' + fence(
      'extends Node2D\n\nfunc _ready() -> void:\n' + T + 'var s := Sprite2D.new()\n'
      + T + 's.name = "Art"\n' + T + 'add_child(s)\n' + T + 'print("ready")\n',
      'gdscript res://Main.gd'),
  },
  {
    id: 'gd_stub', axis: 'godot', prompt: 'A node that does the thing',
    text: fence('extends Node\n\nfunc _ready() -> void:\n' + T + 'pass\n'),
  },
  {
    id: 'gd_parse', axis: 'godot', prompt: 'A node',
    text: fence('extends Node2D\n\nfunc _ready() -> void\n' + T + 'print("x")\n'),
  },
  {
    id: 'gd_asset', axis: 'godot', prompt: 'Show a hero sprite',
    text: fence('extends Node2D\n\nfunc _ready() -> void:\n'
      + T + 'var t = load("res://art/hero_that_does_not_exist_9912.png")\n' + T + 'print(t)\n'),
  },
  {
    id: 'gd_prose', axis: 'godot', prompt: 'How do I make a node?',
    text: 'You would use a Node2D and add children to it in _ready.',
  },
];

writeFileSync(join(dir, 'eval', 'eval_t.jsonl'),
  ROWS.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; }
  catch (e) { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; }
};

let out = '';
try {
  out = execFileSync(process.execPath, [join(__dirname, 'score_run.mjs'), 't'], {
    env: { ...process.env, EVAL_DIR: join(dir, 'eval') },
    encoding: 'utf8',
    timeout: 10 * 60_000,
  });
} catch (e) {
  console.error('score_run.mjs did not complete:', (e.stdout || '') + (e.stderr || ''));
  process.exit(1);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

/** The ' ok ' / 'FAIL' mark score_run prints for one prompt id. */
const verdictOf = (id) => {
  const line = out.split('\n').find((l) => l.includes(` ${id} `));
  assert.ok(line, `no per-prompt line for ${id}\n${out}`);
  return { pass: line.trim().startsWith('ok'), skipped: line.trim().startsWith('?'), line };
};

test('a project that builds a node and prints PASSES', () => {
  const v = verdictOf('gd_good');
  assert.ok(v.pass, v.line);
  assert.match(v.line, /node\(s\) live/);
});

test('A STUB THAT PARSES AND DOES NOTHING FAILS', () => {
  // The reason this axis was rewritten. `--check-only` scored this a pass.
  const v = verdictOf('gd_stub');
  assert.ok(!v.pass && !v.skipped, `a do-nothing stub must not pass: ${v.line}`);
  assert.match(v.line, /nothing observable/);
});

test('a syntax error fails, and says so', () => {
  const v = verdictOf('gd_parse');
  assert.ok(!v.pass);
  assert.match(v.line, /parse/i);
});

test('an invented res:// path fails, same rule as the Phaser axis', () => {
  const v = verdictOf('gd_asset');
  assert.ok(!v.pass);
  assert.match(v.line, /hero_that_does_not_exist|not found/i);
});

test('prose with no code fails rather than erroring the harness', () => {
  const v = verdictOf('gd_prose');
  assert.ok(!v.pass && !v.skipped);
  assert.match(v.line, /no code block/);
});

test('the OLD bar is reported alongside, and differs', () => {
  // Without this line every comparison against a pre-2026-09-10 Godot score is
  // meaningless - run6's "3/15" answered a different question.
  const legacy = out.split('\n').find((l) => l.includes('parses') && l.includes('OLD bar'));
  assert.ok(legacy, `the old-bar row is missing:\n${out}`);
  const nw = out.split('\n').find((l) => /^godot\s/.test(l.trim()));
  assert.ok(nw, 'the new godot row is missing');
  assert.notEqual(nw.match(/(\d+)\/(\d+)/)[0], legacy.match(/(\d+)\/(\d+)/)[0],
    'the two bars scored identically on a set built to separate them - one of them is not doing its job');
});

test('nothing was scored as a harness failure', () => {
  // '?' means the grader could not judge. On this set everything is judgeable, so a '?'
  // here means the harness broke and the numbers above are not results.
  assert.doesNotMatch(out, /could not be scored/, out.slice(-400));
});

console.log(`scoreGodot: ${passed} passed${process.exitCode ? ', SOME FAILED' : ''}`);
