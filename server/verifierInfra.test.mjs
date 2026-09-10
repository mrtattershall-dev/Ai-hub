/**
 * verifierInfra.test.mjs - a CDN problem must never be scored as broken code.
 *
 *   node server/verifierInfra.test.mjs
 *
 * THE BUG THIS PINS
 * -----------------
 * The engine cache matched only the exact URL the verifier injected. A page that pinned
 * its own version - and the agent writes its own script tag, so that is the normal case -
 * fell through to a live CDN fetch. When jsdelivr answered with something HTML-ish, the
 * browser reported `Unexpected token '<'`, and that was recorded as A RUNTIME ERROR IN THE
 * GAME. Correct code marked broken, in the path that feeds the finish gate, eval and
 * harvest. `test_web` was worse: it had no interception at all.
 *
 * No network is needed here. The page asks for a script on an unroutable host, which is
 * the same thing as a CDN that cannot be reached.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { freePort } from './testPort.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TMP = mkdtempSync(join(tmpdir(), 'verifier-infra-'));
const PORT = await freePort();
const BASE = `http://127.0.0.1:${PORT}/api`;

let passed = 0;
const test = async (name, fn) => {
  try { await fn(); passed++; }
  catch (e) { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; }
};

let log = '';
const hub = spawn(process.execPath, [join(__dirname, 'index.js')], {
  env: { ...process.env, PORT: String(PORT), HUB_DB: join(TMP, 'hub.json'), AGENT_QUEUE_FILE: join(TMP, 'agent-queue.json'), AGENT_SUPERVISOR: '0' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
hub.stdout.on('data', (d) => { log += d; });
hub.stderr.on('data', (d) => { log += d; });

const verify = async (code, engine = 'phaser') => {
  const res = await fetch(`${BASE}/game/verify`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ engine, code }),
  });
  return res.json();
};

try {
  const until = Date.now() + 25000;
  for (;;) {
    try { if ((await fetch(`${BASE}/health`)).ok) break; } catch {}
    if (Date.now() > until) throw new Error(`hub did not start\n${log.slice(-600)}`);
    await new Promise((r) => setTimeout(r, 150));
  }

  await test('a library the page pins and we cannot fetch is INFRA, not a code error', async () => {
    // A second <script> the page asks for itself, exactly like a pinned phaser version.
    const code = `
      const s = document.createElement('script');
      s.src = 'https://cdn.unreachable-for-tests.invalid/some-lib@1.2.3/dist/lib.min.js';
      document.head.appendChild(s);
      const config = { type: Phaser.AUTO, width: 320, height: 240, scene: { create() { this.add.rectangle(160,120,80,80,0xff0000); } } };
      new Phaser.Game(config);
    `;
    const r = await verify(code);

    assert.equal(r.infra, true, `a fetch failure must be flagged as infrastructure. verdict: ${r.verdict}`);
    assert.ok(r.cdnFailures?.length, 'the failing script should be named');
    assert.match(r.verdict, /says nothing about the code/,
      `the verdict must not blame the code. got: ${r.verdict}`);
    // The whole point: none of the knock-on noise may be presented as the code throwing.
    const blamed = (r.errors || []).filter((e) => e.startsWith('[JS ERROR]') && e.includes('unreachable-for-tests'));
    assert.deepEqual(blamed, [], 'a CDN failure surfaced as a JS ERROR against the code');
  });

  await test('an ordinary game with no extra libraries is still judged normally', async () => {
    // The guard must not swallow real failures - otherwise it passes everything.
    const r = await verify(`
      const config = { type: Phaser.AUTO, width: 320, height: 240, scene: { create() { boom(); } } };
      new Phaser.Game(config);
    `);
    assert.equal(r.infra, false, 'a genuine code error must NOT be excused as infrastructure');
    assert.equal(r.ok, false);
    assert.ok((r.errors || []).some((e) => e.startsWith('[JS ERROR]')),
      'a real runtime error should still be reported');
  });

  await test('a clean game still passes - the fix did not make everything infra', async () => {
    const r = await verify(`
      const config = { type: Phaser.AUTO, width: 320, height: 240, scene: { create() { this.add.rectangle(160,120,80,80,0x00ff00); } } };
      new Phaser.Game(config);
    `);
    assert.equal(r.infra, false, `verdict: ${r.verdict}`);
    assert.equal(r.ok, true, `a working game should pass. verdict: ${r.verdict} errors: ${JSON.stringify(r.errors)}`);
  });
} finally {
  hub.kill();
  try { rmSync(TMP, { recursive: true, force: true }); } catch {}
}

console.log(`verifier infra: ${passed} passed${process.exitCode ? ' (with failures above)' : ''}`);
