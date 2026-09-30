// The rule under test: a run where the model DID NOT ACT can never be scored as a model outcome.
// The load-bearing case is the FAIL CONTROL — a throttled run whose check verdicts, if consulted,
// would read requested=FAIL/protected=PASS (a model-outcome shape). It must classify PROVIDER_ERROR
// anyway, because the precedence forbids reading those verdicts at all.
import test from 'node:test';
import assert from 'node:assert';
import { classifyRun, CLASS } from './runClassify.mjs';

test('FAIL CONTROL — a throttle-paused run is PROVIDER_ERROR even though its verdicts look like a model outcome', () => {
  // this is the exact t3-add-node-median#1 shape: 0 model calls, hub said "throttling this key",
  // seed reads requested=FAIL/protected=PASS
  const r = classifyRun({ modelCalls: 0, pausedReason: 'Run paused during planning — openrouter is throttling this key.', runStatus: 'interrupted', requested: 'FAIL', protected: 'PASS' });
  assert.equal(r, CLASS.PROVIDER_ERROR, 'a run the model never drove must not be scored on its checks');
});

test('a throttle after ONE call is still PROVIDER_ERROR, not RESTORED_OR_FAILED', () => {
  // t1-repair-node-average#1: 1 model call, throttled, no edit landed, seed verdicts
  const r = classifyRun({ modelCalls: 1, modelActed: false, pausedReason: 'openrouter is throttling this key', requested: 'FAIL', protected: 'PASS' });
  assert.equal(r, CLASS.PROVIDER_ERROR);
});

test('PASS CONTROL — a real edit that passes both is RETAINED', () => {
  const r = classifyRun({ modelCalls: 2, modelActed: true, runStatus: 'awaiting_approval', requested: 'PASS', protected: 'PASS' });
  assert.equal(r, CLASS.RETAINED);
});

test('the model acted but the verifier failed -> NOT_EVALUATED, never a PASS/FAIL', () => {
  const r = classifyRun({ modelActed: true, requested: 'EVALUATION_ERROR', protected: 'PASS' });
  assert.equal(r, CLASS.NOT_EVALUATED);
});

test('protected damage outranks a requested miss', () => {
  const r = classifyRun({ modelActed: true, requested: 'PASS', protected: 'FAIL' });
  assert.equal(r, CLASS.BROKE_PROTECTED);
});

test('model acted, preserved behaviour, feature not achieved -> RESTORED_OR_FAILED', () => {
  const r = classifyRun({ modelActed: true, requested: 'FAIL', protected: 'PASS' });
  assert.equal(r, CLASS.RESTORED_OR_FAILED);
});

test('no model calls and no pause text is still PROVIDER_ERROR (absence of action, not a silent pass)', () => {
  const r = classifyRun({ modelCalls: 0, requested: 'FAIL', protected: 'PASS' });
  assert.equal(r, CLASS.PROVIDER_ERROR);
});

test('NON-VACUITY — the same verdicts DO reach a model outcome once the model is shown to have acted', () => {
  // identical requested/protected to the FAIL CONTROL; the ONLY difference is modelActed. If this also
  // returned PROVIDER_ERROR the rule would just reject everything.
  const infra = classifyRun({ modelCalls: 0, requested: 'FAIL', protected: 'PASS' });
  const acted = classifyRun({ modelActed: true, requested: 'FAIL', protected: 'PASS' });
  assert.equal(infra, CLASS.PROVIDER_ERROR);
  assert.equal(acted, CLASS.RESTORED_OR_FAILED);
  assert.notEqual(infra, acted);
});
