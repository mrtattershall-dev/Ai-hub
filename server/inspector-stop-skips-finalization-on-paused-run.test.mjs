import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { scratch, startHub } from './testHarness.mjs';

const dir = scratch('stopfinal');
mkdirSync(join(dir, 'runs'), { recursive: true });
const id = 'paused0001';
writeFileSync(join(dir, 'runs', id + '.json'), JSON.stringify({
  id, goal: 'paused goal', status: 'interrupted', busy: false, depth: 0,
  createdAt: Date.now(), updatedAt: Date.now(), history: [], steps: [], modelCalls: 1,
}));
const h = await startHub(dir);
try {
  const r = await h.api('/agent/' + id + '/stop', { method: 'POST' });
  assert.equal(r.ok, true);
  const rec = JSON.parse(readFileSync(join(dir, 'runs', id + '.json'), 'utf8'));
  assert.equal(rec.status, 'stopped');
  assert.equal(typeof rec.finalizedAt, 'number', 'stopped run must be finalized');
} finally {
  h.hub.kill();
}
