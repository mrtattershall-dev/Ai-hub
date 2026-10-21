import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'mockLoop.test.mjs'), 'utf8');

// The harness must isolate the hub's meta dir, like testHarness.isolatedEnv does.
assert.match(src, /AGENT_META_DIR\s*:\s*join\(dir,\s*'meta'\)/, 'mockLoop spawns the hub without AGENT_META_DIR, so records land in workspace.hub-meta beside the workspace');

// And the stray-file invariant must allow that isolated meta dir.
const m = src.match(/\[('workspace'[^\]]*)\]\.includes/);
assert.ok(m, 'could not find the stray-file allow-list');
assert.ok(m[1].includes("'meta'"), 'stray-file allow-list does not permit the isolated meta dir');
console.log('ok');
