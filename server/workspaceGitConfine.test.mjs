/**
 * workspaceGitConfine.test.mjs - the agent must never commit to the repo that CONTAINS it.
 *
 *   node server/workspaceGitConfine.test.mjs
 *
 * `git -C <dir>` does not confine git to <dir>: git discovers its repository by walking UP
 * until it finds a .git. The workspace lives inside the hub's own checkout, and
 * ensureRepo() tested `rev-parse --is-inside-work-tree`, which answers TRUE for any
 * directory inside ANY enclosing repo. So `git init` never ran and every auto-checkpoint
 * committed to the hub's source tree, running `add -A` - which from a subdirectory stages
 * the WHOLE tree. Measured 2026-09-10: 15 such commits, sweeping in three parallel
 * sessions' uncommitted work under messages like "before write_file: ...".
 *
 * This rebuilds that exact shape: an outer repo with dirty files, a workspace inside it.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const { ensureRepo, commitAll } = await import('./workspaceGit.js');

let passed = 0, failed = 0;
const test = async (name, fn) => {
  try { await fn(); passed++; console.log(`  ok    ${name}`); }
  catch (e) { failed++; console.error(`  FAIL  ${name}\n        ${e.message}`); }
};

const g = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();

// An "outer repo" standing in for the hub checkout, with uncommitted work in it.
const outer = mkdtempSync(join(tmpdir(), 'outer-'));
g(outer, 'init', '-q');
writeFileSync(join(outer, 'seed.txt'), 'seed', 'utf8');
g(outer, '-c', 'user.name=t', '-c', 'user.email=t@t', 'add', '-A');
g(outer, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'baseline');
writeFileSync(join(outer, 'someone-elses-work.js'), 'export const wip = 1;', 'utf8');

const ws = join(outer, 'workspace');
mkdirSync(ws, { recursive: true });
writeFileSync(join(ws, 'index.html'), '<h1>agent output</h1>', 'utf8');

const outerCommitsBefore = g(outer, 'rev-list', '--count', 'HEAD');

console.log('\nworkspace git confinement\n');

await test('ensureRepo gives the workspace its OWN repo, not the enclosing one', async () => {
  const r = await ensureRepo(ws);
  assert.ok(r.ok, 'ensureRepo failed: ' + r.error);
  assert.ok(existsSync(join(ws, '.git')), 'no .git was created in the workspace');
  assert.equal(resolve(g(ws, 'rev-parse', '--show-toplevel')).toLowerCase(),
    resolve(ws).toLowerCase(), 'workspace git still resolves to the outer repo');
});

await test('commitAll commits the workspace', async () => {
  writeFileSync(join(ws, 'game.js'), 'console.log(1);', 'utf8');
  const r = await commitAll(ws, 'before write_file: build the game');
  assert.ok(r.ok, 'commit failed: ' + r.error);
  assert.ok(g(ws, 'log', '--oneline').includes('before write_file'), 'workspace commit missing');
});

await test('THE INCIDENT: the outer repo gained no commits', () => {
  assert.equal(g(outer, 'rev-list', '--count', 'HEAD'), outerCommitsBefore,
    'the agent committed to the repository that contains it');
});

await test("...and someone else's uncommitted work is still uncommitted", () => {
  const status = g(outer, 'status', '--porcelain');
  assert.match(status, /someone-elses-work\.js/, 'another session\'s in-flight file was swept into a commit');
});

await test('the outer repo never even sees the workspace as dirty', () => {
  const status = g(outer, 'status', '--porcelain');
  assert.ok(!/game\.js/.test(status), 'workspace files leaked into the outer repo status');
});

await test('a workspace that is not its own repo root is refused, not committed', async () => {
  // Simulate the broken state directly: a plain directory inside the outer repo.
  const bare = join(outer, 'not-a-repo');
  mkdirSync(bare, { recursive: true });
  writeFileSync(join(bare, 'x.txt'), 'x', 'utf8');
  const before = g(outer, 'rev-list', '--count', 'HEAD');
  await commitAll(bare, 'should not reach the outer repo');
  assert.equal(g(outer, 'rev-list', '--count', 'HEAD'), before,
    'a non-repo workspace still committed to the enclosing repository');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
