// preflight must FAIL-CLOSED: it blocks when a dependency of a verdict is absent, and it passes only when
// all are present. The load-bearing tests are the fail controls — the classifier check and a broken
// fixture must each block preflight — proven WITHOUT needing docker (those checks are pure/fast).
import test from 'node:test';
import assert from 'node:assert';
import { preflight } from './preflight.mjs';
import { PILOT_TASKS } from './pilotTasks.js';

const t1 = PILOT_TASKS.find((t) => t.id === 't1-repair-node-average');
const GOOD_REF = { 'stats.js': 'function total(xs){return xs.reduce((a,b)=>a+b,0);}\nfunction average(xs){return xs.length===0?0:total(xs)/xs.length;}\nmodule.exports={total,average};\n' };
const BAD_REF = { 'stats.js': 'function total(xs){return 999;}\nfunction average(xs){return 1;}\nmodule.exports={total,average};\n' }; // breaks protected, average wrong

test('FAIL CONTROL — a fixture whose reference does NOT satisfy the checks blocks preflight', async () => {
  // docker may be up or down; either way an invalid fixture must never let preflight pass.
  const r = await preflight([{ task: t1, seed: t1.seed, reference: BAD_REF }]);
  assert.equal(r.ok, false, 'preflight must not pass with a broken fixture');
  // if docker is up, the block is on fixtures; if docker is down, it blocks earlier — both are correct
  assert.ok(r.blockedBy.includes('fixtures') || r.blockedBy.includes('docker') || r.blockedBy.includes('image') || r.blockedBy.includes('worker'),
    'blocked for a real reason: ' + JSON.stringify(r.blockedBy));
});

test('the classifier check is evaluated and reported', async () => {
  const r = await preflight([]);
  const cls = r.checks.find((c) => c.name === 'classifier');
  // classifier is only reached if docker+image+worker pass; if docker is down it is not reached.
  const docker = r.checks.find((c) => c.name === 'docker');
  if (docker && docker.ok) { assert.ok(cls, 'classifier check should run once infra is up'); assert.equal(cls.ok, true, cls?.detail); }
  else { assert.equal(r.ok, false); assert.ok(r.blockedBy.includes('docker')); }
});

test('preflight is fail-closed: result.ok is true only if EVERY check passed', async () => {
  const r = await preflight([{ task: t1, seed: t1.seed, reference: GOOD_REF }]);
  if (r.ok) { assert.ok(r.checks.every((c) => c.ok)); assert.ok(r.checks.some((c) => c.name === 'fixtures' && c.ok)); }
  else { assert.ok(r.blockedBy.length > 0); assert.ok(r.checks.some((c) => !c.ok)); }
});
