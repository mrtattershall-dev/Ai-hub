// EXECUTION_IDENTITY_NONALIASING — the invariant underneath four separate bugs this project has paid for.
//
//     Evidence belongs to the exact executable identity that produced it.
//     SIMILAR SOURCE IS NOT TRANSFERABLE AUTHORITY.
//
// The control is built on ONE PHYSICAL SOURCE LINE that carries two different executable events: the
// module code object's `def f(x): return x + 1` STATEMENT, and the body of `f` itself. Executing one must
// never satisfy a claim about the other - which the old (module, line) representation could not express,
// because both project onto `m:1`.
import test from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { observe } from './witness.mjs';
import { parseSite, codeIdentity } from './pysite.mjs';

const NL = String.fromCharCode(10);
const PKG = 'aliastest';

function corpus() {
  const dir = mkdtempSync(join(tmpdir(), 'alias-'));
  mkdirSync(join(dir, PKG), { recursive: true });
  writeFileSync(join(dir, PKG, '__init__.py'), '', 'utf8');
  // Line 1 belongs to TWO code objects. Line 2 likewise, for the lambda.
  writeFileSync(join(dir, PKG, 'm.py'), [
    'def f(x): return x + 1',
    'g = lambda: 42',
    'def h(y):',
    '    return y * 2',
    '',
  ].join(NL), 'utf8');
  return dir;
}

const sitesAt = (r, line) => (r.qlines || []).filter((q) => parseSite(q) && parseSite(q).line === line);

test('ONE SOURCE LINE, TWO EXECUTABLE IDENTITIES — importing does not establish the function body', () => {
  const dir = corpus();
  // Import DURING tracing, so the module code object runs and nothing else does.
  const r = observe({ rootDir: dir, packageName: PKG, setup: [],
    invocation: '__import__("' + PKG + '.m", fromlist=["m"])' });
  assert.equal(r.status, 'OK', JSON.stringify(r));

  const atLine1 = sitesAt(r, 1);
  assert.equal(atLine1.length, 1, 'exactly one executable identity ran at line 1: ' + JSON.stringify(atLine1));
  assert.equal(parseSite(atLine1[0]).qualname, '<module>',
    'and it is the module STATEMENT that defines f, not the body of f');
  assert.equal((r.qlines || []).some((q) => parseSite(q).qualname === 'f'), false,
    'f was defined, never called: no site inside f may be claimed');
  rmSync(dir, { recursive: true, force: true });
});

test('THE INVERSE — calling the function establishes ITS site at the same source line', () => {
  const dir = corpus();
  const r = observe({ rootDir: dir, packageName: PKG,
    setup: ['from ' + PKG + ' import m'], invocation: 'm.f(1)' });
  assert.equal(r.value, '2');
  const atLine1 = sitesAt(r, 1);
  assert.equal(atLine1.length, 1);
  assert.equal(parseSite(atLine1[0]).qualname, 'f',
    'now the FUNCTION body ran, and the module statement did not (it ran at import, before tracing)');
  rmSync(dir, { recursive: true, force: true });
});

test('THE KILLER — the two sites share module and line, and are NOT the same identity', () => {
  const dir = corpus();
  const imported = observe({ rootDir: dir, packageName: PKG, setup: [],
    invocation: '__import__("' + PKG + '.m", fromlist=["m"])' });
  const called = observe({ rootDir: dir, packageName: PKG,
    setup: ['from ' + PKG + ' import m'], invocation: 'm.f(1)' });

  const a = sitesAt(imported, 1)[0];
  const b = sitesAt(called, 1)[0];
  const pa = parseSite(a); const pb = parseSite(b);

  // The OLD representation. Identical - which is exactly how evidence laundered itself.
  assert.equal(pa.module + ':' + pa.line, pb.module + ':' + pb.line,
    'under (module, line) these two are indistinguishable');
  // The NEW representation. Distinct, and distinct by FINGERPRINT, not merely by name.
  assert.notEqual(a, b);
  assert.notEqual(pa.fingerprint, pb.fingerprint,
    'identity must come from the executable object, not from its label');
  assert.notEqual(codeIdentity(a), codeIdentity(b));
  rmSync(dir, { recursive: true, force: true });
});

test('a LAMBDA on a shared line is the same failure class, and is also separated', () => {
  const dir = corpus();
  const called = observe({ rootDir: dir, packageName: PKG,
    setup: ['from ' + PKG + ' import m'], invocation: 'm.g()' });
  assert.equal(called.value, '42');
  const atLine2 = sitesAt(called, 2);
  assert.equal(atLine2.length, 1);
  assert.equal(parseSite(atLine2[0]).qualname, '<lambda>');
  rmSync(dir, { recursive: true, force: true });
});

test('SITE IDENTITY IS DEFINED ONCE — the tracer and any denominator cannot drift apart', async () => {
  // A forked `containsPoint` between legacore and legaverify already cost this project an entire family
  // of wrong answers. Two definitions of site identity would be that defect with the numerator and the
  // denominator each internally consistent and jointly wrong.
  const src = await import('node:fs').then((fs) =>
    fs.readFileSync('legasus/legaexercise/witness.mjs', 'utf8'));
  assert.match(src, /FINGERPRINT_SRC/, 'the tracer must embed the shared definition');
  assert.equal(/def sitefp\(/.test(src), false, 'and must not carry a second copy of it');
});

test('the parser treats the LINE as presentation and the FINGERPRINT as identity', () => {
  const k = 'utils|canonicalize_name#3f7c6e9d:100';
  const p = parseSite(k);
  assert.deepEqual(p, { module: 'utils', qualname: 'canonicalize_name',
    fingerprint: '3f7c6e9d', line: 100 });
  assert.equal(codeIdentity(k), 'utils|canonicalize_name#3f7c6e9d',
    'the code identity survives the line moving, which is what a refactor does to a line');
  assert.equal(parseSite('utils:100'), null, 'an unqualified line is not a site and must not parse');
});
