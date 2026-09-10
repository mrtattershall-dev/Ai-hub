/**
 * retention.test.mjs - what decides whether the loop survives being left alone.
 *
 *   node server/retention.test.mjs
 *
 * None of this shows up in a suite that finishes in ninety seconds; all of it shows up on
 * day three of a 24/7 run. Measured on real files 2026-09-10: a FIVE-step run produced a
 * 1.05 MB JSON, 400,068 bytes of which was `args` - the file bodies handed to write_file,
 * stored verbatim - and persist() rewrites the whole file after every step.
 */
import assert from 'node:assert/strict';

const { __modelCallTest } = await import('./agent.js');
const { slimForDisk, RUN_ARG_MAX } = __modelCallTest;

let passed = 0, failed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log(`  ok    ${name}`); }
  catch (e) { failed++; console.error(`  FAIL  ${name}\n        ${e.message}`); }
};

console.log('\nretention\n');

const bigRun = () => ({
  id: 'r1', status: 'done', abort: {}, busy: true,
  steps: [
    { n: 1, type: 'tool', tool: 'write_file', args: { path: 'big.txt', content: 'X'.repeat(200_000) } },
    { n: 2, type: 'tool', tool: 'edit_file', args: { path: 'a.js', find: 'Y'.repeat(90_000), replace: 'z' } },
    { n: 3, type: 'tool', tool: 'list_dir', args: { path: '.' } },
  ],
});

test('a 200KB write is capped on disk', () => {
  const out = slimForDisk(bigRun());
  const c = out.steps[0].args.content;
  assert.ok(c.length <= RUN_ARG_MAX + 100, `still ${c.length} chars`);
  assert.match(c, /more characters not kept on disk/, 'no truncation marker');
});

test('the persisted run is orders of magnitude smaller', () => {
  const before = JSON.stringify(bigRun()).length;
  const after = JSON.stringify(slimForDisk(bigRun())).length;
  assert.ok(after < before / 4, `${before} -> ${after} is not a real reduction`);
  console.log(`        ${(before / 1024).toFixed(0)}KB -> ${(after / 1024).toFixed(0)}KB`);
});

test('every large field is capped, not just content', () => {
  const out = slimForDisk(bigRun());
  assert.ok(out.steps[1].args.find.length <= RUN_ARG_MAX + 100, 'edit_file find was not capped');
});

test('small args are left byte-identical', () => {
  const out = slimForDisk(bigRun());
  assert.deepEqual(out.steps[2].args, { path: '.' }, 'a small step was rewritten needlessly');
});

test('the cap matches what the trace harvester keeps, so training data is intact', () => {
  // The harvester slices args.content to 30_000. If the disk cap were SMALLER, a run
  // resumed after a restart would harvest less code than one that ran straight through.
  assert.ok(RUN_ARG_MAX >= 30_000, `RUN_ARG_MAX ${RUN_ARG_MAX} is below the harvester's 30,000`);
});

test('non-serialisable fields are still dropped', () => {
  const out = slimForDisk(bigRun());
  assert.equal(out.abort, undefined, 'abort would break JSON round-trip');
  assert.equal(out.busy, undefined, 'busy is transient and must not persist');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
