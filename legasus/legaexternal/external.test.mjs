// r4 — the eight completion criteria for the external-producer boundary, plus the admit control.
//
// The admit control is the one that stops "fidelity" being solved by preserving everything forever.
import test from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runProducer, externalIdentity } from './producer.mjs';
import { adapt, adaptRecord, readapt, DOCTEST_MAPPING, UNKNOWN_MAPPING } from './adapt.mjs';
import { illegalCompression, illegalRefinement } from '../legaknow/monotonicity.mjs';
import { OBSERVABILITY } from '../legaknow/observation.mjs';

const NL = String.fromCharCode(10);
const PKG = 'extfix';

// A corpus built for this test, with the exact shape that broke identity on pyparsing: the SAME example
// text appearing in two different docstrings with DIFFERENT outcomes.
function corpus() {
  const dir = mkdtempSync(join(tmpdir(), 'ext-'));
  mkdirSync(join(dir, PKG), { recursive: true });
  writeFileSync(join(dir, PKG, '__init__.py'), '', 'utf8');
  writeFileSync(join(dir, PKG, 'm.py'), [
    'def good():',
    '    """',
    '    >>> shared()',
    "    'ok'",
    '    """',
    '    return 1',
    '',
    'def bad():',
    '    """',
    '    >>> shared()',
    "    'THIS IS WRONG'",
    '    """',
    '    return 2',
    '',
    'def noisy():',
    '    """',
    '    >>> print("subject chatter"); shared()',
    "    subject chatter",
    "    'ok'",
    '    """',
    '    return 3',
    '',
    'def shared():',
    '    return "ok"',
    '',
    '# MODULE-LEVEL output, which runs at IMPORT and therefore escapes doctest own per-example',
    '# capture. Without this the channel test is vacuous: doctest intercepts example output itself,',
    '# so a printing EXAMPLE never reaches fd 1 and proves nothing about isolation.',
    'import sys, os',
    'print("import-time chatter on stdout")',
    'os.write(1, b"raw import-time bytes straight to fd one")',
    'sys.stderr.write("import-time chatter on stderr")',
    '',
  ].join(NL), 'utf8');
  return dir;
}

const runOn = (dir) => runProducer({ rootDir: dir, modules: [PKG + '.m'] });

test('IDENTITY — distinct external experiments stay distinct, even with identical source text', () => {
  const dir = corpus();
  const p = runOn(dir);
  assert.equal(p.ok, true, p.why);
  const shared = p.records.filter((r) => r.source === 'shared()');
  assert.equal(shared.length, 2, 'the same text appears in two docstrings');
  const ids = shared.map(externalIdentity);
  assert.notEqual(ids[0], ids[1], 'IDENTICAL SOURCE MUST NOT COLLAPSE TO ONE IDENTITY');
  // and they really do carry different outcomes, which is what made the collision harmful
  assert.notDeepEqual(shared[0].nativeResult, shared[1].nativeResult);
  // the old key would have merged them
  const oldKey = (r) => r.module + '|' + r.source;
  assert.equal(oldKey(shared[0]), oldKey(shared[1]), 'demonstrating the defect this replaces');
  rmSync(dir, { recursive: true, force: true });
});

test('FIDELITY — native results survive adaptation unchanged', () => {
  const dir = corpus();
  const a = adapt(runOn(dir));
  assert.equal(a.ok, true);
  const natives = new Set(a.records.map((r) => r.native.result));
  assert.ok(natives.has('PASS'));
  assert.ok(natives.has('OUTPUT_MISMATCH'));
  for (const r of a.records) {
    assert.ok(r.native.result, 'every adapted record carries its native result');
    assert.notEqual(r.native.want, undefined, 'and the producer\'s want, unstripped');
  }
  rmSync(dir, { recursive: true, force: true });
});

test('NON-INVENTION — an unmapped native result becomes UNKNOWN_MAPPING, not the nearest label', () => {
  const rec = { nativeResult: 'SKIPPED_BY_OPTION_FLAG', nativeDetails: {}, want: '', source: 'x()',
    identity: { producer: 'p', producerVersion: '1', document: 'd', ordinal: 0 } };
  const out = adaptRecord(rec);
  assert.equal(out.observability, UNKNOWN_MAPPING);
  assert.equal(out.assertion, null);
  assert.match(out.why, /would be an invented distinction/);
  // POSITIVE CONTROL: a declared native result maps.
  assert.equal(adaptRecord({ ...rec, nativeResult: 'PASS' }).observability, OBSERVABILITY.OBSERVED);
});

test('NON-INVENTION, mechanically — the adapter cannot refine what the producer did not distinguish', () => {
  // Two subjects the producer reports identically must not be granted different permissions downstream.
  const states = [
    { name: 'assertion wrong', source: 'OUTPUT_MISMATCH', truth: 'OUTPUT_MISMATCH' },
    { name: 'exception raised', source: 'OUTPUT_MISMATCH', truth: 'UNEXPECTED_EXCEPTION' },
  ];
  const r = illegalRefinement({ states,
    adapt: (s) => adaptRecord({ nativeResult: s.source, identity: { producer: 'p',
      producerVersion: '1', document: 'd', ordinal: 0 } }).assertion,
    consumers: [{ name: 'treats as refuted', grants: (v) => v === 'REFUTED' }] });
  assert.equal(r.ok, true, 'the adapter reads only what the producer said');
});

test('NON-VACUITY — producer failure is never subject evidence', () => {
  const failed = adapt({ ok: false, producerFailed: true, why: 'the producer died' });
  assert.equal(failed.ok, false);
  assert.deepEqual(failed.records, []);
  assert.match(failed.why, /NO evidential force/);
  // and a real run is not confused with it
  const dir = corpus();
  assert.equal(adapt(runOn(dir)).ok, true);
  rmSync(dir, { recursive: true, force: true });
});

test('RAW PRESERVATION and REPLAYABILITY — re-adapting is deterministic and needs no subject', () => {
  const dir = corpus();
  const p = runOn(dir);
  rmSync(dir, { recursive: true, force: true });   // the subject is GONE
  const first = readapt(p.records);
  const second = readapt(p.records);
  assert.deepEqual(first, second, 'same raw evidence, same adaptation');
  assert.ok(first.length > 0);

  // A LATER VOCABULARY re-adapts the SAME observation without rerunning anything.
  const r5 = readapt(p.records, { mapping: { ...DOCTEST_MAPPING,
    OUTPUT_MISMATCH: { observability: OBSERVABILITY.OBSERVED, assertion: 'REFUTED_BY_OUTPUT' } } });
  const changed = r5.filter((r) => r.assertion === 'REFUTED_BY_OUTPUT');
  assert.ok(changed.length > 0, 'the new vocabulary applies');
  assert.equal(changed[0].native.result, 'OUTPUT_MISMATCH', 'and the raw record is untouched');
});

test('CHANNEL ISOLATION — a chatty subject cannot corrupt the producer report', () => {
  const dir = corpus();
  const p = runOn(dir);
  assert.equal(p.ok, true, 'the producer survived a subject that writes at import time');
  assert.equal(p.records.length, 3, 'good, bad and noisy - one example each');
  // NON-VACUITY: the attack must actually have happened, or this test proves nothing.
  assert.ok(p.subjectBytes > 0,
    'the subject really did write to the process channel; a test where it does not is vacuous');
  rmSync(dir, { recursive: true, force: true });
});

test('VERSION AND SCOPE — every claim records the semantics that established it', () => {
  const dir = corpus();
  const a = adapt(runOn(dir));
  for (const r of a.records) {
    assert.match(r.scope.criterion, /CPython doctest \d+\.\d+/);
    assert.ok(r.scope.history.includes('#'), 'history is document plus ordinal');
  }
  assert.ok(a.producerVersion);
  rmSync(dir, { recursive: true, force: true });
});

test('THE ADMIT CONTROL — a legitimate collapse must remain legal, or fidelity means hoarding', () => {
  // OUTPUT_MISMATCH and UNEXPECTED_EXCEPTION are DELIBERATELY collapsed to assertion=REFUTED. That is a
  // lossy compression, and it is legal precisely because no consumer of `assertion` distinguishes them.
  const states = [
    { name: 'mismatch', value: adaptRecord({ nativeResult: 'OUTPUT_MISMATCH',
      identity: { producer: 'p', producerVersion: '1', document: 'd', ordinal: 0 } }) },
    { name: 'exception', value: adaptRecord({ nativeResult: 'UNEXPECTED_EXCEPTION',
      identity: { producer: 'p', producerVersion: '1', document: 'd', ordinal: 1 } }) },
  ];
  const legal = illegalCompression({ states, compress: (v) => v.assertion,
    consumers: [{ name: 'the documented behaviour does not hold', grants: (v) => v.assertion === 'REFUTED' }] });
  assert.equal(legal.ok, true, 'collapsing states no consumer distinguishes is LEGAL');

  // And the same collapse becomes ILLEGAL the moment a consumer does distinguish them - which is exactly
  // when the native distinction must be preserved instead.
  const illegal = illegalCompression({ states, compress: (v) => v.assertion,
    consumers: [{ name: 'schedules exception triage', grants: (v) => v.native.result === 'UNEXPECTED_EXCEPTION' }] });
  assert.equal(illegal.ok, false, 'the legality of a compression depends on the consumers, not on taste');
});
