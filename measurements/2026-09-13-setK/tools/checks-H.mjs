// checks-F.mjs <workspaceDir> [--out results.json] : hidden checks for set F (100 goals, 10 projects x 10 steps, interleaved).
// Same design as checks-E.mjs: every step checked on the FINAL workspace; goal = (step - 1) * 10 + project; code steps
// scored asIs (own asserts run) and impl (own asserts neutralised); s9 (kanban board) driven in puppeteer with the hub's
// launch options; S1_NOTES.md and S_INDEX.md checked against the real source (every public name, no invented ones).
// ONLY=1,7 checks just those projects (mutation runs). Validated before any model ran: refs/ 100/100, empty 0/100, mutants.
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
const errMsg = (fn) => { try { fn(); return null; } catch (e) { return String((e && e.message) || e); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const approx = (a, b, eps = 1e-9) => typeof a === 'number' && Math.abs(a - b) <= eps;
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
def run_cli(file, *args):
    flags = [] if __debug__ else ["-O"]
    env = dict(os.environ, PYTHONIOENCODING="utf-8", PYTHONDONTWRITEBYTECODE="1")
    out = subprocess.run([sys.executable] + flags + [file, *args], capture_output=True, timeout=30, env=env)
    return out.stdout.decode("utf-8", "replace"), out.stderr.decode("utf-8", "replace")
def tmpfile(text, name="data.txt"):
    p = os.path.join(tempfile.mkdtemp(), name)
    with open(p, "w", encoding="utf-8") as fh:
        fh.write(text)
    return p
`;

// ---------------------------------------------------------------- s1 library (9 code steps; step 10 = notes)
const S1 = `
const M = load('s1_library.js'); const L = pick(M, 'Library') || M;
step(() => { const l = new L(); l.addBook('111', 'Dune', 2); l.addBook('222', 'Emma'); if (l.copies('111') !== 2 || l.copies('222') !== 1) return 'copies ' + l.copies('111') + ' ' + l.copies('222');
  l.addBook('111', 'Other title', 1); if (l.copies('111') !== 3) return 'adding to an existing isbn'; if (!same(l.titles(), ['Dune', 'Emma'])) return 'titles ' + JSON.stringify(l.titles());
  if (l.copies('999') !== 0) return 'an unknown isbn is not 0';
  for (const bad of [0, -1, 1.5, '2']) if (!throws(() => l.addBook('333', 'Bad', bad))) return 'copies ' + JSON.stringify(bad) + ' did not throw';
  if (l.copies('333') !== 0) return 'a refused add was stored'; });
step(() => { const l = new L(); l.addBook('111', 'Dune', 2); l.checkout('111', 'ann'); if (l.available('111') !== 1) return 'available ' + l.available('111');
  if (!throws(() => l.checkout('111', 'ann'))) return 'the same member twice did not throw';
  l.checkout('111', 'bob'); if (l.available('111') !== 0) return 'available after two loans ' + l.available('111');
  if (!throws(() => l.checkout('111', 'cy'))) return 'no copy left did not throw'; if (!throws(() => l.checkout('999', 'cy'))) return 'an unknown isbn did not throw';
  if (l.available('111') !== 0 || l.copies('111') !== 2) return 'a refused checkout changed something'; });
step(() => { const l = new L(); l.addBook('111', 'Dune'); l.addBook('222', 'Emma'); l.checkout('222', 'ann'); l.checkout('111', 'ann');
  if (!same(l.loans('ann'), ['111', '222'])) return 'loans ' + JSON.stringify(l.loans('ann')); l.returnBook('111', 'ann');
  if (l.available('111') !== 1 || !same(l.loans('ann'), ['222'])) return 'after returnBook ' + JSON.stringify(l.loans('ann')); if (!same(l.loans('zed'), [])) return 'no loans is not []';
  if (!throws(() => l.returnBook('111', 'ann'))) return 'returning a book the member does not have did not throw'; });
step(() => { const l = new L(); l.addBook('111', 'Dune'); l.checkout('111', 'ann');
  if (!throws(() => l.placeHold('111', 'ann'))) return 'a hold on a book the member has did not throw';
  l.placeHold('111', 'bob'); l.placeHold('111', 'cy'); if (!same(l.holds('111'), ['bob', 'cy'])) return 'holds ' + JSON.stringify(l.holds('111'));
  if (!throws(() => l.placeHold('111', 'bob'))) return 'a second hold by the same member did not throw';
  l.returnBook('111', 'ann'); if (!same(l.loans('bob'), ['111']) || !same(l.holds('111'), ['cy'])) return 'the returned copy did not go to the first hold: ' + JSON.stringify(l.loans('bob')) + ' ' + JSON.stringify(l.holds('111'));
  if (l.available('111') !== 0) return 'available after the hold became a loan';
  const m = new L(); m.addBook('222', 'Emma'); if (!throws(() => m.placeHold('222', 'ann'))) return 'a hold on an available book did not throw'; });
step(() => { const l = new L(); l.addBook('111', 'Dune'); l.addBook('222', 'Emma'); l.addBook('333', 'Faust');
  l.checkout('111', 'ann', 1); l.checkout('222', 'bob', 3); l.checkout('333', 'ann');
  if (l.dueDay('111', 'ann') !== 15 || l.dueDay('333', 'ann') !== 14) return 'dueDay ' + l.dueDay('111', 'ann') + ' ' + l.dueDay('333', 'ann');
  const o = (l.overdue(18) || []).map((x) => [x.isbn, x.member, x.daysLate]);
  if (!same(o, [['333', 'ann', 4], ['111', 'ann', 3], ['222', 'bob', 1]])) return 'overdue(18) ' + JSON.stringify(o);
  if (!same(l.overdue(14), [])) return 'overdue on the due day ' + JSON.stringify(l.overdue(14));
  l.placeHold('222', 'cy'); l.returnBook('222', 'bob', 20); if (l.dueDay('222', 'cy') !== 34) return 'a hold loan starts on the return day: due ' + l.dueDay('222', 'cy'); });
step(() => { const l = new L(); l.addBook('111', 'Dune'); l.checkout('111', 'ann', 0);
  const f = l.returnBook('111', 'ann', 16); if (f !== 50) return 'the fine for 2 days late is ' + f; if (l.fines('ann') !== 50) return 'fines ' + l.fines('ann');
  l.checkout('111', 'ann', 20); if (l.returnBook('111', 'ann', 30) !== 0) return 'an on-time return has a fine';
  l.pay('ann', 20); if (l.fines('ann') !== 30) return 'after pay ' + l.fines('ann');
  if (!throws(() => l.pay('ann', 31))) return 'overpaying did not throw'; if (!throws(() => l.pay('ann', 0))) return 'paying 0 did not throw';
  if (l.fines('bob') !== 0) return 'no fines is not 0'; if (l.fines('ann') !== 30) return 'a refused payment changed the fines'; });
step(() => { const l = new L(); for (const i of ['1', '2', '3', '4']) l.addBook(i, 'B' + i); l.checkout('1', 'ann'); l.checkout('2', 'ann'); l.checkout('3', 'ann');
  let m = errMsg(() => l.checkout('4', 'ann')); if (m === null) return 'a 4th loan did not throw'; if (!/limit/i.test(m)) return 'the message does not say limit: ' + m;
  if (l.available('4') !== 1) return 'the refused loan changed availability';
  l.checkout('4', 'bob'); m = errMsg(() => l.placeHold('4', 'ann')); if (m === null || !/limit/i.test(m)) return 'a hold at the limit: ' + m;
  const k = new L(); k.addBook('9', 'Late'); k.addBook('8', 'Next'); k.checkout('9', 'cy', 0); k.returnBook('9', 'cy', 34);
  m = errMsg(() => k.checkout('8', 'cy')); if (m === null) return '500 cents of fines did not block'; if (!/fines/i.test(m)) return 'the message does not say fines: ' + m;
  k.pay('cy', 25); k.checkout('8', 'cy'); if (!same(k.loans('cy'), ['8'])) return 'paying below 500 did not unblock'; });
step(() => { const l = new L(); l.addBook('222', 'Emma', 1); l.addBook('111', 'Dune', 2); l.checkout('222', 'bob', 2); l.checkout('111', 'ann', 1); l.placeHold('222', 'cy');
  l.checkout('111', 'dan', 0); l.returnBook('111', 'dan', 17);
  const norm = (x) => ({ books: (x.books || []).map((b) => ({ isbn: b.isbn, title: b.title, copies: b.copies })), loans: (x.loans || []).map((o) => ({ isbn: o.isbn, member: o.member, day: o.day })), holds: sortKeys(x.holds), fines: sortKeys(x.fines) });
  const want = { books: [{ isbn: '111', title: 'Dune', copies: 2 }, { isbn: '222', title: 'Emma', copies: 1 }], loans: [{ isbn: '111', member: 'ann', day: 1 }, { isbn: '222', member: 'bob', day: 2 }], holds: { '222': ['cy'] }, fines: { dan: 75 } };
  const j = JSON.parse(JSON.stringify(l.toJSON())); if (!same(norm(j), want)) return 'toJSON ' + JSON.stringify(j).slice(0, 200);
  const v = L.fromJSON(j); if (v.available('111') !== 1 || !same(v.holds('222'), ['cy']) || v.fines('dan') !== 75 || v.dueDay('222', 'bob') !== 16) return 'fromJSON state';
  v.returnBook('222', 'bob', 5); if (!same(v.loans('cy'), ['222'])) return 'the rebuilt hold queue does not work';
  if (!same(norm(JSON.parse(JSON.stringify(L.fromJSON(j).toJSON()))), want)) return 'round trip'; });
step(() => { const l = new L(); l.addBook('3', 'the Dune saga'); l.addBook('1', 'Dune'); l.addBook('2', 'Emma'); l.addBook('4', 'Dune');
  if (!same(l.search('dune'), ['1', '4', '3'])) return 'search ' + JSON.stringify(l.search('dune')); if (!same(l.search('zzz'), [])) return 'no match';
  l.checkout('2', 'ann'); if (!throws(() => l.removeBook('2'))) return 'removing a book on loan did not throw'; if (l.copies('2') !== 1) return 'a refused remove removed it';
  if (l.removeBook('1') !== true || l.copies('1') !== 0 || l.search('dune').includes('1')) return 'removeBook'; if (l.removeBook('1') !== false) return 'an unknown isbn is not false'; });
done();`;

// ---------------------------------------------------------------- s7 cache
const S7 = `
const M = load('s7_cache.js'); const C = pick(M, 'Cache') || M;
const clock = () => { const f = () => f.t; f.t = 0; return f; };
step(() => { const c = new C(2); c.set('a', 1); c.set('b', 2); if (c.get('a') !== 1 || c.size() !== 2 || !c.has('b')) return 'basic';
  c.set('c', 3); if (c.has('b') || !c.has('a') || !c.has('c')) return 'evicted the wrong key (b was the least recently used)';
  if (c.get('zz') !== undefined) return 'a missing key is not undefined';
  c.set('a', 10); c.set('d', 4); if (!c.has('a') || c.has('c') || c.get('a') !== 10) return 'set did not count as a use';
  for (const bad of [0, -1, 1.5, '2']) if (!throws(() => new C(bad))) return 'capacity ' + JSON.stringify(bad) + ' did not throw'; });
step(() => { const c = new C(3); c.set('a', 1); c.set('b', 2); if (c.delete('a') !== true || c.delete('a') !== false) return 'delete return values';
  if (c.has('a') || c.size() !== 1) return 'after delete'; c.clear(); if (c.size() !== 0 || c.has('b')) return 'clear'; c.set('x', 1); if (c.get('x') !== 1) return 'set after clear'; });
step(() => { const c = new C(3); c.set('a', 1); c.set('b', 2); c.set('c', 3); c.get('a'); if (!same(c.keys(), ['a', 'c', 'b'])) return 'keys ' + JSON.stringify(c.keys());
  c.set('b', 5); if (!same(c.keys(), ['b', 'a', 'c'])) return 'after set ' + JSON.stringify(c.keys()); });
step(() => { const c = new C(2); c.set('a', 1); c.set('b', 2); if (c.peek('a') !== 1) return 'peek value'; c.set('c', 3); if (c.has('a')) return 'peek counted as a use';
  if (c.peek('zz') !== undefined) return 'peek of a missing key'; });
step(() => { const t = clock(); const c = new C(5, { ttl: 100, now: t }); c.set('a', 1); c.set('b', 2, { ttl: 500 }); c.set('c', 3); t.t = 50; if (c.get('a') !== 1) return 'expired too early';
  // size() comes FIRST, while nothing has touched the expired entries: a size() that ignores expiry must show here.
  t.t = 150; if (c.size() !== 1) return 'size counts expired entries: ' + c.size();
  if (c.get('a') !== undefined || c.has('a') || c.peek('a') !== undefined) return 'not expired after its ttl';
  if (!same(c.keys(), ['b'])) return 'keys still lists an expired entry: ' + JSON.stringify(c.keys());
  t.t = 499; if (c.get('b') !== 2) return 'a per-entry ttl was ignored'; t.t = 600; if (c.has('b')) return 'the per-entry ttl never expired';
  const d = new C(2); d.set('x', 1); if (d.get('x') !== 1) return 'a cache without ttl broke'; });
step(() => { const t = clock(); const c = new C(2, { ttl: 100, now: t }); c.set('a', 1); c.get('a'); c.get('zz'); c.set('b', 2, { ttl: 1000 }); c.set('c', 3);
  t.t = 200; c.get('c'); c.get('c');
  const s = c.stats(); const got = { hits: s.hits, misses: s.misses, evictions: s.evictions, expirations: s.expirations };
  if (!same(got, { hits: 1, misses: 3, evictions: 1, expirations: 1 })) return 'stats ' + JSON.stringify(got);
  const d = new C(1); d.get('q'); d.set('q', 1); d.get('q'); if (d.stats().hits !== 1 || d.stats().misses !== 1) return 'a fresh cache ' + JSON.stringify(d.stats()); });
step(() => { const log = []; const t = clock(); const c = new C(2, { ttl: 100, now: t, onEvict: (k, v, r) => log.push([k, v, r]) });
  c.set('a', 1); c.set('b', 2); c.set('c', 3); c.delete('b'); t.t = 150; c.get('c'); c.set('d', 4, { ttl: 1000 }); c.set('e', 5, { ttl: 1000 }); c.clear();
  if (!same(log.slice(0, 3), [['a', 1, 'lru'], ['b', 2, 'deleted'], ['c', 3, 'expired']])) return 'onEvict ' + JSON.stringify(log);
  const rest = log.slice(3).map((x) => JSON.stringify(x)).sort(); if (!same(rest, [JSON.stringify(['d', 4, 'deleted']), JSON.stringify(['e', 5, 'deleted'])])) return 'clear ' + JSON.stringify(log.slice(3)); });
step(() => { const log = []; const c = new C(4, { onEvict: (k, v, r) => log.push(k + ':' + r) }); for (const k of ['a', 'b', 'c', 'd']) c.set(k, 1); c.get('a');
  c.resize(2); if (!same(c.keys(), ['a', 'd'])) return 'resize kept ' + JSON.stringify(c.keys()); if (!same(log, ['b:lru', 'c:lru'])) return 'resize evictions ' + JSON.stringify(log);
  c.set('e', 1); if (c.size() !== 2) return 'the new capacity is not used'; if (!throws(() => c.resize(0))) return 'resize(0) did not throw'; });
step(() => { const t = clock(); const c = new C(3, { ttl: 100, now: t }); c.set('a', 1); c.set('b', { x: 2 }, { ttl: 1000 }); c.set('c', 3, { ttl: 1000 }); c.get('b'); t.t = 150;
  const j = JSON.parse(JSON.stringify(c.toJSON())); if (j.capacity !== 3 || !same(j.entries, [['c', 3], ['b', { x: 2 }]])) return 'toJSON ' + JSON.stringify(j);
  const d = C.fromJSON(j); if (!same(d.keys(), ['b', 'c'])) return 'fromJSON order ' + JSON.stringify(d.keys()); d.set('x', 1); d.set('y', 1);
  if (d.has('c') || !d.has('b')) return 'the next eviction differs: ' + JSON.stringify(d.keys()); });
step(() => { const c = new C(2); let calls = 0; const f = (k) => { calls++; return k + '!'; };
  if (c.getOrSet('a', f) !== 'a!' || c.getOrSet('a', f) !== 'a!' || calls !== 1) return 'getOrSet called the factory ' + calls + ' times';
  const s = c.stats(); if (s.hits !== 1 || s.misses !== 1) return 'getOrSet stats ' + JSON.stringify(s);
  const m = errMsg(() => c.getOrSet('b', () => { throw new Error('boom'); })); if (m !== 'boom') return 'the factory error did not reach the caller: ' + m;
  if (c.has('b')) return 'a failed factory stored something'; });
done();`;

// ---------------------------------------------------------------- s10 desk (9 code steps; step 10 = index)
const S10 = `
const R = load('s10_desk.js'); let L = null, C = null;
try { const m1 = require('./s1_library.js'); L = pick(m1, 'Library') || m1; } catch (e) {}
try { const m7 = require('./s7_cache.js'); C = pick(m7, 'Cache') || m7; } catch (e) {}
const needL = () => { if (typeof L !== 'function') throw new Error('s1_library.js does not give a Library class'); };
const needC = () => { if (typeof C !== 'function') throw new Error('s7_cache.js does not give a Cache class'); };
const fn = (n) => { const f = R && R[n]; if (typeof f !== 'function') throw new Error(n + ' is not exported'); return f; };
const lib = () => { needL(); const l = new L(); l.addBook('111', 'Dune', 2); l.addBook('222', 'Emma'); return l; };
step(() => { const got = fn('shelfLine')(lib()); if (got !== 'Dune, Emma') return 'shelfLine ' + JSON.stringify(got); needL(); if (fn('shelfLine')(new L()) !== '(empty)') return 'an empty library'; });
step(() => { const l = lib(); l.checkout('111', 'ann'); const got = fn('availability')(l, '111'); if (got !== '1/2') return 'availability ' + JSON.stringify(got); });
step(() => { const l = lib(); l.checkout('222', 'ann'); l.checkout('111', 'ann'); const got = fn('memberLine')(l, 'ann'); if (got !== 'ann: 111, 222') return 'memberLine ' + JSON.stringify(got);
  if (fn('memberLine')(l, 'bob') !== 'bob: none') return 'no loans ' + JSON.stringify(fn('memberLine')(l, 'bob')); });
step(() => { needC(); const l = lib(); const c = new C(10); const look = fn('makeLookup')(l, c); const a = look('111'); if (a !== '2/2') return 'first answer ' + JSON.stringify(a); l.checkout('111', 'ann');
  if (look('111') !== '2/2') return 'not answered from the cache'; if (c.get('111') !== '2/2') return 'the answer is not kept in the cache under the isbn'; if (look('222') !== '1/1') return 'a second isbn'; });
step(() => { const l = lib(); l.checkout('111', 'ann', 0); l.checkout('222', 'bob', 2); const got = fn('overdueLines')(l, 20);
  if (got !== 'ann owes 111 (6 days)\\nbob owes 222 (4 days)') return 'overdueLines ' + JSON.stringify(got); if (fn('overdueLines')(l, 1) !== '') return 'nothing overdue is not empty'; });
step(() => { const l = lib(); l.addBook('333', 'Faust'); l.checkout('111', 'ann', 0); l.returnBook('111', 'ann', 16); l.checkout('222', 'bob', 0); l.returnBook('222', 'bob', 18); l.checkout('333', 'cy', 0); l.returnBook('333', 'cy', 16);
  const got = fn('fineReport')(l, ['ann', 'bob', 'cy', 'dan']); if (got !== 'bob: $1.00\\nann: $0.50\\ncy: $0.50') return 'fineReport ' + JSON.stringify(got); });
step(() => { const l = lib(); l.addBook('333', 'Faust'); const cb = fn('canBorrow'); if (cb(l, 'ann') !== true) return 'a new member';
  l.checkout('111', 'ann'); l.checkout('222', 'ann'); l.checkout('333', 'ann'); if (cb(l, 'ann') !== false) return 'at 3 loans';
  const k = lib(); k.checkout('111', 'cy', 0); k.returnBook('111', 'cy', 34); if (cb(k, 'cy') !== false) return 'at 500 cents'; k.pay('cy', 1); if (cb(k, 'cy') !== true) return 'at 499 cents'; });
step(() => { needC(); const l = lib(); l.checkout('111', 'ann', 3); const c = new C(5); const s = fn('snapshot')(l, c, 'snap'); if (s !== JSON.stringify(l.toJSON()) || c.get('snap') !== s) return 'snapshot';
  const r = fn('restore')(c, 'snap'); if (!r || r.available('111') !== 1 || r.dueDay('111', 'ann') !== 17) return 'restore'; if (fn('restore')(c, 'nope') !== null) return 'a missing key is not null'; });
step(() => { const l = lib(); l.addBook('333', 'The Dune Saga'); const got = fn('searchLines')(l, 'dune'); if (got !== '111: Dune\\n333: The Dune Saga') return 'searchLines ' + JSON.stringify(got);
  if (fn('searchLines')(l, 'zzz') !== '') return 'no match is not empty'; });
done();`;

// ---------------------------------------------------------------- s3 matrix
const S3 = `
const M = load('s3_matrix.js'); const X = pick(M, 'Matrix') || M;
const arr = (m) => m.toArray();
step(() => { const m = new X([[1, 2, 3], [4, 5, 6]]); if (!same(m.shape(), [2, 3])) return 'shape ' + JSON.stringify(m.shape()); if (m.get(1, 2) !== 6 || m.get(0, 0) !== 1) return 'get';
  if (!throws(() => m.get(2, 0)) || !throws(() => m.get(0, 3)) || !throws(() => m.get(-1, 0))) return 'get outside the matrix did not throw';
  const a = m.toArray(); a[0][0] = 99; if (m.get(0, 0) !== 1) return 'toArray is not a copy';
  for (const bad of [[], [[]], [[1, 2], [3]], [[1, 'x']], [[1, NaN]], [[Infinity]]]) if (!throws(() => new X(bad))) return 'rows ' + JSON.stringify(bad) + ' did not throw'; });
step(() => { const a = new X([[1, 2], [3, 4]]), b = new X([[10, 20], [30, 40]]); if (!same(arr(a.add(b)), [[11, 22], [33, 44]])) return 'add'; if (!same(arr(b.sub(a)), [[9, 18], [27, 36]])) return 'sub';
  if (!same(arr(a), [[1, 2], [3, 4]]) || !same(arr(b), [[10, 20], [30, 40]])) return 'an input changed';
  if (!throws(() => a.add(new X([[1, 2, 3]])))) return 'add of different shapes did not throw'; if (!throws(() => a.sub(new X([[1], [2]])))) return 'sub of different shapes did not throw'; });
step(() => { const a = new X([[1, 2], [3, 4]]); if (!same(arr(a.mul(2)), [[2, 4], [6, 8]])) return 'scalar'; const p = a.mul(new X([[5], [6]])); if (!same(arr(p), [[17], [39]])) return 'product ' + JSON.stringify(arr(p));
  const c = new X([[1, 2, 3]]); if (!same(arr(c.mul(new X([[1], [1], [1]]))), [[6]])) return 'row times column'; if (!throws(() => a.mul(c))) return 'mismatched inner dimensions did not throw'; });
step(() => { const a = new X([[1, 2, 3], [4, 5, 6]]); if (!same(arr(a.transpose()), [[1, 4], [2, 5], [3, 6]])) return 'transpose'; if (!same(arr(X.identity(3)), [[1, 0, 0], [0, 1, 0], [0, 0, 1]])) return 'identity(3)';
  for (const bad of [0, -1, 1.5]) if (!throws(() => X.identity(bad))) return 'identity(' + bad + ') did not throw'; });
step(() => { const a = new X([[1, 2], [3, 4]]); if (a.equals(new X([[1, 2], [3, 4 + 1e-12]])) !== true) return 'within the default eps'; if (a.equals(new X([[1, 2], [3, 4.1]])) !== false) return 'a different entry';
  if (a.equals(new X([[1, 2], [3, 4.1]]), 0.2) !== true) return 'a larger eps'; if (a.equals(new X([[1, 2, 0], [3, 4, 0]])) !== false) return 'a different shape is not false'; });
step(() => { const d = (rows) => new X(rows).determinant(); if (!approx(d([[1, 2], [3, 4]]), -2)) return 'det 2x2 ' + d([[1, 2], [3, 4]]);
  if (!approx(d([[6, 1, 1], [4, -2, 5], [2, 8, 7]]), -306, 1e-9)) return 'det 3x3 ' + d([[6, 1, 1], [4, -2, 5], [2, 8, 7]]);
  if (!approx(d([[0, 0, 0, 5], [0, 3, 1, 1], [0, 0, 4, 1], [2, 1, 1, 1]]), -120, 1e-9)) return 'det 4x4 (needs a row swap) ' + d([[0, 0, 0, 5], [0, 3, 1, 1], [0, 0, 4, 1], [2, 1, 1, 1]]);
  if (!approx(d([[7]]), 7) || !approx(d([[1, 2], [2, 4]]), 0)) return '1x1 or singular'; if (!throws(() => d([[1, 2, 3], [4, 5, 6]]))) return 'a matrix that is not square did not throw'; });
step(() => { const a = new X([[4, 7], [2, 6]]); const inv = a.inverse(); if (!inv.equals(new X([[0.6, -0.7], [-0.2, 0.4]]), 1e-9)) return 'inverse ' + JSON.stringify(inv.toArray());
  const b = new X([[6, 1, 1], [4, -2, 5], [2, 8, 7]]); if (!b.mul(b.inverse()).equals(X.identity(3), 1e-9)) return 'A times inverse(A) is not I';
  if (!new X([[0, 1], [1, 0]]).inverse().equals(new X([[0, 1], [1, 0]]), 1e-9)) return 'a matrix that needs a row swap';
  if (!throws(() => new X([[1, 2], [2, 4]]).inverse())) return 'a singular matrix did not throw'; if (!throws(() => new X([[1, 2, 3]]).inverse())) return 'a matrix that is not square did not throw';
  if (!same(a.toArray(), [[4, 7], [2, 6]])) return 'inverse changed the matrix'; });
step(() => { const x = new X([[2, 1], [1, 3]]).solve([3, 5]); if (!Array.isArray(x) || x.length !== 2 || !approx(x[0], 0.8) || !approx(x[1], 1.4)) return 'solve ' + JSON.stringify(x);
  const y = new X([[0, 2, 1], [1, 1, 1], [2, 1, 0]]).solve([7, 6, 4]); if (!Array.isArray(y) || ![1, 2, 3].every((v, i) => approx(y[i], v))) return 'solve 3x3 ' + JSON.stringify(y);
  if (!throws(() => new X([[2, 1], [1, 3]]).solve([1]))) return 'b of the wrong length did not throw'; if (!throws(() => new X([[1, 2], [2, 4]]).solve([1, 2]))) return 'a singular matrix did not throw'; });
step(() => { const t = new X([[1, 0.5], [-2, 3.3333333], [0.0001, 10]]).toString(); if (t !== '1 0.5\\n-2 3.333\\n0 10') return 'toString ' + JSON.stringify(t);
  const z = new X([[-0.0004, 2.1]]).toString(); if (z !== '0 2.1') return 'a value that rounds to zero ' + JSON.stringify(z); });
step(() => { const t = new X([[1, 0.5], [-2, 3.333]]).toString(); const back = X.fromString(t); if (!back || typeof back.toString !== 'function' || back.toString() !== t) return 'round trip';
  if (!same(X.fromString('1 2\\n3 4').toArray(), [[1, 2], [3, 4]])) return 'fromString';
  if (!throws(() => X.fromString('1 2\\n3'))) return 'rows of different lengths did not throw'; if (!throws(() => X.fromString('1 x'))) return 'a word did not throw'; });
done();`;

// ---------------------------------------------------------------- s5 expression evaluator
const S5 = `
const M = load('s5_expr.js'); const ev = M.evaluate;
const fn = (n) => { if (typeof M[n] !== 'function') throw new Error(n + ' is not exported'); return M[n]; };
const all = (cases, f = ev) => { for (const [e, v] of cases) { const got = f(e); if (!approx(got, v)) return JSON.stringify(e) + ' gave ' + got; } };
step(() => { if (typeof ev !== 'function') return 'evaluate is not exported';
  const r = all([['1 + 2 * 3', 7], ['10 / 4', 2.5], ['8 - 3 - 2', 3], ['2 * 3 + 4 * 5', 26], ['1.5 * 2', 3], ['12 / 3 / 2', 2], ['  7  ', 7]]); if (r) return r;
  if (!throws(() => ev('1 / 0'))) return 'division by zero did not throw'; for (const bad of ['1 +', '', '2 3', '1 * * 2']) if (!throws(() => ev(bad))) return JSON.stringify(bad) + ' did not throw'; });
step(() => { const r = all([['-(2+3)*2', -10], ['2*-3', -6], ['(1 + 2) * (3 + 4)', 21], ['-3', -3], ['2 * (3 + (4 - 1))', 12]]); if (r) return r;
  if (!throws(() => ev('(1 + 2'))) return 'an unclosed parenthesis did not throw'; if (!throws(() => ev('1 + 2)'))) return 'an extra ) did not throw'; });
step(() => all([['2^3', 8], ['2^3^2', 512], ['-2^2', -4], ['2*3^2', 18], ['(-2)^2', 4], ['1 + 2^2 * 3', 13]]));
step(() => { if (!approx(ev('x * 2 + y', { x: 3, y: 1 }), 7)) return 'variables'; if (!approx(ev('_a1 + 1', { _a1: 4 }), 5)) return 'names with _ and digits';
  const m = errMsg(() => ev('x + zed', { x: 1 })); if (m === null) return 'an unknown variable did not throw'; if (!/zed/.test(m)) return 'the message does not name it: ' + m;
  if (!approx(ev('2 + 2'), 4)) return 'a call without vars'; });
step(() => { const r = all([['min(3, 1, 2)', 1], ['max(4)', 4], ['abs(-5)', 5], ['sqrt(16)', 4], ['max(1, 2) * 3', 6], ['abs(2 - 5) + min(1, 0)', 3]]); if (r) return r;
  if (!throws(() => ev('sqrt(-1)'))) return 'sqrt of a negative number did not throw';
  const m = errMsg(() => ev('foo(1)')); if (m === null || !/foo/.test(m)) return 'an unknown function: ' + m;
  if (!throws(() => ev('abs(1, 2)'))) return 'abs with two arguments did not throw'; if (!throws(() => ev('sqrt()'))) return 'sqrt() did not throw'; });
step(() => { const at = (e) => { const m = errMsg(() => ev(e)); const r = m && /at (\\d+)/.exec(m); return r ? Number(r[1]) : m; };
  for (const [e, n] of [['2 + * 3', 4], ['(1+2', 4], ['1 +', 3], ['3 $ 4', 2], ['(1, 2)', 2]]) if (at(e) !== n) return JSON.stringify(e) + ': ' + JSON.stringify(at(e)); });
step(() => { const t = fn('tokenize')('max(x, 2.5) - 1'); const got = (t || []).map((k) => (['lparen', 'rparen', 'comma'].includes(k.type) ? [k.type] : [k.type, k.value]));
  if (!same(got, [['name', 'max'], ['lparen'], ['name', 'x'], ['comma'], ['num', 2.5], ['rparen'], ['op', '-'], ['num', 1]])) return 'tokenize ' + JSON.stringify(got);
  if (!throws(() => fn('tokenize')('1 $ 2'))) return 'an unknown character did not throw'; });
step(() => { const r = fn('toRPN'); for (const [e, want] of [['1 + 2 * x', ['1', '2', 'x', '*', '+']], ['-(a - b)', ['a', 'b', '-', 'neg']], ['max(1, 2) ^ 2', ['1', '2', 'max/2', '2', '^']],
    ['2^3^2', ['2', '3', '2', '^', '^']], ['(1 + 2) * 3', ['1', '2', '+', '3', '*']], ['0.5 / abs(y)', ['0.5', 'y', 'abs/1', '/']]]) if (!same(r(e), want)) return JSON.stringify(e) + ' -> ' + JSON.stringify(r(e)); });
step(() => { const f = fn('compile')('a * b + 1'); if (typeof f !== 'function') return 'compile did not return a function'; if (!approx(f({ a: 2, b: 3 }), 7) || !approx(f({ a: 0, b: 9 }), 1)) return 'compiled results';
  // The name has to be distinctive: "division by zero" happens to contain a y, so /y/ would pass on a compiled
  // function that treats an unknown variable as 0 and then divides by it.
  const g = fn('compile')('total / count'); if (errMsg(() => g({ total: 1, count: 0 })) === null) return 'division by zero did not throw from the compiled function';
  const m = errMsg(() => g({ total: 1 })); if (m === null || !/count/.test(m)) return 'an unknown variable: ' + m;
  if (!approx(fn('compile')('max(p, q)')({ p: 1, q: 5 }), 5)) return 'a function call'; });
step(() => { const r = all([['1 + 1 == 2', 1], ['2 < 1', 0], ['3 >= 3', 1], ['2 * 3 > 5', 1], ['1 != 1', 0], ['4 <= 3 + 1', 1], ['(1 < 2) + (2 < 3)', 2]]); if (r) return r;
  if (!same(fn('toRPN')('a + 1 < b'), ['a', '1', '+', 'b', '<'])) return 'toRPN with a comparison ' + JSON.stringify(fn('toRPN')('a + 1 < b'));
  if (!approx(ev('1 + 2 * 3'), 7)) return 'arithmetic broke'; });
done();`;

// ---------------------------------------------------------------- s2 log analyzer (Python)
const S2 = `
M, printed = load("s2_logs.py")
L1 = '127.0.0.1 - - [10/Oct/2023:13:55:36 +0000] "GET /index.html HTTP/1.1" 200 2326 0.045'
def mk(ip, t, path, status=200, size=100, secs=0.1):
    return '%s - - [%s +0000] "GET %s HTTP/1.1" %s %s %s' % (ip, t, path, status, size, secs)
LOG = NL.join([mk("1.1.1.1", "10/Oct/2023:13:55:36", "/a", 200, 100, 0.1), "", "not a log line", mk("2.2.2.2", "10/Oct/2023:13:59:00", "/b?x=1", 500, 50, 0.3),
               mk("1.1.1.1", "10/Oct/2023:14:05:00", "/a?y=2", 404, "-", 0.2), "   ", mk("3.3.3.3", "10/Oct/2023:15:00:00", "/b", 503, 10, 0.9), "2.2.2.2 broken"])
tup = lambda xs: [tuple(x) for x in xs]
def s1():
    e = M.parse_line(L1)
    want = {"ip": "127.0.0.1", "time": "10/Oct/2023:13:55:36 +0000", "method": "GET", "path": "/index.html", "status": 200, "bytes": 2326, "seconds": 0.045}
    got = {k: e.get(k) for k in want}
    if got != want: return "parse_line " + repr(got)[:150]
    if M.parse_line(mk("10.0.0.2", "10/Oct/2023:13:55:36", "/a", 404, "-", 0.2))["bytes"] != 0: return "a - size is not 0"
    for bad in ("garbage", L1.replace(" 200 ", " abc "), '127.0.0.1 - - "GET / HTTP/1.1" 200 5 0.1'):
        if not raises(lambda: M.parse_line(bad), ValueError): return "accepted " + repr(bad)[:60]
def s2():
    es = M.parse_log(LOG)
    if [e["path"] for e in es] != ["/a", "/b?x=1", "/a?y=2", "/b"]: return "parse_log " + repr([e.get("path") for e in es])
    if M.bad_lines(LOG) != [3, 8]: return "bad_lines " + repr(M.bad_lines(LOG))
def s3():
    es = M.parse_log(LOG)
    if M.status_counts(es) != {200: 1, 500: 1, 404: 1, 503: 1}: return "status_counts " + repr(M.status_counts(es))
    if M.error_rate(es) != 0.5: return "error_rate " + repr(M.error_rate(es))
    if M.error_rate([]) != 0.0: return "no entries"
    three = M.parse_log(NL.join([mk("1.1.1.1", "10/Oct/2023:13:55:36", "/", s) for s in (500, 200, 200)]))
    if M.error_rate(three) != 0.3333: return "rounding " + repr(M.error_rate(three))
def s4():
    es = M.parse_log(LOG)
    if tup(M.top_paths(es)) != [("/a", 2), ("/b", 2)]: return "top_paths " + repr(M.top_paths(es))
    if tup(M.top_paths(es, 1)) != [("/a", 2)]: return "n=1 " + repr(M.top_paths(es, 1))
    more = es + M.parse_log(mk("4.4.4.4", "10/Oct/2023:16:00:00", "/c"))
    if tup(M.top_paths(more, 3)) != [("/a", 2), ("/b", 2), ("/c", 1)]: return "three paths " + repr(M.top_paths(more, 3))
def s5():
    es = M.parse_log(LOG)
    got = [M.percentile(es, p) for p in (10, 25, 50, 75, 100)]
    if got != [0.1, 0.1, 0.2, 0.3, 0.9]: return "percentile " + repr(got)
    for bad in (0, 101, -5):
        if not raises(lambda: M.percentile(es, bad), ValueError): return "p=%r did not raise ValueError" % bad
    if not raises(lambda: M.percentile([], 50), ValueError): return "no values did not raise ValueError"
def s6():
    es = M.parse_log(LOG)
    if M.by_hour(es) != {"2023-10-10 13": 150, "2023-10-10 14": 0, "2023-10-10 15": 10}: return "by_hour " + repr(M.by_hour(es))
    jan = M.parse_log(mk("1.1.1.1", "05/Jan/2024:09:00:00", "/", 200, 7, 0.1))
    if M.by_hour(jan) != {"2024-01-05 09": 7}: return "month and day " + repr(M.by_hour(jan))
def s7():
    es = M.parse_log(LOG)
    got = [e["path"] for e in M.between(es, "2023-10-10 13:56:00", "2023-10-10 15:00:00")]
    if got != ["/b?x=1", "/a?y=2"]: return "between " + repr(got)
    if [e["path"] for e in M.between(es, "2023-10-10 15:00:00", "2023-10-10 15:00:01")] != ["/b"]: return "start is not included"
def s8():
    es = M.parse_log(NL.join([mk("1.1.1.1", "10/Oct/2023:10:00:00", "/"), mk("1.1.1.1", "10/Oct/2023:10:20:00", "/"), mk("1.1.1.1", "10/Oct/2023:11:00:00", "/"),
                              mk("2.2.2.2", "10/Oct/2023:10:00:00", "/"), mk("1.1.1.1", "10/Oct/2023:10:05:00", "/")]))
    if M.sessions(es) != {"1.1.1.1": 2, "2.2.2.2": 1}: return "sessions " + repr(M.sessions(es))
    if M.sessions(es, 10) != {"1.1.1.1": 3, "2.2.2.2": 1}: return "gap 10 " + repr(M.sessions(es, 10))
    two = M.parse_log(NL.join([mk("9.9.9.9", "10/Oct/2023:10:00:00", "/"), mk("9.9.9.9", "10/Oct/2023:10:30:00", "/")]))
    if M.sessions(two) != {"9.9.9.9": 1}: return "exactly gap_minutes apart is not a new session"
def s9():
    if printed.strip(): return "importing printed " + printed.strip()[:60]
    p = tmpfile(LOG + NL + mk("4.4.4.4", "10/Oct/2023:16:00:00", "/c", 200, 5, 0.1), "access.log")
    so, se = run_cli("s2_logs.py", p, "--top", "2")
    lines = [l.strip() for l in so.strip().splitlines() if l.strip()]
    if lines != ["requests: 5", "errors: 2", "/a 2", "/b 2"]: return "CLI --top 2 printed " + repr(lines)[:140] + ((" | " + se.strip()[-80:]) if se.strip() else "")
    so, se = run_cli("s2_logs.py", p)
    lines = [l.strip() for l in so.strip().splitlines() if l.strip()]
    if lines != ["requests: 5", "errors: 2", "/a 2", "/b 2", "/c 1"]: return "CLI with the default top printed " + repr(lines)[:140]
def s10():
    e = M.parse_line('::1 - - [10/Oct/2023:13:55:36 +0000] "GET /x HTTP/1.1" 200 12')
    if e.get("ip") != "::1" or e.get("seconds") is not None or e.get("bytes") != 12: return "no seconds / IPv6 " + repr(e)[:120]
    if M.parse_line('2001:db8::7 - - [10/Oct/2023:13:55:36 +0000] "GET /y HTTP/1.1" 404 - 0.5')["ip"] != "2001:db8::7": return "IPv6 with seconds"
    es = M.parse_log(LOG + NL + '::1 - - [10/Oct/2023:13:55:36 +0000] "GET /x HTTP/1.1" 200 12')
    if len(es) != 5: return "the line without seconds was skipped"
    if M.percentile(es, 100) != 0.9 or M.percentile(es, 25) != 0.1: return "percentile with a missing seconds value " + repr(M.percentile(es, 25))
    if M.parse_line(L1)["seconds"] != 0.045: return "seconds broke"
for f in (s1, s2, s3, s4, s5, s6, s7, s8, s9, s10):
    step(f)
done()`;

// ---------------------------------------------------------------- s4 markdown (Python)
const S4 = `
M, _ = load("s4_markdown.py")
BT = chr(96)
h = M.to_html
def s1():
    if h("Hello world") != "<p>Hello world</p>": return "one paragraph " + repr(h("Hello world"))
    got = h("line one" + NL + "line two" + NL + NL + "next")
    if got != "<p>line one line two</p>" + NL + "<p>next</p>": return "two paragraphs " + repr(got)
    if h("a < b & c > d") != "<p>a &lt; b &amp; c &gt; d</p>": return "escaping " + repr(h("a < b & c > d"))
    if h("x" + NL + NL + NL + NL + "y") != "<p>x</p>" + NL + "<p>y</p>": return "several blank lines " + repr(h("x" + NL + NL + NL + NL + "y"))
def s2():
    got = h("# Title" + NL + "text under it" + NL + "## Sub" + NL + NL + "### Small")
    if got != NL.join(["<h1>Title</h1>", "<p>text under it</p>", "<h2>Sub</h2>", "<h3>Small</h3>"]): return "headings " + repr(got)
    if h("#### four") != "<p>#### four</p>": return "four # is not a heading " + repr(h("#### four"))
    if h("#nospace") != "<p>#nospace</p>": return "# without a space " + repr(h("#nospace"))
def s3():
    if h("**bold** and *it*") != "<p><strong>bold</strong> and <em>it</em></p>": return "emphasis " + repr(h("**bold** and *it*"))
    if h("# A **big** deal") != "<h1>A <strong>big</strong> deal</h1>": return "in a heading " + repr(h("# A **big** deal"))
    if h("a * b") != "<p>a * b</p>": return "a lone * " + repr(h("a * b"))
def s4():
    got = h("use " + BT + "a**b** < c" + BT + " here")
    if got != "<p>use <code>a**b** &lt; c</code> here</p>": return "inline code " + repr(got)
    if h(BT + "x" + BT + " and *y*") != "<p><code>x</code> and <em>y</em></p>": return "code, then emphasis " + repr(h(BT + "x" + BT + " and *y*"))
def s5():
    got = h("see [the docs](http://x.org/a?b=1) now")
    if got != '<p>see <a href="http://x.org/a?b=1">the docs</a> now</p>': return "link " + repr(got)
    q = h('[q](a"b)')
    if q != '<p><a href="a&quot;b">q</a></p>': return "a quote in the url " + repr(q)
def s6():
    got = h("- one" + NL + "- **two**" + NL + NL + "after")
    if got != "<ul><li>one</li><li><strong>two</strong></li></ul>" + NL + "<p>after</p>": return "list " + repr(got)
def s7():
    got = h("1. first" + NL + "2. second" + NL + "10. tenth")
    if got != "<ol><li>first</li><li>second</li><li>tenth</li></ol>": return "ordered list " + repr(got)
    both = h("- a" + NL + NL + "1. b")
    if both != "<ul><li>a</li></ul>" + NL + "<ol><li>b</li></ol>": return "both kinds " + repr(both)
def s8():
    F = BT * 3
    got = h("before" + NL + NL + F + NL + "x = 1 < 2" + NL + "  *not em*" + NL + F + NL + NL + "after")
    if got != NL.join(["<p>before</p>", "<pre><code>x = 1 &lt; 2" + NL + "  *not em*</code></pre>", "<p>after</p>"]): return "code block " + repr(got)
    got = h(F + NL + "open" + NL + "# not a heading")
    if got != "<pre><code>open" + NL + "# not a heading</code></pre>": return "an unclosed fence " + repr(got)
def s9():
    got = h("> quoted **text**" + NL + "> # Head" + NL + NL + "plain")
    if got != NL.join(["<blockquote><p>quoted <strong>text</strong></p>" + NL + "<h1>Head</h1></blockquote>", "<p>plain</p>"]): return "blockquote " + repr(got)
def s10():
    t = M.toc("# Intro" + NL + "text" + NL + "## Set up, fast!" + NL + "## Intro" + NL + "### Intro")
    if [tuple(x) for x in t] != [(1, "Intro", "intro"), (2, "Set up, fast!", "set-up-fast"), (2, "Intro", "intro-2"), (3, "Intro", "intro-3")]: return "toc " + repr(t)
    if list(M.toc("no headings")) != []: return "no headings"
    if h("# Intro") != "<h1>Intro</h1>": return "to_html changed"
for f in (s1, s2, s3, s4, s5, s6, s7, s8, s9, s10):
    step(f)
done()`;

// ---------------------------------------------------------------- s6 directed graph (Python)
const S6 = `
M, _ = load("s6_graph.py")
def G(*edges):
    g = M.Graph()
    for e in edges:
        g.add_edge(*e)
    return g
tup = lambda xs: [tuple(x) for x in xs]
def s1():
    g = G(("b", "a", 2), ("a", "c"), ("a", "b", 5))
    g.add_node("z")
    g.add_node("a")
    if g.nodes() != ["a", "b", "c", "z"]: return "nodes " + repr(g.nodes())
    if tup(g.neighbors("a")) != [("b", 5), ("c", 1)]: return "neighbors " + repr(g.neighbors("a"))
    if list(g.neighbors("z")) != []: return "an isolated node"
    g.add_edge("a", "b", 7)
    if tup(g.neighbors("a")) != [("b", 7), ("c", 1)]: return "a repeated edge did not replace the weight"
    for w in (0, -1, "3"):
        if not raises(lambda: g.add_edge("x", "y", w), ValueError): return "weight %r did not raise ValueError" % (w,)
def s2():
    g = G(("a", "c"), ("a", "b"), ("b", "d"), ("c", "d"), ("d", "a"), ("x", "y"))
    if g.bfs("a") != ["a", "b", "c", "d"]: return "bfs " + repr(g.bfs("a"))
    if g.bfs("x") != ["x", "y"] or g.bfs("y") != ["y"]: return "bfs from x / y"
    if not raises(lambda: g.bfs("nope"), KeyError): return "an unknown start did not raise KeyError"
def s3():
    g = G(("a", "b", 1), ("b", "c", 1), ("a", "c", 5), ("c", "d", 1), ("a", "d", 10), ("e", "a", 1))
    r = g.shortest_path("a", "d")
    if r is None or r[0] != 3 or list(r[1]) != ["a", "b", "c", "d"]: return "shortest_path " + repr(r)
    if g.shortest_path("d", "a") is not None: return "unreachable is not None"
    r = g.shortest_path("b", "b")
    if r is None or r[0] != 0 or list(r[1]) != ["b"]: return "a to a " + repr(r)
    if not raises(lambda: g.shortest_path("a", "zz"), KeyError): return "an unknown node did not raise KeyError"
    r = G(("s", "t", 2.5), ("s", "u", 1), ("u", "t", 1)).shortest_path("s", "t")
    if r is None or abs(r[0] - 2) > 1e-9 or list(r[1]) != ["s", "u", "t"]: return "weights " + repr(r)
def s4():
    if G(("a", "b"), ("b", "c")).has_cycle() is not False: return "a chain has no cycle"
    if G(("a", "b"), ("b", "c"), ("c", "a")).has_cycle() is not True: return "a 3-cycle"
    if G(("a", "a")).has_cycle() is not True: return "a self-loop"
    if G(("a", "b"), ("a", "c"), ("b", "d"), ("c", "d")).has_cycle() is not False: return "a diamond is not a cycle"
def s5():
    g = G(("c", "d"), ("a", "d"), ("b", "c"))
    g.add_node("e")
    if g.topo_order() != ["a", "b", "c", "d", "e"]: return "topo_order " + repr(g.topo_order())
    if not raises(lambda: G(("a", "b"), ("b", "a")).topo_order(), ValueError): return "a cycle did not raise ValueError"
def s6():
    g = G(("a", "b"), ("b", "c"), ("c", "a"), ("c", "d"))
    g.remove_node("c")
    if g.nodes() != ["a", "b", "d"]: return "nodes after remove_node " + repr(g.nodes())
    if list(g.neighbors("b")) != []: return "an edge into the removed node is left"
    if g.has_cycle(): return "the cycle through the removed node is still there"
    if not raises(lambda: g.remove_node("zz"), KeyError): return "an unknown node did not raise KeyError"
def s7():
    g = G(("a", "b"), ("b", "c"), ("c", "b"), ("d", "a"), ("e", "e"))
    if g.reachable("a") != ["b", "c"]: return "reachable(a) " + repr(g.reachable("a"))
    if g.reachable("b") != ["b", "c"]: return "a node on a cycle reaches itself " + repr(g.reachable("b"))
    if g.reachable("e") != ["e"]: return "a self-loop " + repr(g.reachable("e"))
    if not raises(lambda: g.reachable("zz"), KeyError): return "an unknown node did not raise KeyError"
def s8():
    g = G(("b", "a"), ("c", "d"), ("e", "d"))
    g.add_node("z")
    g.add_node("f")
    got = [list(c) for c in g.components()]
    if got != [["a", "b"], ["c", "d", "e"], ["f"], ["z"]]: return "components " + repr(got)
def s9():
    g = G(("b", "a", 3), ("a", "c"), ("a", "b", 2))
    g.add_node("z")
    g.add_node("m")
    want = NL.join(["digraph {", "  a -> b [weight=2];", "  a -> c [weight=1];", "  b -> a [weight=3];", "  m;", "  z;", "}"])
    if g.to_dot() != want: return "to_dot " + repr(g.to_dot())
def s10():
    g = M.Graph.from_text(NL.join(["# roads", "a -> b 4", "", "b -> c", "c -> a 2"]))
    if tup(g.neighbors("a")) != [("b", 4)] or tup(g.neighbors("b")) != [("c", 1)] or tup(g.neighbors("c")) != [("a", 2)]: return "from_text " + repr([g.neighbors(n) for n in ("a", "b", "c")])
    for text, n in (("a -> b" + NL + "a b c d e", 2), ("x -> y" + NL + NL + "p => q", 3), ("a -> b zero", 1)):
        try:
            M.Graph.from_text(text)
            return "accepted " + repr(text)
        except ValueError as e:
            if str(n) not in str(e): return "the error for %r does not name line %d: %s" % (text, n, e)
for f in (s1, s2, s3, s4, s5, s6, s7, s8, s9, s10):
    step(f)
done()`;

// ---------------------------------------------------------------- s8 gradebook (Python)
const S8 = `
M, printed = load("s8_grades.py")
def mk():
    g = M.Gradebook()
    for s in ("bob", "ann", "cy"):
        g.add_student(s)
    return g
def s1():
    g = mk()
    g.add_assignment("hw1", 10)
    g.record("ann", "hw1", 8)
    if g.score("ann", "hw1") != 8 or g.score("bob", "hw1") is not None: return "score"
    g.record("ann", "hw1", 9)
    if g.score("ann", "hw1") != 9: return "recording again did not replace the score"
    if not raises(lambda: g.add_student("ann"), ValueError): return "a duplicate student did not raise ValueError"
    if not raises(lambda: g.add_assignment("hw1", 5), ValueError): return "a duplicate assignment did not raise ValueError"
    for bad in (0, -1, "10"):
        if not raises(lambda: g.add_assignment("x" + repr(bad), bad), ValueError): return "max_points %r did not raise ValueError" % (bad,)
    if not raises(lambda: g.record("zed", "hw1", 1), KeyError) or not raises(lambda: g.record("ann", "nope", 1), KeyError): return "an unknown student or assignment did not raise KeyError"
    for bad in (-1, 11):
        if not raises(lambda: g.record("ann", "hw1", bad), ValueError): return "points %r did not raise ValueError" % (bad,)
    if g.score("ann", "hw1") != 9: return "a refused record changed the score"
def s2():
    g = mk()
    for name, mx in (("hw1", 10), ("hw2", 20), ("hw3", 30)):
        g.add_assignment(name, mx)
    g.record("ann", "hw1", 10)
    g.record("ann", "hw2", 5)
    if g.percent("ann") != 50.0: return "percent " + repr(g.percent("ann"))
    g.record("bob", "hw3", 20)
    if g.percent("bob") != 66.67: return "rounding " + repr(g.percent("bob"))
    if g.percent("cy") is not None: return "no scores is not None"
    if not raises(lambda: g.percent("zed"), KeyError): return "an unknown student did not raise KeyError"
def s3():
    got = [M.letter(p) for p in (95, 90, 89.99, 80, 70, 60, 59.9, 0)]
    if got != ["A", "A", "B", "B", "C", "D", "F", "F"]: return "letter " + repr(got)
    g = mk()
    g.add_assignment("hw1", 10)
    g.record("bob", "hw1", 7)
    g.record("ann", "hw1", 9.5)
    if [tuple(r) for r in g.report()] != [("ann", 95.0, "A"), ("bob", 70.0, "C"), ("cy", None, "-")]: return "report " + repr(g.report())
def s4():
    g = mk()
    g.add_assignment("hw1", 10, "hw")
    g.add_assignment("hw2", 10, "hw")
    g.add_assignment("exam", 100, category="exam")
    g.record("ann", "hw1", 10)
    g.record("ann", "hw2", 6)
    g.record("ann", "exam", 50)
    if g.percent("ann") != 65.0: return "equal weights " + repr(g.percent("ann"))
    g.set_weight("exam", 3)
    if g.percent("ann") != 57.5: return "exam weight 3 " + repr(g.percent("ann"))
    g.record("bob", "hw1", 5)
    if g.percent("bob") != 50.0: return "the weights must rescale over the categories with scores " + repr(g.percent("bob"))
    if not raises(lambda: g.set_weight("hw", 0), ValueError): return "weight 0 did not raise ValueError"
    one = mk()
    one.add_assignment("a", 10)
    one.add_assignment("b", 30)
    one.record("ann", "a", 10)
    one.record("ann", "b", 10)
    if one.percent("ann") != 50.0: return "a single category changed " + repr(one.percent("ann"))
def s5():
    g = mk()
    for i, (mx, p) in enumerate([(10, 2), (10, 9), (20, 18), (10, 10)]):
        g.add_assignment("q%d" % i, mx, "quiz")
        g.record("ann", "q%d" % i, p)
    g.add_assignment("exam", 100, "exam")
    g.record("ann", "exam", 80)
    g.drop_lowest("quiz", 1)
    if g.percent("ann") != 86.25: return "drop the lowest quiz " + repr(g.percent("ann"))
    two = mk()
    two.add_assignment("q1", 10, "quiz")
    two.record("bob", "q1", 3)
    two.drop_lowest("quiz", 1)
    if two.percent("bob") != 30.0: return "with only n scores nothing is dropped " + repr(two.percent("bob"))
def s6():
    g = mk()
    g.add_assignment("hw1", 10)
    g.add_assignment("hw2", 10)
    g.record("ann", "hw1", 8)
    if g.percent("ann") != 80.0: return "the default"
    g.set_missing_zero(True)
    if g.percent("ann") != 40.0 or g.percent("cy") != 0.0: return "missing as zero " + repr((g.percent("ann"), g.percent("cy")))
    g.set_missing_zero(False)
    if g.percent("ann") != 80.0: return "switching back"
def s7():
    g = mk()
    g.add_assignment("hw1", 10)
    g.record("ann", "hw1", 9)
    g.record("bob", "hw1", 5)
    g.record("cy", "hw1", 10)
    n = g.curve("hw1", 2)
    if n != 2: return "curve changed " + repr(n)
    got = (g.score("ann", "hw1"), g.score("bob", "hw1"), g.score("cy", "hw1"))
    if got != (10, 7, 10): return "curved scores " + repr(got)
def s8():
    g = mk()
    g.add_assignment("hw2", 10)
    g.add_assignment("hw1", 20)
    g.record("ann", "hw1", 10)
    g.record("ann", "hw2", 9)
    g.record("bob", "hw2", 5)
    want = NL.join(["student,hw2,hw1,percent,letter", "ann,9,10,63.33,D", "bob,5,,50.00,F", "cy,,,,-"])
    if g.to_csv().strip() != want: return "to_csv " + repr(g.to_csv())
def s9():
    g = mk()
    g.add_assignment("hw1", 10)
    g.add_assignment("hw2", 10)
    for s, p in (("ann", 4), ("bob", 7), ("cy", 8)):
        g.record(s, "hw1", p)
    s = g.stats("hw1")
    if {k: s.get(k) for k in ("count", "mean", "median", "min", "max")} != {"count": 3, "mean": 6.33, "median": 7, "min": 4, "max": 8}: return "stats " + repr(s)
    g.record("ann", "hw2", 1)
    g.record("bob", "hw2", 2)
    if g.stats("hw2")["median"] != 1.5: return "median of an even count " + repr(g.stats("hw2"))
    if not raises(lambda: g.stats("nope"), KeyError): return "an unknown assignment did not raise KeyError"
    g.add_assignment("hw3", 10)
    if not raises(lambda: g.stats("hw3"), ValueError): return "nothing recorded did not raise ValueError"
def s10():
    if printed.strip(): return "importing printed " + printed.strip()[:60]
    p = tmpfile(NL.join(["bob,hw1,5,10", "ann,hw1,9,10", "ann,exam,40,50,exam", "bob,exam,50,50,exam"]), "grades.csv")
    so, se = run_cli("s8_grades.py", p)
    rows = [l.strip().split(",") for l in so.strip().splitlines() if l.strip()]
    if not rows or rows[0] != ["student", "hw1", "exam", "percent", "letter"]: return "CLI header " + repr(rows[:1]) + ((" | " + se.strip()[-80:]) if se.strip() else "")
    def num(x):
        try:
            return float(x)
        except ValueError:
            return x
    got = [[r[0]] + [num(x) for x in r[1:3]] + r[3:] for r in rows[1:]]
    if got != [["ann", 9.0, 40.0, "85.00", "B"], ["bob", 5.0, 50.0, "75.00", "C"]]: return "CLI rows " + repr(rows[1:])
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
  const p = join(ws, 'S1_NOTES.md'); if (!existsSync(p)) return { pass: false, why: 'S1_NOTES.md missing' };
  const t = readFileSync(p, 'utf8'); const src = existsSync(join(ws, 's1_library.js')) ? readFileSync(join(ws, 's1_library.js'), 'utf8') : '';
  const miss = ['addBook', 'copies', 'titles', 'checkout', 'available', 'returnBook', 'loans', 'placeHold', 'holds', 'dueDay', 'overdue', 'fines', 'pay', 'toJSON', 'fromJSON', 'search', 'removeBook'].filter((n) => !has(t, n));
  if (miss.length) return { pass: false, why: 'notes miss ' + miss.join(', ') };
  if (!/limit/i.test(t)) return { pass: false, why: 'notes never mention the loan limit' };
  const fake = codeNames(t).filter((n) => !has(src, n) && n !== 'Library');
  if (fake.length) return { pass: false, why: 'notes name things s1_library.js does not have: ' + fake.slice(0, 6).join(', ') };
  return { pass: true };
}

function indexCheck() {
  const p = join(ws, 'S_INDEX.md'); if (!existsSync(p)) return { pass: false, why: 'S_INDEX.md missing' };
  const t = readFileSync(p, 'utf8');
  const files = readdirSync(ws).filter((f) => /^s\d+_[\w.-]*\.(js|py|html)$/i.test(f) && statSync(join(ws, f)).isFile());
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
  if (fake.length) return { pass: false, why: 'index names things no s-file has: ' + fake.slice(0, 6).join(', ') };
  return { pass: true };
}

async function webChain() {
  if (!existsSync(join(ws, 's9_board.html'))) return { load: 'missing s9_board.html' };
  const req = createRequire(HUB + 'index.js'); const puppeteer = req('puppeteer');
  const { launchOptions } = await import(pathToFileURL(HUB + 'browser.js').href);
  const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
  const server = http.createServer((q, s) => {
    const f = join(ws, decodeURIComponent(new URL(q.url, 'http://x').pathname));
    if (!f.startsWith(ws) || !existsSync(f) || statSync(f).isDirectory()) { s.writeHead(404); s.end('not found'); return; }
    s.writeHead(200, { 'Content-Type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(readFileSync(f));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/s9_board.html`;
  const browser = await puppeteer.launch(launchOptions());
  const steps = [];
  const txt = (page, sel) => page.$eval(sel, (el) => el.innerText.replace(/\s+/g, ' ').trim()).catch(() => null);
  const cardText = (el) => { const c = el.cloneNode(true); c.querySelectorAll('button, input').forEach((b) => b.remove()); return c.textContent.replace(/\s+/g, ' ').trim(); };
  const cards = (page, col) => page.evaluate((col, fn) => { const root = document.getElementById('s9-' + col); if (!root) return null;
    const f = new Function('return ' + fn)(); return [...root.querySelectorAll('.s9-card')].map(f); }, col, cardText.toString());
  const add = async (page, text, enter) => { await page.$eval('#s9-new', (el) => { el.value = ''; el.focus(); }); await page.type('#s9-new', text);
    if (enter) await page.keyboard.press('Enter'); else await page.click('#s9-add'); await sleep(80); };
  const click = async (page, col, text, cls) => {
    for (const li of await page.$$('#s9-' + col + ' .s9-card')) {
      if ((await li.evaluate((el, fn) => new Function('return ' + fn)()(el), cardText.toString())) === text) { const b = await li.$('.' + cls); if (!b) throw new Error('card ' + text + ' has no .' + cls + ' button'); await b.click(); await sleep(80); return; }
    }
    throw new Error('no card ' + JSON.stringify(text) + ' in ' + col);
  };
  const counts = async (page) => [await txt(page, '#s9-count-todo'), await txt(page, '#s9-count-doing'), await txt(page, '#s9-count-done')];
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
    await run(async (p) => { await add(p, 'Write spec'); if ((await p.$eval('#s9-new', (el) => el.value)) !== '') return 'the input was not cleared'; await add(p, 'Build it'); await add(p, '   ');
      const t = await cards(p, 'todo'); if (!same(t, ['Write spec', 'Build it'])) return 'To Do ' + JSON.stringify(t);
      if (!same(await cards(p, 'doing'), []) || !same(await cards(p, 'done'), [])) return 'the other columns are not empty'; });
    await run(async (p) => { await add(p, 'A'); await add(p, 'B'); await click(p, 'todo', 'A', 's9-right'); if (!same(await cards(p, 'doing'), ['A'])) return 'right from To Do';
      await click(p, 'doing', 'A', 's9-right'); if (!same(await cards(p, 'done'), ['A'])) return 'right from Doing';
      await click(p, 'done', 'A', 's9-right'); if (!same(await cards(p, 'done'), ['A']) || !same(await cards(p, 'todo'), ['B'])) return 'right from Done moved the card';
      await click(p, 'todo', 'B', 's9-left'); if (!same(await cards(p, 'todo'), ['B'])) return 'left from To Do moved the card';
      await click(p, 'done', 'A', 's9-left'); if (!same(await cards(p, 'doing'), ['A']) || !same(await cards(p, 'done'), [])) return 'left from Done';
      await add(p, 'C'); await click(p, 'todo', 'C', 's9-right'); if (!same(await cards(p, 'doing'), ['A', 'C'])) return 'a moved card goes to the end: ' + JSON.stringify(await cards(p, 'doing')); });
    await run(async (p) => { if (!same(await counts(p), ['0', '0', '0'])) return 'start ' + JSON.stringify(await counts(p));
      await add(p, 'A'); await add(p, 'B'); await click(p, 'todo', 'A', 's9-right'); if (!same(await counts(p), ['1', '1', '0'])) return 'counts ' + JSON.stringify(await counts(p)); });
    await run(async (p) => { await add(p, 'A'); await add(p, 'B'); await click(p, 'todo', 'A', 's9-del'); if (!same(await cards(p, 'todo'), ['B'])) return 'delete ' + JSON.stringify(await cards(p, 'todo'));
      await click(p, 'todo', 'B', 's9-right'); await click(p, 'doing', 'B', 's9-del'); if (!same(await cards(p, 'doing'), [])) return 'delete in Doing'; });
    await run(async (p) => { await add(p, 'A'); await add(p, 'B'); await add(p, 'C'); await click(p, 'todo', 'B', 's9-right'); await p.reload({ waitUntil: 'load' }); await sleep(200);
      if (!same(await cards(p, 'todo'), ['A', 'C']) || !same(await cards(p, 'doing'), ['B'])) return 'after reload ' + JSON.stringify([await cards(p, 'todo'), await cards(p, 'doing')]);
      if (!(await p.evaluate(() => localStorage.getItem('s9-board')))) return 'nothing saved under s9-board'; });
    await run(async (p) => { for (const t of ['A', 'B', 'C', 'D']) await add(p, t); for (const t of ['A', 'B', 'C']) await click(p, 'todo', t, 's9-right'); await click(p, 'todo', 'D', 's9-right');
      if (!same(await cards(p, 'doing'), ['A', 'B', 'C']) || !same(await cards(p, 'todo'), ['D'])) return 'a 4th card got into Doing: ' + JSON.stringify(await cards(p, 'doing'));
      if ((await txt(p, '#s9-msg')) !== 'Doing is full') return 'message ' + JSON.stringify(await txt(p, '#s9-msg'));
      await click(p, 'doing', 'A', 's9-right'); if ((await txt(p, '#s9-msg')) !== '') return 'the message was not emptied: ' + JSON.stringify(await txt(p, '#s9-msg'));
      await click(p, 'todo', 'D', 's9-right'); if (!same(await cards(p, 'doing'), ['B', 'C', 'D'])) return 'after a place freed up ' + JSON.stringify(await cards(p, 'doing')); });
    await run(async (p) => { await add(p, 'Via enter', true); if (!same(await cards(p, 'todo'), ['Via enter'])) return 'Enter did not add: ' + JSON.stringify(await cards(p, 'todo')); });
    await run(async (p) => { for (const t of ['Buy milk', 'Fix bug', 'MILK run']) await add(p, t); await click(p, 'todo', 'Fix bug', 's9-right');
      const shown = () => p.evaluate((fn) => { const f = new Function('return ' + fn)(); return [...document.querySelectorAll('.s9-card')]
        .filter((li) => !!(li.offsetWidth || li.offsetHeight || li.getClientRects().length) && getComputedStyle(li).visibility !== 'hidden').map(f).sort(); }, cardText.toString());
      await p.type('#s9-filter', 'milk'); await sleep(150);
      if (!same(await shown(), ['Buy milk', 'MILK run'])) return 'shown with the filter ' + JSON.stringify(await shown());
      if ((await txt(p, '#s9-count-todo')) !== '2' || (await txt(p, '#s9-count-doing')) !== '1') return 'the counts changed with the filter: ' + JSON.stringify(await counts(p));
      // Clear it with a real keystroke (so input/keyup/keydown listeners all fire): select the text, then Backspace.
      await p.$eval('#s9-filter', (el) => { el.focus(); el.select(); }); await p.keyboard.press('Backspace'); await sleep(150);
      if (!same(await shown(), ['Buy milk', 'Fix bug', 'MILK run'])) return 'an empty filter did not show every card: ' + JSON.stringify(await shown()); });
    await run(async (p) => { await add(p, 'Deploy'); await click(p, 'todo', 'Deploy', 's9-right'); await add(p, '  deploy ');
      if (!same(await cards(p, 'todo'), [])) return 'a duplicate was added: ' + JSON.stringify(await cards(p, 'todo'));
      if ((await txt(p, '#s9-msg')) !== 'Card already exists') return 'message ' + JSON.stringify(await txt(p, '#s9-msg'));
      await add(p, 'Other'); if (!same(await cards(p, 'todo'), ['Other'])) return 'a different card was refused'; });
    await run(async (p) => { for (const t of ['A', 'B', 'C']) await add(p, t); for (const t of ['A', 'B']) { await click(p, 'todo', t, 's9-right'); await click(p, 'doing', t, 's9-right'); }
      await p.click('#s9-clear-done'); await sleep(100);
      if (!same(await cards(p, 'done'), []) || !same(await cards(p, 'todo'), ['C'])) return 'clear done ' + JSON.stringify([await cards(p, 'todo'), await cards(p, 'done')]);
      await p.reload({ waitUntil: 'load' }); await sleep(200); if (!same(await cards(p, 'done'), []) || !same(await cards(p, 'todo'), ['C'])) return 'the cleared board was not saved'; });
  } finally { await browser.close().catch(() => {}); server.close(); }
  return { steps };
}

const CHAINS = [
  { n: 1, file: 's1_library.js', lang: 'js', script: S1, last: notesCheck, lastFile: 'S1_NOTES.md' },
  { n: 2, file: 's2_logs.py', lang: 'py', script: S2 },
  { n: 3, file: 's3_matrix.js', lang: 'js', script: S3 },
  { n: 4, file: 's4_markdown.py', lang: 'py', script: S4 },
  { n: 5, file: 's5_expr.js', lang: 'js', script: S5 },
  { n: 6, file: 's6_graph.py', lang: 'py', script: S6 },
  { n: 7, file: 's7_cache.js', lang: 'js', script: S7 },
  { n: 8, file: 's8_grades.py', lang: 'py', script: S8 },
  { n: 9, file: 's9_board.html', lang: 'web' },
  { n: 10, file: 's10_desk.js', lang: 'js', script: S10, last: indexCheck, lastFile: 'S_INDEX.md' },
].filter((c) => (c.lang === 'web' ? webChain : c.script));

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
const per = CHAINS.filter((c) => !ONLY || ONLY.has(c.n)).map((c) => `s${c.n} ${got.filter((r) => r.chain === c.n && r.impl).length}/10`).join('  ');
console.log(`\nper project (implementation correct): ${per}`);
console.log(`done as asked ${asIs}/100 | implementation correct ${impl}/100 (CT = correct code, own test broke it)`);
if (outAt) writeFileSync(outAt, JSON.stringify({ ws, asIs, impl, results: got }, null, 2));
