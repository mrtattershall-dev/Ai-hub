// WITNESSES for EXPRESSION CONTINUATION — written before the implementation.
//
// GATE 4 defect: a position inside an unclosed bracket is not a legal insertion boundary at all, and
// nothing modelled it. `bodies()` tracks compound statements and knows nothing about an expression
// continued across lines.
//
// THE RULE: after line i, if bracket depth is greater than zero, the statement is still open and
// nothing may be inserted there.
//
// The NEGATIVE controls are the ones that matter. A depth counter that ignores strings and comments
// will find phantom brackets in ordinary code and start removing perfectly legal positions - which is
// over-constraint, the failure this project refuses to reward. Every negative below exists to catch a
// specific way that could happen.
import { openAfterLine } from './continuation.mjs';

const NL = String.fromCharCode(10);
const L = (...xs) => xs.join(NL);

const cases = [
  { name: 'POSITIVE  inside a multi-line list literal',
    src: L('KINDS = ["a", "b"', ']', 'X = 1'), open: [0] },
  { name: 'POSITIVE  inside a multi-line dict literal',
    src: L('M = {"a": 1,', '     "b": 2}', 'X = 1'), open: [0] },
  { name: 'POSITIVE  inside a multi-line call, two levels deep',
    src: L('V = f(g(1,', '        2),', '      3)', 'X = 1'), open: [0, 1] },

  { name: 'NEGATIVE  balanced brackets on one line close immediately',
    src: L('KINDS = ["a", "b"]', 'X = 1'), open: [] },
  { name: 'NEGATIVE  a bracket inside a STRING is not a bracket',
    src: L('S = "a [ b"', 'X = 1'), open: [] },
  { name: 'NEGATIVE  an unbalanced bracket inside a string does not open a continuation',
    src: L("S = 'unclosed [ here'", 'T = "and ) here"', 'X = 1'), open: [] },
  { name: 'NEGATIVE  a bracket inside a COMMENT is not a bracket',
    src: L('X = 1  # see [ this', 'Y = 2'), open: [] },
  { name: 'NEGATIVE  an escaped quote does not end the string early',
    src: L('S = "he said \\" [ still in string"', 'X = 1'), open: [] },
  { name: 'NEGATIVE  a compound statement is NOT a continuation',
    src: L('def f(a):', '    return a', 'X = 1'), open: [] },
];

let fail = 0;
for (const c of cases) {
  const lines = c.src.split(NL);
  const got = [];
  for (let i = 0; i < lines.length; i++) if (openAfterLine(c.src, i) > 0) got.push(i);
  const ok = JSON.stringify(got) === JSON.stringify(c.open);
  if (!ok) fail++;
  console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + c.name
    + '   open after lines ' + JSON.stringify(got) + (ok ? '' : '   expected ' + JSON.stringify(c.open)));
}

const pos = cases.filter((c) => c.open.length).length;
const neg = cases.filter((c) => !c.open.length).length;
console.log('');
console.log('  ' + (fail ? fail + ' WITNESS FAILURE(S)' : 'all ' + cases.length + ' witnesses pass'));
console.log('  Non-vacuity: ' + pos + ' must report an open continuation and ' + neg + ' must not.');
console.log('  A counter that ignored strings or comments would find phantom brackets in ordinary code');
console.log('  and remove legal positions - over-constraint, which this project never rewards. Each');
console.log('  negative names one specific way that could happen.');
if (fail) process.exitCode = 1;
