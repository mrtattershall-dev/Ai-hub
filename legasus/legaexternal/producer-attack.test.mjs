// r4 — composition wave 2, producer #1's identity. Prediction frozen in benchmarks/COMPOSITION_PREREG_2.md
// (W2-f) BEFORE this file existed. Asserts the PREDICTED DEFECT beside its control. Runs CPython.
import test from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runProducer } from './producer.mjs';
import { adaptRecord } from './adapt.mjs';

const NL = String.fromCharCode(10);

function corpus() {
  const dir = mkdtempSync(join(tmpdir(), 'w2f-'));
  writeFileSync(join(dir, 'boom.py'), 'raise RuntimeError("import-time failure")' + NL, 'utf8');
  writeFileSync(join(dir, 'ok.py'), ['def f():', '    """', '    >>> f()', '    1', '    """',
    '    return 1', ''].join(NL), 'utf8');
  return dir;
}

test('W2-f-1 ATTACK — an IMPORT_FAILED record is given a document and an array-index ordinal it does not have', () => {
  const dir = corpus();
  const p = runProducer({ rootDir: dir, modules: ['boom', 'ok'] });
  assert.equal(p.ok, true, p.why);
  const failed = p.records.find((r) => r.nativeResult === 'IMPORT_FAILED');
  assert.ok(failed, 'the producer reported the import failure');
  // PREDICTED DEFECT: fabricated coordinates, and a history built from them.
  assert.equal(failed.identity.document, '<boom>', 'prediction W2-f-1: fabricated document');
  assert.equal(typeof failed.identity.ordinal, 'number', 'prediction W2-f-1: fabricated ordinal');
  const adapted = adaptRecord(failed);
  assert.equal(typeof adapted.scope.history, 'string', 'and a history coordinate for no example');
  rmSync(dir, { recursive: true, force: true });
});

test('W2-f-2 CONTROL — a PASS record carries its real DocTest name and ordinal', () => {
  const dir = corpus();
  const p = runProducer({ rootDir: dir, modules: ['ok'] });
  assert.equal(p.ok, true, p.why);
  const pass = p.records.find((r) => r.nativeResult === 'PASS');
  assert.ok(pass);
  assert.equal(pass.identity.document, 'ok.f');
  assert.equal(pass.identity.ordinal, 0);
  assert.equal(adaptRecord(pass).scope.history, 'ok.f#0');
  rmSync(dir, { recursive: true, force: true });
});
