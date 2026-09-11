// checks-E.mjs <workspaceDir> [--out results.json] : hidden checks for set E (100 goals, 10 projects x 10 steps, interleaved).
// Same design as checks-D.mjs: every step checked on the FINAL workspace; goal = (step - 1) * 10 + project; code steps
// scored asIs (own asserts run) and impl (own asserts neutralised); q9 (web shop) driven in puppeteer with the hub's
// launch options; Q1_NOTES.md and Q_INDEX.md checked against the real source (every public name, no invented ones).
// ONLY=1,9 checks just those projects (mutation runs). Validated before any model ran: refs/ 100/100, empty 0/100, mutants.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import http from 'node:http';

const HERE = dirname(fileURLToPath(import.meta.url));
const NEUTRAL = join(HERE, 'neutral.cjs');
const HUB = 'C:/Users/tatte/Projects/ai-coding-hub/server/';
const args = process.argv.slice(2);
const ws = resolve(args[0] || '.');
const outAt = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;
const ENV = { ...process.env, PYTHONDONTWRITEBYTECODE: '1', PYTHONIOENCODING: 'utf-8' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

const JS_PRELUDE = `
const steps = [];
const step = (fn) => { try { const r = fn(); steps.push(r === true || r === undefined ? { pass: true } : { pass: false, why: String(r).slice(0, 160) }); }
  catch (e) { steps.push({ pass: false, why: 'threw: ' + String((e && e.message) || e).slice(0, 140) }); } };
const throws = (fn) => { try { fn(); return false; } catch { return true; } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const approx = (a, b) => typeof a === 'number' && Math.abs(a - b) < 1e-9;
const done = () => console.log('RESULT ' + JSON.stringify({ steps }));
const load = (f) => { try { return require('./' + f); } catch (e) { console.log('RESULT ' + JSON.stringify({ load: 'load: ' + String((e && e.message) || e).slice(0, 160) })); process.exit(0); } };
const pick = (m, name) => (m && typeof m[name] === 'function') ? m[name] : (typeof m === 'function' && (m.name === name || !name) ? m : undefined);
const sortKeys = (o) => Object.fromEntries(Object.entries(o || {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
`;

const PY_PRELUDE = `
import importlib.util, io, contextlib, json, os, sys, tempfile, subprocess, copy
steps = []
NL = chr(10)
def step(fn):
    try:
        r = fn()
        steps.append({"pass": True} if r in (True, None) else {"pass": False, "why": str(r)[:160]})
    except BaseException as e:
        steps.append({"pass": False, "why": "threw: " + (type(e).__name__ + ": " + str(e))[:140]})
def raises(f, exc):
    try:
        f()
        return False
    except exc:
        return True
def load(file, argv=None):
    buf = io.StringIO()
    old = sys.argv
    if argv is not None:
        sys.argv = argv
    try:
        spec = importlib.util.spec_from_file_location(file[:-3] + "_mod", os.path.join(os.getcwd(), file))
        M = importlib.util.module_from_spec(spec)
        with contextlib.redirect_stdout(buf):
            spec.loader.exec_module(M)
    except BaseException as e:
        print("RESULT " + json.dumps({"load": "load: " + (type(e).__name__ + ": " + str(e))[:160]}))
        sys.exit(0)
    finally:
        sys.argv = old
    return M, buf.getvalue()
def done():
    print("RESULT " + json.dumps({"steps": steps}))
class Clock:
    def __init__(self):
        self.t = 0.0
    def __call__(self):
        return self.t
def run_cli(file, *args):
    flags = [] if __debug__ else ["-O"]
    env = dict(os.environ, PYTHONIOENCODING="utf-8", PYTHONDONTWRITEBYTECODE="1")
    out = subprocess.run([sys.executable] + flags + [file, *args], capture_output=True, timeout=30, env=env)
    return out.stdout.decode("utf-8", "replace"), out.stderr.decode("utf-8", "replace")
`;

// ---------------------------------------------------------------- q1 warehouse (9 code steps; step 10 = notes)
const Q1 = `
const M = load('q1_stock.js'); const W = pick(M, 'Warehouse') || M;
step(() => { const w = new W(); w.addItem('apple', 5); if (w.stock('apple') !== 5) return 'stock ' + w.stock('apple'); if (w.stock('x') !== 0) return 'an unknown sku is not 0';
  w.addItem('pear', 2); w.addItem('apple', 1); if (!same(w.skus(), ['apple', 'pear'])) return 'skus ' + JSON.stringify(w.skus()); if (w.stock('apple') !== 6) return 'a second add';
  for (const bad of [0, -1, 1.5, '2']) if (!throws(() => w.addItem('z', bad))) return 'addItem ' + JSON.stringify(bad) + ' did not throw'; });
step(() => { const w = new W(); w.addItem('a', 5); w.remove('a', 2); if (w.stock('a') !== 3) return 'after remove ' + w.stock('a');
  if (!throws(() => w.remove('a', 10))) return 'removing too much did not throw'; if (!throws(() => w.remove('a', 0))) return 'remove 0 did not throw'; if (w.stock('a') !== 3) return 'a failed remove changed the stock'; });
step(() => { const w = new W(); w.addItem('a', 3); w.reserve('a', 2, 'o1'); if (w.available('a') !== 1 || w.stock('a') !== 3) return 'available ' + w.available('a') + ' stock ' + w.stock('a');
  if (!throws(() => w.reserve('a', 5, 'o2'))) return 'reserving too much did not throw'; if (!throws(() => w.reserve('a', 1, 'o1'))) return 'a second reservation by the same order did not throw';
  if (w.available('a') !== 1) return 'a failed reserve changed available'; });
step(() => { const w = new W(); w.addItem('a', 5); w.addItem('b', 5); w.reserve('a', 2, 'o1'); w.reserve('b', 1, 'o1'); const n = w.release('o1'); if (n !== 3) return 'release returned ' + n;
  if (w.available('a') !== 5 || w.available('b') !== 5) return 'not freed'; if (w.release('nope') !== 0) return 'an unknown order did not return 0'; });
step(() => { const w = new W(); w.addItem('a', 5); w.reserve('a', 2, 'o1'); w.fulfil('o1'); if (w.stock('a') !== 3 || w.available('a') !== 3) return 'after fulfil stock ' + w.stock('a') + ' available ' + w.available('a');
  if (!throws(() => w.fulfil('o1'))) return 'fulfilling twice did not throw'; if (!throws(() => w.fulfil('zz'))) return 'an unknown order did not throw'; });
step(() => { const w = new W(); w.addItem('a', 5); w.reserve('a', 4, 'o1'); if (!throws(() => w.remove('a', 2))) return 'reserved units were removed'; if (w.stock('a') !== 5) return 'a refused remove changed the stock';
  w.remove('a', 1); if (w.stock('a') !== 4 || w.available('a') !== 0) return 'removing the available unit'; });
step(() => { const w = new W(); w.addItem('apple', 5); w.addItem('pear', 3); w.reserve('apple', 4, 'o1');
  if (!same(w.lowStock(2), ['apple'])) return 'lowStock(2) ' + JSON.stringify(w.lowStock(2)); if (!same(w.lowStock(10), ['apple', 'pear'])) return 'lowStock(10)'; if (!same(w.lowStock(1), [])) return 'lowStock(1)'; });
step(() => { const w = new W(); w.addItem('b', 2); w.addItem('a', 5); w.reserve('a', 1, 'o2'); w.reserve('b', 1, 'o1'); w.reserve('a', 2, 'o1');
  const j = JSON.parse(JSON.stringify(w.toJSON()));
  if (!same(sortKeys(j.stock), { a: 5, b: 2 })) return 'toJSON stock ' + JSON.stringify(j.stock);
  if (!same((j.reservations || []).map((r) => ({ orderId: r.orderId, sku: r.sku, qty: r.qty })), [{ orderId: 'o1', sku: 'a', qty: 2 }, { orderId: 'o1', sku: 'b', qty: 1 }, { orderId: 'o2', sku: 'a', qty: 1 }])) return 'toJSON reservations ' + JSON.stringify(j.reservations);
  const v = W.fromJSON(j); if (v.available('a') !== 2 || v.stock('b') !== 2 || v.available('b') !== 1) return 'fromJSON state';
  const k = JSON.parse(JSON.stringify(v.toJSON())); if (!same(sortKeys(k.stock), sortKeys(j.stock)) || !same(k.reservations, j.reservations)) return 'round trip'; });
step(() => { const w = new W(); w.addItem('a', 5); w.remove('a', 1); try { w.remove('a', 100); } catch {} w.reserve('a', 2, 'o1'); w.release('o1'); w.reserve('a', 1, 'o2'); w.fulfil('o2');
  const h = (w.history('a') || []).map((e) => { const o = { type: e.type, qty: e.qty }; if (e.orderId !== undefined && e.orderId !== null) o.orderId = e.orderId; return o; });
  const want = [{ type: 'add', qty: 5 }, { type: 'remove', qty: 1 }, { type: 'reserve', qty: 2, orderId: 'o1' }, { type: 'release', qty: 2, orderId: 'o1' }, { type: 'reserve', qty: 1, orderId: 'o2' }, { type: 'fulfil', qty: 1, orderId: 'o2' }];
  if (!same(h, want)) return 'history ' + JSON.stringify(h).slice(0, 200); });
done();`;

// ---------------------------------------------------------------- q3 calendar
const Q3 = `
const M = load('q3_calendar.js'); const C = pick(M, 'Calendar') || M;
const ids = (xs) => (xs || []).map((x) => x.id);
step(() => { const c = new C(); c.add('b', 600, 660); c.add('a', 540, 600); const g = c.get('a'); if (!g || g.id !== 'a' || g.start !== 540 || g.end !== 600) return 'get ' + JSON.stringify(g);
  if (c.get('zz') !== null) return 'get of an unknown id is not null'; if (!same(ids(c.list()), ['a', 'b'])) return 'list ' + JSON.stringify(c.list());
  if (!throws(() => c.add('a', 700, 710))) return 'a duplicate id did not throw';
  for (const [s, e] of [[600, 540], [-1, 10], [0, 1441], [1.5, 10], [5, 5]]) if (!throws(() => c.add('x' + s, s, e))) return 'range ' + s + '-' + e + ' did not throw'; });
step(() => { const c = new C(); c.add('a', 540, 600); c.add('b', 600, 660); if (!same(c.conflicts(590, 610), ['a', 'b'])) return 'conflicts(590,610) ' + JSON.stringify(c.conflicts(590, 610));
  if (!same(c.conflicts(600, 610), ['b'])) return 'a touching meeting counted: ' + JSON.stringify(c.conflicts(600, 610)); if (!same(c.conflicts(0, 540), [])) return 'conflicts(0,540)'; });
step(() => { const c = new C(); c.add('a', 540, 600); if (!throws(() => c.add('b', 590, 620))) return 'an overlapping add did not throw'; if (c.get('b') !== null) return 'the refused meeting was stored';
  c.add('c', 600, 620); if (!c.get('c')) return 'a touching meeting was refused'; });
step(() => { const c = new C(); c.add('a', 540, 600); if (c.remove('a') !== true || c.remove('a') !== false) return 'remove return values'; if (c.get('a') !== null) return 'still there'; });
step(() => { const c = new C(); c.add('a', 540, 600); c.add('b', 660, 720); c.move('a', 600); const a = c.get('a'); if (!a || a.start !== 600 || a.end !== 660) return 'move ' + JSON.stringify(a);
  if (!throws(() => c.move('a', 630))) return 'an overlapping move did not throw'; if (c.get('a').start !== 600) return 'a refused move changed it';
  if (!throws(() => c.move('zz', 0))) return 'an unknown id did not throw'; if (!throws(() => c.move('a', 1400))) return 'moving past midnight did not throw'; });
step(() => { const c = new C(); c.add('a', 540, 600); c.add('b', 660, 720);
  if (!same(c.freeSlots(480, 780, 30), [[480, 540], [600, 660], [720, 780]])) return 'freeSlots ' + JSON.stringify(c.freeSlots(480, 780, 30));
  if (!same(c.freeSlots(480, 780, 61), [])) return 'minLength 61 ' + JSON.stringify(c.freeSlots(480, 780, 61)); if (!same(c.freeSlots(560, 700, 10), [[600, 660]])) return 'clipped ' + JSON.stringify(c.freeSlots(560, 700, 10)); });
step(() => { const c = new C(); c.add('a', 0, 60); c.add('b', 90, 100); if (c.firstFree(30) !== 60) return 'firstFree(30) ' + c.firstFree(30); if (c.firstFree(30, 70) !== 100) return 'firstFree(30,70) ' + c.firstFree(30, 70);
  const d = new C(); d.add('x', 0, 1440); if (d.firstFree(1) !== null) return 'a full day is not null'; });
step(() => { const f = M.formatTime, p = M.parseTime; if (typeof f !== 'function' || typeof p !== 'function') return 'formatTime/parseTime not exported';
  if (f(545) !== '09:05' || f(0) !== '00:00') return 'formatTime ' + f(545); if (p('09:05') !== 545 || p('23:59') !== 1439) return 'parseTime';
  for (const bad of ['24:00', '9:5', 'ab:cd', '12:60']) if (!throws(() => p(bad))) return JSON.stringify(bad) + ' was accepted'; });
step(() => { const c = new C(); c.add('b', 600, 660); c.add('a', 540, 600); const t = c.toText(); if (t !== '09:00-10:00 a\\n10:00-11:00 b') return 'toText ' + JSON.stringify(t); });
step(() => { const c = new C(); c.add('b', 600, 660); c.add('a', 540, 600); const t = c.toText(); if (C.fromText(t).toText() !== t) return 'round trip';
  if (!throws(() => C.fromText('9-10 a'))) return 'a malformed line was accepted'; if (!throws(() => C.fromText('09:00-10:00 a\\n09:30-10:30 b'))) return 'an overlap was accepted'; });
done();`;

// ---------------------------------------------------------------- q4 template engine
const Q4 = `
const M = load('q4_template.js'); const r = M.render;
step(() => { if (r('Hi {{name}}!', { name: 'Ann' }) !== 'Hi Ann!') return 'basic ' + r('Hi {{name}}!', { name: 'Ann' }); if (r('{{ name }}', { name: 'Bo' }) !== 'Bo') return 'spaces in the braces';
  if (r('[{{x}}]', {}) !== '[]') return 'a missing name is not empty'; if (r('{{a}}+{{b}}={{c}}', { a: 1, b: 2, c: 3 }) !== '1+2=3') return 'several names'; });
step(() => { if (r('{{user.name}}', { user: { name: 'Ann' } }) !== 'Ann') return 'dotted path'; if (r('[{{user.x.y}}]', { user: {} }) !== '[]') return 'a missing part'; if (r('{{a}}', { a: 'x' }) !== 'x') return 'plain names broke'; });
step(() => { const v = '<a href="x">&\\'</a>'; const e = r('{{v}}', { v }); if (e !== '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;') return 'escaped ' + e; if (r('{{{v}}}', { v }) !== v) return 'raw ' + r('{{{v}}}', { v }); });
step(() => { if (r('{{name | upper}}', { name: 'ann' }) !== 'ANN') return 'upper'; if (r('{{ name | trim | upper }}', { name: '  ann ' }) !== 'ANN') return 'chained filters';
  if (r('{{name|lower}}', { name: 'AnN' }) !== 'ann') return 'lower'; let msg = null; try { r('{{name | shout}}', { name: 'x' }); } catch (e) { msg = String(e.message); }
  if (msg === null) return 'an unknown filter did not throw'; if (!/shout/.test(msg)) return 'the error does not name the filter: ' + msg; });
step(() => { if (r('{{#items}}<{{.}}>{{/items}}', { items: ['a', 'b'] }) !== '<a><b>') return 'array ' + r('{{#items}}<{{.}}>{{/items}}', { items: ['a', 'b'] });
  if (r('{{#p}}{{name}},{{/p}}', { p: [{ name: 'x' }, { name: 'y' }] }) !== 'x,y,') return 'object elements';
  if (r('[{{#l}}x{{/l}}]', { l: [] }) !== '[]' || r('[{{#l}}x{{/l}}]', { l: false }) !== '[]') return 'empty or false rendered';
  if (r('{{#ok}}yes{{/ok}}', { ok: true }) !== 'yes') return 'true'; if (r('{{#u}}{{name}}{{/u}}', { u: { name: 'Z' } }) !== 'Z') return 'an object value'; });
step(() => { if (r('{{^items}}none{{/items}}', { items: [] }) !== 'none') return 'empty array'; if (r('{{^items}}none{{/items}}', {}) !== 'none') return 'missing value';
  if (r('[{{^items}}none{{/items}}]', { items: ['a'] }) !== '[]') return 'a non-empty list rendered the inverted block'; });
step(() => { let m1 = null, m2 = null; try { r('{{#alpha}}x', {}); } catch (e) { m1 = String(e.message); } try { r('{{#alpha}}x{{/beta}}', {}); } catch (e) { m2 = String(e.message); }
  if (m1 === null) return 'an unclosed section did not throw'; if (!/alpha/.test(m1)) return 'the unclosed error does not name alpha: ' + m1;
  if (m2 === null) return 'a mismatched close did not throw'; if (!/beta|alpha/.test(m2)) return 'the mismatch error names neither tag: ' + m2; });
step(() => { if (r('a{{! hidden }}b', {}) !== 'ab') return 'comment ' + r('a{{! hidden }}b', {}); });
step(() => { const got = r('{{> head}}!', { t: 'X' }, { head: '<{{t}}>' }); if (got !== '<X>!') return 'partial ' + got;
  let msg = null; try { r('{{> nope}}', {}, {}); } catch (e) { msg = String(e.message); } if (msg === null || !/nope/.test(msg)) return 'a missing partial: ' + msg; });
step(() => { if (typeof M.compile !== 'function') return 'compile is not exported'; const f = M.compile('{{a}}-{{#l}}{{.}}{{/l}}');
  if (f({ a: 1, l: [2, 3] }) !== '1-23') return 'compiled ' + f({ a: 1, l: [2, 3] }); if (f({ a: 'x', l: [] }) !== 'x-') return 'reuse';
  if (r('{{a}}-{{#l}}{{.}}{{/l}}', { a: 1, l: [2, 3] }) !== '1-23') return 'render changed'; });
done();`;

// ---------------------------------------------------------------- q7 text buffer
const Q7 = `
const M = load('q7_buffer.js'); const B = pick(M, 'TextBuffer') || M;
step(() => { const b = new B('hello'); b.insert(5, ' world'); if (b.text() !== 'hello world') return 'insert ' + b.text(); b.remove(0, 6); if (b.text() !== 'world') return 'remove ' + b.text();
  if (!throws(() => b.insert(99, 'x'))) return 'an insert out of range did not throw'; if (!throws(() => b.remove(3, 10))) return 'a remove out of range did not throw';
  if (b.text() !== 'world') return 'a refused edit changed the text'; if (new B().text() !== '') return 'the default text'; });
step(() => { const b = new B('ab'); b.insert(2, 'c'); b.remove(0, 1); if (b.text() !== 'bc') return 'setup ' + b.text();
  if (b.undo() !== true || b.text() !== 'abc') return 'first undo ' + b.text(); if (b.undo() !== true || b.text() !== 'ab') return 'second undo'; if (b.undo() !== false) return 'nothing to undo is not false';
  if (b.redo() !== true || b.text() !== 'abc') return 'redo'; b.insert(0, 'x'); if (b.redo() !== false || b.text() !== 'xabc') return 'a new edit did not clear redo'; });
step(() => { const b = new B('ab\\ncd\\n'); if (!same(b.lines(), ['ab', 'cd', ''])) return 'lines ' + JSON.stringify(b.lines()); const lc = b.lineCol(4); if (!lc || lc.line !== 1 || lc.col !== 1) return 'lineCol(4) ' + JSON.stringify(lc);
  if (b.posOf(1, 1) !== 4 || b.posOf(0, 0) !== 0) return 'posOf'; if (!throws(() => b.lineCol(99))) return 'lineCol out of range'; if (!throws(() => b.posOf(5, 0))) return 'posOf out of range'; });
step(() => { const b = new B('aXbXXc'); if (b.find('X') !== 1 || b.find('X', 2) !== 3 || b.find('Q') !== -1) return 'find'; if (!same(b.findAll('X'), [1, 3, 4])) return 'findAll ' + JSON.stringify(b.findAll('X'));
  if (!same(new B('aaaa').findAll('aa'), [0, 2])) return 'overlapping matches'; });
step(() => { const b = new B('a-b-c'); if (b.replaceAll('-', '+') !== 2 || b.text() !== 'a+b+c') return 'replaceAll ' + b.text(); if (b.undo() !== true || b.text() !== 'a-b-c') return 'one undo did not revert all: ' + b.text();
  if (b.replaceAll('z', 'y') !== 0) return 'no match is not 0'; });
step(() => { const b = new B('abc'); b.beginGroup(); b.insert(0, '1'); b.insert(4, '2'); b.endGroup(); if (b.text() !== '1abc2') return 'group edits ' + b.text();
  b.undo(); if (b.text() !== 'abc') return 'group undo ' + b.text(); b.redo(); if (b.text() !== '1abc2') return 'group redo ' + b.text(); });
step(() => { const b = new B('foo bar_2 baz'); const got = [b.wordAt(1), b.wordAt(3), b.wordAt(5), b.wordAt(9)]; if (!same(got, ['foo', 'foo', 'bar_2', 'bar_2'])) return 'wordAt ' + JSON.stringify(got);
  if (new B('a  b').wordAt(2) !== '') return 'between two spaces'; });
step(() => { const b = new B('', { maxUndo: 2 }); b.insert(0, 'a'); b.insert(1, 'b'); b.insert(2, 'c'); b.undo(); b.undo(); if (b.text() !== 'a') return 'maxUndo text ' + b.text(); if (b.undo() !== false) return 'kept more than maxUndo';
  const c = new B('x'); for (let i = 0; i < 5; i++) c.insert(0, 'y'); for (let i = 0; i < 5; i++) c.undo(); if (c.text() !== 'x') return 'the default buffer lost undo steps'; });
step(() => { const b = new B('ab'); b.insert(2, 'c'); b.insert(0, 'z'); b.undo(); const j = JSON.parse(JSON.stringify(b.toJSON()));
  const c = B.fromJSON(j); if (c.text() !== 'abc') return 'fromJSON text ' + c.text(); const d = B.fromJSON(j); if (!d.redo() || d.text() !== 'zabc') return 'redo after fromJSON ' + d.text();
  if (!c.undo() || c.text() !== 'ab') return 'undo after fromJSON ' + c.text(); });
step(() => { const s = new B('hi there\\nfoo_1').stats(); if (!same({ chars: s.chars, words: s.words, lines: s.lines }, { chars: 14, words: 3, lines: 2 })) return 'stats ' + JSON.stringify(s);
  const e = new B('').stats(); if (e.chars !== 0 || e.words !== 0 || e.lines !== 0) return 'empty stats ' + JSON.stringify(e); });
done();`;

// ---------------------------------------------------------------- q10 report (9 code steps; step 10 = index)
const Q10 = `
const R = load('q10_report.js'); let W = null; try { const m1 = require('./q1_stock.js'); W = pick(m1, 'Warehouse') || m1; } catch (e) {}
const need = () => { if (typeof W !== 'function') throw new Error('q1_stock.js does not give a Warehouse class'); };
const mk = () => { need(); const w = new W(); w.addItem('apple', 5); return w; };
const fn = (n) => { const f = R && R[n]; if (typeof f !== 'function') throw new Error(n + ' is not exported'); return f; };
step(() => { const got = fn('skuLine')(mk(), 'apple'); if (got !== 'apple: 5') return 'skuLine ' + JSON.stringify(got); });
step(() => { const got = fn('itemLine')(mk(), 'apple'); if (got !== 'apple has 5') return 'itemLine ' + JSON.stringify(got); });
step(() => { const w = mk(); w.reserve('apple', 2, 'o1'); const got = fn('reservedLine')(w, 'apple'); if (got !== 'apple: 3 of 5 free') return 'reservedLine ' + JSON.stringify(got); });
step(() => { const got = fn('shoutLine')(mk(), 'apple'); if (got !== 'APPLE: 5') return 'shoutLine ' + JSON.stringify(got); });
step(() => { const w = mk(); w.addItem('pear', 2); const got = fn('stockTable')(w); if (got !== 'apple=5;pear=2;') return 'stockTable ' + JSON.stringify(got); });
step(() => { need(); const e = fn('emptyNote')(new W()); if (e !== 'no stock') return 'empty warehouse ' + JSON.stringify(e); const w = mk(); w.addItem('pear', 2); const got = fn('emptyNote')(w); if (got !== 'apple pear ') return 'emptyNote ' + JSON.stringify(got); });
step(() => { const w = mk(); w.addItem('pear', 2); const got = fn('lowReport')(w, 3); if (got !== 'low: pear ') return 'lowReport ' + JSON.stringify(got); });
step(() => { const w = mk(); w.reserve('apple', 1, 'o1'); const got = fn('jsonReport')(w); if (got !== JSON.stringify(w.toJSON())) return 'jsonReport ' + String(got).slice(0, 120); });
step(() => { const w = mk(); w.remove('apple', 1); const got = fn('historyReport')(w, 'apple'); if (got !== 'history: add 5, remove 1, ') return 'historyReport ' + JSON.stringify(got); });
done();`;

// ---------------------------------------------------------------- q2 table toolkit (Python)
const Q2 = `
fake = os.path.join(tempfile.mkdtemp(), "t.csv")
with open(fake, "w", encoding="utf-8") as fh:
    fh.write("a,b" + NL + "1,2")
M, printed = load("q2_table.py", ["q2_table.py", fake])
ROWS = [{"name": "ann", "age": "30", "city": "x"}, {"name": "bob", "age": "4", "city": "y"}, {"name": "cy", "age": "30", "city": "x"}]
names = lambda rs: [r["name"] for r in rs]
def s1():
    t = "name,note" + NL + 'ann,"hi, there"' + NL + 'bob,"say ""yo"""'
    r = M.parse_csv(t)
    if r != [{"name": "ann", "note": "hi, there"}, {"name": "bob", "note": 'say "yo"'}]: return "parse_csv " + repr(r)[:140]
    if M.parse_csv("") != []: return "empty text"
def s2():
    rows = [{"a": "x,y", "b": 'he said "hi"'}, {"a": "plain", "b": ""}]
    t = M.to_csv(rows)
    if '"x,y"' not in t or '"he said ""hi"""' not in t: return "quoting " + repr(t)
    if not t.startswith("a,b"): return "headers " + repr(t[:20])
    if M.parse_csv(t) != rows: return "round trip " + repr(M.parse_csv(t))
    if M.to_csv(rows, ["b"]).split(NL)[0].strip() != "b": return "explicit headers"
def s3():
    s = M.select(ROWS, ["age", "name"])
    if s[0] != {"age": "30", "name": "ann"} or list(s[0].keys()) != ["age", "name"]: return "select " + repr(s[0])
    if not raises(lambda: M.select(ROWS, ["zz"]), KeyError): return "an unknown column did not raise KeyError"
def s4():
    if names(M.where(ROWS, "age", ">", "5")) != ["ann", "cy"]: return "numeric > " + repr(names(M.where(ROWS, "age", ">", "5")))
    if names(M.where(ROWS, "city", "=", "x")) != ["ann", "cy"]: return "="
    if names(M.where(ROWS, "name", "<", "b")) != ["ann"]: return "string <"
    if names(M.where(ROWS, "age", "!=", "30")) != ["bob"]: return "!="
    if not raises(lambda: M.where(ROWS, "age", "~", "1"), ValueError): return "an unknown op did not raise ValueError"
def s5():
    if names(M.order_by(ROWS, "age")) != ["bob", "ann", "cy"]: return "numeric order " + repr(names(M.order_by(ROWS, "age")))
    if names(M.order_by(ROWS, "age", descending=True)) != ["ann", "cy", "bob"]: return "descending, stable " + repr(names(M.order_by(ROWS, "age", descending=True)))
    if names(M.order_by(ROWS, "city")) != ["ann", "cy", "bob"]: return "string order"
def s6():
    if M.group_count(ROWS, "city") != {"x": 2, "y": 1}: return "group_count " + repr(M.group_count(ROWS, "city"))
def s7():
    rs = [{"g": "a", "v": "1"}, {"g": "a", "v": "2"}, {"g": "b", "v": "10"}]
    got = [M.aggregate(rs, "g", "v", f) for f in ("sum", "avg", "min", "max")]
    if got != [{"a": 3, "b": 10}, {"a": 1.5, "b": 10}, {"a": 1, "b": 10}, {"a": 2, "b": 10}]: return "aggregate " + repr(got)
    if M.aggregate([{"g": "a", "v": "1"}, {"g": "a", "v": "2"}, {"g": "a", "v": "2"}], "g", "v", "avg") != {"a": 1.67}: return "avg rounding"
    if not raises(lambda: M.aggregate(rs, "g", "v", "median"), ValueError): return "an unknown fn did not raise ValueError"
def s8():
    left = [{"id": "1", "name": "ann"}, {"id": "2", "name": "bob"}]
    right = [{"id": "1", "city": "x", "name": "Ann B"}, {"id": "1", "city": "y", "name": "A2"}, {"id": "3", "city": "z", "name": "C"}]
    got = M.join(left, right, "id")
    if got != [{"id": "1", "name": "ann", "city": "x", "right_name": "Ann B"}, {"id": "1", "name": "ann", "city": "y", "right_name": "A2"}]: return "join " + repr(got)[:160]
def s9():
    if printed.strip(): return "importing printed " + printed.strip()[:60]
    d = tempfile.mkdtemp(); p = os.path.join(d, "t.csv")
    with open(p, "w", encoding="utf-8") as fh:
        fh.write(NL.join(["name,age,city", "ann,30,x", "bob,4,y", "cy,30,x"]))
    so, se = run_cli("q2_table.py", p, "--where", "city=x", "--select", "name,age")
    lines = [l.strip() for l in so.strip().splitlines() if l.strip()]
    if lines != ["name,age", "ann,30", "cy,30"]: return "CLI printed " + repr(lines)[:120] + ((" | " + se.strip()[-80:]) if se.strip() else "")
def s10():
    rs = [{"d": "mon", "k": "a", "v": "1"}, {"d": "mon", "k": "b", "v": "2"}, {"d": "tue", "k": "a", "v": "3"}]
    if M.pivot(rs, "d", "k", "v") != {"mon": {"a": "1", "b": "2"}, "tue": {"a": "3"}}: return "pivot " + repr(M.pivot(rs, "d", "k", "v"))
    if not raises(lambda: M.pivot(rs + [{"d": "mon", "k": "a", "v": "9"}], "d", "k", "v"), ValueError): return "a repeated pair did not raise ValueError"
for f in (s1, s2, s3, s4, s5, s6, s7, s8, s9, s10):
    step(f)
done()`;

// ---------------------------------------------------------------- q5 rate limiters (Python)
const Q5 = `
M, _ = load("q5_limits.py")
def s1():
    c = Clock(); b = M.TokenBucket(3, 1, now=c)
    got = [b.allow() for _ in range(4)]
    if got != [True, True, True, False]: return "burst " + repr(got)
    c.t = 1
    if [b.allow(), b.allow()] != [True, False]: return "refill at 1 per second"
    c.t = 100
    if [b.allow() for _ in range(4)] != [True, True, True, False]: return "refill is not capped at capacity"
    d = M.TokenBucket(3, 1, now=Clock())
    if d.allow(2) is not True or d.allow(2) is not False: return "cost 2"
def s2():
    c = Clock(); b = M.TokenBucket(3, 1, now=c)
    if abs(b.tokens() - 3) > 1e-9: return "full " + repr(b.tokens())
    b.allow(2)
    if abs(b.tokens() - 1) > 1e-9: return "after spending 2 " + repr(b.tokens())
    c.t = 0.5
    if abs(b.tokens() - 1.5) > 1e-9: return "refilled " + repr(b.tokens())
def s3():
    c = Clock(); w = M.SlidingWindow(2, 10, now=c); got = []
    for t in (0, 1, 5, 10.5, 11.5):
        c.t = t
        got.append(w.allow())
    if got != [True, True, False, True, True]: return "sliding window " + repr(got)
def s4():
    c = Clock(); b = M.TokenBucket(4, 2, now=c)
    if b.wait_time(1) != 0.0: return "a full bucket waits " + repr(b.wait_time(1))
    b.allow(4)
    if abs(b.wait_time(1) - 0.5) > 1e-9 or abs(b.wait_time(3) - 1.5) > 1e-9: return "wait " + repr((b.wait_time(1), b.wait_time(3)))
    if not raises(lambda: b.wait_time(5), ValueError): return "a cost above capacity did not raise ValueError"
def s5():
    c = Clock(); k = M.KeyedLimiter(lambda: M.TokenBucket(1, 1, now=c))
    if [k.allow("a"), k.allow("a"), k.allow("b")] != [True, False, True]: return "per key"
    if list(k.keys()) != ["a", "b"]: return "keys " + repr(k.keys())
def s6():
    c = Clock(); k = M.KeyedLimiter(lambda: M.TokenBucket(1, 1, now=c))
    k.allow("a"); k.reset("a")
    if k.allow("a") is not True: return "reset did not give a fresh limiter"
    k.reset("never-seen")
def s7():
    c = Clock(); k = M.KeyedLimiter(lambda: M.TokenBucket(1, 1, now=c))
    k.allow("a"); k.allow("a"); k.allow("b")
    if k.stats() != {"a": {"allowed": 1, "denied": 1}, "b": {"allowed": 1, "denied": 0}}: return "stats " + repr(k.stats())
    k.reset("a"); k.allow("a")
    if k.stats()["a"] != {"allowed": 2, "denied": 1}: return "reset changed the counts " + repr(k.stats())
def s8():
    bad = [lambda: M.TokenBucket(0, 1), lambda: M.TokenBucket(1, -1), lambda: M.TokenBucket("3", 1), lambda: M.SlidingWindow(0, 1), lambda: M.SlidingWindow(1.5, 1), lambda: M.SlidingWindow(1, 0)]
    for i, f in enumerate(bad):
        if not raises(f, ValueError): return "bad constructor #%d did not raise ValueError" % i
    b = M.TokenBucket(2, 1, now=Clock())
    if not raises(lambda: b.allow(0), ValueError) or not raises(lambda: b.allow(-1), ValueError): return "a bad cost did not raise ValueError"
    if b.allow() is not True: return "a valid bucket broke"
def s9():
    lim = M.TokenBucket(1, 1, now=Clock())
    @M.limited(lim)
    def double(x):
        return x * 2
    if double(2) != 4: return "the call through the limiter"
    if not raises(lambda: double(3), M.RateLimited): return "a limited call did not raise RateLimited"
    if not issubclass(M.RateLimited, Exception): return "RateLimited is not an Exception"
def s10():
    w = M.SlidingWindow(3, 10, now=Clock())
    got = [w.allow(2), w.allow(2), w.allow(1), w.allow(1)]
    if got != [True, False, True, False]: return "allow(cost) " + repr(got)
for f in (s1, s2, s3, s4, s5, s6, s7, s8, s9, s10):
    step(f)
done()`;

// ---------------------------------------------------------------- q6 JSON paths (Python)
const Q6 = `
M, _ = load("q6_jpath.py")
def s1():
    d = {"a": {"b": [{"c": 5}]}}
    if M.get(d, "a.b.0.c") != 5: return "get"
    if M.get(d, "a") is not d["a"]: return "get of a dict"
    try:
        M.get(d, "a.x")
        return "a missing key did not raise"
    except KeyError as e:
        if "a.x" not in str(e): return "the KeyError does not name the path: " + str(e)
    if not raises(lambda: M.get(d, "a.b.3.c"), KeyError): return "a missing index did not raise KeyError"
def s2():
    d = {"a": {"b": [1]}}
    if M.get(d, "a.x", 7) != 7 or M.get(d, "a.b.9", None) is not None: return "default"
    if not raises(lambda: M.get(d, "a.x"), KeyError): return "without a default it no longer raises"
def s3():
    e = {}
    M.set_path(e, "x.y.z", 1)
    if e != {"x": {"y": {"z": 1}}}: return "set_path " + repr(e)
    l = {"l": [1, 2]}
    M.set_path(l, "l.1", 9)
    if l != {"l": [1, 9]}: return "list index " + repr(l)
    if not raises(lambda: M.set_path(l, "l.2", 3), IndexError): return "past the end did not raise IndexError"
def s4():
    d = {"a": {"b": 1, "c": 2}}
    if M.delete(d, "a.b") != 1 or d != {"a": {"c": 2}}: return "delete " + repr(d)
    if not raises(lambda: M.delete(d, "a.zz"), KeyError): return "a missing path did not raise KeyError"
    l = {"l": [1, 2, 3]}
    if M.delete(l, "l.1") != 2 or l != {"l": [1, 3]}: return "list delete " + repr(l)
def s5():
    data = {"users": [{"name": "a"}, {"x": 1}, {"name": "c"}]}
    if M.get(data, "users.*.name") != ["a", "c"]: return "list wildcard " + repr(M.get(data, "users.*.name"))
    if M.get({"m": {"p": {"v": 1}, "q": {"v": 2}}}, "m.*.v") != [1, 2]: return "dict wildcard"
def s6():
    d = {"a": 1, "b": {"c": 2, "d": [3, 0]}}
    got = M.find(d, lambda v: isinstance(v, int) and v > 1)
    if got != ["b.c", "b.d.0"]: return "find " + repr(got)
def s7():
    d = {"a": {"b": 1}, "l": [{"x": 2}, 3]}
    if M.flatten(d) != {"a.b": 1, "l.0.x": 2, "l.1": 3}: return "flatten " + repr(M.flatten(d))
    if M.unflatten(M.flatten(d)) != d: return "round trip " + repr(M.unflatten(M.flatten(d)))
def s8():
    got = M.diff({"a": 1, "b": {"c": 2}, "r": 5}, {"a": 1, "b": {"c": 3}, "n": 4})
    if [tuple(x) for x in got] != [("b.c", 2, 3), ("n", None, 4), ("r", 5, None)]: return "diff " + repr(got)
def s9():
    data = {"a": {"b.c": [10, 20]}}
    if M.get(data, ["a", "b.c", 1]) != 20: return "get with a list path"
    M.set_path(data, ["a", "b.c", 0], 7)
    if data["a"]["b.c"][0] != 7: return "set_path with a list path"
    if M.delete(data, ["a", "b.c", 1]) != 20 or data != {"a": {"b.c": [7]}}: return "delete with a list path " + repr(data)
    if M.get({"x": {"y": 1}}, "x.y") != 1: return "dotted strings broke"
def s10():
    a = {"x": {"y": 1, "z": 2}, "l": [1]}
    b = {"x": {"z": 3, "w": 4}, "l": [2], "n": 5}
    a0, b0 = copy.deepcopy(a), copy.deepcopy(b)
    if M.merge(a, b) != {"x": {"y": 1, "z": 3, "w": 4}, "l": [2], "n": 5}: return "merge " + repr(M.merge(a, b))
    if a != a0 or b != b0: return "an input changed"
for f in (s1, s2, s3, s4, s5, s6, s7, s8, s9, s10):
    step(f)
done()`;

// ---------------------------------------------------------------- q8 units and recipes (Python)
const Q8 = `
M, printed = load("q8_units.py", ["q8_units.py", "2", "cup", "ml"])
A = lambda a, b: abs(a - b) < 1e-6
def s1():
    if not A(M.convert(1, "kg", "g"), 1000) or not A(M.convert(1, "lb", "oz"), 16) or not A(M.convert(1, "oz", "g"), 28.349523125): return "mass"
    if not raises(lambda: M.convert(1, "stone", "g"), ValueError): return "an unknown unit did not raise ValueError"
def s2():
    if not A(M.convert(1, "cup", "tbsp"), 16) or not A(M.convert(1, "tbsp", "tsp"), 3) or not A(M.convert(1, "l", "ml"), 1000): return "volume"
    if not A(M.convert(1, "cup", "ml"), 236.5882365): return "cup in ml " + repr(M.convert(1, "cup", "ml"))
    if not raises(lambda: M.convert(1, "g", "ml"), ValueError): return "mass to volume without a density"
def s3():
    if not A(M.convert(100, "C", "F"), 212) or not A(M.convert(32, "F", "C"), 0) or not A(M.convert(0, "C", "K"), 273.15): return "temperature"
    if not raises(lambda: M.convert(1, "C", "g"), ValueError): return "temperature to mass did not raise"
def s4():
    cases = {"2 kg": (2, "kg"), "0.5 l": (0.5, "l"), "3/4 cup": (0.75, "cup"), "1 1/2 cups": (1.5, "cup"), "2 tablespoons": (2, "tbsp"), "10 grams": (10, "g"), "3 litres": (3, "l")}
    for t, (q, u) in cases.items():
        got = M.parse_quantity(t)
        if not (A(got[0], q) and got[1] == u): return "parse_quantity(%r) = %r" % (t, got)
    for bad in ("lots of sugar", "2 stones"):
        if not raises(lambda: M.parse_quantity(bad), ValueError): return repr(bad) + " was accepted"
def s5():
    r = [(2, "cup", "flour"), (1, "tsp", "salt")]
    got = M.scale_recipe(r, 1.5)
    if [(float(a), b, c) for a, b, c in got] != [(3.0, "cup", "flour"), (1.5, "tsp", "salt")]: return "scaled " + repr(got)
    if r != [(2, "cup", "flour"), (1, "tsp", "salt")]: return "the input changed"
def s6():
    got = [M.format_quantity(1.5, "cup"), M.format_quantity(0.75, "tsp"), M.format_quantity(2, "cup"), M.format_quantity(1.37, "kg"), M.format_quantity(0.333, "cup"), M.format_quantity(1.1, "kg")]
    if got != ["1 1/2 cup", "3/4 tsp", "2 cup", "1.37 kg", "1/3 cup", "1.1 kg"]: return "format_quantity " + repr(got)
def s7():
    got = M.to_metric([(1, "lb", "butter"), (2, "cup", "milk"), (3, "", "eggs"), (180, "C", "oven")])
    want = [(453.6, "g", "butter"), (473.2, "ml", "milk"), (3, "", "eggs"), (180, "C", "oven")]
    if [(round(float(a), 1), b, c) for a, b, c in got] != want: return "to_metric " + repr(got)
def s8():
    got = M.shopping_list([[(1, "cup", "milk"), (100, "g", "flour")], [(250, "ml", "milk"), (1, "", "egg"), (1, "kg", "flour"), (2, "tbsp", "flour")]])
    if [x[2] for x in got] != ["egg", "flour", "flour", "milk"]: return "lines " + repr(got)
    eg, f1, f2, mk = got
    if not (A(eg[0], 1) and eg[1] == ""): return "egg " + repr(eg)
    if not (A(f1[0], 1100) and f1[1] == "g"): return "flour in g " + repr(f1)
    if not (A(f2[0], 2) and f2[1] == "tbsp"): return "the tbsp of flour must stay separate " + repr(f2)
    if not (A(mk[0], 1 + 250 / 236.5882365) and mk[1] == "cup"): return "milk in cups " + repr(mk)
def s9():
    if not A(M.convert(1, "cup", "g", density=1), 236.5882365): return "volume to mass"
    if not A(M.convert(500, "g", "ml", density=0.5), 1000): return "mass to volume"
    if not raises(lambda: M.convert(1, "cup", "g"), ValueError): return "without a density it no longer raises"
def s10():
    if printed.strip(): return "importing printed " + printed.strip()[:60]
    so, se = run_cli("q8_units.py", "2", "cup", "ml")
    if so.strip() != "473.18 ml": return "CLI printed " + repr(so.strip()) + ((" | " + se.strip()[-80:]) if se.strip() else "")
for f in (s1, s2, s3, s4, s5, s6, s7, s8, s9, s10):
    step(f)
done()`;

// ---------------------------------------------------------------- runners
function runScript(file, lang, script, neutral) {
  if (!existsSync(join(ws, file))) return { load: 'missing ' + file };
  const r = lang === 'js'
    ? spawnSync(process.execPath, [...(neutral ? ['-r', NEUTRAL] : []), '-e', JS_PRELUDE + script], { cwd: ws, encoding: 'utf8', timeout: 60000, env: ENV })
    : spawnSync('python', [...(neutral ? ['-O'] : []), '-c', PY_PRELUDE + script], { cwd: ws, encoding: 'utf8', timeout: 180000, env: ENV });
  const line = (r.stdout || '').split('\n').reverse().find((l) => l.startsWith('RESULT '));
  if (!line) return { load: 'no result: ' + ((r.stderr || '') + (r.stdout || '')).trim().split('\n').slice(-2).join(' | ').slice(0, 160) };
  return JSON.parse(line.slice(7));
}

const IDENT_OK = new Set(['require', 'module', 'exports', 'export', 'import', 'class', 'function', 'def', 'return', 'self', 'this', 'new', 'true', 'false', 'null', 'None', 'True', 'False', 'Error', 'print', 'len', 'if', 'for', 'while']);
function codeNames(text) {
  const out = new Set();
  for (const m of text.matchAll(/`([^`\n]+)`/g)) for (const t of m[1].matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)) out.add(t[0]);
  for (const m of text.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\(/g)) out.add(m[1]);
  return [...out].filter((n) => !IDENT_OK.has(n) && n.length > 1);
}
const has = (text, name) => new RegExp('(^|[^A-Za-z0-9_])' + name.replace(/[$]/g, '\\$') + '([^A-Za-z0-9_]|$)').test(text);

function notesCheck() {
  const p = join(ws, 'Q1_NOTES.md'); if (!existsSync(p)) return { pass: false, why: 'Q1_NOTES.md missing' };
  const t = readFileSync(p, 'utf8'); const src = existsSync(join(ws, 'q1_stock.js')) ? readFileSync(join(ws, 'q1_stock.js'), 'utf8') : '';
  const miss = ['addItem', 'stock', 'skus', 'remove', 'reserve', 'available', 'release', 'fulfil', 'lowStock', 'toJSON', 'fromJSON', 'history'].filter((n) => !has(t, n));
  if (miss.length) return { pass: false, why: 'notes miss ' + miss.join(', ') };
  if (!/not enough|insufficient/i.test(t)) return { pass: false, why: 'notes never say remove/reserve throw on not enough stock' };
  const fake = codeNames(t).filter((n) => !has(src, n) && n !== 'Warehouse');
  if (fake.length) return { pass: false, why: 'notes name things q1_stock.js does not have: ' + fake.slice(0, 6).join(', ') };
  return { pass: true };
}

function indexCheck() {
  const p = join(ws, 'Q_INDEX.md'); if (!existsSync(p)) return { pass: false, why: 'Q_INDEX.md missing' };
  const t = readFileSync(p, 'utf8');
  const files = readdirSync(ws).filter((f) => /^q\d+_[\w.-]*\.(js|py|html)$/i.test(f) && statSync(join(ws, f)).isFile());
  const missFiles = files.filter((f) => !t.includes(f));
  if (missFiles.length) return { pass: false, why: 'index misses files: ' + missFiles.join(', ') };
  const need = [];
  for (const f of files) {
    if (f.endsWith('.py')) {
      const src = readFileSync(join(ws, f), 'utf8');
      for (const m of src.matchAll(/^(?:async\s+)?(?:def|class)\s+([A-Za-z][A-Za-z0-9_]*)/gm)) need.push([f, m[1]]);
    } else if (f.endsWith('.js')) {
      const r = spawnSync(process.execPath, ['-r', NEUTRAL, '-e', `try { const m = require('./${f}'); const k = typeof m === 'function' ? [m.name] : Object.keys(m || {}); console.log('EXP ' + JSON.stringify(k)); } catch (e) { console.log('EXP []'); }`], { cwd: ws, encoding: 'utf8', timeout: 30000, env: ENV });
      const line = (r.stdout || '').split('\n').find((l) => l.startsWith('EXP ')); for (const n of line ? JSON.parse(line.slice(4)) : []) if (n) need.push([f, n]);
    }
  }
  const missNames = need.filter(([, n]) => !has(t, n));
  if (missNames.length) return { pass: false, why: 'index misses names: ' + missNames.slice(0, 6).map(([f, n]) => f + ':' + n).join(', ') + (missNames.length > 6 ? ' (+' + (missNames.length - 6) + ')' : '') };
  const all = files.map((f) => readFileSync(join(ws, f), 'utf8')).join('\n');
  const fake = codeNames(t).filter((n) => !has(all, n) && !files.some((f) => f.includes(n)));
  if (fake.length) return { pass: false, why: 'index names things no q-file has: ' + fake.slice(0, 6).join(', ') };
  return { pass: true };
}

async function webChain() {
  if (!existsSync(join(ws, 'q9_shop.html'))) return { load: 'missing q9_shop.html' };
  const req = createRequire(HUB + 'index.js'); const puppeteer = req('puppeteer');
  const { launchOptions } = await import(pathToFileURL(HUB + 'browser.js').href);
  const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
  const server = http.createServer((q, s) => {
    const f = join(ws, decodeURIComponent(new URL(q.url, 'http://x').pathname));
    if (!f.startsWith(ws) || !existsSync(f) || statSync(f).isDirectory()) { s.writeHead(404); s.end('not found'); return; }
    s.writeHead(200, { 'Content-Type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(readFileSync(f));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/q9_shop.html`;
  const browser = await puppeteer.launch(launchOptions());
  const steps = [];
  const txt = (page, sel) => page.$eval(sel, (el) => el.innerText.replace(/\s+/g, ' ').trim()).catch(() => null);
  const visible = (page, sel) => page.$eval(sel, (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length) && getComputedStyle(el).visibility !== 'hidden').catch(() => false);
  const addP = async (page, name) => { for (const b of await page.$$('.q9-add')) { if ((await b.evaluate((el) => el.dataset.name)) === name) { await b.click(); await sleep(70); return; } } throw new Error('no .q9-add button with data-name ' + name); };
  const cart = (page) => page.evaluate(() => [...document.querySelectorAll('#q9-cart li')].map((li) => { const c = li.cloneNode(true); c.querySelectorAll('button, input').forEach((b) => b.remove()); return c.textContent.replace(/\s+/g, ' ').trim(); }));
  const liBtn = async (page, name, cls) => { for (const li of await page.$$('#q9-cart li')) { if ((await li.evaluate((el) => el.textContent)).includes(name)) return li.$('.' + cls); } return null; };
  const code = async (page, c, enter) => { await page.$eval('#q9-code', (el) => { el.value = ''; el.focus(); }); await page.type('#q9-code', c); if (enter) await page.keyboard.press('Enter'); else await page.click('#q9-apply'); await sleep(90); };
  const run = async (fn) => {
    const page = await browser.newPage(); const errs = [];
    page.on('pageerror', (e) => errs.push(String(e.message).split('\n')[0])); page.on('dialog', (d) => d.dismiss().catch(() => {}));
    const tail = () => (errs.length ? ' | js error: ' + errs[0].slice(0, 80) : '');
    try {
      await page.goto(url, { waitUntil: 'load', timeout: 15000 }); await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'load' }); await sleep(150);
      const r = await Promise.race([fn(page), sleep(20000).then(() => 'step timed out')]);
      steps.push(r === undefined || r === true ? { pass: true } : { pass: false, why: String(r).slice(0, 160) + tail() });
    } catch (e) { steps.push({ pass: false, why: 'threw: ' + String(e.message).split('\n')[0].slice(0, 120) + tail() }); }
    finally { await page.close().catch(() => {}); }
  };
  try {
    await run(async (p) => { await addP(p, 'Apple'); await addP(p, 'Apple'); await addP(p, 'Bread'); const c = await cart(p); if (!same(c, ['Apple x2', 'Bread x1'])) return 'cart ' + JSON.stringify(c); });
    await run(async (p) => { if ((await txt(p, '#q9-total')) !== '$0.00') return 'empty total ' + JSON.stringify(await txt(p, '#q9-total')); await addP(p, 'Apple'); await addP(p, 'Apple'); await addP(p, 'Milk');
      if ((await txt(p, '#q9-total')) !== '$2.99') return 'total ' + JSON.stringify(await txt(p, '#q9-total')); });
    await run(async (p) => { await addP(p, 'Apple'); const inc = await liBtn(p, 'Apple', 'q9-inc'); if (!inc) return 'no .q9-inc button'; await inc.click(); await sleep(70);
      if (!same(await cart(p), ['Apple x2']) || (await txt(p, '#q9-total')) !== '$1.00') return 'after + ' + JSON.stringify(await cart(p)) + ' ' + (await txt(p, '#q9-total'));
      for (let k = 0; k < 2; k++) { const dec = await liBtn(p, 'Apple', 'q9-dec'); if (!dec) return 'no .q9-dec button'; await dec.click(); await sleep(70); }
      if ((await cart(p)).length !== 0 || (await txt(p, '#q9-total')) !== '$0.00') return 'at 0 the item stayed: ' + JSON.stringify(await cart(p)); });
    await run(async (p) => { if ((await txt(p, '#q9-count')) !== '0 items') return 'start ' + JSON.stringify(await txt(p, '#q9-count')); await addP(p, 'Apple');
      if ((await txt(p, '#q9-count')) !== '1 item') return 'one ' + JSON.stringify(await txt(p, '#q9-count')); await addP(p, 'Bread'); if ((await txt(p, '#q9-count')) !== '2 items') return 'two ' + JSON.stringify(await txt(p, '#q9-count')); });
    await run(async (p) => { for (let k = 0; k < 4; k++) await addP(p, 'Bread'); await code(p, 'NOPE'); if ((await txt(p, '#q9-msg')) !== 'Invalid code') return 'message ' + JSON.stringify(await txt(p, '#q9-msg'));
      if ((await txt(p, '#q9-total')) !== '$9.00') return 'an invalid code changed the total ' + (await txt(p, '#q9-total')); await code(p, 'SAVE10'); if ((await txt(p, '#q9-total')) !== '$8.10') return 'SAVE10 total ' + (await txt(p, '#q9-total')); });
    await run(async (p) => { await addP(p, 'Apple'); await addP(p, 'Milk'); await addP(p, 'Milk'); await p.reload({ waitUntil: 'load' }); await sleep(200);
      if (!same(await cart(p), ['Apple x1', 'Milk x2'])) return 'after reload ' + JSON.stringify(await cart(p)); if ((await txt(p, '#q9-total')) !== '$4.48') return 'total after reload ' + (await txt(p, '#q9-total'));
      if (!(await p.evaluate(() => localStorage.getItem('q9-cart')))) return 'nothing saved under q9-cart'; });
    await run(async (p) => { if (!(await visible(p, '#q9-empty')) || !/Cart is empty/.test((await txt(p, '#q9-empty')) || '')) return 'the empty message is not shown at start';
      await addP(p, 'Apple'); if (await visible(p, '#q9-empty')) return 'still shown with an item'; await p.click('#q9-clear'); await sleep(80);
      if ((await cart(p)).length !== 0) return 'clear left items'; if (!(await visible(p, '#q9-empty'))) return 'not shown again after clear'; });
    await run(async (p) => { for (let k = 0; k < 4; k++) await addP(p, 'Bread'); if ((await txt(p, '#q9-delivery')) !== 'Add $1.00 for free delivery') return 'at $9.00 ' + JSON.stringify(await txt(p, '#q9-delivery'));
      await addP(p, 'Apple'); await addP(p, 'Apple'); if ((await txt(p, '#q9-delivery')) !== 'Free delivery') return 'at $10.00 ' + JSON.stringify(await txt(p, '#q9-delivery'));
      await code(p, 'SAVE10'); if ((await txt(p, '#q9-delivery')) !== 'Add $1.00 for free delivery') return 'after the discount ' + JSON.stringify(await txt(p, '#q9-delivery')); });
    await run(async (p) => { for (let k = 0; k < 4; k++) await addP(p, 'Bread'); await code(p, 'SAVE10', true); if ((await txt(p, '#q9-total')) !== '$8.10') return 'Enter did not apply the code: ' + (await txt(p, '#q9-total')); });
    await run(async (p) => { for (let k = 0; k < 4; k++) await addP(p, 'Bread'); await code(p, 'SAVE10'); await p.reload({ waitUntil: 'load' }); await sleep(200);
      if ((await txt(p, '#q9-total')) !== '$8.10') return 'the discount did not survive a reload: ' + (await txt(p, '#q9-total')); });
  } finally { await browser.close().catch(() => {}); server.close(); }
  return { steps };
}

const CHAINS = [
  { n: 1, file: 'q1_stock.js', lang: 'js', script: Q1, last: notesCheck, lastFile: 'Q1_NOTES.md' },
  { n: 2, file: 'q2_table.py', lang: 'py', script: Q2 },
  { n: 3, file: 'q3_calendar.js', lang: 'js', script: Q3 },
  { n: 4, file: 'q4_template.js', lang: 'js', script: Q4 },
  { n: 5, file: 'q5_limits.py', lang: 'py', script: Q5 },
  { n: 6, file: 'q6_jpath.py', lang: 'py', script: Q6 },
  { n: 7, file: 'q7_buffer.js', lang: 'js', script: Q7 },
  { n: 8, file: 'q8_units.py', lang: 'py', script: Q8 },
  { n: 9, file: 'q9_shop.html', lang: 'web' },
  { n: 10, file: 'q10_report.js', lang: 'js', script: Q10, last: indexCheck, lastFile: 'Q_INDEX.md' },
];

const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',').map(Number)) : null;
const results = new Array(100);
for (const c of CHAINS) {
  if (ONLY && !ONLY.has(c.n)) continue;
  let a, b;
  if (c.lang === 'web') { try { a = b = await webChain(); } catch (e) { a = b = { load: 'web: ' + String(e.message).slice(0, 140) }; } }
  else { a = runScript(c.file, c.lang, c.script, false); b = runScript(c.file, c.lang, c.script, true); }
  const lastR = c.last ? c.last() : null;
  for (let k = 0; k < 10; k++) {
    const goal = k * 10 + c.n;
    if (c.last && k === 9) { results[goal - 1] = { goal, chain: c.n, step: 10, file: c.lastFile, asIs: lastR.pass, impl: lastR.pass, why: lastR.why || '' }; continue; }
    const sa = a.steps ? a.steps[k] : { pass: false, why: a.load }, sb = b.steps ? b.steps[k] : { pass: false, why: b.load };
    results[goal - 1] = { goal, chain: c.n, step: k + 1, file: c.file, asIs: !!(sa && sa.pass), impl: !!(sb && sb.pass),
      why: (sa && !sa.pass ? sa.why : (sb && !sb.pass ? 'impl: ' + sb.why : '')) || '' };
  }
}
const got = results.filter(Boolean);
const asIs = got.filter((r) => r.asIs).length, impl = got.filter((r) => r.impl).length;
for (const r of got) console.log(`${String(r.goal).padStart(3)} ${r.asIs ? 'PASS' : (r.impl ? 'CT  ' : 'fail')} ${r.file.padEnd(14)} s${String(r.step).padEnd(2)} ${String(r.why).slice(0, 100)}`);
const per = CHAINS.filter((c) => !ONLY || ONLY.has(c.n)).map((c) => `q${c.n} ${got.filter((r) => r.chain === c.n && r.impl).length}/10`).join('  ');
console.log(`\nper project (implementation correct): ${per}`);
console.log(`done as asked ${asIs}/100 | implementation correct ${impl}/100 (CT = correct code, own test broke it)`);
if (outAt) writeFileSync(outAt, JSON.stringify({ ws, asIs, impl, results: got }, null, 2));
