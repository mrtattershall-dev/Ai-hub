// THE WITNESS BANK — identity, lifecycle, and the ladder.
//
// The lifecycle tests are the ones that matter for a month-long autonomous run: evidence established at
// S0 must not silently remain authority at S5000.
import test from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync, copyFileSync, readdirSync }
  from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { establish, checkFreshness, revalidate, exercise, identityOf, projectionForRender,
  LIFECYCLE, SOURCE_RANK } from './bank.mjs';
import { WITNESS } from './witness.mjs';

const ROOT = 'benchmarks/repoB/pristine';
const PKG = 'packaging';
const TARGET = { module: 'utils.py', callable: 'canonicalize_name' };
const SETUP = ['from packaging.utils import canonicalize_name'];
const CALL = 'canonicalize_name("Foo.Bar_baz")';

test('a witness carries the identity needed to re-check it later', () => {
  const id = identityOf({ rootDir: ROOT, packageName: PKG, target: TARGET, setup: SETUP,
    invocation: CALL });
  for (const k of ['corpus', 'sourceRoot', 'targetSymbol', 'targetFile', 'sourceDigest',
    'setupDigest', 'invocationDigest', 'environment']) {
    assert.ok(id[k] !== undefined && id[k] !== null, k + ' must be recorded');
  }
  assert.equal(id.targetFile, 'packaging/utils.py');
});

test('an established witness that reaches its site is VALID', () => {
  const w = establish({ rootDir: ROOT, packageName: PKG, target: TARGET, setup: SETUP,
    invocation: CALL, provenance: 'DOCTEST' });
  assert.equal(w.state, WITNESS.SITE_REACHED, JSON.stringify(w.why));
  assert.equal(w.lifecycle, LIFECYCLE.VALID);
});

test('an unchanged repository leaves the witness FRESH', () => {
  const w = establish({ rootDir: ROOT, packageName: PKG, target: TARGET, setup: SETUP,
    invocation: CALL, provenance: 'DOCTEST' });
  assert.equal(checkFreshness(w).fresh, true);
});

test('CHANGING THE SOURCE MAKES THE WITNESS STALE — evidence invalidation', () => {
  // The property a month-long run depends on: evidence about a program that has since changed is not
  // evidence about the program that exists now.
  const dir = mkdtempSync(join(tmpdir(), 'bank-'));
  mkdirSync(join(dir, PKG), { recursive: true });
  for (const f of readdirSync(join(ROOT, PKG))) {
    if (f.endsWith('.py')) copyFileSync(join(ROOT, PKG, f), join(dir, PKG, f));
  }
  const w = establish({ rootDir: dir, packageName: PKG, target: TARGET, setup: SETUP,
    invocation: CALL, provenance: 'DOCTEST' });
  assert.equal(w.lifecycle, LIFECYCLE.VALID);
  assert.equal(checkFreshness(w).fresh, true);

  // Touch the source the witness depends on.
  const p = join(dir, PKG, 'utils.py');
  writeFileSync(p, '# a change the witness never saw' + String.fromCharCode(10)
    + readFileSync(p, 'utf8'), 'utf8');
  const stale = checkFreshness(w);
  assert.equal(stale.fresh, false);
  assert.equal(stale.lifecycle, LIFECYCLE.STALE);
  assert.ok(stale.changed.includes('sourceDigest'));

  // Replaying a still-correct change REVALIDATES rather than silently trusting.
  const again = revalidate(stale);
  assert.equal(again.lifecycle, LIFECYCLE.REVALIDATED, JSON.stringify(again.why));
  rmSync(dir, { recursive: true, force: true });
});

test('a change that BREAKS reachability marks the witness INVALID, not merely stale', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bank2-'));
  mkdirSync(join(dir, PKG), { recursive: true });
  for (const f of readdirSync(join(ROOT, PKG))) {
    if (f.endsWith('.py')) copyFileSync(join(ROOT, PKG, f), join(dir, PKG, f));
  }
  const w = establish({ rootDir: dir, packageName: PKG, target: TARGET, setup: SETUP,
    invocation: CALL, provenance: 'DOCTEST' });
  assert.equal(w.lifecycle, LIFECYCLE.VALID);

  // Remove the function entirely: the same invocation can no longer reach it.
  const p = join(dir, PKG, 'utils.py');
  const src = readFileSync(p, 'utf8');
  writeFileSync(p, src.replace(/def canonicalize_name/, 'def canonicalize_name_RENAMED'), 'utf8');
  const after = revalidate(checkFreshness(w));
  assert.equal(after.lifecycle, LIFECYCLE.INVALID, JSON.stringify(after.why));
  assert.equal(after.previousState, WITNESS.SITE_REACHED);
  rmSync(dir, { recursive: true, force: true });
});

test('THE LADDER prefers the more authoritative source and records which rung answered', () => {
  const r = exercise({ rootDir: ROOT, packageName: PKG, target: TARGET, candidates: [
    { provenance: 'SYNTHESIZED', setup: SETUP, invocation: 'canonicalize_name(12345)' },
    { provenance: 'DOCTEST', setup: SETUP, invocation: CALL },
  ] });
  assert.equal(r.established, true, JSON.stringify(r.attempts));
  assert.equal(r.rung, 'DOCTEST', 'the doctest outranks the synthesized call and must be tried first');
  assert.equal(r.attempts[0].provenance, 'DOCTEST');
});

test('NONE is a real answer when nothing can make the site execute', () => {
  const r = exercise({ rootDir: ROOT, packageName: PKG,
    target: { module: 'utils.py', callable: 'a_callable_that_does_not_exist' },
    candidates: [{ provenance: 'SYNTHESIZED', setup: SETUP, invocation: CALL }] });
  assert.equal(r.established, false);
  assert.equal(r.rung, 'NONE');
  assert.ok(r.attempts.length > 0, 'and it must have tried, rather than returning NONE by default');
});

test('SEMANTIC LEAST PRIVILEGE — the render projection carries almost nothing', () => {
  const r = exercise({ rootDir: ROOT, packageName: PKG, target: TARGET,
    candidates: [{ provenance: 'DOCTEST', setup: SETUP, invocation: CALL }] });
  const p = projectionForRender(r);
  assert.equal(p.exercisable, true);
  // The invocation, the setup, the traced frames and the argument values are EXERCISE's business.
  for (const leak of ['invocation', 'setup', 'entered', 'identity', 'witness']) {
    assert.equal(p[leak], undefined, leak + ' must not reach RENDER by default');
  }
});

test('the provenance ranking is total and ends at the least trustworthy source', () => {
  assert.equal(SOURCE_RANK[0], 'EXISTING_WITNESS');
  assert.equal(SOURCE_RANK[SOURCE_RANK.length - 1], 'SYNTHESIZED');
  assert.equal(new Set(SOURCE_RANK).size, SOURCE_RANK.length, 'no duplicate rungs');
});
