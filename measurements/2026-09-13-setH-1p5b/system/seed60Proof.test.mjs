// BEHAVIOURAL PROOFS FOR THE POST-GOAL-60 CANONICAL SEED (JS half, files completed so far).
//
// This seed will be the predecessor state for 61-80, and v3's whole purpose includes behavioural
// PRESERVATION - so an unproven predecessor is worse here than it was for the post-40 seed. Every
// assertion below comes from the literal wording or worked examples of goals 1-60.
//
// Anything not proven here stays REFERENCE_IMPLEMENTED_BUT_UNPROVEN and is declared as such rather
// than being quietly counted as correct.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Library } = require('./seed60/s1_library.js');
const { Matrix } = require('./seed60/s3_matrix.js');
const { Cache } = require('./seed60/s7_cache.js');

let pass = 0;
let fail = 0;
const t = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail !== undefined ? '   got ' + JSON.stringify(detail) : '')); }
};
const throws = (fn) => { try { fn(); return false; } catch (e) { return true; } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('  s1_library.js  goals 41 + 51 (with 1/11/21/31 regressions)\n');
{
  const l = new Library();
  l.addBook('a', 'Dune', 2);
  // ---- goals 1/11/21/31 must survive
  l.addBook('a', 'Other', 1);
  t('goal 1 survives: re-add keeps the first title', eq(l.titles(), ['Dune']) && l.copies('a') === 3);
  l.checkout('a', 'ann');
  t('goal 11 survives: available drops', l.available('a') === 2);
  t('goal 21 survives: loans() sorted', eq(l.loans('ann'), ['a']));

  // ---- goal 41: due days
  t('goal 41: a loan is due 14 days after it starts', l.dueDay('a', 'ann') === 14);
  l.checkout('a', 'bob', 10);
  t('goal 41: an explicit start day is respected', l.dueDay('a', 'bob') === 24);
  t('goal 41: calls WITHOUT a day still work', l.dueDay('a', 'ann') === 14);
  t('goal 41: nothing is overdue before the due day', eq(l.overdue(14), []));
  const od = l.overdue(30);
  t('goal 41: overdue rows carry isbn, member, daysLate',
    od.length === 2 && od[0].daysLate === 16 && od[1].daysLate === 6, od);
  t('goal 41: sorted by daysLate DESC', od[0].member === 'ann' && od[1].member === 'bob', od.map((r) => r.member));
  {
    const s = new Library();
    s.addBook('x', 'X', 2);
    s.addBook('y', 'Y', 1);
    s.checkout('y', 'zed', 0);
    s.checkout('x', 'amy', 0);
    s.checkout('x', 'bea', 0);
    const rows = s.overdue(20);
    t('goal 41: ties break by isbn then member',
      eq(rows.map((r) => r.isbn + '/' + r.member), ['x/amy', 'x/bea', 'y/zed']), rows.map((r) => r.isbn + '/' + r.member));
  }
  t('goal 41: dueDay throws when the member does not have it', throws(() => l.dueDay('a', 'nobody')));

  // ---- goal 51: fines
  const f = new Library();
  f.addBook('b', 'B', 1);
  f.checkout('b', 'ann', 0);
  t('goal 51: returning on time returns a zero fine', f.returnBook('b', 'ann', 14) === 0);
  t('goal 51: nothing is owed', f.fines('ann') === 0);
  f.checkout('b', 'ann', 0);
  const fine = f.returnBook('b', 'ann', 18);
  t('goal 51: 25 cents per day late', fine === 100, fine);
  t('goal 51: the fine is added to the unpaid total', f.fines('ann') === 100);
  f.checkout('b', 'ann', 0);
  f.returnBook('b', 'ann', 16);
  t('goal 51: fines accumulate', f.fines('ann') === 150, f.fines('ann'));
  f.pay('ann', 50);
  t('goal 51: pay lowers the total', f.fines('ann') === 100);
  t('goal 51: pay throws for a non-positive amount', throws(() => f.pay('ann', 0)));
  t('goal 51: pay throws for more than is owed', throws(() => f.pay('ann', 101)));
  t('goal 51: a failed payment changes nothing', f.fines('ann') === 100);

  // ---- goals 31 + 41 interacting: a hold that becomes a loan starts on the RETURN day
  const h = new Library();
  h.addBook('c', 'C', 1);
  h.checkout('c', 'ann', 0);
  h.placeHold('c', 'bob');
  h.returnBook('c', 'ann', 5);
  t('goal 31 survives: the queue head became a loan', eq(h.loans('bob'), ['c']));
  t('goal 41: that new loan starts on the day of the return', h.dueDay('c', 'bob') === 19, h.dueDay('c', 'bob'));
}

console.log('\n  s3_matrix.js  goals 43 + 53 (with 3/13/23/33 regressions)\n');
{
  const m = new Matrix([[1, 2], [3, 4]]);
  t('goal 3 survives: shape/get/toArray', eq(m.shape(), [2, 2]) && m.get(1, 0) === 3);
  t('goal 13 survives: add', eq(m.add(m).toArray(), [[2, 4], [6, 8]]));
  t('goal 23 survives: mul', eq(m.mul(2).toArray(), [[2, 4], [6, 8]]));
  t('goal 33 survives: identity/transpose', eq(Matrix.identity(2).toArray(), [[1, 0], [0, 1]]));

  t('goal 43: equal matrices', m.equals(new Matrix([[1, 2], [3, 4]])) === true);
  t('goal 43: within eps', m.equals(new Matrix([[1, 2], [3, 4 + 1e-12]])) === true);
  t('goal 43: outside eps', m.equals(new Matrix([[1, 2], [3, 4.5]])) === false);
  t('goal 43: explicit eps is honoured', m.equals(new Matrix([[1, 2], [3, 4.4]]), 0.5) === true);
  t('goal 43: different shape is false, not a throw', m.equals(new Matrix([[1, 2, 3]])) === false);

  t('goal 53: 1x1', new Matrix([[7]]).determinant() === 7);
  t('goal 53: 2x2', Math.abs(m.determinant() - (-2)) < 1e-9, m.determinant());
  t('goal 53: 3x3', Math.abs(new Matrix([[6, 1, 1], [4, -2, 5], [2, 8, 7]]).determinant() - (-306)) < 1e-9);
  t('goal 53: singular matrix is 0', Math.abs(new Matrix([[1, 2], [2, 4]]).determinant()) < 1e-9);
  t('goal 53: identity is 1', Math.abs(Matrix.identity(4).determinant() - 1) < 1e-9);
  t('goal 53: throws for a non-square matrix', throws(() => new Matrix([[1, 2, 3], [4, 5, 6]]).determinant()));
  t('goal 53: determinant does not mutate the matrix', eq(m.toArray(), [[1, 2], [3, 4]]));
}

console.log('\n  s7_cache.js  goals 47 + 57 (with 7/17/27/37 regressions)\n');
{
  // ---- goals 7/17/27/37 must survive, with NO ttl configured
  const c = new Cache(2);
  c.set('a', 1); c.set('b', 2);
  t('goal 7 survives: get returns the value', c.get('a') === 1);
  c.set('c', 3);
  t('goal 7 survives: LRU eviction, get counts as a use', c.has('a') && !c.has('b'));
  t('goal 17 survives: delete true then false', c.delete('a') === true && c.delete('a') === false);
  const k = new Cache(3);
  k.set('x', 1); k.set('y', 2); k.set('z', 3); k.get('x');
  t('goal 27 survives: keys() MRU first', eq(k.keys(), ['x', 'z', 'y']), k.keys());
  const before = k.keys();
  t('goal 37 survives: peek returns without counting as a use', k.peek('y') === 2 && eq(k.keys(), before));
  t('goal 47: a cache with no ttl NEVER expires', k.has('y') && k.size() === 3);

  // ---- goal 47: expiry with an injected clock
  let clock = 1000;
  const e = new Cache(5, { ttl: 100, now: () => clock });
  e.set('p', 'P');
  t('goal 47: live before the ttl elapses', e.get('p') === 'P');
  clock = 1101;
  t('goal 47: expired entries are missing from get', e.get('p') === undefined);
  t('goal 47: ...and from has', e.has('p') === false);
  t('goal 47: ...and from peek', e.peek('p') === undefined);
  t('goal 47: ...and from size', e.size() === 0);
  t('goal 47: ...and from keys', eq(e.keys(), []));

  clock = 2000;
  const o = new Cache(5, { ttl: 100, now: () => clock });
  o.set('q', 'Q', { ttl: 1000 });
  clock = 2500;
  t('goal 47: a per-entry ttl overrides the default', o.get('q') === 'Q');
  clock = 3100;
  t('goal 47: the per-entry ttl still expires', o.get('q') === undefined);

  // ---- goal 57: stats
  clock = 5000;
  const s = new Cache(2, { ttl: 100, now: () => clock });
  s.set('a', 1);
  s.get('a');            // hit
  s.get('zz');           // miss
  t('goal 57: hits and misses', eq([s.stats().hits, s.stats().misses], [1, 1]), s.stats());
  clock = 5200;
  s.get('a');            // expired -> miss + one expiration
  const st = s.stats();
  t('goal 57: an expiry is counted once', st.expirations === 1, st);
  t('goal 57: an expired get is also a miss', st.misses === 2, st);
  clock = 5300;
  s.get('a');
  t('goal 57: the same entry is not counted as expiring twice', s.stats().expirations === 1, s.stats());
  const ev = new Cache(1);
  ev.set('x', 1); ev.set('y', 2);
  t('goal 57: evictions are counted', ev.stats().evictions === 1, ev.stats());
  t('goal 57: stats() returns all four keys',
    eq(Object.keys(ev.stats()).sort(), ['evictions', 'expirations', 'hits', 'misses']));
}

console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
