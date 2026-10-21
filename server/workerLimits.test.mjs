/**
 * workerLimits.test.mjs - the command worker can be given a memory and CPU ceiling, asserted on the ACTUAL
 * argument list (worker.js's rule: a comment claiming a flag is not evidence that it is passed).
 *
 *   node server/workerLimits.test.mjs
 *
 * The worker had --pids-limit and nothing else: one runaway script from the model could take every core and all
 * the RAM on a laptop that is also serving that model. AGENT_WORKER_MEMORY / AGENT_WORKER_CPUS set the ceiling;
 * unset means exactly the old boundary, so frozen experiments keep the worker they were frozen against.
 */
import assert from 'node:assert/strict';
import { workerArgs } from './worker.js';

let passed = 0, failed = 0;
const test = (n, f) => { try { f(); passed++; console.log(`  ok    ${n}`); } catch (e) { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); } };
const flagValue = (args, flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
const before = (args, flag) => args.indexOf(flag) >= 0 && args.indexOf(flag) < args.indexOf('sh');

delete process.env.AGENT_WORKER_MEMORY; delete process.env.AGENT_WORKER_CPUS;
const plain = workerArgs('/ws', 'true', { image: 'img' });
test('unset: no ceiling flags - the boundary is exactly what it was', () => {
  assert.equal(plain.indexOf('--memory'), -1); assert.equal(plain.indexOf('--cpus'), -1);
});

process.env.AGENT_WORKER_MEMORY = '2g'; process.env.AGENT_WORKER_CPUS = '2';
const capped = workerArgs('/ws', 'true', { image: 'img' });
test('set: --memory and --cpus are in the argument list, before the image', () => {
  assert.equal(flagValue(capped, '--memory'), '2g'); assert.equal(flagValue(capped, '--cpus'), '2');
  assert.ok(before(capped, '--memory') && capped.indexOf('--memory') < capped.indexOf('img'), 'the flag must precede the image, or docker passes it to the command');
});
test('set: swap is pinned to the memory ceiling, so the cap cannot be escaped into swap', () => {
  assert.equal(flagValue(capped, '--memory-swap'), '2g');
});
test('the existing boundary is untouched by the ceiling', () => {
  for (const f of ['--network', '--cap-drop', '--security-opt', '--user', '--pids-limit']) assert.ok(capped.includes(f), `lost ${f}`);
  assert.equal(flagValue(capped, '--network'), 'none');
});
process.env.AGENT_WORKER_MEMORY = '2g; rm -rf /'; process.env.AGENT_WORKER_CPUS = 'lots';
test('a malformed value is refused, not passed to docker', () => {
  const bad = workerArgs('/ws', 'true', { image: 'img' });
  assert.equal(bad.indexOf('--memory'), -1); assert.equal(bad.indexOf('--cpus'), -1);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
