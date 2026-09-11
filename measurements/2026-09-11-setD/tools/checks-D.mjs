// checks-D.mjs <workspaceDir> [--out results.json] : hidden checks for set D (100 goals, 10 chains x 10 steps, interleaved).
//
// Every step is checked on the FINAL workspace, so a later goal that breaks an earlier one fails the earlier one.
// Goal number = (step - 1) * 10 + chain. Each code step is scored twice:
//   asIs  the module loaded exactly as the model left it, its own asserts included  -> "done as asked"
//   impl  the model's own asserts neutralised (neutral.cjs for node, python -O)     -> "implementation correct"
// r9 (web app) is driven in puppeteer over a local http server with the hub's launch options (asIs = impl).
// R1_NOTES.md and R_INDEX.md are checked against the real source: every public name present, and no
// code-looking name that exists nowhere in the r-files (fabrication).
// Validated before any model ran: 100/100 on refs/, 0/100 on an empty workspace, mutants in mutate-D.sh.
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
`;

const PY_PRELUDE = `
import importlib.util, io, contextlib, json, os, sys, tempfile, subprocess, datetime
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
`;

// ---------------------------------------------------------------- r1 ledger (9 code steps; step 10 = notes)
const R1 = `
const M = load('r1_ledger.js'); const L = pick(M, 'Ledger') || M; const mk = () => new L();
step(() => { const l = mk(); l.open('a'); l.deposit('a', 5); if (l.balance('a') !== 5) return 'balance ' + l.balance('a');
  if (!throws(() => l.open('a'))) return 'open of an existing account did not throw';
  if (!throws(() => l.deposit('x', 1))) return 'deposit to an unknown account did not throw';
  for (const bad of [0, -1, 'abc', NaN]) if (!throws(() => l.deposit('a', bad))) return 'deposit ' + String(bad) + ' did not throw';
  if (!throws(() => l.balance('x'))) return 'balance of an unknown account did not throw';
  if (l.balance('a') !== 5) return 'a failed deposit changed the balance'; });
step(() => { const l = mk(); l.open('a'); l.deposit('a', 10); l.withdraw('a', 4); if (l.balance('a') !== 6) return 'after withdraw ' + l.balance('a');
  if (!throws(() => l.withdraw('a', 7))) return 'overdraw did not throw'; if (!throws(() => l.withdraw('a', 0))) return 'withdraw 0 did not throw';
  if (!throws(() => l.withdraw('z', 1))) return 'withdraw from unknown did not throw'; if (l.balance('a') !== 6) return 'a failed withdraw changed the balance'; });
step(() => { const l = mk(); l.open('a'); l.open('b'); l.deposit('a', 10); l.transfer('a', 'b', 3);
  if (l.balance('a') !== 7 || l.balance('b') !== 3) return 'after transfer a=' + l.balance('a') + ' b=' + l.balance('b');
  if (!throws(() => l.transfer('a', 'b', 100))) return 'overdrawn transfer did not throw';
  if (!throws(() => l.transfer('a', 'zz', 1))) return 'transfer to unknown did not throw';
  if (!throws(() => l.transfer('a', 'a', 1))) return 'transfer to itself did not throw';
  if (l.balance('a') !== 7 || l.balance('b') !== 3) return 'a failed transfer changed balances'; });
step(() => { const l = mk(); l.open('a'); l.open('b'); l.deposit('a', 10); l.withdraw('a', 2); try { l.withdraw('a', 100); } catch {} l.transfer('a', 'b', 3);
  const norm = (h) => (h || []).map((e) => ({ type: e.type, amount: e.amount }));
  if (!same(norm(l.history('a')), [{ type: 'deposit', amount: 10 }, { type: 'withdraw', amount: 2 }, { type: 'transfer-out', amount: 3 }])) return 'history(a) ' + JSON.stringify(norm(l.history('a'))).slice(0, 120);
  if (!same(norm(l.history('b')), [{ type: 'transfer-in', amount: 3 }])) return 'history(b) ' + JSON.stringify(norm(l.history('b'))); });
step(() => { const l = mk(); l.open('a'); l.open('b'); l.deposit('a', 10); l.deposit('b', 5); l.freeze('a');
  if (!throws(() => l.deposit('a', 1))) return 'deposit to a frozen account did not throw';
  if (!throws(() => l.withdraw('a', 1))) return 'withdraw from a frozen account did not throw';
  if (!throws(() => l.transfer('a', 'b', 1))) return 'transfer from a frozen account did not throw';
  if (!throws(() => l.transfer('b', 'a', 1))) return 'transfer to a frozen account did not throw';
  if (l.balance('a') !== 10 || l.balance('b') !== 5) return 'frozen operations changed balances';
  if (l.history('a').length !== 1 || l.history('b').length !== 1) return 'frozen operations changed history';
  l.unfreeze('a'); l.deposit('a', 1); if (l.balance('a') !== 11) return 'unfreeze did not allow a deposit';
  if (!throws(() => l.freeze('zz'))) return 'freeze of an unknown account did not throw'; });
step(() => { const l = mk(); l.open('a'); l.open('b'); l.deposit('a', 10); l.withdraw('a', 3); l.transfer('a', 'b', 2);
  const H = (n) => l.history(n).map((e) => e.type + ':' + e.amount).join(',');
  l.undo(); if (!approx(l.balance('a'), 7) || !approx(l.balance('b'), 0)) return 'undo transfer: a=' + l.balance('a') + ' b=' + l.balance('b');
  if (H('a') !== 'deposit:10,withdraw:3' || H('b') !== '') return 'undo transfer history: ' + H('a') + ' | ' + H('b');
  l.undo(); if (!approx(l.balance('a'), 10) || H('a') !== 'deposit:10') return 'undo withdraw: ' + l.balance('a') + ' ' + H('a');
  l.undo(); if (!approx(l.balance('a'), 0) || H('a') !== '') return 'undo deposit: ' + l.balance('a') + ' ' + H('a');
  if (!throws(() => l.undo())) return 'undo with nothing left did not throw'; });
step(() => { const l = mk(); for (const n of ['a', 'b', 'c', 'f']) l.open(n); l.deposit('a', 100); l.deposit('f', 20); l.freeze('f'); l.deposit('b', 50.5);
  const t = l.applyInterest(10); if (!approx(t, 15.05)) return 'returned ' + t;
  if (!approx(l.balance('a'), 110) || !approx(l.balance('b'), 55.55) || l.balance('c') !== 0 || l.balance('f') !== 20) return 'balances ' + ['a', 'b', 'c', 'f'].map((n) => l.balance(n)).join(',');
  const last = l.history('a').slice(-1)[0]; if (!last || last.type !== 'interest' || !approx(last.amount, 10)) return 'interest history ' + JSON.stringify(last);
  l.undo(); if (!approx(l.balance('b'), 5.05)) return 'undo after interest: b=' + l.balance('b') + ' (must reverse the 50.5 deposit and keep the interest)';
  if (!l.history('b').some((e) => e.type === 'interest')) return 'undo removed the interest entry';
  if (!approx(l.balance('a'), 110)) return 'undo touched a'; });
step(() => { const l = mk(); l.open('bob'); l.open('alice'); l.deposit('alice', 12.5); l.deposit('bob', 3);
  const t = l.toCSV(); if (t !== 'account,balance\\nalice,12.50\\nbob,3.00') return 'toCSV ' + JSON.stringify(t); });
step(() => { const l = mk(); l.open('bob'); l.open('alice'); l.open('zed'); l.deposit('alice', 12.5); l.deposit('bob', 3);
  const csv = l.toCSV(); const k = L.fromCSV(csv); if (k.toCSV() !== csv) return 'round trip ' + JSON.stringify(k.toCSV());
  if (!approx(k.balance('alice'), 12.5)) return 'balance after fromCSV';
  const h = k.history('alice'); if (h.length !== 1 || h[0].type !== 'deposit' || !approx(h[0].amount, 12.5)) return 'history after fromCSV ' + JSON.stringify(h);
  if (k.history('zed').length !== 0) return 'a zero balance got a deposit';
  if (!throws(() => L.fromCSV('name,balance\\na,1.00'))) return 'a wrong header was accepted';
  if (!throws(() => L.fromCSV('account,balance\\na;1.00'))) return 'a malformed line was accepted'; });
done();`;

// ---------------------------------------------------------------- r3 task graph
const R3 = `
const M = load('r3_tasks.js'); const G = pick(M, 'TaskGraph') || M;
const build = () => { const g = new G(); g.add('a', 3); g.add('b', 2); g.add('c', 4); g.add('d', 1); g.depend('b', 'a'); g.depend('c', 'a'); g.depend('d', 'b'); g.depend('d', 'c'); return g; };
step(() => { const g = new G(); g.add('a', 3); if (g.has('a') !== true || g.has('z') !== false) return 'has'; if (g.size() !== 1) return 'size ' + g.size();
  if (!throws(() => g.add('a', 1))) return 'a duplicate id did not throw';
  for (const bad of [0, -1, 'x']) if (!throws(() => g.add('n' + String(bad), bad))) return 'duration ' + String(bad) + ' did not throw';
  if (g.size() !== 1) return 'failed adds changed the size'; });
step(() => { const g = new G(); g.add('a', 1); g.add('b', 1); g.depend('b', 'a');
  if (!throws(() => g.depend('b', 'zz'))) return 'an unknown onId did not throw'; if (!throws(() => g.depend('zz', 'a'))) return 'an unknown id did not throw';
  if (!throws(() => g.depend('a', 'a'))) return 'a self-dependency did not throw'; });
step(() => { const g = new G(); g.add('x', 1); g.add('y', 1); g.add('z', 1); g.depend('y', 'x');
  if (!same(g.order(), ['x', 'y', 'z'])) return 'order ' + JSON.stringify(g.order()) + ' (ready tasks must go in the order they were added)';
  const h = new G(); h.add('d', 1); h.add('b', 1); h.add('a', 1); h.add('c', 1); h.depend('a', 'd'); h.depend('c', 'b');
  if (!same(h.order(), ['d', 'b', 'a', 'c'])) return 'order ' + JSON.stringify(h.order()); });
step(() => { const g = new G(); g.add('a', 1); g.add('b', 1); g.add('c', 1); g.depend('b', 'a'); g.depend('c', 'b');
  if (!throws(() => g.depend('a', 'c'))) return 'the cycle a->c->b->a was accepted';
  if (!same(g.order(), ['a', 'b', 'c'])) return 'the graph changed after a refused cycle: ' + JSON.stringify(g.order()); });
step(() => { const g = build(); const es = ['a', 'b', 'c', 'd'].map((x) => g.earliestStart(x)); if (!same(es, [0, 3, 3, 7])) return 'earliestStart ' + JSON.stringify(es);
  if (!throws(() => g.earliestStart('zz'))) return 'an unknown id did not throw'; });
step(() => { const g = build(); if (g.totalTime() !== 8) return 'totalTime ' + g.totalTime(); if (new G().totalTime() !== 0) return 'an empty graph is not 0'; });
step(() => { const g = build(); if (!same(g.criticalPath(), ['a', 'c', 'd'])) return 'criticalPath ' + JSON.stringify(g.criticalPath()); });
step(() => { const g = build(); g.remove('c'); if (!same(g.order(), ['a', 'b', 'd'])) return 'order after remove ' + JSON.stringify(g.order());
  if (g.totalTime() !== 6) return 'totalTime after remove ' + g.totalTime(); if (g.has('c')) return 'c is still there';
  if (!throws(() => g.remove('zz'))) return 'an unknown id did not throw'; });
step(() => { const g = build(); const j = g.toJSON(); const t = (j && j.tasks) || [];
  const norm = t.map((x) => ({ id: x.id, duration: x.duration, deps: [...(x.deps || [])].sort() }));
  if (!same(norm, [{ id: 'a', duration: 3, deps: [] }, { id: 'b', duration: 2, deps: ['a'] }, { id: 'c', duration: 4, deps: ['a'] }, { id: 'd', duration: 1, deps: ['b', 'c'] }])) return 'toJSON ' + JSON.stringify(norm).slice(0, 140);
  const h = G.fromJSON(JSON.parse(JSON.stringify(j))); if (!same(h.order(), g.order())) return 'fromJSON order ' + JSON.stringify(h.order());
  if (h.totalTime() !== 8) return 'fromJSON totalTime';
  if (!throws(() => G.fromJSON({ tasks: [{ id: 'a', duration: 1, deps: ['b'] }, { id: 'b', duration: 1, deps: ['a'] }] }))) return 'a cycle was accepted';
  if (!throws(() => G.fromJSON({ tasks: [{ id: 'a', duration: 1, deps: ['nope'] }] }))) return 'an unknown dependency was accepted'; });
step(() => { const g = build(); if (!same(g.ready([]), ['a'])) return 'ready([]) ' + JSON.stringify(g.ready([]));
  if (!same(g.ready(['a']), ['b', 'c'])) return 'ready([a]) ' + JSON.stringify(g.ready(['a']));
  if (!same(g.ready(['a', 'b', 'c']), ['d'])) return 'ready([a,b,c])'; if (!same(g.ready(['a', 'b', 'c', 'd']), [])) return 'ready(all)'; });
done();`;

// ---------------------------------------------------------------- r4 geometry
const R4 = `
const M = load('r4_geom.js'); const P = (x, y) => ({ x, y });
const sq = [P(0, 0), P(2, 0), P(2, 2), P(0, 2)], L6 = [P(0, 0), P(2, 0), P(2, 1), P(1, 1), P(1, 2), P(0, 2)];
const aP = (p, x, y) => !!p && approx(p.x, x) && approx(p.y, y);
step(() => { if (!approx(M.distance(P(0, 0), P(3, 4)), 5)) return 'distance'; if (!approx(M.polygonArea(sq), 4)) return 'area (counter-clockwise)';
  if (!approx(M.polygonArea([...sq].reverse()), 4)) return 'area (clockwise)'; if (!approx(M.polygonArea([P(0, 0), P(4, 0), P(0, 3)]), 6)) return 'triangle area'; });
step(() => { if (!approx(M.perimeter(sq), 8)) return 'square ' + M.perimeter(sq); if (!approx(M.perimeter([P(0, 0), P(4, 0), P(0, 3)]), 12)) return 'triangle'; });
step(() => { const c = M.centroid(L6); if (!aP(c, 2.5 / 3, 2.5 / 3)) return 'L-shape centroid ' + JSON.stringify(c) + ' (the corner average would be 1,1)';
  if (!aP(M.centroid(sq), 1, 1)) return 'square centroid'; if (!throws(() => M.centroid([P(0, 0), P(1, 1), P(2, 2)]))) return 'zero area did not throw'; });
step(() => { const b = M.boundingBox([P(1, 5), P(-2, 3), P(4, -1)]); if (!same({ minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY }, { minX: -2, minY: -1, maxX: 4, maxY: 5 })) return 'bbox ' + JSON.stringify(b);
  if (!throws(() => M.boundingBox([]))) return 'an empty list did not throw'; });
step(() => { const f = M.pointInPolygon; if (f(P(1, 1), sq) !== true) return 'inside'; if (f(P(3, 3), sq) !== false) return 'outside';
  if (f(P(2, 1), sq) !== true) return 'on an edge'; if (f(P(0, 0), sq) !== true) return 'on a corner';
  if (f(P(1.5, 1.5), L6) !== false) return 'in the notch of the L'; if (f(P(0.5, 1.5), L6) !== true) return 'in the arm of the L'; });
step(() => { const h = M.convexHull([P(1, 1), P(2, 2), P(0, 2), P(1, 0), P(2, 0), P(0, 0), P(0.5, 1.5)]).map((p) => [p.x, p.y]);
  if (!same(h, [[0, 0], [2, 0], [2, 2], [0, 2]])) return 'hull ' + JSON.stringify(h); });
step(() => { const inp = [P(1, 1), P(2, 3)]; const snap = JSON.stringify(inp);
  const t = M.translate(inp, 1, -1); if (!aP(t[0], 2, 0) || !aP(t[1], 3, 2)) return 'translate ' + JSON.stringify(t);
  const s = M.scale(inp, 2); if (!aP(s[0], 2, 2) || !aP(s[1], 4, 6)) return 'scale ' + JSON.stringify(s);
  const o = M.scale([P(2, 2)], 2, P(1, 1)); if (!aP(o[0], 3, 3)) return 'scale about an origin ' + JSON.stringify(o);
  if (JSON.stringify(inp) !== snap) return 'the input changed'; if (t[0] === inp[0] || s[0] === inp[0]) return 'returned the same point objects'; });
step(() => { if (!throws(() => M.polygonArea([P(0, 0), P(1, 0)]))) return 'area of 2 points did not throw'; if (!throws(() => M.distance({ x: 0 }, P(1, 1)))) return 'a point without y did not throw';
  if (!throws(() => M.perimeter([P(0, 0), { x: '1', y: 0 }, P(0, 1)]))) return 'a string x did not throw'; if (!throws(() => M.boundingBox([P(NaN, 0)]))) return 'NaN did not throw';
  if (!throws(() => M.translate([null], 1, 1))) return 'a null point did not throw'; if (!throws(() => M.pointInPolygon(P(0, 0), 'no'))) return 'a non-array polygon did not throw';
  if (!approx(M.polygonArea(sq), 4)) return 'valid input changed'; });
step(() => { if (M.isConvex(sq) !== true) return 'square (ccw)'; if (M.isConvex([...sq].reverse()) !== true) return 'square (cw)';
  if (M.isConvex(L6) !== false) return 'L shape'; if (M.isConvex([P(0, 0), P(4, 0), P(0, 3)]) !== true) return 'triangle'; });
step(() => { const inp = [P(1, 0)]; const r = M.rotate(inp, 90); if (!aP(r[0], 0, 1)) return 'rotate 90 ' + JSON.stringify(r);
  const q = M.rotate([P(2, 1)], 180, P(1, 1)); if (!aP(q[0], 0, 1)) return 'rotate about an origin ' + JSON.stringify(q);
  if (inp[0].x !== 1 || inp[0].y !== 0) return 'the input changed'; });
done();`;

// ---------------------------------------------------------------- r8 money
const R8 = `
const M = load('r8_money.js');
step(() => { const got = ['$1,234.56', '12', '0.5', '-$3.50'].map((s) => M.parseMoney(s)); if (!same(got, [123456, 1200, 50, -350])) return 'parse ' + JSON.stringify(got);
  for (const bad of ['abc', '1.234', '']) if (!throws(() => M.parseMoney(bad))) return JSON.stringify(bad) + ' was accepted';
  const out = [123456, -123456, 5, 100000000].map((c) => M.formatMoney(c)); if (!same(out, ['$1,234.56', '-$1,234.56', '$0.05', '$1,000,000.00'])) return 'format ' + JSON.stringify(out); });
step(() => { if (M.addMoney(1, 2, 3) !== 6) return 'add'; if (M.subtractMoney(10, 3) !== 7) return 'subtract';
  if (!throws(() => M.addMoney(1, 1.5))) return 'a non-integer add was accepted'; if (!throws(() => M.subtractMoney('1', 1))) return 'a string subtract was accepted'; });
step(() => { const m = M.multiplyMoney; const got = [m(5, 0.5), m(-5, 0.5), m(1000, 1.15), m(333, 1 / 3), m(7, 0.5)]; if (!same(got, [3, -3, 1150, 111, 4])) return 'multiply ' + JSON.stringify(got); });
step(() => { const s = M.splitMoney; if (!same(s(1000, 3), [334, 333, 333])) return 'split 1000/3 ' + JSON.stringify(s(1000, 3));
  if (!same(s(100, 4), [25, 25, 25, 25])) return 'split 100/4'; if (!same(s(5, 3), [2, 2, 1])) return 'split 5/3 ' + JSON.stringify(s(5, 3)); });
step(() => { const a = M.allocateMoney; if (!same(a(100, [1, 1, 1]), [34, 33, 33])) return 'allocate 100 ' + JSON.stringify(a(100, [1, 1, 1]));
  if (!same(a(1000, [1, 2, 3]), [167, 333, 500])) return 'allocate 1000 ' + JSON.stringify(a(1000, [1, 2, 3])); if (!same(a(5, [3, 7]), [2, 3])) return 'allocate 5 ' + JSON.stringify(a(5, [3, 7])); });
step(() => { const t = M.taxMoney(1000, 8.25); if (!same({ net: t.net, tax: t.tax, gross: t.gross }, { net: 1000, tax: 83, gross: 1083 })) return 'tax ' + JSON.stringify(t);
  const u = M.taxMoney(199, 10); if (u.tax !== 20 || u.gross !== 219) return 'tax 199 ' + JSON.stringify(u); });
step(() => { const r = { USD: 1, EUR: 1.1 }; const c = M.convertMoney; if (c(1000, 'EUR', 'USD', r) !== 1100) return 'EUR->USD ' + c(1000, 'EUR', 'USD', r);
  if (c(1100, 'USD', 'EUR', r) !== 1000) return 'USD->EUR ' + c(1100, 'USD', 'EUR', r); if (c(1, 'USD', 'EUR', r) !== 1) return '1 cent'; if (!throws(() => c(1, 'USD', 'XYZ', r))) return 'an unknown code was accepted'; });
step(() => { const f = M.formatMoney; const got = [f(1250, 'EUR'), f(1250, 'GBP'), f(123456, 'JPY'), f(1250), f(1250, 'USD')]; if (!same(got, ['€12.50', '£12.50', 'JPY 1,234.56', '$12.50', '$12.50'])) return 'format with codes ' + JSON.stringify(got); });
step(() => { if (M.sumMoney([1, 2, 3]) !== 6 || M.sumMoney([]) !== 0) return 'sum'; if (!throws(() => M.sumMoney([1, 0.5]))) return 'a non-integer sum was accepted';
  const c = M.compareMoney; if (c(1, 2) !== -1 || c(2, 2) !== 0 || c(3, 2) !== 1) return 'compare'; });
step(() => { const got = ['€12.50', '£3', '12.50 EUR', '-€3.50', '$1,234.56'].map((s) => M.parseMoney(s)); if (!same(got, [1250, 300, 1250, -350, 123456])) return 'parse ' + JSON.stringify(got);
  for (const bad of ['abc', '1.234', '']) if (!throws(() => M.parseMoney(bad))) return JSON.stringify(bad) + ' was accepted'; });
done();`;

// ---------------------------------------------------------------- r10 report (9 code steps; step 10 = index)
const R10 = `
const R = load('r10_report.js'); let L = null; try { const m1 = require('./r1_ledger.js'); L = pick(m1, 'Ledger') || m1; } catch (e) {}
const need = () => { if (typeof L !== 'function') throw new Error('r1_ledger.js does not give a Ledger class'); };
const mk = () => { need(); const l = new L(); l.open('alice'); l.deposit('alice', 12.5); l.open('bob'); l.deposit('bob', 1234.5); return l; };
const fn = (n) => { const f = R && R[n]; if (typeof f !== 'function') throw new Error(n + ' is not exported'); return f; };
step(() => { const got = fn('balancesReport')(mk(), ['alice', 'bob']); if (!same(got, ['alice: $12.50', 'bob: $1,234.50'])) return 'balancesReport ' + JSON.stringify(got); });
step(() => { const got = fn('totalReport')(mk(), ['alice', 'bob']); if (got !== 'Total: $1,247.00') return 'totalReport ' + JSON.stringify(got); });
step(() => { const l = mk(); const got = fn('interestPreview')(l, ['alice'], 10); if (!same(got, ['alice: $1.25'])) return 'interestPreview ' + JSON.stringify(got); if (l.balance('alice') !== 12.5) return 'the preview changed the ledger'; });
step(() => { need(); const l = new L(); for (const n of ['a', 'b', 'c', 'd']) l.open(n); l.deposit('a', 10); const got = fn('evenSplit')(l, 'a', ['b', 'c', 'd']);
  if (!same(got, [334, 333, 333])) return 'evenSplit returned ' + JSON.stringify(got);
  if (!approx(l.balance('b'), 3.34) || !approx(l.balance('c'), 3.33) || !approx(l.balance('d'), 3.33) || !approx(l.balance('a'), 0)) return 'balances ' + ['a', 'b', 'c', 'd'].map((n) => l.balance(n)).join(','); });
step(() => { need(); const l = new L(); l.open('a'); l.deposit('a', 10); l.withdraw('a', 2.5); const got = fn('historyReport')(l, 'a'); if (!same(got, ['deposit $10.00', 'withdraw $2.50'])) return 'historyReport ' + JSON.stringify(got); });
step(() => { const got = fn('taxReport')(mk(), ['alice'], 10); if (!same(got, ['alice: net $12.50 tax $1.25 gross $13.75'])) return 'taxReport ' + JSON.stringify(got); });
step(() => { const got = fn('convertBalances')(mk(), ['alice', 'bob'], 'EUR', { USD: 1, EUR: 1.1 }); if (!same(got, [1136, 112227])) return 'convertBalances ' + JSON.stringify(got); });
step(() => { const got = fn('currencyReport')(mk(), ['alice'], 'EUR', { USD: 1, EUR: 1.1 }); if (!same(got, ['alice: €11.36'])) return 'currencyReport ' + JSON.stringify(got); });
step(() => { need(); const l = new L(); for (const n of ['c', 'a', 'b']) l.open(n); l.deposit('c', 5); l.deposit('a', 5); l.deposit('b', 9);
  const r = fn('richest'); if (!same(r(l, 2), ['b', 'a'])) return 'richest(2) ' + JSON.stringify(r(l, 2)); if (!same(r(l, 3), ['b', 'a', 'c'])) return 'richest(3) ' + JSON.stringify(r(l, 3)); });
done();`;

// ---------------------------------------------------------------- r2 text (Python)
const R2 = `
fake = os.path.join(tempfile.mkdtemp(), "argv.txt")
with open(fake, "w", encoding="utf-8") as fh:
    fh.write("zz zz yy")
M, printed = load("r2_text.py", ["r2_text.py", fake, "1"])
def s1():
    if M.words("Don't stop, DON'T!") != ["don't", "stop", "don't"]: return "words " + repr(M.words("Don't stop, DON'T!"))
    if M.word_count("a b a") != {"a": 2, "b": 1}: return "word_count " + repr(M.word_count("a b a"))
def s2():
    if M.sentences("Hi! How are you? Fine.") != ["Hi!", "How are you?", "Fine."]: return "sentences " + repr(M.sentences("Hi! How are you? Fine."))
    if M.sentences("One. Two") != ["One.", "Two"]: return "last piece " + repr(M.sentences("One. Two"))
    if M.sentences("") != []: return "empty text " + repr(M.sentences(""))
def s3():
    if [list(x) for x in M.top_words("b a b c a b", 2)] != [["b", 3], ["a", 2]]: return "top " + repr(M.top_words("b a b c a b", 2))
    if [list(x) for x in M.top_words("y x", 2)] != [["x", 1], ["y", 1]]: return "ties " + repr(M.top_words("y x", 2))
    if [list(x) for x in M.top_words("the cat the dog the", 1, stopwords=("THE",))] != [["cat", 1]]: return "stopwords " + repr(M.top_words("the cat the dog the", 1, stopwords=("THE",)))
def s4():
    if M.bigrams("a b a b") != {"a b": 2, "b a": 1}: return "bigrams " + repr(M.bigrams("a b a b"))
def s5():
    if M.avg_sentence_length("One two. Three four five!") != 2.5: return "avg " + repr(M.avg_sentence_length("One two. Three four five!"))
    if M.avg_sentence_length("") != 0.0: return "empty " + repr(M.avg_sentence_length(""))
    if M.avg_sentence_length("a b c. d") != 2.0: return "avg2 " + repr(M.avg_sentence_length("a b c. d"))
def s6():
    d = tempfile.mkdtemp()
    p = os.path.join(d, "t.txt")
    with open(p, "w", encoding="utf-8") as fh:
        fh.write("a a b")
    if M.read_counts(p) != {"a": 2, "b": 1}: return "read_counts " + repr(M.read_counts(p))
    if not raises(lambda: M.read_counts(os.path.join(d, "missing.txt")), FileNotFoundError): return "a missing file did not raise FileNotFoundError"
def cli(*extra):
    d = tempfile.mkdtemp()
    p = os.path.join(d, "t.txt")
    with open(p, "w", encoding="utf-8") as fh:
        fh.write("b a b c a b")
    flags = [] if __debug__ else ["-O"]
    env = dict(os.environ, PYTHONIOENCODING="utf-8", PYTHONDONTWRITEBYTECODE="1")
    out = subprocess.run([sys.executable] + flags + ["r2_text.py", p, "2", *extra], capture_output=True, timeout=30, env=env)
    return out.stdout.decode("utf-8", "replace"), out.stderr.decode("utf-8", "replace")
def s7():
    if printed.strip(): return "importing printed " + printed.strip()[:60]
    so, se = cli()
    lines = [l.strip() for l in so.strip().splitlines() if l.strip()]
    if lines != ["b 3", "a 2"]: return "CLI printed " + repr(lines)[:100] + ((" | " + se.strip()[-80:]) if se.strip() else "")
def s8():
    so, se = cli("--json")
    try:
        j = json.loads(so)
    except Exception:
        return "not JSON: " + repr(so[:80]) + ((" | " + se.strip()[-80:]) if se.strip() else "")
    if j != {"top": [["b", 3], ["a", 2]], "sentences": 1}: return "json " + repr(j)[:100]
    so2, _ = cli()
    if [l.strip() for l in so2.strip().splitlines() if l.strip()] != ["b 3", "a 2"]: return "the plain output changed"
def s9():
    if M.words("Café CAFÉ café") != ["café"] * 3: return "accents " + repr(M.words("Café CAFÉ café"))
    if M.word_count("Ünïcödé ünïcödé") != {"ünïcödé": 2}: return "unicode count " + repr(M.word_count("Ünïcödé ünïcödé"))
    if M.words("Don't stop") != ["don't", "stop"]: return "the apostrophe rule broke"
def s10():
    s = M.summary("a b a. c!")
    norm = dict(s)
    norm["top"] = [list(x) for x in s.get("top", [])]
    if norm != {"words": 4, "unique": 3, "sentences": 2, "top": [["a", 2], ["b", 1], ["c", 1]]}: return "summary " + repr(s)[:120]
for f in (s1, s2, s3, s4, s5, s6, s7, s8, s9, s10):
    step(f)
done()`;

// ---------------------------------------------------------------- r5 store (Python)
const R5 = `
M, _ = load("r5_store.py")
S = M.Store
class Clock:
    def __init__(self):
        self.t = 0.0
    def __call__(self):
        return self.t
def s1():
    s = S()
    s.set("a", 1)
    if s.get("a") != 1: return "get"
    if s.get("z") is not None or s.get("z", 5) != 5: return "default"
    if s.delete("a") is not True or s.delete("a") is not False: return "delete return values"
    s.set("b", 2); s.set("a", 1)
    if s.keys() != ["a", "b"]: return "keys " + repr(s.keys())
def s2():
    s = S(); s.begin(); s.set("a", 1)
    if s.get("a") != 1: return "not visible inside the transaction"
    s.rollback()
    if s.get("a") is not None: return "rollback kept a"
    s.begin(); s.set("a", 2); s.commit()
    if s.get("a") != 2: return "commit lost a"
    if not raises(s.commit, RuntimeError) or not raises(s.rollback, RuntimeError): return "commit/rollback without a transaction did not raise RuntimeError"
    s.set("k", 1); s.begin(); s.delete("k"); s.rollback()
    if s.get("k") != 1: return "rollback did not undo a delete"
def s3():
    s = S(); s.set("x", 0); s.begin(); s.set("x", 1); s.begin(); s.set("x", 2); s.rollback()
    if s.get("x") != 1: return "inner rollback gave " + repr(s.get("x"))
    s.begin(); s.set("y", 5); s.commit()
    if s.get("y") != 5: return "inner commit"
    s.rollback()
    if s.get("x") != 0 or s.get("y") is not None: return "outer rollback x=%r y=%r" % (s.get("x"), s.get("y"))
def s4():
    c = Clock(); s = S(now=c); s.set("a", 1, ttl=10); c.t = 5
    if s.get("a") != 1: return "expired early"
    c.t = 10
    if s.get("a") is not None: return "did not expire at ttl"
    if "a" in s.keys(): return "keys() lists an expired key"
    s.set("b", 2); c.t = 1e9
    if s.get("b") != 2: return "a key without ttl expired"
    t = S(); t.set("q", 1)
    if t.get("q") != 1: return "Store() broke"
def s5():
    c = Clock(); s = S(now=c)
    s.set("user:1", "a"); s.set("user:2", "b"); s.set("post:1", "c"); s.set("user:3", "d", ttl=1); c.t = 2
    if s.count_prefix("user:") != 2: return "count_prefix " + repr(s.count_prefix("user:"))
    if [tuple(x) for x in s.items("user:")] != [("user:1", "a"), ("user:2", "b")]: return "items " + repr(s.items("user:"))
    if [tuple(x) for x in s.items()] != [("post:1", "c"), ("user:1", "a"), ("user:2", "b")]: return "items() " + repr(s.items())
def s6():
    c = Clock(); s = S(now=c); s.set("a", 1); s.set("b", [1, 2], ttl=5)
    p = os.path.join(tempfile.mkdtemp(), "s.json"); s.save(p)
    c2 = Clock(); c2.t = 10; t = S.load(p, now=c2)
    if t.get("a") != 1: return "a was lost"
    if t.get("b") is not None: return "an expired key survived load"
    c2.t = 0; u = S.load(p, now=c2)
    if u.get("b") != [1, 2]: return "a live key was lost " + repr(u.get("b"))
    s.begin()
    if not raises(lambda: s.save(p), RuntimeError): return "save during a transaction did not raise RuntimeError"
def s7():
    s = S()
    if s.incr("n") != 1 or s.incr("n", 5) != 6 or s.get("n") != 6: return "incr"
    s.set("s", "x")
    if not raises(lambda: s.incr("s"), TypeError): return "incr of a string did not raise TypeError"
    s.begin(); s.incr("n"); s.rollback()
    if s.get("n") != 6: return "rollback did not undo incr"
def s8():
    s = S(max_keys=2); s.set("a", 1); s.set("b", 2)
    if not raises(lambda: s.set("c", 3), OverflowError): return "a third key did not raise OverflowError"
    if s.get("c") is not None: return "the failed set stored c"
    s.set("a", 9)
    if s.get("a") != 9: return "an update was refused"
    s.delete("a"); s.set("c", 3)
    c = Clock(); t = S(now=c); t.set("x", 1)
    if t.get("x") != 1: return "Store(now=...) broke"
    u = S(max_keys=1, now=c); u.set("e", 1, ttl=1); c.t = 2; u.set("f", 2)
    if u.get("f") != 2: return "an expired key still counted toward the limit"
def s9():
    s = S(); s.set("a", 1); s.set("b", 2); s.get("a"); s.get("z")
    st = s.stats()
    if {k: st.get(k) for k in ("keys", "sets", "gets", "hits")} != {"keys": 2, "sets": 2, "gets": 2, "hits": 1}: return "stats " + repr(st)
    s.begin(); s.set("c", 3); s.rollback(); st = s.stats()
    if st.get("sets") != 3 or st.get("keys") != 2: return "after rollback " + repr(st)
def s10():
    c = Clock(); s = S(now=c); s.set("a", 1); s.set("b", 2); s.set("e", 3, ttl=1); c.t = 5
    if ("a" in s) is not True or ("z" in s) is not False or ("e" in s) is not False: return "the in operator"
    if len(s) != 2: return "len " + repr(len(s))
for f in (s1, s2, s3, s4, s5, s6, s7, s8, s9, s10):
    step(f)
done()`;

// ---------------------------------------------------------------- r6 days (Python)
const R6 = `
M, _ = load("r6_days.py")
D = datetime.date
def iw(d):
    return tuple(d.isocalendar()[:2])
def s1():
    if M.parse("2026-09-11") != D(2026, 9, 11): return "parse"
    for bad in ("2026-02-30", "11/09/2026", "2026-9-1", "hello"):
        if not raises(lambda: M.parse(bad), ValueError): return "parse(%r) did not raise ValueError" % bad
    if M.fmt(D(2026, 1, 5)) != "2026-01-05": return "fmt"
def s2():
    if M.add_days("2026-02-27", 2) != "2026-03-01": return "add_days " + repr(M.add_days("2026-02-27", 2))
    if M.add_days("2026-01-01", -1) != "2025-12-31": return "negative n"
def s3():
    if M.is_weekend("2026-09-12") is not True or M.is_weekend("2026-09-11") is not False: return "is_weekend"
    got = [M.add_business_days("2026-09-11", 1), M.add_business_days("2026-09-12", 1), M.add_business_days("2026-09-11", 0), M.add_business_days("2026-09-14", 5)]
    if got != ["2026-09-14", "2026-09-14", "2026-09-11", "2026-09-21"]: return "add_business_days " + repr(got)
def s4():
    if M.add_business_days("2026-09-11", 1, holidays={"2026-09-14"}) != "2026-09-15": return "holiday set"
    if M.add_business_days("2026-09-11", 2, ["2026-09-14", "2026-09-15"]) != "2026-09-17": return "holiday list"
    if M.add_business_days("2026-09-11", 1) != "2026-09-14": return "the old call broke"
def s5():
    b = M.business_days_between
    got = [b("2026-09-11", "2026-09-18"), b("2026-09-11", "2026-09-18", {"2026-09-16"}), b("2026-09-18", "2026-09-11"), b("2026-09-11", "2026-09-13")]
    if got != [5, 4, 0, 0]: return "business_days_between " + repr(got)
def s6():
    got = [M.month_end("2026-02-10"), M.month_end("2024-02-10"), M.add_months("2026-01-31", 1), M.add_months("2026-03-31", -1), M.add_months("2026-11-15", 3)]
    if got != ["2026-02-28", "2024-02-29", "2026-02-28", "2026-02-28", "2027-02-15"]: return "months " + repr(got)
def s7():
    got = [tuple(M.iso_week(s)) for s in ("2026-01-01", "2027-01-01", "2026-09-11")]
    want = [iw(D(2026, 1, 1)), iw(D(2027, 1, 1)), iw(D(2026, 9, 11))]
    if got != want: return "iso_week %r, want %r" % (got, want)
def s8():
    got = [M.weekday_name("2026-09-11"), M.weekday_name("2026-09-13")]
    if got != ["Friday", "Sunday"]: return "weekday_name " + repr(got)
def s9():
    if M.next_weekday("2026-09-11", "friday") != "2026-09-18" or M.next_weekday("2026-09-11", "Monday") != "2026-09-14": return "next_weekday"
    if not raises(lambda: M.next_weekday("2026-09-11", "Funday"), ValueError): return "an unknown name did not raise ValueError"
def s10():
    d = D(2026, 9, 11)
    got = [M.add_days(d, 1), M.is_weekend(D(2026, 9, 12)), M.add_business_days(d, 1), M.business_days_between(d, "2026-09-18"), M.month_end(D(2026, 2, 1)), M.add_months(d, 1), tuple(M.iso_week(D(2026, 1, 1))), M.weekday_name(d), M.next_weekday(d, "monday"), M.fmt(d)]
    want = ["2026-09-12", True, "2026-09-14", 5, "2026-02-28", "2026-10-11", iw(D(2026, 1, 1)), "Friday", "2026-09-14", "2026-09-11"]
    if got != want: return "date inputs " + repr(got)[:140]
for f in (s1, s2, s3, s4, s5, s6, s7, s8, s9, s10):
    step(f)
done()`;

// ---------------------------------------------------------------- r7 grid (Python)
const R7 = `
M, _ = load("r7_grid.py")
T, F = True, False
G = "..#" + NL + ".#." + NL + "..."
def valid_path(grid, path, start, goal, diag=False):
    if not path or tuple(path[0]) != tuple(start) or tuple(path[-1]) != tuple(goal): return False
    for a, b in zip(path, path[1:]):
        dr, dc = abs(a[0] - b[0]), abs(a[1] - b[1])
        if (dr, dc) not in ((1, 0), (0, 1)) and not (diag and (dr, dc) == (1, 1)): return False
        if not grid[b[0]][b[1]]: return False
    return True
def s1():
    g = M.parse_grid(G)
    if g != [[T, T, F], [T, F, T], [T, T, T]]: return "parse_grid " + repr(g)
    if not raises(lambda: M.parse_grid(".." + NL + "..."), ValueError): return "ragged lines did not raise ValueError"
    if not raises(lambda: M.parse_grid(".x"), ValueError): return "a bad character did not raise ValueError"
    if [tuple(x) for x in M.neighbors(g, 1, 0)] != [(0, 0), (2, 0)]: return "neighbors(1,0) " + repr(M.neighbors(g, 1, 0))
    if [tuple(x) for x in M.neighbors(g, 2, 1)] != [(2, 0), (2, 2)]: return "neighbors(2,1) " + repr(M.neighbors(g, 2, 1))
def s2():
    g = M.parse_grid(G)
    p = M.shortest_path(g, (0, 0), (1, 2))
    if not p or len(p) != 6 or not valid_path(g, [tuple(x) for x in p], (0, 0), (1, 2)): return "path " + repr(p)
    h = M.parse_grid(".#." + NL + "###" + NL + "...")
    if M.shortest_path(h, (0, 0), (0, 2)) is not None: return "an unreachable goal did not give None"
    if not raises(lambda: M.shortest_path(g, (0, 2), (0, 0)), ValueError): return "a wall start did not raise ValueError"
    if not raises(lambda: M.shortest_path(g, (0, 0), (5, 5)), ValueError): return "an outside goal did not raise ValueError"
def s3():
    g2 = M.parse_grid(".#" + NL + "#.")
    if M.shortest_path(g2, (0, 0), (1, 1), diagonal=True) is not None: return "cut between two walls"
    g3 = M.parse_grid(".." + NL + "#.")
    p = M.shortest_path(g3, (0, 0), (1, 1), diagonal=True)
    if not p or len(p) != 2: return "diagonal path " + repr(p)
    if set(map(tuple, M.neighbors(g3, 0, 0, diagonal=True))) != {(0, 1), (1, 1)}: return "diagonal neighbors " + repr(M.neighbors(g3, 0, 0, diagonal=True))
    g = M.parse_grid(G)
    if [tuple(x) for x in M.neighbors(g, 1, 0)] != [(0, 0), (2, 0)]: return "the old neighbors() call changed"
    if len(M.shortest_path(g, (0, 0), (1, 2)) or []) != 6: return "the old shortest_path() call changed"
def s4():
    g = M.parse_grid(G)
    if M.render(g) != G: return "render " + repr(M.render(g))
    want = "*.#" + NL + "*#." + NL + "..."
    if M.render(g, [(0, 0), (1, 0)]) != want: return "render with a path " + repr(M.render(g, [(0, 0), (1, 0)]))
def s5():
    c = M.parse_costs(".9." + NL + ".#." + NL + "..5")
    if c != [[1, 9, 1], [1, 0, 1], [1, 1, 5]]: return "parse_costs " + repr(c)
    c = M.parse_costs(".9." + NL + ".#." + NL + "...")
    r = M.cheapest_path(c, (0, 0), (0, 2))
    if not r: return "no path found"
    total, path = r
    path = [tuple(x) for x in path]
    if total != 6: return "total " + repr(total)
    if not valid_path(c, path, (0, 0), (0, 2)) or sum(c[a][b] for a, b in path[1:]) != 6: return "path " + repr(path)
    w = M.parse_costs(".#." + NL + "###" + NL + "...")
    if M.cheapest_path(w, (0, 0), (0, 2)) is not None: return "an unreachable goal did not give None"
def s6():
    g = M.parse_grid(G)
    if set(map(tuple, M.reachable(g, (0, 0)))) != {(0, 0), (0, 1), (1, 0), (1, 2), (2, 0), (2, 1), (2, 2)}: return "reachable " + repr(M.reachable(g, (0, 0)))
    h = M.parse_grid(".#." + NL + ".#." + NL + ".#.")
    if set(map(tuple, M.reachable(h, (0, 0)))) != {(0, 0), (1, 0), (2, 0)}: return "reachable across a wall"
def s7():
    got = [M.count_regions(M.parse_grid(".#." + NL + ".#." + NL + ".#.")), M.count_regions(M.parse_grid("#.#" + NL + "###" + NL + "#.#")), M.count_regions(M.parse_grid("##" + NL + "##")), M.count_regions(M.parse_grid(G))]
    if got != [2, 2, 0, 1]: return "count_regions " + repr(got)
BL = [[F, F, F], [T, T, T], [F, F, F]]
BLV = [[F, T, F], [F, T, F], [F, T, F]]
def B(g):
    return [[bool(v) for v in r] for r in g]
def s8():
    inp = [row[:] for row in BL]
    out = M.life_step(inp)
    if B(out) != BLV: return "blinker " + repr(out)
    if inp != BL: return "the input changed"
    if B(M.life_step([[T, F], [F, F]])) != [[F, F], [F, F]]: return "a lonely cell survived"
def s9():
    if B(M.life_run(BL, 2)) != BL: return "life_run(2)"
    if B(M.life_run(BL, 1)) != BLV: return "life_run(1)"
    block = [[F, F, F, F], [F, T, T, F], [F, T, T, F], [F, F, F, F]]
    if M.is_still(block) is not True or M.is_still(BL) is not False: return "is_still"
def s10():
    t = "..#" + NL + "#.."
    if M.to_text(M.parse_grid(t)) != t: return "to_text " + repr(M.to_text(M.parse_grid(t)))
    g = M.parse_grid(G)
    if M.parse_grid(M.to_text(g)) != g: return "round trip"
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
  const p = join(ws, 'R1_NOTES.md'); if (!existsSync(p)) return { pass: false, why: 'R1_NOTES.md missing' };
  const t = readFileSync(p, 'utf8'); const src = existsSync(join(ws, 'r1_ledger.js')) ? readFileSync(join(ws, 'r1_ledger.js'), 'utf8') : '';
  const miss = ['open', 'deposit', 'balance', 'withdraw', 'transfer', 'history', 'freeze', 'unfreeze', 'undo', 'applyInterest', 'toCSV', 'fromCSV'].filter((n) => !has(t, n));
  if (miss.length) return { pass: false, why: 'notes miss ' + miss.join(', ') };
  if (!/frozen/i.test(t)) return { pass: false, why: 'notes never say what happens to a frozen account' };
  if (!/not enough|insufficient/i.test(t)) return { pass: false, why: 'notes never say withdraw/transfer throw on not enough money' };
  const fake = codeNames(t).filter((n) => !has(src, n) && n !== 'Ledger');
  if (fake.length) return { pass: false, why: 'notes name things r1_ledger.js does not have: ' + fake.slice(0, 6).join(', ') };
  return { pass: true };
}

function indexCheck() {
  const p = join(ws, 'R_INDEX.md'); if (!existsSync(p)) return { pass: false, why: 'R_INDEX.md missing' };
  const t = readFileSync(p, 'utf8');
  const files = readdirSync(ws).filter((f) => /^r\d+_[\w.-]*\.(js|py|html)$/i.test(f) && statSync(join(ws, f)).isFile());
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
  if (fake.length) return { pass: false, why: 'index names things no r-file has: ' + fake.slice(0, 6).join(', ') };
  return { pass: true };
}

async function webChain() {
  if (!existsSync(join(ws, 'r9_app.html'))) return { load: 'missing r9_app.html' };
  const req = createRequire(HUB + 'index.js'); const puppeteer = req('puppeteer');
  const { launchOptions } = await import(pathToFileURL(HUB + 'browser.js').href);
  const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
  const server = http.createServer((q, s) => {
    const f = join(ws, decodeURIComponent(new URL(q.url, 'http://x').pathname));
    if (!f.startsWith(ws) || !existsSync(f) || statSync(f).isDirectory()) { s.writeHead(404); s.end('not found'); return; }
    s.writeHead(200, { 'Content-Type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(readFileSync(f));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/r9_app.html`;
  const browser = await puppeteer.launch(launchOptions());
  const steps = [];
  const itemText = (el) => { const c = el.cloneNode(true); c.querySelectorAll('button, input').forEach((b) => b.remove()); return c.textContent.trim(); };
  const texts = (page, visibleOnly) => page.evaluate((vo, fnSrc) => {
    const it = new Function('return ' + fnSrc)(); const vis = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    return [...document.querySelectorAll('#r9-list li')].filter((li) => !vo || vis(li)).map(it);
  }, !!visibleOnly, itemText.toString());
  const txt = (page, sel) => page.$eval(sel, (el) => el.innerText.trim()).catch(() => null);
  const visible = (page, sel) => page.$eval(sel, (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length) && getComputedStyle(el).visibility !== 'hidden').catch(() => false);
  const liOf = async (page, t) => { for (const li of await page.$$('#r9-list li')) { if ((await li.evaluate((el, fnSrc) => new Function('return ' + fnSrc)()(el), itemText.toString())) === t) return li; } return null; };
  const clickText = async (page, t) => {
    const li = await liOf(page, t); if (!li) throw new Error('no item ' + t);
    const target = await li.evaluateHandle((el, t) => { let best = el; for (const x of [el, ...el.querySelectorAll('*')]) { if (['BUTTON', 'INPUT'].includes(x.tagName)) continue; if ([...x.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim() === t)) best = x; } return best; }, t);
    await target.asElement().click(); await sleep(80);
  };
  const isDone = async (page, t) => { const li = await liOf(page, t); return li ? li.evaluate((el) => el.classList.contains('done')) : null; };
  const add = async (page, t) => { await page.$eval('#r9-input', (el) => { el.value = ''; el.focus(); }); await page.type('#r9-input', t); await page.keyboard.press('Enter'); await sleep(80); };
  const count = (page) => txt(page, '#r9-count');
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
    await run(async (p) => { await add(p, 'milk'); const t = await texts(p); if (!same(t, ['milk'])) return 'items ' + JSON.stringify(t); if ((await p.$eval('#r9-input', (el) => el.value)) !== '') return 'the input was not cleared'; });
    await run(async (p) => { await add(p, '   '); if ((await texts(p)).length) return 'a blank item was added'; await add(p, '  eggs  '); const t = await texts(p); if (!same(t, ['eggs'])) return 'items ' + JSON.stringify(t); });
    await run(async (p) => { const c0 = await count(p); if (c0 !== '0 items left') return 'at start ' + JSON.stringify(c0); await add(p, 'a'); if ((await count(p)) !== '1 item left') return 'with one ' + JSON.stringify(await count(p)); await add(p, 'b'); if ((await count(p)) !== '2 items left') return 'with two ' + JSON.stringify(await count(p)); });
    await run(async (p) => { await add(p, 'a'); await add(p, 'b'); await clickText(p, 'a'); if ((await isDone(p, 'a')) !== true) return 'a is not done after a click'; if ((await isDone(p, 'b')) !== false) return 'b is done';
      if ((await count(p)) !== '1 item left') return 'count ' + JSON.stringify(await count(p)); await clickText(p, 'a'); if ((await isDone(p, 'a')) !== false) return 'a second click did not undo it'; if ((await count(p)) !== '2 items left') return 'count after undoing ' + JSON.stringify(await count(p)); });
    await run(async (p) => { await add(p, 'a'); await add(p, 'b'); const li = await liOf(p, 'a'); const del = li && (await li.$('.r9-del')); if (!del) return 'no .r9-del button in the item'; await del.click(); await sleep(80);
      const t = await texts(p); if (!same(t, ['b'])) return 'after delete ' + JSON.stringify(t); if ((await count(p)) !== '1 item left') return 'count after delete ' + JSON.stringify(await count(p)); });
    await run(async (p) => { for (const x of ['a', 'b', 'c']) await add(p, x); await clickText(p, 'b');
      await p.click('#r9-active'); await sleep(80); let t = await texts(p, true); if (!same(t, ['a', 'c'])) return 'Active shows ' + JSON.stringify(t);
      await p.click('#r9-done'); await sleep(80); t = await texts(p, true); if (!same(t, ['b'])) return 'Done shows ' + JSON.stringify(t);
      await p.click('#r9-all'); await sleep(80); t = await texts(p, true); if (!same(t, ['a', 'b', 'c'])) return 'All shows ' + JSON.stringify(t); });
    await run(async (p) => { for (const x of ['a', 'b', 'c']) await add(p, x); await clickText(p, 'a'); await clickText(p, 'c'); await p.click('#r9-clear'); await sleep(80);
      const t = await texts(p); if (!same(t, ['b'])) return 'after clear ' + JSON.stringify(t); if ((await count(p)) !== '1 item left') return 'count after clear ' + JSON.stringify(await count(p)); });
    await run(async (p) => { await add(p, 'x'); await add(p, 'y'); await clickText(p, 'y'); await p.reload({ waitUntil: 'load' }); await sleep(200);
      const t = await texts(p); if (!same(t, ['x', 'y'])) return 'after reload ' + JSON.stringify(t); if ((await isDone(p, 'y')) !== true || (await isDone(p, 'x')) !== false) return 'the done state was lost';
      if (!(await p.evaluate(() => localStorage.getItem('r9-items')))) return 'nothing saved under r9-items'; });
    await run(async (p) => { if (!(await visible(p, '#r9-empty'))) return 'the empty message is not shown at start'; if (!/Nothing to do/.test((await txt(p, '#r9-empty')) || '')) return 'wrong text ' + JSON.stringify(await txt(p, '#r9-empty'));
      await add(p, 'a'); if (await visible(p, '#r9-empty')) return 'still shown with an item';
      const li = await liOf(p, 'a'); const del = li && (await li.$('.r9-del')); if (del) { await del.click(); await sleep(80); if (!(await visible(p, '#r9-empty'))) return 'not shown again after the last delete'; } });
    await run(async (p) => { await add(p, 'Milk'); await add(p, ' milk '); const t = await texts(p); if (!same(t, ['Milk'])) return 'items ' + JSON.stringify(t); });
  } finally { await browser.close().catch(() => {}); server.close(); }
  return { steps };
}
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

const CHAINS = [
  { n: 1, file: 'r1_ledger.js', lang: 'js', script: R1, last: notesCheck, lastFile: 'R1_NOTES.md' },
  { n: 2, file: 'r2_text.py', lang: 'py', script: R2 },
  { n: 3, file: 'r3_tasks.js', lang: 'js', script: R3 },
  { n: 4, file: 'r4_geom.js', lang: 'js', script: R4 },
  { n: 5, file: 'r5_store.py', lang: 'py', script: R5 },
  { n: 6, file: 'r6_days.py', lang: 'py', script: R6 },
  { n: 7, file: 'r7_grid.py', lang: 'py', script: R7 },
  { n: 8, file: 'r8_money.js', lang: 'js', script: R8 },
  { n: 9, file: 'r9_app.html', lang: 'web' },
  { n: 10, file: 'r10_report.js', lang: 'js', script: R10, last: indexCheck, lastFile: 'R_INDEX.md' },
];

const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',').map(Number)) : null;   // mutation runs: check only these chains
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
const per = CHAINS.filter((c) => !ONLY || ONLY.has(c.n)).map((c) => `r${c.n} ${results.filter((r) => r.chain === c.n && r.impl).length}/10`).join('  ');
console.log(`\nper chain (implementation correct): ${per}`);
console.log(`done as asked ${asIs}/100 | implementation correct ${impl}/100 (CT = correct code, own test broke it)`);
if (outAt) writeFileSync(outAt, JSON.stringify({ ws, asIs, impl, results: got }, null, 2));
