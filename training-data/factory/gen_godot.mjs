/**
 * gen_godot.mjs - GDScript rows PROVEN to parse and run in real headless Godot.
 *
 *   node factory/gen_godot.mjs 800 factory/dataset_godot.jsonl     (hub server on :3001)
 *
 * WHY THIS EXISTS
 * ---------------
 * Measured 2026-09-08: run4 scored 0/3 on the Godot tab. One script ran 15s without
 * calling quit(); two failed to parse outright. That is not a regression - there is no
 * GDScript in ANY dataset, so the model is guessing at a language it has never been
 * shown. A clean absence, and the cheapest gap to close.
 *
 * Same method that fixed Phaser: generate parametrically, then verify by EXECUTION via
 * the hub's /api/godot/verify - a row survives only if headless Godot parses it, runs it
 * to completion, and it exits without error.
 *
 * SCOPE, honestly: these are standalone SceneTree scripts - GDScript syntax, typing,
 * built-in types, control flow, and the quit() convention the tab requires. They do NOT
 * teach scene composition, nodes, signals or _process, because those cannot be verified
 * standalone. This closes the "can it write valid GDScript at all" gap, not "can it build
 * a Godot game".
 */
import { writeFileSync } from 'fs';
import { createHash } from 'crypto';

const TARGET = parseInt(process.argv[2] || '800', 10);
const OUT = process.argv[3] || 'dataset_godot.jsonl';
const HUB = process.env.HUB || 'http://localhost:3001';

const SYSTEM = 'You write GDScript for Godot 4. A standalone script must `extends SceneTree`, do its '
  + 'work in `_init()`, and call `quit()` when finished or it will run forever. Use static typing where '
  + 'it helps, assert() to check results, and print() to report. Return code that runs as given.';

let seed = 4620260908;
const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const ri = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const T = '\t';

const wrap = (body) => `extends SceneTree\n\nfunc _init():\n${body}\n${T}quit()\n`;
const L = (s) => T + s;

const R = {};

R.arithmetic = () => {
  const a = ri(2, 40), b = ri(2, 40);
  return { ask: `sum the numbers 1 to ${a} and print the total`,
    code: wrap([
      L(`var total: int = 0`),
      L(`for i in range(1, ${a + 1}):`),
      L(`${T}total += i`),
      L(`assert(total == ${(a * (a + 1)) / 2}, "sum is wrong")`),
      L(`print("sum 1..${a} = ", total)`),
    ].join('\n')) };
};

R.arraySort = () => {
  const n = ri(4, 8);
  const arr = Array.from({ length: n }, () => ri(1, 99));
  const sorted = [...arr].sort((x, y) => x - y);
  return { ask: 'sort an array of integers and print it',
    code: wrap([
      L(`var nums: Array[int] = [${arr.join(', ')}]`),
      L(`nums.sort()`),
      L(`assert(nums == [${sorted.join(', ')}], "not sorted")`),
      L(`print("sorted: ", nums)`),
    ].join('\n')) };
};

R.dictionary = () => {
  const items = ['wheat', 'corn', 'ore', 'gem', 'wood', 'stone', 'herb'];
  const k = some(items, ri(3, 4));
  const counts = k.map(() => ri(1, 20));
  const idx = ri(0, k.length - 1);
  return { ask: `build a dictionary of item counts and look one up`,
    code: wrap([
      L(`var stock: Dictionary = {`),
      ...k.map((x, i) => L(`${T}"${x}": ${counts[i]},`)),
      L(`}`),
      L(`assert(stock["${k[idx]}"] == ${counts[idx]}, "lookup failed")`),
      L(`assert(stock.size() == ${k.length}, "wrong size")`),
      L(`print("${k[idx]} = ", stock["${k[idx]}"])`),
    ].join('\n')) };
};

R.stringWork = () => {
  const words = some(['harvest', 'plant', 'water', 'sell', 'craft', 'mine'], ri(3, 4));
  return { ask: 'join and split a list of strings',
    code: wrap([
      L(`var parts: Array[String] = [${words.map(w => `"${w}"`).join(', ')}]`),
      L(`var joined: String = ", ".join(parts)`),
      L(`var back: PackedStringArray = joined.split(", ")`),
      L(`assert(back.size() == ${words.length}, "split lost items")`),
      L(`assert(joined.begins_with("${words[0]}"), "join order wrong")`),
      L(`print(joined)`),
    ].join('\n')) };
};

R.clampLerp = () => {
  const lo = ri(0, 20), hi = lo + ri(10, 60), over = hi + ri(5, 30);
  return { ask: 'clamp a value into a range and report it',
    code: wrap([
      L(`var raw: int = ${over}`),
      L(`var value: int = clampi(raw, ${lo}, ${hi})`),
      L(`assert(value == ${hi}, "clamp failed")`),
      L(`var half: float = lerpf(float(${lo}), float(${hi}), 0.5)`),
      L(`assert(is_equal_approx(half, ${((lo + hi) / 2).toFixed(1)}), "lerp failed")`),
      L(`print("clamped ", raw, " -> ", value)`),
    ].join('\n')) };
};

R.classDef = () => {
  const max = ri(50, 300), dmg = ri(5, 40);
  return { ask: 'define a small health class and exercise it',
    code: `extends SceneTree

class Health:
${T}var max_hp: int
${T}var hp: int

${T}func _init(m: int):
${T}${T}max_hp = m
${T}${T}hp = m

${T}func damage(n: int) -> int:
${T}${T}hp = max(0, hp - n)
${T}${T}return hp

${T}func is_dead() -> bool:
${T}${T}return hp <= 0

func _init():
${T}var h := Health.new(${max})
${T}h.damage(${dmg})
${T}assert(h.hp == ${max - dmg}, "damage wrong")
${T}h.damage(9999)
${T}assert(h.is_dead(), "should be dead")
${T}print("hp after lethal hit: ", h.hp)
${T}quit()
` };
};

R.loopFilter = () => {
  const n = ri(10, 30);
  const evens = Array.from({ length: n }, (_, i) => i + 1).filter(x => x % 2 === 0);
  return { ask: `collect the even numbers up to ${n}`,
    code: wrap([
      L(`var evens: Array[int] = []`),
      L(`for i in range(1, ${n + 1}):`),
      L(`${T}if i % 2 == 0:`),
      L(`${T}${T}evens.append(i)`),
      L(`assert(evens.size() == ${evens.length}, "wrong count")`),
      L(`assert(evens[0] == 2, "should start at 2")`),
      L(`print("evens: ", evens)`),
    ].join('\n')) };
};

R.vector = () => {
  const x = ri(1, 20), y = ri(1, 20);
  return { ask: 'do some Vector2 maths and print the result',
    code: wrap([
      L(`var a := Vector2(${x}, ${y})`),
      L(`var b := Vector2(${y}, ${x})`),
      L(`var sum := a + b`),
      L(`assert(sum == Vector2(${x + y}, ${x + y}), "vector add failed")`),
      L(`assert(a.distance_to(a) == 0.0, "distance to self")`),
      L(`print("sum: ", sum, "  length: ", snappedf(a.length(), 0.01))`),
    ].join('\n')) };
};

function some(a, n) { const c = [...a], o = []; while (o.length < n && c.length) o.push(c.splice(Math.floor(rnd() * c.length), 1)[0]); return o; }

async function verify(code) {
  try {
    const r = await fetch(HUB + '/api/godot/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }), signal: AbortSignal.timeout(60000) });
    if (!r.ok) return null;                 // harness problem, never a verdict
    return (await r.json()).ok === true;
  } catch { return null; }
}

const names = Object.keys(R);
const rows = [], seen = new Set();
let attempts = 0, dup = 0, rejected = 0, unreachable = 0;
const tally = {};

console.log(`generating ${TARGET} verified GDScript rows from ${names.length} families...`);
while (rows.length < TARGET && attempts < TARGET * 5) {
  attempts++;
  let b;
  try { b = R[names[attempts % names.length]](); } catch { continue; }
  const key = createHash('sha1').update(b.code).digest('hex');
  if (seen.has(key)) { dup++; continue; }
  const ok = await verify(b.code);
  if (ok === null) {
    // Not a verdict - give the attempt back and wait for the verifier to return.
    unreachable++; attempts--;
    await new Promise(r => setTimeout(r, 2000));
    continue;
  }
  if (!ok) { rejected++; continue; }
  seen.add(key);
  const fam = names[attempts % names.length];
  tally[fam] = (tally[fam] || 0) + 1;
  rows.push({ messages: [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: b.ask },
    { role: 'assistant', content: '```gdscript\n' + b.code.trim() + '\n```' },
  ]});
  if (rows.length % 25 === 0) {
    writeFileSync(OUT, rows.map(r => JSON.stringify(r)).join('\n') + '\n', 'utf8');
    console.log(`  ${rows.length}/${TARGET}  (rejected ${rejected}, dup ${dup})`);
  }
}
writeFileSync(OUT, rows.map(r => JSON.stringify(r)).join('\n') + '\n', 'utf8');
console.log(`\nkept ${rows.length} verified rows -> ${OUT}`);
console.log(`attempts ${attempts} | rejected by godot ${rejected} | duplicates ${dup}` + (unreachable ? ` | unreachable ${unreachable}` : ''));
console.log('by family:', JSON.stringify(tally));
