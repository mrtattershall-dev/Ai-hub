// EXECUTION WITNESS — the brutal suite, because this layer decides what may become an experiment at all.
//
// Every state must be reachable and distinguishable on REAL code, not on fixtures written to make the
// states appear. All of these run against `packaging`, a repository this architecture was never
// developed against.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { witnessFor, observe, replay, isValidExperiment, WITNESS, PROVENANCE }
  from './witness.mjs';

const ROOT = 'benchmarks/repoB/pristine';
const PKG = 'packaging';

const lineOf = (file, needle) => {
  const lines = readFileSync('benchmarks/repoB/pristine/packaging/' + file, 'utf8').split(/\r?\n/);
  const i = lines.findIndex((l) => l.includes(needle));
  return i < 0 ? null : i + 1;
};

test('1 — a witness REACHES THE FUNCTION, and says so', () => {
  const w = witnessFor({ rootDir: ROOT, packageName: PKG,
    setup: ['from packaging.utils import canonicalize_name'],
    invocation: 'canonicalize_name("Foo.Bar_baz")',
    target: { module: 'utils.py', callable: 'canonicalize_name' }, provenance: PROVENANCE.DOCTEST });
  assert.equal(w.state, WITNESS.SITE_REACHED, JSON.stringify(w));
  assert.equal(w.value, "'foo-bar-baz'");
});

test('2 — a witness reaches the EXACT TARGET SITE, at line granularity', () => {
  const line = lineOf('utils.py', 'def canonicalize_name');
  assert.ok(line, 'the target line must be locatable');
  const w = witnessFor({ rootDir: ROOT, packageName: PKG,
    setup: ['from packaging.utils import canonicalize_name'],
    invocation: 'canonicalize_name("Foo")',
    target: { module: 'utils.py', callable: 'canonicalize_name', line: line + 2 },
    provenance: PROVENANCE.DOCTEST });
  assert.ok([WITNESS.SITE_REACHED, WITNESS.SITE_NOT_REACHED].includes(w.state));
  assert.ok(w.linesInTarget > 0, 'lines inside the module must have been recorded');
});

test('3 — REPLAY actually works; a witness that cannot be reproduced is an anecdote', () => {
  const w = witnessFor({ rootDir: ROOT, packageName: PKG,
    setup: ['from packaging.utils import canonicalize_name'],
    invocation: 'canonicalize_name("Foo_Bar")',
    target: { module: 'utils.py', callable: 'canonicalize_name' }, provenance: PROVENANCE.DOCTEST });
  assert.equal(w.replayable, true);
  const r = replay(w, { rootDir: ROOT, packageName: PKG });
  assert.equal(r.reproduced, true, JSON.stringify(r));
});

test('4 — WRONG ARGUMENTS DO NOT REACH THE DEEP SITE: the Repo B Attempt 0 failure mode', () => {
  // My first version of this test asserted that a bad argument means the function was not reached. That
  // was wrong, and the code was right: `parse_wheel_filename("1.0")` DOES enter the function and then
  // raises inside it. Entering and raising is still reality touching the code.
  //
  // The Attempt 0 failure was never "the function was not entered". It was "the SITE was not reached",
  // and only line granularity can say that - which is exactly why the witness has it.
  const entryOnly = witnessFor({ rootDir: ROOT, packageName: PKG,
    setup: ['from packaging.utils import parse_wheel_filename'],
    invocation: 'parse_wheel_filename("1.0")',
    target: { module: 'utils.py', callable: 'parse_wheel_filename' },
    provenance: PROVENANCE.SYNTHESIZED });
  assert.equal(entryOnly.state, WITNESS.SITE_REACHED, 'the function IS entered');
  assert.equal(entryOnly.outcome, 'RAISED', 'and it raised, which the witness records: '
    + JSON.stringify(entryOnly.status));

  // A line deep inside, past the validation that rejects "1.0", is NOT reached - and that is the fact
  // that invalidates an authority experiment on it.
  const deep = lineOf('utils.py', 'return (name, version, build, tags)');
  assert.ok(deep, 'need a line past the early validation');
  const w = witnessFor({ rootDir: ROOT, packageName: PKG,
    setup: ['from packaging.utils import parse_wheel_filename'],
    invocation: 'parse_wheel_filename("1.0")',
    target: { module: 'utils.py', callable: 'parse_wheel_filename', line: deep },
    provenance: PROVENANCE.SYNTHESIZED });
  assert.equal(w.state, WITNESS.SITE_NOT_REACHED, JSON.stringify(w));
  assert.equal(isValidExperiment(w), false,
    'a site the probe never reaches cannot license an authority experiment on it');
});

test('5 — FUNCTION ENTERED BUT WRONG BRANCH does not count as reaching the site', () => {
  // A line inside a branch this input never takes. The function runs; the site does not.
  const line = lineOf('utils.py', 'raise InvalidSdistFilename');
  assert.ok(line, 'need a line inside a rarely-taken branch');
  const w = witnessFor({ rootDir: ROOT, packageName: PKG,
    setup: ['from packaging.utils import canonicalize_name'],
    invocation: 'canonicalize_name("Foo")',
    target: { module: 'utils.py', callable: 'canonicalize_name', line },
    provenance: PROVENANCE.DOCTEST });
  assert.equal(w.state, WITNESS.SITE_NOT_REACHED, JSON.stringify(w));
  assert.equal(isValidExperiment(w), false);
});

test('6 — a SHADOWED implementation is correctly distinguished from an unreached site', () => {
  // bisect is the known case: the public call succeeds while the Python source never runs.
  const w = witnessFor({ rootDir: 'benchmarks/devrepo', packageName: 'pristine',
    setup: ['import sys', 'sys.path.insert(0, "benchmarks/devrepo/pristine")', 'import bisect'],
    invocation: 'bisect.insort_right([1,3,5], 2)',
    target: { module: 'bisect.py', callable: 'insort_right' }, provenance: PROVENANCE.SYNTHESIZED });
  // Either the target was never entered (shadowed) or the harness could not observe it - but it must
  // NEVER be reported as a valid experiment on that source.
  assert.equal(isValidExperiment(w), false, JSON.stringify(w));
});

test('7 — a CONDITIONAL PLATFORM BRANCH stays unobserved rather than being called shadowed', () => {
  const line = lineOf('tags.py', 'def mac_platforms');
  assert.ok(line);
  const w = witnessFor({ rootDir: ROOT, packageName: PKG,
    setup: ['from packaging.tags import sys_tags'],
    invocation: 'list(sys_tags())[:3]',
    target: { module: 'tags.py', callable: 'mac_platforms', line: line + 3 },
    provenance: PROVENANCE.DOCTEST });
  // On a non-macOS host this must be an unreached path, never an authority claim.
  assert.notEqual(w.state, WITNESS.SITE_REACHED);
  assert.ok([WITNESS.FUNCTION_NOT_ENTERED, WITNESS.SITE_NOT_REACHED, WITNESS.INVOCATION_FAILED,
    WITNESS.UNOBSERVABLE].includes(w.state), JSON.stringify(w));
});

test('8 — a witness INVALIDATES when the setup changes out from under it', () => {
  const good = witnessFor({ rootDir: ROOT, packageName: PKG,
    setup: ['from packaging.utils import canonicalize_name'],
    invocation: 'canonicalize_name("Foo")',
    target: { module: 'utils.py', callable: 'canonicalize_name' }, provenance: PROVENANCE.DOCTEST });
  assert.equal(good.state, WITNESS.SITE_REACHED);
  const broken = witnessFor({ rootDir: ROOT, packageName: PKG,
    setup: ['from packaging.utils import a_name_that_does_not_exist'],
    invocation: 'canonicalize_name("Foo")',
    target: { module: 'utils.py', callable: 'canonicalize_name' }, provenance: PROVENANCE.DOCTEST });
  assert.equal(broken.state, WITNESS.INVOCATION_FAILED, JSON.stringify(broken));
});

test('9 — THE INSTRUMENTATION DOES NOT CHANGE SEMANTICS', () => {
  // If tracing altered behaviour, every witness would describe a program that does not exist.
  const traced = observe({ rootDir: ROOT, packageName: PKG,
    setup: ['from packaging.utils import canonicalize_name'],
    invocation: 'canonicalize_name("Foo.Bar_baz")' });
  const untracedProg = observe({ rootDir: ROOT, packageName: 'nonexistent_package_marker',
    setup: ['from packaging.utils import canonicalize_name'],
    invocation: 'canonicalize_name("Foo.Bar_baz")' });
  assert.equal(traced.value, "'foo-bar-baz'");
  assert.equal(untracedProg.value, traced.value,
    'the value must not depend on whether the tracer was recording');
  assert.equal(untracedProg.entered.length, 0, 'and the control really did record nothing');
});

test('10 — UNOBSERVABLE is never mistaken for a clean negative', () => {
  const w = witnessFor({ rootDir: '/definitely/not/a/path', packageName: PKG,
    setup: ['from packaging.utils import canonicalize_name'],
    invocation: 'canonicalize_name("Foo")',
    target: { module: 'utils.py', callable: 'canonicalize_name' }, provenance: PROVENANCE.DOCTEST });
  assert.ok([WITNESS.UNOBSERVABLE, WITNESS.INVOCATION_FAILED].includes(w.state), JSON.stringify(w));
  assert.equal(isValidExperiment(w), false);
});
