// gradeAB.mjs <setA-ws> <setB-ws> : first-pass value checks for the 26 code goals of sets A/B.
// Each goal's function is called on known inputs, from the FINAL workspace, two ways:
//   asIs  - required exactly as left (the model's own asserts run)      -> P if it passes
//   impl  - the model's own asserts neutralised (neutral.cjs, python -O) -> CT if only this passes
// A function that exists but is not exported is found through a vm load and flagged NX.
// This is a FIRST PASS for hand-grading: every non-P line is read by hand before it counts.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const NEUTRAL = 'C:/Users/tatte/Projects/ai-coding-hub/measurements/2026-09-11-setC/tools/neutral.cjs';
const [wsA, wsB] = process.argv.slice(2).map((p) => resolve(p));

const JS = (file, body) => `
const fs = require('fs'), vm = require('vm'); const FILE = ${JSON.stringify(file)};
let M = null, loadErr = null; const NX = []; try { M = require('./' + FILE); } catch (e) { loadErr = String((e && e.message) || e).slice(0, 120); }
function get(name) {
  if (M && typeof M[name] === 'function') return M[name];
  if (typeof M === 'function' && M.name === name) return M;
  if (M && M.default && typeof M.default[name] === 'function') return M.default[name];
  const ctx = { module: { exports: {} }, exports: {}, require, console: { log() {}, error() {}, assert() {} }, setTimeout, clearTimeout, Promise, process };
  try { vm.runInNewContext(fs.readFileSync(FILE, 'utf8') + ';globalThis.__x = (typeof ' + name + ' !== "undefined") ? ' + name + ' : undefined;', ctx); } catch (e) {}
  if (typeof ctx.__x === 'function') { NX.push(name); return ctx.__x; }
  throw new Error(name + ' not found' + (loadErr ? ' (load: ' + loadErr + ')' : ''));
}
const throws = (f) => { try { f(); return false; } catch { return true; } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
(async () => { let why = '';
  try { const r = await (async () => { ${body} })(); if (r !== undefined && r !== true) why = String(r); } catch (e) { why = 'threw: ' + String((e && e.message) || e).slice(0, 120); }
  console.log('RESULT ' + JSON.stringify({ pass: !why, why, NX, loadErr }));
})();`;

const PY = (file, body) => `
import importlib.util, io, contextlib, json, os, sys
NL = chr(10)
why = ''
try:
    spec = importlib.util.spec_from_file_location('m', os.path.join(os.getcwd(), ${JSON.stringify(file)}))
    M = importlib.util.module_from_spec(spec)
    with contextlib.redirect_stdout(io.StringIO()):
        spec.loader.exec_module(M)
except BaseException as e:
    print('RESULT ' + json.dumps({'pass': False, 'why': 'load: ' + (type(e).__name__ + ': ' + str(e))[:120], 'NX': []})); sys.exit(0)
def raises(f, exc):
    try:
        f(); return False
    except exc:
        return True
def check():
${body.split('\n').map((l) => '    ' + l).join('\n')}
try:
    r = check()
    if r not in (None, True): why = str(r)
except BaseException as e:
    why = 'threw: ' + (type(e).__name__ + ': ' + str(e))[:120]
print('RESULT ' + json.dumps({'pass': not why, 'why': why, 'NX': []}))`;

const A = [
  ['A1', 't1_temp.js', JS('t1_temp.js', `const c = get('cToF'), f = get('fToC'); if (c(0) !== 32 || c(100) !== 212) return 'cToF'; if (Math.abs(f(212) - 100) > 1e-9 || Math.abs(f(32)) > 1e-9) return 'fToC';`)],
  ['A2', 't1_temp.js', JS('t1_temp.js', `const k = get('kToC'); if (Math.abs(k(273.15)) > 1e-9 || Math.abs(k(0) + 273.15) > 1e-9) return 'kToC values'; if (!throws(() => k(-1))) return 'negative did not throw'; if (get('cToF')(100) !== 212) return 'cToF broke';`)],
  ['A3', 't2_text.py', PY('t2_text.py', `if M.is_palindrome("A man, a plan, a canal: Panama") is not True: return 'panama'
if M.is_palindrome("No 'x' in Nixon") is not True: return 'nixon'
if M.is_palindrome("hello") is not False: return 'hello'`)],
  ['A4', 't3_inventory.js', JS('t3_inventory.js', `const I = get('Inventory'); const v = new I(); v.add('a', 5); v.remove('a', 2); if (v.count('a') !== 3) return 'count ' + v.count('a'); if (!throws(() => v.remove('a', 10))) return 'negative stock did not throw'; if (v.count('a') !== 3) return 'failed remove changed count';`)],
  ['A5', 't3_inventory.js', JS('t3_inventory.js', `const I = get('Inventory'); const v = new I(); v.add('a', 2); v.add('b', 1); v.remove('a', 2);
    for (const k of Object.keys(v)) { const x = v[k]; if (x instanceof Map && x.has('a')) return 'a still in Map ' + k; if (x && typeof x === 'object' && !(x instanceof Map) && Object.prototype.hasOwnProperty.call(x, 'a')) return 'a still in ' + k + ': ' + JSON.stringify(x.a); }
    if (v.count('b') !== 1) return 'b lost'; if (![0, undefined].includes(v.count('a'))) return 'count(a) ' + v.count('a');`)],
  ['A7', 't4_intervals.js', JS('t4_intervals.js', `const m = get('mergeIntervals'); const r = m([[1, 3], [2, 6], [8, 10], [15, 18]]); if (!same(r, [[1, 6], [8, 10], [15, 18]])) return 'basic ' + JSON.stringify(r); if (!same(m([[1, 4], [4, 5]]), [[1, 5]])) return 'touching';`)],
  ['A8', 't4_intervals.js', JS('t4_intervals.js', `const m = get('mergeIntervals'); const r = m([[8, 10], [1, 3], [2, 6]]); if (!same(r, [[1, 6], [8, 10]])) return 'unsorted ' + JSON.stringify(r); if (!fs.existsSync('T_INTERVALS.md')) return 'no T_INTERVALS.md';`)],
  ['A11', 't6_stats.py', PY('t6_stats.py', `if M.mean([1, 2, 3, 4]) != 2.5: return 'mean'
if M.median([3, 1, 2]) != 2 or M.median([1, 2, 3, 4]) != 2.5: return 'median'
if M.mode([1, 2, 2, 3]) != 2: return 'mode'
for n in ('mean', 'median', 'mode'):
    if not raises(lambda: getattr(M, n)([]), ValueError): return n + '([]) no ValueError'`)],
  ['A12', 't7_router.js', JS('t7_router.js', `const m = get('match'); if (!same(m('/u/:id', '/u/7'), { id: '7' })) return 'params ' + JSON.stringify(m('/u/:id', '/u/7')); if (m('/u/:id', '/u/7/8') !== null) return '/u/7/8 matched'; if (m('/a/b', '/a/c') !== null) return 'literal mismatch matched';`)],
  ['A13', 't7_router.js', JS('t7_router.js', `const m = get('match'); if (m('/files/*', '/files/a/b') === null) return 'wildcard never matches'; if (m('/files/*', '/other/a') !== null) return 'wildcard matched wrong prefix'; if (!same(m('/u/:id', '/u/7'), { id: '7' })) return 'params broke'; if (m('/u/:id', '/u/7/8') !== null) return '/u/7/8 matched';`)],
  ['A16', 't9_csvsum.py', PY('t9_csvsum.py', `t = NL.join(["a,b", "1,2", "3,4.5"])
if M.sum_column(t, "b") != 6.5: return 'sum ' + repr(M.sum_column(t, "b"))
if not raises(lambda: M.sum_column(t, "zz"), KeyError): return 'unknown column no KeyError'`)],
  ['A17', 't10_debounce.js', JS('t10_debounce.js', `const d = get('debounce'); const seen = []; const g = d((x) => seen.push(x), 40); g(1); g(2); g(3); await new Promise((r) => setTimeout(r, 120)); if (!same(seen, [3])) return 'burst ran ' + JSON.stringify(seen); g(4); await new Promise((r) => setTimeout(r, 120)); if (!same(seen, [3, 4])) return 'second burst ' + JSON.stringify(seen);`)],
  ['A19', 't12_bits.js', JS('t12_bits.js', `const c = get('countBits'), p = get('isPowerOfTwo'); if (c(0) !== 0 || c(5) !== 2 || c(255) !== 8) return 'countBits'; if (p(8) !== true || p(1) !== true || p(0) !== false || p(6) !== false) return 'isPowerOfTwo';`)],
];
const B = [
  ['B1', 'u1_queue.js', JS('u1_queue.js', `const Q = get('Queue'); const q = new Q(); q.enqueue(1); q.enqueue(2); if (q.size() !== 2) return 'size'; if (q.dequeue() !== 1) return 'fifo'; q.dequeue(); if (!throws(() => q.dequeue())) return 'empty dequeue did not throw'; if (q.size() !== 0) return 'size after';`)],
  ['B2', 'u1_queue.js', JS('u1_queue.js', `const Q = get('Queue'); const q = new Q(); if (!throws(() => q.peek())) return 'empty peek did not throw'; q.enqueue('a'); q.enqueue('b'); if (q.peek() !== 'a' || q.size() !== 2) return 'peek removed or wrong';`)],
  ['B3', 'u2_anagram.py', PY('u2_anagram.py', `if M.are_anagrams("Dormitory", "Dirty room") is not True: return 'dormitory'
if M.are_anagrams("abc", "abd") is not False: return 'abc/abd'`)],
  ['B4', 'u3_cart.js', JS('u3_cart.js', `const C = get('Cart'); const c = new C(); c.addItem('a', 2, 3); c.addItem('b', 4, 1); if (Math.abs(c.total() - 10) > 1e-9) return 'total ' + c.total(); const after = c.applyDiscount(10); const t = c.total(); if (Math.abs(t - 9) > 1e-9 && Math.abs(after - 9) > 1e-9) return 'after 10% total ' + t + ' returned ' + after; if (!throws(() => c.applyDiscount(101)) || !throws(() => c.applyDiscount(-1))) return 'bad pct did not throw';`)],
  ['B5', 'u3_cart.js', JS('u3_cart.js', `const C = get('Cart'); const c = new C(); c.addItem('x', 0.1, 3); if (c.total() !== 0.3) return '0.1*3 total ' + c.total(); const d = new C(); d.addItem('y', 10.126, 1); if (Math.abs(d.total() - 10.13) > 1e-9) return '10.126 total ' + d.total();`)],
  ['B7', 'u4_flatten.js', JS('u4_flatten.js', `const f = get('flatten'); if (!same(f({ a: { b: 1 } }), { 'a.b': 1 })) return 'basic'; const r = f({ a: { b: { c: 2 } }, d: 3 }); if (r['a.b.c'] !== 2 || r.d !== 3) return 'deep ' + JSON.stringify(r);`)],
  ['B11', 'u6_wrap.py', PY('u6_wrap.py', `s = "the quick brown fox jumps over the lazy dog"
r = M.wrap(s, 10)
lines = r if isinstance(r, list) else r.split(NL)
if any(len(l) > 10 for l in lines): return 'line too long ' + repr(lines)
if " ".join(" ".join(lines).split()) != s: return 'words changed ' + repr(lines)`)],
  ['B12', 'u7_semver.js', JS('u7_semver.js', `const c = get('compare'); if (c('1.10.2', '1.9.9') !== 1) return '1.10.2 vs 1.9.9'; if (c('1.0.0', '1.0.0') !== 0) return 'equal'; if (c('1.2.0', '1.10.0') !== -1) return '1.2 vs 1.10';`)],
  ['B13', 'u7_semver.js', JS('u7_semver.js', `const c = get('compare'); if (c('1.0.0-beta', '1.0.0') !== -1) return 'beta before release'; if (c('1.0.0', '1.0.0-beta') !== 1) return 'release after beta'; if (c('1.0.0-rc.1', '1.0.0') !== -1) return 'rc.1'; if (c('1.10.2', '1.9.9') !== 1) return 'existing broke';`)],
  ['B16', 'u9_deep.py', PY('u9_deep.py', `d = {"a": {"b": [{"c": 5}]}}
if M.deep_get(d, "a.b.0.c") != 5: return 'path ' + repr(M.deep_get(d, "a.b.0.c"))
for p in ("a.x", "a.b.5.c", "z", "a.b.0.c.d"):
    if M.deep_get(d, p) is not None: return p + ' gave ' + repr(M.deep_get(d, p))`)],
  ['B17', 'u10_retry.js', JS('u10_retry.js', `const r = get('retry'); let n = 0; const v = await r(async () => { n++; if (n < 3) throw new Error('e' + n); return 'ok'; }, 3); if (v !== 'ok' || n !== 3) return 'eventual success ' + v + ' n=' + n;
    let m = 0, err = null; try { await r(async () => { m++; throw new Error('last' + m); }, 2); } catch (e) { err = e; } if (!err) return 'did not rethrow'; if (err.message !== 'last2') return 'rethrew ' + err.message + ' after ' + m;`)],
  ['B19', 'u12_luhn.js', JS('u12_luhn.js', `const v = get('isValidCard'); if (v('4111111111111111') !== true || v('79927398713') !== true) return 'valid rejected'; if (v('4111111111111112') !== false || v('79927398710') !== false) return 'invalid accepted';`)],
];

function run(ws, file, script, neutral) {
  const py = file.endsWith('.py');
  const r = py ? spawnSync('python', [...(neutral ? ['-O'] : []), '-c', script], { cwd: ws, encoding: 'utf8', timeout: 30000 })
    : spawnSync(process.execPath, [...(neutral ? ['-r', NEUTRAL] : []), '-e', script], { cwd: ws, encoding: 'utf8', timeout: 30000 });
  const line = (r.stdout || '').split('\n').reverse().find((l) => l.startsWith('RESULT '));
  return line ? JSON.parse(line.slice(7)) : { pass: false, why: 'no result: ' + (r.stderr || '').trim().split('\n').slice(-1)[0], NX: [] };
}
let p = 0, impl = 0; const n = A.length + B.length;
for (const [ws, list] of [[wsA, A], [wsB, B]]) for (const [goal, file, script] of list) {
  const a = run(ws, file, script, false), b = run(ws, file, script, true);
  const nx = [...new Set([...(a.NX || []), ...(b.NX || [])])];
  const tag = a.pass ? (nx.length ? 'NX' : 'P ') : (b.pass ? (nx.length ? 'NX' : 'CT') : 'F ');
  if (a.pass) p++; if (a.pass || b.pass) impl++;
  console.log(`${goal.padEnd(4)} ${tag} ${file.padEnd(16)} ${a.pass ? '' : a.why}${!a.pass && !b.pass && b.why !== a.why ? ' | impl: ' + b.why : ''}${nx.length ? ' | not exported: ' + nx.join(',') : ''}`);
}
console.log(`\ncode goals: pass as-is ${p}/${n} | implementation correct ${impl}/${n} (first pass; hand-grading decides)`);
