// BEHAVIOURAL PROOFS FOR THE CANONICAL SEED (JS half).
//
// The seed is the predecessor state for the 41-60 experiment, so it is part of the treatment
// definition. A seed that satisfies every STRUCTURAL contract can still be a bad predecessor -
// tonight already established that contracts omit behavioural obligations. Anything proven here is
// BEHAVIOURALLY_VERIFIED; anything merely structural stays REFERENCE_IMPLEMENTED_BUT_UNPROVEN and
// is declared as such in the strata provenance.
//
// Every assertion below is taken from the literal wording or worked examples of goals 1-40.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Library } = require('./seed/s1_library.js');
const { Matrix } = require('./seed/s3_matrix.js');
const { evaluate } = require('./seed/s5_expr.js');
const { Cache } = require('./seed/s7_cache.js');
const desk = require('./seed/s10_desk.js');

let pass = 0;
let fail = 0;
const t = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail !== undefined ? '   got ' + JSON.stringify(detail) : '')); }
};
const throws = (fn) => { try { fn(); return false; } catch (e) { return true; } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('  s1_library.js  (goals 1, 11, 21, 31)\n');
{
  const l = new Library();
  l.addBook('a', 'Dune', 2);
  l.addBook('a', 'Dune Messiah', 1);
  t('goal 1: re-adding an isbn adds copies and KEEPS THE FIRST TITLE',
    l.copies('a') === 3 && eq(l.titles(), ['Dune']), [l.copies('a'), l.titles()]);
  t('goal 1: copies() is 0 for an unknown isbn', l.copies('zz') === 0);
  t('goal 1: throws unless copies is a positive integer',
    throws(() => l.addBook('b', 'X', 0)) && throws(() => l.addBook('b', 'X', 1.5)));
  l.addBook('b', 'Anathem');
  t('goal 1: titles() are sorted alphabetically', eq(l.titles(), ['Anathem', 'Dune']), l.titles());

  t('goal 11: available() is copies minus copies on loan', l.available('a') === 3);
  l.checkout('a', 'ann');
  t('goal 11: checkout lends one copy', l.available('a') === 2);
  t('goal 11: throws when that member already has that book', throws(() => l.checkout('a', 'ann')));
  t('goal 11: throws for an unknown isbn', throws(() => l.checkout('zz', 'ann')));
  const before = l.available('a');
  try { l.checkout('a', 'ann'); } catch (e) { /* expected */ }
  t('goal 11: on a throw NOTHING changes', l.available('a') === before);

  l.checkout('a', 'bob');
  t('goal 21: loans() returns the isbns on loan, sorted', eq(l.loans('ann'), ['a']), l.loans('ann'));
  l.returnBook('a', 'ann');
  t('goal 21: returnBook ends the loan', l.available('a') === 2 && eq(l.loans('ann'), []));
  t('goal 21: throws if the member does not have that book', throws(() => l.returnBook('a', 'ann')));

  const q = new Library();
  q.addBook('x', 'Solo', 1);
  q.checkout('x', 'ann');
  t('goal 31: placeHold throws when a copy IS available', throws(() => {
    const r = new Library(); r.addBook('y', 'Y', 1); r.placeHold('y', 'zed');
  }));
  q.placeHold('x', 'bob');
  q.placeHold('x', 'cat');
  t('goal 31: holds() returns the queue in order', eq(q.holds('x'), ['bob', 'cat']), q.holds('x'));
  t('goal 31: throws if the member already holds it', throws(() => q.placeHold('x', 'bob')));
  t('goal 31: throws if the member already HAS it', throws(() => q.placeHold('x', 'ann')));
  q.returnBook('x', 'ann');
  t('goal 31: a returned copy goes straight to the queue head as a new loan',
    eq(q.loans('bob'), ['x']) && eq(q.holds('x'), ['cat']) && q.available('x') === 0,
    [q.loans('bob'), q.holds('x'), q.available('x')]);
}

console.log('\n  s3_matrix.js  (goals 3, 13, 23, 33)\n');
{
  const m = new Matrix([[1, 2, 3], [4, 5, 6]]);
  t('goal 3: shape()', eq(m.shape(), [2, 3]), m.shape());
  t('goal 3: get()', m.get(0, 1) === 2);
  t('goal 3: get() throws outside the matrix', throws(() => m.get(5, 0)));
  const arr = m.toArray();
  arr[0][0] = 99;
  t('goal 3: toArray() returns a COPY', m.get(0, 0) === 1);
  t('goal 3: rejects ragged rows', throws(() => new Matrix([[1, 2], [3]])));
  t('goal 3: rejects non-finite entries', throws(() => new Matrix([[1, NaN]])));
  t('goal 3: rejects no rows / empty rows', throws(() => new Matrix([])) && throws(() => new Matrix([[]])));

  const a = new Matrix([[1, 2], [3, 4]]);
  const b = new Matrix([[10, 20], [30, 40]]);
  t('goal 13: add()', eq(a.add(b).toArray(), [[11, 22], [33, 44]]));
  t('goal 13: sub()', eq(b.sub(a).toArray(), [[9, 18], [27, 36]]));
  t('goal 13: neither operand is mutated', eq(a.toArray(), [[1, 2], [3, 4]]) && eq(b.toArray(), [[10, 20], [30, 40]]));
  t('goal 13: throws when shapes differ', throws(() => a.add(m)));

  t('goal 23: mul() by a number', eq(a.mul(2).toArray(), [[2, 4], [6, 8]]));
  t('goal 23: mul() matrix product', eq(new Matrix([[1, 2, 3]]).mul(new Matrix([[1], [2], [3]])).toArray(), [[14]]));
  t('goal 23: throws when inner dimensions do not match', throws(() => a.mul(new Matrix([[1, 2, 3]]))));

  t('goal 33: transpose()', eq(m.transpose().toArray(), [[1, 4], [2, 5], [3, 6]]));
  t('goal 33: static identity(n)', eq(Matrix.identity(2).toArray(), [[1, 0], [0, 1]]));
  t('goal 33: identity throws unless n is a positive integer',
    throws(() => Matrix.identity(0)) && throws(() => Matrix.identity(2.5)));
}

console.log('\n  s5_expr.js  (goals 5, 15, 25, 35)\n');
{
  t('goal 5: precedence', evaluate('2 + 3 * 4') === 14);
  t('goal 5: left to right', evaluate('10 - 2 - 3') === 5);
  t('goal 5: decimals and spaces', evaluate(' 1.5 * 2 ') === 3);
  t('goal 5: throws on division by zero', throws(() => evaluate('1/0')));
  t('goal 5: throws on junk', throws(() => evaluate('2 +')) && throws(() => evaluate('#')));
  t('goal 15: parentheses and unary minus, -(2+3)*2 is -10', evaluate('-(2+3)*2') === -10, evaluate('-(2+3)*2'));
  t('goal 15: 2*-3 is -6', evaluate('2*-3') === -6, evaluate('2*-3'));
  t('goal 25: 2^3^2 is 512 (right associative)', evaluate('2^3^2') === 512, evaluate('2^3^2'));
  t('goal 25: -2^2 is -4 (minus applies after the power)', evaluate('-2^2') === -4, evaluate('-2^2'));
  t('goal 25: ^ binds tighter than *', evaluate('2*3^2') === 18, evaluate('2*3^2'));
  t('goal 35: variables resolve from vars', evaluate('x + 1', { x: 41 }) === 42);
  let msg = '';
  try { evaluate('y + 1', {}); } catch (e) { msg = e.message; }
  t('goal 35: an unknown name throws with the NAME in the message', msg.includes('y'), msg);
}

console.log('\n  s7_cache.js  (goals 7, 17, 27, 37)\n');
{
  t('goal 7: throws unless capacity is a positive integer',
    throws(() => new Cache(0)) && throws(() => new Cache(1.5)));
  const c = new Cache(2);
  c.set('a', 1);
  c.set('b', 2);
  t('goal 7: get() returns the value, undefined when missing', c.get('a') === 1 && c.get('zz') === undefined);
  c.set('c', 3);
  t('goal 7: evicts the LEAST recently used, and GET counts as a use',
    c.has('a') && !c.has('b') && c.has('c'), [c.has('a'), c.has('b'), c.has('c')]);
  t('goal 7: has() and size()', c.size() === 2);
  const d = new Cache(2);
  d.set('a', 1); d.set('b', 2); d.set('a', 9); d.set('c', 3);
  t('goal 7: SET also counts as a use', d.has('a') && !d.has('b'), [d.has('a'), d.has('b')]);

  t('goal 17: delete() returns true when it removed an entry', d.delete('a') === true);
  t('goal 17: delete() returns false otherwise', d.delete('a') === false);
  d.clear();
  t('goal 17: clear()', d.size() === 0);

  const k = new Cache(3);
  k.set('a', 1); k.set('b', 2); k.set('c', 3); k.get('a');
  t('goal 27: keys() most recently used first', eq(k.keys(), ['a', 'c', 'b']), k.keys());
  const before = k.keys();
  t('goal 37: peek() returns the value like get', k.peek('b') === 2);
  t('goal 37: ...but does NOT count as a use', eq(k.keys(), before), k.keys());
}

console.log('\n  s10_desk.js  (goals 10, 20, 30, 40)\n');
{
  const l = new Library();
  t('goal 10: shelfLine is (empty) with no books', desk.shelfLine(l) === '(empty)');
  l.addBook('a', 'Dune', 2);
  l.addBook('b', 'Anathem', 1);
  t('goal 10: shelfLine joins sorted titles with a comma', desk.shelfLine(l) === 'Anathem, Dune', desk.shelfLine(l));
  l.checkout('a', 'ann');
  t('goal 20: availability is available/copies', desk.availability(l, 'a') === '1/2', desk.availability(l, 'a'));
  t('goal 30: memberLine lists loans', desk.memberLine(l, 'ann') === 'ann: a', desk.memberLine(l, 'ann'));
  t('goal 30: memberLine says none when there are no loans', desk.memberLine(l, 'bob') === 'bob: none');

  const cache = new Cache(4);
  const lookup = desk.makeLookup(l, cache);
  const first = lookup('a');
  l.checkout('a', 'bob');                 // availability really changed underneath
  const second = lookup('a');
  t('goal 40: makeLookup answers from the cache on a repeat call',
    first === '1/2' && second === '1/2', [first, second]);
  t('goal 40: the answer is kept in the given Cache under the isbn', cache.has('a') && cache.peek('a') === '1/2');
}

console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
