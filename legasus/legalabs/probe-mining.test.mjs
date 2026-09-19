// PROBE MINING — positive, negative and non-vacuity controls, before it is allowed to admit anything.
//
// This apparatus decides which candidates become benchmark tasks, so it gets the same treatment as every
// rejecting stage in this project: it must be shown capable of BOTH answers, and of declining.
import test from 'node:test';
import assert from 'node:assert';
import { mineDoctests, exercisedBy, probesExercising, setupFor, PROVENANCE }
  from './probe-mining.mjs';

const ROOT = 'benchmarks/repoB/pristine';
const PKG = 'benchmarks/repoB/pristine/packaging';

test('doctests are mined from the shipped package, with provenance recorded', () => {
  const ex = mineDoctests(PKG, 'packaging');
  assert.notEqual(ex, null, 'mining must be observable');
  assert.ok(ex.length > 30, 'packaging carries many author-written examples, found ' + ex.length);
  for (const e of ex.slice(0, 5)) {
    assert.equal(e.provenance, PROVENANCE.DOCTEST_DERIVED);
    assert.ok(e.source.length > 0);
  }
});

test('POSITIVE — a probe is proven to enter the callable it calls', () => {
  const r = exercisedBy({ rootDir: ROOT, packageName: 'packaging',
    setup: ['from packaging.utils import *'], source: 'canonicalize_name("Foo.Bar_baz")' });
  assert.notEqual(r, null);
  assert.equal(r.status, 'OK', JSON.stringify(r));
  assert.ok(r.entered.includes('utils.canonicalize_name'),
    'the tracer must record the function actually entered: ' + JSON.stringify(r.entered));
  assert.equal(r.value, "'foo-bar-baz'");
});

test('NEGATIVE — a probe does NOT claim callables it never entered', () => {
  // The whole point of tracing rather than name-matching: this must not report unrelated functions.
  const r = exercisedBy({ rootDir: ROOT, packageName: 'packaging',
    setup: ['from packaging.utils import *'], source: 'canonicalize_name("Foo")' });
  assert.ok(!r.entered.includes('tags.mac_platforms'));
  assert.ok(!r.entered.includes('version.parse'),
    'a name-matching miner would wrongly credit this: ' + JSON.stringify(r.entered));
});

test('METHODS are reachable by traced probes, which the generated prober could never do', () => {
  const r = exercisedBy({ rootDir: ROOT, packageName: 'packaging',
    setup: ['from packaging.version import Version'], source: 'Version("1.2.3") < Version("1.3")' });
  assert.equal(r.status, 'OK', JSON.stringify(r));
  const methods = r.entered.filter((e) => e.startsWith('version.'));
  assert.ok(methods.length > 0, 'entering Version methods: ' + JSON.stringify(r.entered));
});

test('a RAISING probe is reported as raising, not as success and not as absence', () => {
  const r = exercisedBy({ rootDir: ROOT, packageName: 'packaging',
    setup: ['from packaging.version import Version'], source: 'Version("not a version")' });
  assert.notEqual(r, null);
  assert.match(r.status, /^RAISED:/, JSON.stringify(r));
});

test('NON-VACUITY — an unrunnable probe returns null, never an empty success', () => {
  const r = exercisedBy({ rootDir: '/definitely/not/here', packageName: 'packaging',
    setup: [], source: 'canonicalize_name("x")' });
  // Either unobservable (null) or an explicit raise; what it must never be is a clean OK with no entries.
  if (r !== null) assert.notEqual(r.status, 'OK', JSON.stringify(r));
});

test('probesExercising returns only probes PROVEN to enter the target', () => {
  const examples = mineDoctests(PKG, 'packaging');
  const r = probesExercising({ rootDir: ROOT, packageName: 'packaging', examples,
    moduleName: 'utils.py', callableName: 'canonicalize_name' });
  assert.ok(r.observed > 0, 'probes must actually have been evaluated');
  assert.ok(r.hits.length > 0, 'packaging documents canonicalize_name, so a probe must be found');
  for (const h of r.hits) assert.equal(h.provenance, PROVENANCE.DOCTEST_DERIVED);
});

test('a callable nothing documents yields NO probes, and says so rather than inventing one', () => {
  const examples = mineDoctests(PKG, 'packaging');
  const r = probesExercising({ rootDir: ROOT, packageName: 'packaging', examples,
    moduleName: 'utils.py', callableName: 'a_function_that_does_not_exist' });
  assert.equal(r.hits.length, 0);
  assert.ok(r.observed > 0, 'and it must have looked, rather than returning empty because it did not');
});
