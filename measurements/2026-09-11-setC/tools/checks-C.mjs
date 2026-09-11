// checks-C.mjs <workspaceDir> [--out results.json] : the hidden checks for set C (40 chained goals).
//
// Every step is checked on the FINAL workspace, after all 40 goals have run, so a later step that
// breaks an earlier one fails that earlier step - the long-run skill this set exists to measure.
// Each step is scored twice:
//   asIs  the module loaded exactly as the model left it, its own asserts included  -> "done as asked"
//   impl  the model's own asserts neutralised (neutral.cjs for node, python -O)     -> "implementation correct"
// Written and validated (40/40 on refs/, 0/40 on an empty workspace) before any model ran the goals.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const NEUTRAL = join(HERE, 'neutral.cjs');
const args = process.argv.slice(2);
const ws = resolve(args[0] || '.');
const outAt = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;

const JS_PRELUDE = `
const steps = [];
const step = (fn) => { try { const r = fn(); steps.push(r === true || r === undefined ? { pass: true } : { pass: false, why: String(r).slice(0, 160) }); }
  catch (e) { steps.push({ pass: false, why: 'threw: ' + String((e && e.message) || e).slice(0, 140) }); } };
const throws = (fn) => { try { fn(); return false; } catch { return true; } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const near = (a, b) => Array.isArray(a) && a.length === b.length && a.every((row, i) => row.length === b[i].length && row.every((v, j) => Math.abs(v - b[i][j]) < 1e-9));
const done = () => console.log('RESULT ' + JSON.stringify({ steps }));
const load = (f) => { try { return require('./' + f); } catch (e) { console.log('RESULT ' + JSON.stringify({ load: 'load: ' + String((e && e.message) || e).slice(0, 160) })); process.exit(0); } };
const pick = (m, name) => (m && typeof m[name] === 'function') ? m[name] : (typeof m === 'function' && (m.name === name || !name) ? m : undefined);
`;

const CHAINS = [
  { file: 's1_bank.js', lang: 'js', steps: 4, script: `
const M = load('s1_bank.js'); const Bank = pick(M, 'Bank') || M;
step(() => { const b = new Bank(); b.open('a'); b.deposit('a', 5); if (b.balance('a') !== 5) return 'balance ' + b.balance('a');
  if (!throws(() => b.deposit('x', 1))) return 'deposit to an unknown account did not throw';
  if (!throws(() => b.deposit('a', 0))) return 'deposit of 0 did not throw';
  if (!throws(() => b.deposit('a', -1))) return 'negative deposit did not throw';
  if (!throws(() => b.balance('x'))) return 'balance of an unknown account did not throw';
  if (b.balance('a') !== 5) return 'a failed deposit changed the balance'; });
step(() => { const b = new Bank(); b.open('a'); b.deposit('a', 10); b.withdraw('a', 4); if (b.balance('a') !== 6) return 'after withdraw ' + b.balance('a');
  if (!throws(() => b.withdraw('a', 7))) return 'overdraw did not throw'; if (b.balance('a') !== 6) return 'a failed withdraw changed the balance';
  if (!throws(() => b.withdraw('a', 0))) return 'withdraw of 0 did not throw'; if (!throws(() => b.withdraw('zz', 1))) return 'withdraw from an unknown account did not throw'; });
step(() => { const b = new Bank(); b.open('a'); b.open('b'); b.deposit('a', 10); b.transfer('a', 'b', 3);
  if (b.balance('a') !== 7 || b.balance('b') !== 3) return 'after transfer a=' + b.balance('a') + ' b=' + b.balance('b');
  if (!throws(() => b.transfer('a', 'b', 100))) return 'transfer beyond the balance did not throw';
  if (b.balance('a') !== 7 || b.balance('b') !== 3) return 'a failed transfer changed balances';
  if (!throws(() => b.transfer('a', 'zz', 1))) return 'transfer to an unknown account did not throw';
  if (b.balance('a') !== 7) return 'a transfer to an unknown account still took money'; });
step(() => { const b = new Bank(); b.open('a'); b.open('b'); b.deposit('a', 10); b.withdraw('a', 2); try { b.withdraw('a', 100); } catch {} b.transfer('a', 'b', 3);
  const norm = (h) => (h || []).map((e) => ({ type: e.type, amount: e.amount }));
  const ha = norm(b.history('a')), hb = norm(b.history('b'));
  if (!same(ha, [{ type: 'deposit', amount: 10 }, { type: 'withdraw', amount: 2 }, { type: 'transfer-out', amount: 3 }])) return 'history(a) ' + JSON.stringify(ha).slice(0, 120);
  if (!same(hb, [{ type: 'transfer-in', amount: 3 }])) return 'history(b) ' + JSON.stringify(hb).slice(0, 80); });
done();` },
  { file: 's2_text.py', lang: 'py', steps: 5, script: `
import importlib.util, io, contextlib, json, os, sys, tempfile, subprocess
steps = []
def step(fn):
    try:
        r = fn()
        steps.append({"pass": True} if r in (True, None) else {"pass": False, "why": str(r)[:160]})
    except BaseException as e:
        steps.append({"pass": False, "why": "threw: " + (type(e).__name__ + ": " + str(e))[:140]})
buf = io.StringIO()
_argv = sys.argv
_fake = os.path.join(tempfile.mkdtemp(), "argv.txt")
with open(_fake, "w", encoding="utf-8") as _f: _f.write("zz zz yy")
sys.argv = ["s2_text.py", _fake, "1"]
try:
    spec = importlib.util.spec_from_file_location("s2mod", os.path.join(os.getcwd(), "s2_text.py"))
    M = importlib.util.module_from_spec(spec)
    with contextlib.redirect_stdout(buf):
        spec.loader.exec_module(M)
except BaseException as e:
    print("RESULT " + json.dumps({"load": "load: " + (type(e).__name__ + ": " + str(e))[:160]})); sys.exit(0)
sys.argv = _argv
printed = buf.getvalue()
def s1():
    r = M.word_count("Hello, hello world!")
    if r != {"hello": 2, "world": 1}: return "word_count gave " + repr(r)[:100]
    if M.word_count("") != {}: return "word_count('') was not {}"
def s2():
    r = [list(x) for x in M.top_words("b a b c a b", 2)]
    if r != [["b", 3], ["a", 2]]: return "top_words gave " + repr(r)[:100]
    r2 = [list(x) for x in M.top_words("y x", 2)]
    if r2 != [["x", 1], ["y", 1]]: return "tie order gave " + repr(r2)[:100]
def s3():
    r = M.word_count("Don't stop 'quoted' it's")
    if r != {"don't": 1, "stop": 1, "quoted": 1, "it's": 1}: return "apostrophes gave " + repr(r)[:120]
def s4():
    d = tempfile.mkdtemp(); p = os.path.join(d, "t.txt")
    with open(p, "w", encoding="utf-8") as f: f.write("a a b")
    r = M.read_file_counts(p)
    if r != {"a": 2, "b": 1}: return "read_file_counts gave " + repr(r)[:100]
    try:
        M.read_file_counts(os.path.join(d, "missing.txt")); return "a missing file did not raise"
    except FileNotFoundError: pass
def s5():
    if printed.strip(): return "importing printed: " + printed.strip()[:80]
    d = tempfile.mkdtemp(); p = os.path.join(d, "t.txt")
    with open(p, "w", encoding="utf-8") as f: f.write("b a b c a b")
    flags = ["-O"] if not __debug__ else []
    out = subprocess.run([sys.executable] + flags + ["s2_text.py", p, "2"], capture_output=True, text=True, timeout=20)
    lines = [l.strip() for l in out.stdout.strip().splitlines() if l.strip()]
    if lines != ["b 3", "a 2"]: return "CLI printed " + repr(lines)[:100] + (" stderr " + out.stderr[-80:] if out.stderr else "")
for fn in (s1, s2, s3, s4, s5): step(fn)
print("RESULT " + json.dumps({"steps": steps}))` },
  { file: 's3_events.js', lang: 'js', steps: 5, script: `
const M = load('s3_events.js'); const EventBus = pick(M, 'EventBus') || M;
step(() => { const bus = new EventBus(); const calls = []; bus.on('e', (a, b) => calls.push(['1', a, b])); bus.on('e', (a) => calls.push(['2', a]));
  const n = bus.emit('e', 1, 2); if (n !== 2) return 'emit returned ' + n;
  if (!same(calls, [['1', 1, 2], ['2', 1]])) return 'calls ' + JSON.stringify(calls);
  if (bus.emit('none') !== 0) return 'emit of an event with no listeners did not return 0'; });
step(() => { const bus = new EventBus(); let f = 0, g = 0; const F = () => f++, G = () => g++; bus.on('e', F); bus.on('e', G); bus.off('e', F);
  const n = bus.emit('e'); if (n !== 1 || f !== 0 || g !== 1) return 'after off: returned ' + n + ' f=' + f + ' g=' + g;
  if (throws(() => bus.off('nothing', F))) return 'off of an unknown event threw';
  if (throws(() => bus.off('e', () => {}))) return 'off of a listener never added threw'; });
step(() => { const bus = new EventBus(); let k = 0; bus.once('e', () => k++);
  const a = bus.emit('e'), b = bus.emit('e'); if (k !== 1) return 'once ran ' + k + ' times'; if (a !== 1 || b !== 0) return 'emit returned ' + a + ' then ' + b; });
step(() => { const bus = new EventBus(); let ok = false; bus.on('e', () => { throw new Error('A'); }); bus.on('e', () => { ok = true; }); bus.on('e', () => { throw new Error('B'); });
  let err = null; try { bus.emit('e'); } catch (e) { err = e; }
  if (!ok) return 'a listener after a throwing one did not run'; if (!err) return 'emit did not rethrow'; if (String(err.message) !== 'A') return 'rethrew ' + err.message + ' instead of the first error'; });
step(() => { const bus = new EventBus(); const F = () => {}, G = () => {}; bus.on('e', F); bus.once('e', G);
  if (bus.listenerCount('e') !== 2) return 'count ' + bus.listenerCount('e'); bus.emit('e');
  if (bus.listenerCount('e') !== 1) return 'after emit ' + bus.listenerCount('e'); bus.off('e', F);
  if (bus.listenerCount('e') !== 0) return 'after off ' + bus.listenerCount('e'); if (bus.listenerCount('none') !== 0) return 'unknown event not 0'; });
done();` },
  { file: 's4_matrix.js', lang: 'js', steps: 5, script: `
const M = load('s4_matrix.js');
step(() => { if (!same(M.add([[1, 2], [3, 4]], [[5, 6], [7, 8]]), [[6, 8], [10, 12]])) return 'add wrong';
  if (!same(M.multiply([[1, 2, 3], [4, 5, 6]], [[7, 8], [9, 10], [11, 12]]), [[58, 64], [139, 154]])) return 'multiply wrong';
  if (!throws(() => M.add([[1, 2]], [[1], [2]]))) return 'add of mismatched shapes did not throw';
  if (!throws(() => M.multiply([[1, 2]], [[1, 2]]))) return 'multiply of mismatched shapes did not throw'; });
step(() => { if (!same(M.transpose([[1, 2, 3], [4, 5, 6]]), [[1, 4], [2, 5], [3, 6]])) return 'transpose wrong';
  if (!same(M.identity(3), [[1, 0, 0], [0, 1, 0], [0, 0, 1]])) return 'identity wrong'; });
step(() => { if (M.determinant([[1, 2], [3, 4]]) !== -2) return '2x2 det ' + M.determinant([[1, 2], [3, 4]]);
  if (Math.abs(M.determinant([[6, 1, 1], [4, -2, 5], [2, 8, 7]]) + 306) > 1e-9) return '3x3 det wrong';
  if (Math.abs(M.determinant(M.identity(4)) - 1) > 1e-9) return 'det(I4) not 1'; if (M.determinant([[5]]) !== 5) return '1x1 det wrong';
  if (!throws(() => M.determinant([[1, 2, 3], [4, 5, 6]]))) return 'det of a non-square matrix did not throw'; });
step(() => { if (!near(M.inverse([[4, 7], [2, 6]]), [[0.6, -0.7], [-0.2, 0.4]])) return 'inverse 2x2 wrong';
  if (!throws(() => M.inverse([[1, 2], [2, 4]]))) return 'inverse of a singular matrix did not throw';
  const m = [[2, -1, 0], [-1, 2, -1], [0, -1, 2]]; if (!near(M.multiply(m, M.inverse(m)), M.identity(3))) return 'm * inverse(m) is not the identity'; });
step(() => { if (!throws(() => M.add([], [[1]]))) return 'add([]) did not throw'; if (!throws(() => M.transpose([[1, 2], [3]]))) return 'ragged transpose did not throw';
  if (!throws(() => M.determinant([[1, 'a'], [2, 3]]))) return 'a non-number entry did not throw'; if (!throws(() => M.inverse('x'))) return 'inverse of a string did not throw';
  if (!throws(() => M.multiply([[1, 2]], 'no'))) return 'multiply by a string did not throw';
  if (!same(M.add([[1]], [[2]]), [[3]])) return 'valid input stopped working'; });
done();` },
  { file: 's5_cache.js', lang: 'js', steps: 5, script: `
const M = load('s5_cache.js'); const LRU = pick(M, 'LRUCache') || M;
const st = (c) => { const s = c.stats(); return { hits: s.hits, misses: s.misses, evictions: s.evictions }; };
step(() => { const c = new LRU(2); c.set('a', 1); c.set('b', 2); c.get('a'); c.set('c', 3);
  if (c.get('b') !== undefined) return 'the least recently used entry was not evicted'; if (c.get('a') !== 1 || c.get('c') !== 3) return 'the wrong entry was evicted'; });
step(() => { let t = 0; const c = new LRU(3, () => t); c.set('a', 1, 100); t = 50; if (c.get('a') !== 1) return 'expired too early';
  t = 100; if (c.get('a') !== undefined) return 'did not expire at ttl'; c.set('b', 2); t = 1e9; if (c.get('b') !== 2) return 'an entry without ttl expired';
  const d = new LRU(1, () => 0); d.set('x', 1); d.set('y', 2); if (d.get('x') !== undefined || d.get('y') !== 2) return 'LRU broken with a clock'; });
step(() => { const c = new LRU(1); c.set('a', 1); c.get('a'); c.get('zz'); c.set('b', 2); c.get('a');
  if (!same(st(c), { hits: 1, misses: 2, evictions: 1 })) return 'stats ' + JSON.stringify(st(c));
  let t = 0; const d = new LRU(2, () => t); d.set('x', 1, 10); t = 20; d.get('x'); if (st(d).misses !== 1 || st(d).hits !== 0) return 'an expired get was not a miss ' + JSON.stringify(st(d)); });
step(() => { const c = new LRU(2); c.set('a', 1); if (c.delete('a') !== true) return 'delete did not return true'; if (c.delete('a') !== false) return 'second delete did not return false';
  if (c.get('a') !== undefined) return 'deleted entry still there'; c.set('b', 2); c.clear(); if (c.get('b') !== undefined) return 'clear left entries';
  if (!same(st(c), { hits: 0, misses: 2, evictions: 0 })) return 'delete/clear changed stats ' + JSON.stringify(st(c)); });
step(() => { for (const bad of [0, 1.5, -1, '3']) if (!throws(() => new LRU(bad))) return 'capacity ' + JSON.stringify(bad) + ' did not throw';
  const c = new LRU(1); if (!throws(() => c.set('a', 1, -5))) return 'ttl -5 did not throw'; if (!throws(() => c.set('a', 1, 0))) return 'ttl 0 did not throw';
  c.set('a', 1, 10); if (c.get('a') !== 1) return 'a valid ttl stopped working'; });
done();` },
  { file: 's6_parser.js', lang: 'js', steps: 5, script: `
const M = load('s6_parser.js');
const tv = (t) => (t !== null && typeof t === 'object') ? (t.value ?? t.text ?? t.token ?? t.val ?? t.v) : t;
step(() => { const toks = M.tokenize('12+3.5*(2)').map(tv).map(String); if (!same(toks, ['12', '+', '3.5', '*', '(', '2', ')'])) return 'tokens ' + JSON.stringify(toks);
  if (!throws(() => M.tokenize('2 $ 3'))) return "'$' did not throw"; if (!same(M.tokenize(' 7 ').map(tv).map(String), ['7'])) return 'whitespace not skipped'; });
step(() => { const E = M.evaluate; if (E('2+3*4') !== 14) return '2+3*4 = ' + E('2+3*4'); if (E('(2+3)*4') !== 20) return '(2+3)*4 wrong';
  if (E('10/4') !== 2.5) return '10/4 wrong'; if (E('8-3-2') !== 3) return '8-3-2 = ' + E('8-3-2');
  for (const bad of ['1/0', '2+', '(1']) if (!throws(() => E(bad))) return JSON.stringify(bad) + ' did not throw'; });
step(() => { const E = M.evaluate; for (const [x, v] of [['-3', -3], ['-(2+1)', -3], ['4*-2', -8], ['2--1', 3]]) if (E(x) !== v) return x + ' = ' + E(x); });
step(() => { const E = M.evaluate; if (E('x*2+y', { x: 3, y: 1 }) !== 7) return 'x*2+y wrong'; if (E('rate_2*10', { rate_2: 0.5 }) !== 5) return 'rate_2 wrong';
  let msg = null; try { E('z+1'); } catch (e) { msg = String(e.message); } if (msg === null) return 'unknown name did not throw'; if (!/z/.test(msg)) return 'error does not name z: ' + msg;
  if (E('2+2') !== 4) return 'evaluate without vars broke'; });
step(() => { const E = M.evaluate; for (const [x, v] of [['2^3^2', 512], ['-2^2', -4], ['2*3^2', 18], ['2^-1', 0.5], ['(2^3)^2', 64]]) if (E(x) !== v) return x + ' = ' + E(x); });
done();` },
  { file: 's7_todo.py', lang: 'py', steps: 5, script: `
import importlib.util, io, contextlib, json, os, sys, tempfile
steps = []
def step(fn):
    try:
        r = fn()
        steps.append({"pass": True} if r in (True, None) else {"pass": False, "why": str(r)[:160]})
    except BaseException as e:
        steps.append({"pass": False, "why": "threw: " + (type(e).__name__ + ": " + str(e))[:140]})
try:
    spec = importlib.util.spec_from_file_location("s7mod", os.path.join(os.getcwd(), "s7_todo.py"))
    M = importlib.util.module_from_spec(spec)
    with contextlib.redirect_stdout(io.StringIO()):
        spec.loader.exec_module(M)
except BaseException as e:
    print("RESULT " + json.dumps({"load": "load: " + (type(e).__name__ + ": " + str(e))[:160]})); sys.exit(0)
T = M.TodoList
def tmp(): return os.path.join(tempfile.mkdtemp(), "todo.json")
def s1():
    t = T(); a = t.add("a"); b = t.add("b"); c = t.add("c")
    if not all(isinstance(x, int) for x in (a, b, c)) or len({a, b, c}) != 3: return "ids " + repr((a, b, c))
    t.done(b)
    if t.pending() != ["a", "c"]: return "pending " + repr(t.pending())
def s2():
    t = T(); x = t.add("x"); t.add("y"); t.remove(x)
    if t.pending() != ["y"]: return "after remove " + repr(t.pending())
    for name in ("remove", "done"):
        try: getattr(t, name)(999); return name + "(999) did not raise"
        except KeyError: pass
def s3():
    t = T(); i1 = t.add("a"); i2 = t.add("b"); i3 = t.add("c"); t.done(i2); p = tmp(); t.save(p)
    u = T.load(p)
    if u.pending() != ["a", "c"]: return "loaded pending " + repr(u.pending())
    n = u.add("d")
    if n <= max(i1, i2, i3): return "id reused or not increasing: " + repr(n)
    if u.pending() != ["a", "c", "d"]: return "after add " + repr(u.pending())
def s4():
    t = T(); t.add("a"); t.add("b", 2); t.add("c", 2); t.add("d", 1)
    if t.pending() != ["b", "c", "d", "a"]: return "priority order " + repr(t.pending())
    t.add("e", priority=3)
    if t.pending()[0] != "e": return "keyword priority ignored"
    p = tmp(); t.save(p)
    if T.load(p).pending() != t.pending(): return "save/load lost priorities"
def s5():
    t = T(); x = t.add("x", due="2026-09-01"); t.add("y", due="2026-10-01"); t.add("z")
    if t.overdue("2026-09-15") != ["x"]: return "overdue " + repr(t.overdue("2026-09-15"))
    t.done(x)
    if t.overdue("2026-09-15") != []: return "a done item was still overdue"
    try: t.add("bad", due="not a date"); return "a bad due date did not raise ValueError"
    except ValueError: pass
    p = tmp(); t.save(p)
    if T.load(p).overdue("2026-10-02") != ["y"]: return "save/load lost due dates"
for fn in (s1, s2, s3, s4, s5): step(fn)
print("RESULT " + json.dumps({"steps": steps}))` },
  { file: 's8_router.js', lang: 'js', steps: 5, script: `
const M = load('s8_router.js'); const Router = pick(M, 'Router') || M;
step(() => { const r = new Router(); r.add('GET', '/users/:id', (req) => 'user ' + req.params.id); r.add('GET', '/echo', (req) => req.method + ' ' + req.path);
  if (r.handle('GET', '/users/7') !== 'user 7') return 'params: ' + r.handle('GET', '/users/7');
  if (r.handle('GET', '/users/7/x') !== '404') return 'extra segment matched'; if (r.handle('GET', '/nope') !== '404') return 'unknown path not 404';
  if (r.handle('GET', '/echo') !== 'GET /echo') return 'request object: ' + r.handle('GET', '/echo'); });
step(() => { const r = new Router(); r.add('GET', '/search', (req) => JSON.stringify(req.query)); r.add('GET', '/users/:id', (req) => 'user ' + req.params.id);
  const q = JSON.parse(r.handle('GET', '/search?q=cats&page=2')); if (q.q !== 'cats' || q.page !== '2') return 'query ' + JSON.stringify(q);
  if (r.handle('GET', '/users/9?x=1') !== 'user 9') return 'params with a query broke'; });
step(() => { const r = new Router(); r.add('GET', '/files/*', (req) => req.params['*']);
  if (r.handle('GET', '/files/a/b') !== 'a/b') return 'wildcard gave ' + r.handle('GET', '/files/a/b');
  if (r.handle('GET', '/files/x') !== 'x') return 'one segment gave ' + r.handle('GET', '/files/x');
  if (r.handle('GET', '/files') !== '404') return "'/files' matched the wildcard"; });
step(() => { const r = new Router(); const log = []; r.use(() => { log.push(1); }); r.use((req) => (req.path === '/blocked' ? 'denied' : undefined));
  r.add('GET', '/blocked', () => 'handler'); r.add('GET', '/ok', () => 'fine');
  if (r.handle('GET', '/blocked') !== 'denied') return 'middleware did not short-circuit'; if (r.handle('GET', '/ok') !== 'fine') return 'normal route broke';
  if (log.length !== 2) return 'first middleware ran ' + log.length + ' times'; });
step(() => { const r = new Router(); r.add('GET', '/items', () => 'list');
  if (r.handle('POST', '/items') !== '405') return 'wrong method gave ' + r.handle('POST', '/items');
  if (r.handle('GET', '/other') !== '404') return 'unknown path gave ' + r.handle('GET', '/other');
  if (r.handle('GET', '/items') !== 'list') return 'the right method broke'; });
done();` },
];

function run(chain, neutral) {
  if (!existsSync(join(ws, chain.file))) return { load: 'missing ' + chain.file };
  const r = chain.lang === 'js'
    ? spawnSync(process.execPath, [...(neutral ? ['-r', NEUTRAL] : []), '-e', JS_PRELUDE + chain.script], { cwd: ws, encoding: 'utf8', timeout: 30000 })
    : spawnSync('python', [...(neutral ? ['-O'] : []), '-c', chain.script], { cwd: ws, encoding: 'utf8', timeout: 60000 });
  const line = (r.stdout || '').split('\n').reverse().find((l) => l.startsWith('RESULT '));
  if (!line) return { load: 'no result: ' + ((r.stderr || '') + (r.stdout || '')).trim().split('\n').slice(-2).join(' | ').slice(0, 160) };
  return JSON.parse(line.slice(7));
}

const results = [];
for (const chain of CHAINS) {
  const a = run(chain, false), b = run(chain, true);
  for (let i = 0; i < chain.steps; i++) {
    const sa = a.steps ? a.steps[i] : { pass: false, why: a.load }, sb = b.steps ? b.steps[i] : { pass: false, why: b.load };
    results.push({ file: chain.file, asIs: !!(sa && sa.pass), impl: !!(sb && sb.pass), why: (sa && !sa.pass ? sa.why : (sb && !sb.pass ? 'impl: ' + sb.why : '')) || '' });
  }
  if (chain.file === 's1_bank.js') {
    // goal 5: the notes must name every public method and say when it throws
    const p = join(ws, 'S1_NOTES.md');
    let why = '';
    if (!existsSync(p)) why = 'S1_NOTES.md missing';
    else {
      const t = readFileSync(p, 'utf8');
      const missingNames = ['open', 'deposit', 'balance', 'withdraw', 'transfer', 'history'].filter((n) => !new RegExp('\\b' + n + '\\b').test(t));
      if (missingNames.length) why = 'notes miss ' + missingNames.join(', ');
      else if (!/insufficient|not enough|enough money|overdraw/i.test(t)) why = 'notes never say withdraw/transfer throw on insufficient funds';
    }
    results.push({ file: 'S1_NOTES.md', asIs: !why, impl: !why, why });
  }
}
results.forEach((r, i) => { r.goal = i + 1; });
const asIs = results.filter((r) => r.asIs).length, impl = results.filter((r) => r.impl).length;
for (const r of results) console.log(`${String(r.goal).padStart(2)} ${r.asIs ? 'PASS' : (r.impl ? 'CT  ' : 'fail')} ${r.file.padEnd(13)} ${r.why.slice(0, 110)}`);
console.log(`\ndone as asked ${asIs}/40 | implementation correct ${impl}/40 (CT = correct code, own test broke it)`);
if (outAt) writeFileSync(outAt, JSON.stringify({ ws, asIs, impl, results }, null, 2));
