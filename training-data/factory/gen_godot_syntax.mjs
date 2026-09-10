/**
 * gen_godot_syntax.mjs - GDScript rows that target where it DIVERGES FROM PYTHON.
 *
 *   node factory/gen_godot_syntax.mjs 1500 factory/dataset_godot_syntax.jsonl
 *
 * WHAT WENT WRONG IN run5
 * -----------------------
 * Godot scored 0/3 for base, run4 AND run5. But the run5 failures were a different KIND
 * of failure, and that is the whole design input here:
 *
 *   run4  "Unexpected 'extends' in class body"      <- did not know the pattern at all
 *   run5  "Expected '{' after enum name"            <- knows the pattern, writes Python
 *
 * The 900 Godot rows in run5 taught the SHAPE correctly. Every generation had
 * `extends SceneTree`, `_init()`, `quit()`, `assert()` and static typing - all of it
 * right. What they did not do is override Qwen's Python priors on the handful of points
 * where GDScript looks like Python and is not:
 *
 *   enum State:          ->  enum State { IDLE, WALK }
 *   for _, w in items:   ->  GDScript has NO tuple unpacking, at all
 *   func.call vs func()  ->  Callables need .call()
 *
 * Teaching the shape again is wasted capacity - it already knows. So every family below
 * exists to put a divergence point in front of the model, in working code.
 *
 * THE GATE
 * --------
 * Every row is parsed by REAL headless Godot before it is kept. Godot exits 0 even on a
 * parse failure, so success is decided by scanning output for SCRIPT ERROR / Parse Error,
 * never by exit code. A row that does not parse is dropped, not fixed - the same contract
 * that took Phaser from 0/12 to 4/6.
 */
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { tmpdir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const N = parseInt(process.argv[2] || '1500', 10);
const OUT = process.argv[3] || join(__dirname, 'dataset_godot_syntax.jsonl');

const SYSTEM = 'You write GDScript for Godot 4. A standalone script must `extends SceneTree`, '
  + 'do its work in `_init()`, and call `quit()` when finished or it will run forever. Use static '
  + 'typing where it helps, assert() to check results, and print() to report. Return code that runs as given.';

// ── find Godot ────────────────────────────────────────────────────────────────
function resolveGodot() {
  if (process.env.GODOT_BIN && existsSync(process.env.GODOT_BIN)) return process.env.GODOT_BIN;
  for (const n of ['godot_console.exe', 'godot.exe', 'godot']) {
    const p = join(__dirname, '..', '..', 'vendor', 'godot', n);
    if (existsSync(p)) return p;
  }
  return null;
}
const GODOT = resolveGodot();
if (!GODOT) {
  console.error('No Godot binary. Put one at vendor/godot/ or set GODOT_BIN.');
  console.error('Without it every row would be unverified, which is how the Phaser slice got ruined.');
  process.exit(1);
}

// ── deterministic PRNG ────────────────────────────────────────────────────────
// Math.imul, not plain multiply: a float64 multiply overflows past 2^53 and the state
// collapses into a short cycle. That capped an earlier generator at 2,945 distinct rows.
let seed = 990909;
const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

// The parameter space IS the row count.
//
// The first run produced 247 unique rows from 18,000 attempts - 17,753 duplicates -
// because each family could only emit a few dozen distinct programs. Nothing was
// rejected by Godot; the templates simply ran out of things to say. So every dimension
// below is widened, and numeric parameters flow into the ASSERTIONS, which multiplies
// the space rather than merely relabelling it.
const NOUNS = ['Ore', 'Herb', 'Relic', 'Seed', 'Rune', 'Pelt', 'Ingot', 'Scroll', 'Gem', 'Root',
  'Fang', 'Ash', 'Bone', 'Silk', 'Clay', 'Amber', 'Husk', 'Talon', 'Vial', 'Coal',
  'Sap', 'Wick', 'Chime', 'Feather', 'Salt', 'Thorn', 'Ember', 'Frost', 'Moss', 'Quill',
  'Shard', 'Tonic', 'Antler', 'Cinder', 'Lotus', 'Marrow', 'Nectar', 'Obsidian', 'Pearl', 'Resin'];
const STATES = [
  ['IDLE', 'WALK', 'RUN'], ['CALM', 'ALERT', 'HOSTILE'], ['SEED', 'SPROUT', 'BLOOM'],
  ['LOCKED', 'OPENING', 'OPEN'], ['DORMANT', 'STIRRING', 'AWAKE'], ['EMPTY', 'FILLING', 'FULL'],
  ['COLD', 'WARM', 'BURNING'], ['HIDDEN', 'REVEALED', 'CLAIMED'], ['DRY', 'DAMP', 'FLOODED'],
  ['NEW', 'WORN', 'BROKEN'], ['PATROL', 'CHASE', 'FLEE'], ['GROUND', 'RISING', 'AIRBORNE'],
  ['SAFE', 'WARNED', 'DOOMED'], ['RAW', 'CUT', 'POLISHED'], ['SHUT', 'AJAR', 'WIDE'],
];
const ENUM_NAMES = ['State', 'Phase', 'Mode', 'Stage', 'Condition', 'Posture', 'Cycle', 'Rank'];
const OPS = [
  ['double', 'v * 2', (v) => v * 2], ['negate', '-v', (v) => -v], ['square', 'v * v', (v) => v * v],
  ['increment', 'v + 1', (v) => v + 1], ['triple', 'v * 3', (v) => v * 3],
  ['decrement', 'v - 1', (v) => v - 1], ['offset', 'v + 10', (v) => v + 10],
  ['scale', 'v * 5', (v) => v * 5], ['invert', '100 - v', (v) => 100 - v],
  ['quadruple', 'v * 4', (v) => v * 4], ['plus_seven', 'v + 7', (v) => v + 7],
  ['times_six', 'v * 6', (v) => v * 6],
];
const cap = (s) => s[0].toUpperCase() + s.slice(1);

// ── families, each aimed at one divergence ────────────────────────────────────
const FAMILIES = [

  // 1. enum needs BRACES. This is the exact error run5 produced.
  () => {
    const st = pick(STATES), name = pick(ENUM_NAMES);
    return {
      ask: `Write a standalone GDScript for Godot 4: an enum ${name} with the values ${st.join(', ')}, a dictionary of legal transitions between them, and a function that reports whether a transition is allowed. Assert both a legal and an illegal transition, then quit.`,
      code: `extends SceneTree

enum ${name} { ${st.join(', ')} }

var transitions := {
${st.map((s, i) => `\t${name}.${s}: [${name}.${st[(i + 1) % st.length]}]`).join(',\n')}
}

func can_move(from: int, to: int) -> bool:
\tif not transitions.has(from):
\t\treturn false
\treturn to in transitions[from]

func _init():
\tassert(can_move(${name}.${st[0]}, ${name}.${st[1]}), "${st[0]} -> ${st[1]} should be legal")
\tassert(not can_move(${name}.${st[1]}, ${name}.${st[0]}), "${st[1]} -> ${st[0]} should be illegal")
\tprint("transitions verified for ${name}")
\tquit()
`,
    };
  },

  // 2. NO TUPLE UNPACKING. Iterate a Dictionary by key and index it.
  () => {
    // Randomised weights, ascending so "heaviest is the last" stays true, and the
    // asserted total is computed from them - so nouns x counts x weights, not just nouns.
    const n = pick(NOUNS), k = int(3, 6);
    const keys = Array.from({ length: k }, (_, i) => `${n.toLowerCase()}_${i + 1}`);
    let w = int(1, 4);
    const ws = keys.map(() => (w += int(1, 5)));
    return {
      ask: `Write a standalone GDScript for Godot 4: a dictionary of ${n.toLowerCase()} weights, a function that totals them, and a function that finds the heaviest. Assert both results and print a summary, then quit.`,
      code: `extends SceneTree

var weights := {
${keys.map((key, i) => `\t"${key}": ${(i + 1) * 2}`).join(',\n')}
}

func total_weight() -> int:
\tvar sum := 0
\t# GDScript has no tuple unpacking - iterate the KEYS and index the dictionary.
\tfor key in weights:
\t\tsum += weights[key]
\treturn sum

func heaviest() -> String:
\tvar best := ""
\tvar best_w := -1
\tfor key in weights.keys():
\t\tif weights[key] > best_w:
\t\t\tbest_w = weights[key]
\t\t\tbest = key
\treturn best

func _init():
\tassert(total_weight() == ${keys.reduce((a, _, i) => a + (i + 1) * 2, 0)}, "total should match")
\tassert(heaviest() == "${keys[k - 1]}", "heaviest should be the last entry")
\tprint("total=", total_weight(), " heaviest=", heaviest())
\tquit()
`,
    };
  },

  // 3. Callables need .call(). Storing a func in a variable and invoking it.
  () => {
    // 12 ops x 3 randomised inputs, and every input's expected value is asserted -
    // so the space is ops x values, not just ops. It was 3 total.
    const [nm, expr, fn] = pick(OPS);
    const src = [int(1, 9), int(10, 19), int(20, 30)];
    const want = src.map(fn);
    const n = pick(NOUNS).toLowerCase();
    return {
      ask: `Write a standalone GDScript for Godot 4: store a function in a variable and call it through that variable, applying it across an array of ${n} values. Assert every result and quit.`,
      code: `extends SceneTree

func ${nm}(v: int) -> int:
\treturn ${expr}

func apply_all(values: Array[int], op: Callable) -> Array[int]:
\tvar out: Array[int] = []
\tfor v in values:
\t\t# A Callable is invoked with .call(), not with plain parentheses.
\t\tout.append(op.call(v))
\treturn out

func _init():
\tvar ${n}_values: Array[int] = [${src.join(', ')}]
\tvar op := Callable(self, "${nm}")
\tvar got := apply_all(${n}_values, op)
\tassert(got.size() == ${n}_values.size(), "size preserved")
${want.map((w, i) => `\tassert(got[${i}] == ${w}, "${src[i]} ${nm} -> ${w}")`).join('\n')}
\tprint("applied ${nm} to ${n}_values: ", got)
\tquit()
`,
    };
  },

  // 4. match, not if/elif. And typed arrays.
  () => {
    const n = pick(NOUNS);
    return {
      ask: `Write a standalone GDScript for Godot 4: classify ${n.toLowerCase()} values into tiers using a match statement, collect the tiers into a typed array, assert the counts and quit.`,
      code: `extends SceneTree

func tier_of(value: int) -> String:
\t# match, not if/elif chains - and it needs an explicit default branch.
\tmatch value:
\t\t0:
\t\t\treturn "none"
\t\t1, 2:
\t\t\treturn "common"
\t\t3, 4:
\t\t\treturn "rare"
\t\t_:
\t\t\treturn "legendary"

func classify(values: Array[int]) -> Array[String]:
\tvar out: Array[String] = []
\tfor v in values:
\t\tout.append(tier_of(v))
\treturn out

func _init():
\tvar tiers := classify([0, 1, 3, 9])
\tassert(tiers[0] == "none", "0 is none")
\tassert(tiers[1] == "common", "1 is common")
\tassert(tiers[2] == "rare", "3 is rare")
\tassert(tiers[3] == "legendary", "9 is legendary")
\tprint("${n} tiers: ", tiers)
\tquit()
`,
    };
  },

  // 5. Class definition: class_name is file-level; inner classes use `class X:` + extends inside.
  () => {
    const n = pick(NOUNS);
    return {
      ask: `Write a standalone GDScript for Godot 4: an inner class representing a ${n.toLowerCase()} stack with add and remove, used from _init with assertions, then quit.`,
      code: `extends SceneTree

# An inner class is declared with \`class\`; \`extends\` goes INSIDE it, never after the name
# in the outer body.
class ${n}Stack:
\tvar count: int = 0
\tvar cap: int

\tfunc _init(capacity: int = 10) -> void:
\t\tcap = capacity

\tfunc add(n: int) -> bool:
\t\tif count + n > cap:
\t\t\treturn false
\t\tcount += n
\t\treturn true

\tfunc remove(n: int) -> bool:
\t\tif n > count:
\t\t\treturn false
\t\tcount -= n
\t\treturn true

func _init():
\tvar s := ${n}Stack.new(${int(6, 12)})
\tassert(s.add(4), "adding within cap succeeds")
\tassert(not s.add(100), "adding over cap is refused")
\tassert(s.count == 4, "refused add left the count alone")
\tassert(s.remove(4), "removing what is held succeeds")
\tassert(not s.remove(1), "removing more than held is refused")
\tprint("${n}Stack verified")
\tquit()
`,
    };
  },

  // 6. String formatting: % with an array, not f-strings or .format(**kwargs).
  () => {
    const n = pick(NOUNS);
    return {
      ask: `Write a standalone GDScript for Godot 4: format a ${n.toLowerCase()} report line from values, assert the formatted string, then quit.`,
      code: `extends SceneTree

func describe(name: String, qty: int, weight: float) -> String:
\t# GDScript has no f-strings. Use % with an array, or String.format.
\treturn "%s x%d (%.1f kg)" % [name, qty, weight]

func _init():
\tvar line := describe("${n}", ${int(2, 9)}, 1.5)
\tassert(line.begins_with("${n}"), "starts with the name")
\tassert(line.ends_with("kg)"), "ends with the unit")
\tprint(line)
\tquit()
`,
    };
  },
];

// ── verify against real Godot ─────────────────────────────────────────────────
const tmp = join(tmpdir(), `gdgen-${Date.now()}`);
mkdirSync(tmp, { recursive: true });

function parses(code) {
  const f = join(tmp, 'probe.gd');
  writeFileSync(f, code, 'utf8');
  let out = '';
  try {
    out = execFileSync(GODOT, ['--headless', '--check-only', '--script', f],
      { timeout: 30_000, windowsHide: true, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) || '';
  } catch (e) {
    out = `${e.stdout || ''}\n${e.stderr || ''}`;
  }
  // Godot exits 0 on parse failure, so the OUTPUT decides - never the exit code.
  return !/SCRIPT ERROR|Parse Error|Failed to load script/i.test(out);
}

const rows = [];
const seen = new Set();
let attempts = 0, rejected = 0, dupes = 0;
const perFamily = FAMILIES.map(() => 0);

console.log(`  Godot: ${GODOT}`);
console.log(`  target: ${N} rows across ${FAMILIES.length} divergence families\n`);

while (rows.length < N && attempts < N * 12) {
  attempts++;
  const fi = attempts % FAMILIES.length;
  const { ask, code } = FAMILIES[fi]();
  const key = createHash('sha1').update(code.replace(/\s+/g, ' ')).digest('hex');
  if (seen.has(key)) { dupes++; continue; }
  seen.add(key);
  if (!parses(code)) { rejected++; continue; }
  perFamily[fi]++;
  rows.push({
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: ask },
      { role: 'assistant', content: '```gdscript\n' + code + '```' },
    ],
  });
  if (rows.length % 100 === 0) process.stdout.write(`  ${rows.length}/${N}\r`);
}

writeFileSync(OUT, rows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
console.log(`\n=== gen_godot_syntax -> ${OUT} ===`);
console.log(`  kept        ${rows.length}`);
console.log(`  attempts    ${attempts}`);
console.log(`  rejected    ${rejected}   (did NOT parse in real Godot — dropped, never patched)`);
console.log(`  duplicates  ${dupes}`);
console.log(`\n  per family:`);
const LABELS = ['enum needs braces', 'no tuple unpacking', 'Callable .call()', 'match + typed arrays', 'inner class / extends', 'string % formatting'];
perFamily.forEach((c, i) => console.log(`    ${LABELS[i].padEnd(24)} ${c}`));
