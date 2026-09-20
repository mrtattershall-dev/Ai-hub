// CONTROLS FOR BACKWARD-1 — predictions BK-1..BK-6 in benchmarks/BACKWARD_1_PREREG.md.
//
// The backdoor detector finds NOTHING on this repository, so without a fixture that forces it to
// fire it would be a detector never shown to work - which this project does not accept. The run
// against the real tree is benchmarks/RESULT.backward.md.
import test from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { frames, isTestFile, REACHABILITY } from './sink.mjs';
import { indexTree, testBackdoors, noProductionConsumer, classifyEvent } from './ancestry.mjs';

function tree(files) {
  const dir = mkdtempSync(join(tmpdir(), 'lgs-back-'));
  for (const [rel, src] of Object.entries(files)) {
    const p = join(dir, rel);
    mkdirSync(join(p, '..'), { recursive: true });
    writeFileSync(p, src);
  }
  return dir;
}

test('MUST FIRE — an aggregate export of PRIVATE bindings is a backdoor, whatever it is called', () => {
  const dir = tree({
    'mod.mjs': `
      function hidden(a) { return a + 1; }
      const alsoHidden = (b) => b * 2;
      export function api(x) { return hidden(x); }
      export const __handleTest = { hidden, alsoHidden };
      export const CONFIG = { retries: 3, mode: 'fast' };
      export const PUBLIC_API = { api };
    `,
    'mod.test.mjs': 'import { __handleTest } from "./mod.mjs"; __handleTest.hidden(1);',
  });
  try {
    const idx = indexTree(dir);
    const back = testBackdoors(idx);
    assert.deepEqual([...back], ['mod.mjs::__handleTest'],
      'the literal-valued CONFIG is not a backdoor, and PUBLIC_API re-exports what is already public');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('A BACKDOOR IS A STRUCTURE, NOT A CONSUMER COUNT', () => {
  // The first version called any export referenced only by tests "test-only". On the real tree that
  // flagged 192 exports including a plain function and a constant, and drove PRODUCTION_REACHED to
  // zero. Who happens to call something is a fact about the repository, not about the export.
  const dir = tree({
    'mod.mjs': 'export function lonely(x) { return x; }\n',
    'mod.test.mjs': 'import { lonely } from "./mod.mjs"; lonely(1);',
  });
  try {
    const idx = indexTree(dir);
    assert.equal(testBackdoors(idx).size, 0, 'no aggregate, so no backdoor');
    assert.deepEqual([...noProductionConsumer(idx)], ['mod.mjs::lonely'],
      'but it IS reported as having no production consumer - a separate coordinate');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('MUST FIRE — a path entering through a backdoor is TEST_ONLY, not production reachability', () => {
  const dir = tree({
    'mod.mjs': `
      function hidden() { return 1; }
      export function api() { return hidden(); }
      export const __t = { hidden };
    `,
    'mod.test.mjs': 'export const x = 1;',
  });
  try {
    const idx = indexTree(dir);
    const back = testBackdoors(idx);
    const viaBackdoor = classifyEvent({ sinkClass: 'FILESYSTEM_MUTATION', stack: [
      { fn: 'hidden', file: join(dir, 'mod.mjs').replace(/\\/g, '/'), line: 2 },
      { fn: '__t', file: join(dir, 'mod.mjs').replace(/\\/g, '/'), line: 4 },
      { fn: 'run', file: join(dir, 'mod.test.mjs').replace(/\\/g, '/'), line: 1 },
    ] }, idx, back);
    assert.equal(viaBackdoor.reachability, REACHABILITY.TEST_ONLY);

    const viaApi = classifyEvent({ sinkClass: 'FILESYSTEM_MUTATION', stack: [
      { fn: 'hidden', file: join(dir, 'mod.mjs').replace(/\\/g, '/'), line: 2 },
      { fn: 'api', file: join(dir, 'mod.mjs').replace(/\\/g, '/'), line: 3 },
      { fn: 'run', file: join(dir, 'mod.test.mjs').replace(/\\/g, '/'), line: 1 },
    ] }, idx, back);
    assert.equal(viaApi.reachability, REACHABILITY.PRODUCTION_REACHED);
    assert.ok(viaApi.privateOnPath.some((p) => p.fn === 'hidden'),
      'BK-3 shape: a PRIVATE function is on a witnessed effect path');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('AN ESM FRAME ON WINDOWS PARSES — regression for a silent measured absence', () => {
  // The first FRAME pattern recognised a path by its prefix and stopped at the first colon, so
  // `file:///C:/...` never matched, every frame was dropped, and the run reported PRODUCTION_REACHED
  // 0 with complete confidence. An unparsed representation became a measured absence.
  const stack = ['Error: lgs-sink',
    '    at instrumentedSink (file:///C:/p/legasus/legascreen/sink.mjs:112:23)',
    '    at snapshot (file:///C:/p/legasus/legacommit/transactional.mjs:44:5)',
    '    at /home/u/p/legasus/x.mjs:9:1',
    '    at TestContext.<anonymous> (C:\\p\\legasus\\a.test.mjs:12:3)'].join('\n');
  const f = frames(stack);
  assert.equal(f.length, 4);
  assert.equal(f[1].fn, 'snapshot');
  assert.equal(f[1].line, 44);
  assert.ok(f[1].file.endsWith('legacommit/transactional.mjs'));
  assert.ok(f[3].file.endsWith('a.test.mjs'), 'a Windows path without a file: scheme parses too');
});

test('node_modules and runtime-internal frames are not the subject', () => {
  const f = frames(['Error: x',
    '    at foo (/p/node_modules/dep/index.js:1:1)',
    '    at bar (node:internal/modules/run:5:2)',
    '    at baz (/p/src/real.mjs:7:1)'].join('\n'));
  assert.deepEqual(f.map((x) => x.fn), ['baz']);
});

test('isTestFile recognises the shapes, and only those', () => {
  assert.ok(isTestFile('a/b.test.mjs'));
  assert.ok(isTestFile('a/b.test.js'));
  assert.ok(isTestFile('pkg/tests/helper.mjs'));
  assert.equal(isTestFile('pkg/latest/thing.mjs'), false, 'not every path containing "test"');
  assert.equal(isTestFile('src/contest.mjs'), false);
});
