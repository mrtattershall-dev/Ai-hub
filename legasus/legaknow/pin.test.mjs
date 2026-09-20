// r4 — the artifact pin (composition attack C9-b). Each case's meaning was fixed in the prereg before
// this existed: PINNED re-measures; REPLACED, ABSENT and UNPINNED re-measure nothing.
import test from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pinnedArtifact, PIN } from './pin.mjs';
import { digestOf } from './provenance.mjs';

const ORIGINAL = '[{"module": "m", "outcome": "PASS", "source": "f()"}]';
const RICHER = '[{"module": "m", "outcome": "PASS", "source": "f()", "ordinal": 0}]';

test('PINNED — the recorded bytes at the path re-measure, and the bytes come back for measurement', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pin-'));
  const p = join(dir, 'external.json');
  writeFileSync(p, ORIGINAL);
  const r = pinnedArtifact({ path: p, expectedDigest: digestOf(ORIGINAL) });
  assert.equal(r.ok, true);
  assert.equal(r.state, PIN.PINNED);
  assert.equal(r.bytes.toString('utf8'), ORIGINAL);
  rmSync(dir, { recursive: true, force: true });
});

test('REPLACED — richer records under the SAME PATH do not re-measure the old verdict', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pin-'));
  const p = join(dir, 'external.json');
  writeFileSync(p, RICHER);
  const r = pinnedArtifact({ path: p, expectedDigest: digestOf(ORIGINAL) });
  assert.equal(r.ok, false);
  assert.equal(r.state, PIN.REPLACED);
  assert.equal(r.bytes, undefined, 'no bytes are handed to a measurement');
  assert.match(r.why, /kept the name/);
  rmSync(dir, { recursive: true, force: true });
});

test('ABSENT and UNPINNED — neither is evidence, and neither re-measures', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pin-'));
  const absent = pinnedArtifact({ path: join(dir, 'missing.json'), expectedDigest: digestOf(ORIGINAL) });
  assert.equal(absent.state, PIN.ABSENT);
  assert.equal(absent.ok, false);
  const p = join(dir, 'external.json');
  writeFileSync(p, ORIGINAL);
  const unpinned = pinnedArtifact({ path: p, expectedDigest: null });
  assert.equal(unpinned.state, PIN.UNPINNED);
  assert.equal(unpinned.ok, false, 'present bytes with no recorded digest are still not re-measured');
  rmSync(dir, { recursive: true, force: true });
});
