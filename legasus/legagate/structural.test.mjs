// STRUCTURAL AUTHORITY, THE HEALTH FLOOR, AND THE CAPABILITY CONTRACT — the three gates Run 0 demanded.
//
// The test that matters most here is DIAGNOSTIC INTEGRITY. T04 was refused by a predicate that was not the
// one its message named, and the outcome happened to be defensible. That is the failure this suite exists
// to make impossible: every rejection must name the predicate that actually fired.
import test from 'node:test';
import assert from 'node:assert';
import { authorizeStructural, signatureOf, describe, PREDICATES } from './structural.mjs';
import { repositoryHealth, healthGate, HEALTH } from '../legaverify/health.mjs';
import { assess, envelopeOf, OPERATION, ANSWER, REFUSAL } from '../legacore/capability.mjs';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const NL = String.fromCharCode(10);
const REF = 'def dedent(text):' + NL + '    margin = None' + NL + '    return text' + NL;
const ctx = { fn: 'dedent', signature: signatureOf(REF, 'dedent') };

test('DIAGNOSTIC INTEGRITY — the reported predicate is the one that actually fired', () => {
  // THE T04 CASE. `import re` plus exactly one `def dedent`. The old gate rejected it while reporting a
  // definition-count problem that did not exist.
  const t04 = 'import re' + NL + NL + 'def dedent(text):' + NL + '    return text.strip()' + NL;
  const r = authorizeStructural(t04, ctx);
  assert.equal(r.ok, false);
  assert.ok(r.failed.includes('SINGLE_TOP_LEVEL_STATEMENT'),
    'the real cause is a second module-level statement');
  // And the predicate it does NOT violate must not be blamed.
  assert.ok(!r.failed.includes('DEFINES_THE_NAMED_FUNCTION'),
    'it defines exactly the named function, so that predicate must be reported as PASSING');
  assert.ok(r.passed.includes('DEFINES_THE_NAMED_FUNCTION'));
  // Every named failure must correspond to a predicate that genuinely evaluates false.
  const d = describe(t04);
  for (const name of r.failed) assert.equal(!!PREDICATES[name].test(d, ctx), false, name);
  for (const name of r.passed) assert.equal(!!PREDICATES[name].test(d, ctx), true, name);
});

test('the gate admits a clean bounded body edit', () => {
  const ok = 'def dedent(text):' + NL + '    return text.lstrip()' + NL;
  const r = authorizeStructural(ok, ctx);
  assert.equal(r.ok, true, JSON.stringify(r.failed));
});

test('PROSE is refused at PARSES — the T06 failure mode, caught structurally', () => {
  const prose = 'To correct the rule, we modify the function.' + NL + NL + 'Here is the code:';
  const r = authorizeStructural(prose, ctx);
  assert.equal(r.ok, false);
  assert.ok(r.failed.includes('PARSES'), 'it is not Python at all');
});

test('SIGNATURE_UNCHANGED fires alone when only the interface moved', () => {
  const widened = 'def dedent(text, tabsize=8):' + NL + '    return text' + NL;
  const r = authorizeStructural(widened, ctx);
  assert.equal(r.ok, false);
  assert.deepEqual(r.failed, ['SIGNATURE_UNCHANGED'],
    'a precise gate blames exactly one thing when exactly one thing is wrong');
});

test('an empty body is refused, and only for that reason', () => {
  const empty = 'def dedent(text):' + NL + '    pass' + NL;
  const r = authorizeStructural(empty, ctx);
  assert.deepEqual(r.failed, ['NON_EMPTY_BODY']);
});

test('a harness failure is NOT an authority decision', () => {
  // If the structural check cannot run, the gate must decline to claim anything rather than default to
  // refusing - a refusal it did not derive is a verdict it did not make.
  const r = authorizeStructural('def dedent(text):' + NL + '    return text' + NL, ctx);
  assert.ok(r.ok === true || r.harnessError, 'either a real verdict or an explicit harness error');
});

test('HEALTH FLOOR — prose written into a module is caught before any semantic question', () => {
  const dir = mkdtempSync(join(tmpdir(), 'health-'));
  writeFileSync(join(dir, 'good.py'), 'def f():' + NL + '    return 1' + NL, 'utf8');
  let h = repositoryHealth(dir, ['good.py']);
  assert.equal(h.status, HEALTH.OK, JSON.stringify(h));

  writeFileSync(join(dir, 'good.py'),
    'def f():' + NL + '    return 1' + NL + NL + 'Here is the corrected code:' + NL, 'utf8');
  h = repositoryHealth(dir, ['good.py']);
  assert.equal(h.status, HEALTH.DOES_NOT_PARSE);
  assert.equal(healthGate(dir, ['good.py']).admit, false);
  rmSync(dir, { recursive: true, force: true });
});

test('a module that parses but does not import is a DIFFERENT defect', () => {
  const dir = mkdtempSync(join(tmpdir(), 'health2-'));
  writeFileSync(join(dir, 'bad.py'), 'import nonexistent_module_xyz' + NL + 'def f():' + NL
    + '    return 1' + NL, 'utf8');
  const h = repositoryHealth(dir, ['bad.py']);
  assert.equal(h.status, HEALTH.DOES_NOT_IMPORT, JSON.stringify(h));
  rmSync(dir, { recursive: true, force: true });
});

test('UNOBSERVABLE health is never an admission', () => {
  const g = healthGate('/definitely/not/a/directory/xyz', ['nope.py']);
  assert.equal(g.admit, false, 'a floor that admits when it cannot see is not a floor');
});

test('CAPABILITY — the four questions are asked before inference, and kept separate', () => {
  const edit = assess({ operation: OPERATION.BOUNDED_FUNCTION_BODY_EDIT, runtimeAuthoritative: true });
  assert.equal(edit.admit, true, JSON.stringify(edit));

  // An addition is representable and constrainable but NOT independently verifiable yet, and the refusal
  // must say which of the four failed - that is what tells you what to build.
  const add = assess({ operation: OPERATION.FUNCTION_ADDITION, runtimeAuthoritative: true });
  assert.equal(add.admit, false);
  assert.equal(add.refusal, REFUSAL.CANNOT_VERIFY);

  const thread = assess({ operation: OPERATION.CROSS_CUTTING_PROPERTY });
  assert.equal(thread.refusal, REFUSAL.CANNOT_REPRESENT);
});

test('CAPABILITY — non-authoritative source is its own refusal, not a capability gap', () => {
  const r = assess({ operation: OPERATION.BOUNDED_FUNCTION_BODY_EDIT, runtimeAuthoritative: false });
  assert.equal(r.admit, false);
  assert.equal(r.refusal, REFUSAL.NONAUTHORITATIVE_SOURCE,
    'the operation is perfectly supported; the SOURCE is the problem, and the fix is different');
});

test('CAPABILITY — unproven runtime provenance refuses BEFORE spending inference', () => {
  const r = assess({ operation: OPERATION.BOUNDED_FUNCTION_BODY_EDIT, runtimeAuthoritative: null });
  assert.equal(r.admit, false);
  assert.equal(r.refusal, REFUSAL.UNKNOWN_RUNTIME_PROVENANCE);
});

test('the ENVELOPE is derived from the capability answers, not declared by hand', () => {
  assert.equal(envelopeOf(OPERATION.BOUNDED_FUNCTION_BODY_EDIT), 'IN');
  assert.equal(envelopeOf(OPERATION.GUARD_INSERTION), 'IN');
  assert.equal(envelopeOf(OPERATION.FUNCTION_ADDITION), 'BOUNDARY');
  assert.equal(envelopeOf(OPERATION.MULTI_FILE_CHANGE), 'OUT');
  assert.equal(envelopeOf(OPERATION.CROSS_CUTTING_PROPERTY), 'OUT');
});
