// WITNESSES for ENCLOSING-SCOPE resolution — written BEFORE the implementation change.
//
// GATE 3 defect: an operation inserted into a function body refers to that function's parameters and
// locals. The requirement model searched only for module-level bindings, found none, and declared the
// requirement UNRESOLVED. Scope is inside the declared supported universe, so that is a wrong account
// even though the derived region was correct in all three observed cases.
//
// THE NEW RESOLUTION STATE:  RESOLVED_ENCLOSING_SCOPE
//
// It must impose NO ordering constraint. A parameter exists for the whole body; there is no boundary
// within the body before which it is unavailable. So this state resolves the account without
// narrowing - which is exactly why it needs its own witnesses rather than being inferred from a
// region that was already right.
//
// CONTROLS, and the path-sensitivity rule applies to every one of them:
//   POSITIVE  a name bound by the enclosing unit resolves as enclosing scope, and narrows nothing
//   NEGATIVE  a name bound NOWHERE stays UNRESOLVED - the new state must not swallow real gaps
//   NEGATIVE  a module-level name still resolves as a module binding and still narrows
import { scopeProviders } from './scopefacts.mjs';

const NL = String.fromCharCode(10);
const L = (...xs) => xs.join(NL);

// A module whose function has both parameters and a local, plus a module constant, plus a name that
// exists nowhere. One fixture can therefore exercise every branch.
const SRC = L(
  'BASE = 10',
  '',
  'def handle(channel, msg):',
  '    prefix = str(channel).upper()',
  '    if channel == "a":',
  '        return prefix + msg',
  '    return msg',
);

const cases = [
  { name: 'POSITIVE  a parameter of the enclosing unit resolves as enclosing scope',
    sym: 'channel', parent: { lo: 3, hi: 6 }, expect: 'enclosing_scope' },
  { name: 'POSITIVE  a second parameter resolves the same way',
    sym: 'msg', parent: { lo: 3, hi: 6 }, expect: 'enclosing_scope' },
  { name: 'POSITIVE  a LOCAL of the enclosing unit resolves as enclosing scope',
    sym: 'prefix', parent: { lo: 3, hi: 6 }, expect: 'enclosing_scope' },
  { name: 'NEGATIVE  a module-level name does NOT become enclosing scope',
    sym: 'BASE', parent: { lo: 3, hi: 6 }, expect: null },
  { name: 'NEGATIVE  a name bound nowhere stays unresolved',
    sym: 'nowhere', parent: { lo: 3, hi: 6 }, expect: null },
  { name: 'NEGATIVE  a parameter is NOT in scope for a module-level insertion',
    sym: 'channel', parent: null, expect: null },
  { name: 'NEGATIVE  a local is NOT in scope for a module-level insertion',
    sym: 'prefix', parent: null, expect: null },
];

let fail = 0;
for (const c of cases) {
  const got = scopeProviders(SRC, c.parent, c.sym);
  const ok = (got ? got.kind : null) === c.expect;
  if (!ok) fail++;
  console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + c.name
    + '   -> ' + (got ? got.kind + ' (' + got.why + ')' : 'null'));
}

const pos = cases.filter((c) => c.expect).length;
const neg = cases.filter((c) => !c.expect).length;
console.log('');
console.log('  ' + (fail ? fail + ' WITNESS FAILURE(S)' : 'all ' + cases.length + ' witnesses pass'));
console.log('  Non-vacuity: ' + pos + ' must resolve as enclosing scope and ' + neg + ' must NOT.');
console.log('  A resolver that answered enclosing_scope for everything would fail the negatives and');
console.log('  would silently swallow genuinely unresolved requirements - the failure this state is');
console.log('  most likely to cause if it is built carelessly.');
if (fail) process.exitCode = 1;
