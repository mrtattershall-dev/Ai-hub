// r4 — composition wave 2, producer #1's identity. Prediction frozen in benchmarks/COMPOSITION_PREREG_2.md
// (W2-f); the PRE-REPAIR run that reproduced it is preserved in benchmarks/RESULT.composition-2.md and
// at b0673cd, where this file asserted the defect. It now asserts the repair and keeps its control.
// Runs CPython.
import test from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runProducer, externalIdentity } from './producer.mjs';
import { adaptRecord } from './adapt.mjs';
import { UNADMITTED } from '../legaknow/justification.mjs';

const NL = String.fromCharCode(10);

function corpus() {
  const dir = mkdtempSync(join(tmpdir(), 'w2f-'));
  writeFileSync(join(dir, 'boom.py'), 'raise RuntimeError("import-time failure")' + NL, 'utf8');
  writeFileSync(join(dir, 'ok.py'), ['def f():', '    """', '    >>> f()', '    1', '    """',
    '    return 1', ''].join(NL), 'utf8');
  return dir;
}

test('W2-f-1 REGRESSION — an IMPORT_FAILED record has NO document and NO ordinal, and adapts with no history', () => {
  const dir = corpus();
  const p = runProducer({ rootDir: dir, modules: ['boom', 'ok'] });
  assert.equal(p.ok, true, p.why);
  const failed = p.records.find((r) => r.nativeResult === 'IMPORT_FAILED');
  assert.ok(failed, 'the producer reported the import failure');
  assert.equal(Object.hasOwn(failed.identity, 'document'), false, 'b0673cd fabricated "<boom>"');
  assert.equal(Object.hasOwn(failed.identity, 'ordinal'), false, 'b0673cd fabricated the array index');
  assert.equal(failed.identity.module, 'boom', 'the one coordinate it does have is carried');
  const adapted = adaptRecord(failed);
  assert.equal(Object.hasOwn(adapted.scope, 'history'), false, 'no history for no experiment');
  assert.equal(adapted.scope[UNADMITTED].module, 'boom', 'recorded, not authoritative');
  assert.equal(adapted.observability, 'PREREQUISITE_MISSING');
  assert.equal(externalIdentity(failed), 'CPython doctest|' + p.producerVersion + '|module:boom|-');
  assert.equal(JSON.stringify(failed.identity).includes('undefined'), false);
  rmSync(dir, { recursive: true, force: true });
});

test('W2-f-2 CONTROL — a PASS record carries its real DocTest name and ordinal, byte-unchanged', () => {
  const dir = corpus();
  const p = runProducer({ rootDir: dir, modules: ['ok'] });
  assert.equal(p.ok, true, p.why);
  const pass = p.records.find((r) => r.nativeResult === 'PASS');
  assert.ok(pass);
  assert.deepEqual(Object.keys(pass.identity).sort(), ['document', 'lineno', 'ordinal', 'producer', 'producerVersion']);
  assert.equal(pass.identity.document, 'ok.f');
  assert.equal(pass.identity.ordinal, 0);
  assert.equal(adaptRecord(pass).scope.history, 'ok.f#0');
  assert.equal(externalIdentity(pass), 'CPython doctest|' + p.producerVersion + '|ok.f|0');
  rmSync(dir, { recursive: true, force: true });
});
