/**
 * webFetchSsrf.test.mjs - web_fetch must refuse the addresses download_file already refuses.
 *
 *   node server/webFetchSsrf.test.mjs
 *
 * THE DEFECT, found 2026-09-12 by reading agent.js end to end.
 *
 * download_file carries a full SSRF block (agent.js ~1058-1068) and its own header comment says why:
 *
 *     "SSRF block - refuses localhost, private ranges and cloud metadata. Without this an autonomous
 *      agent could fetch http://localhost:3001/api/keys and write your API keys into the workspace,
 *      or read cloud instance credentials."
 *
 * That tool is OFF by default and deliberately absent from AUTO_TOOLS. web_fetch is IN AUTO_TOOLS
 * (agent.js:1687), takes a URL straight from the model, has no host check of any kind, follows
 * redirects with no re-check, and returns 4,000 characters of the body into the model's context -
 * which is then written to the run file, the transcript jsonl, and harvested into training rows.
 * hub.json holds the provider API keys.
 *
 * The justification sits at agent.js:1673: "web_search/web_fetch are read-only network reads with
 * truncated output." That is the reasoning error. They are read-only with respect to the WORKSPACE.
 * They are not read-only with respect to the hub's own localhost API, and READING is the whole
 * attack - nothing needs to be written.
 *
 * This is the same shape as append_file missing markerRefusal, and as verify_project being fixed
 * while the finish gate kept the bug: the guard exists, on one route, and not on its sibling.
 *
 * RED-FIRST: every case below FAILS before the fix (the host check does not exist, so web_fetch
 * proceeds to fetch). The controls are the point - a fix that simply refuses everything would pass
 * the refusal cases and fail the last two.
 */
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Before importing agent.js: never let a tool test touch the developer's live workspace.
process.env.AGENT_WORKSPACE = mkdtempSync(join(tmpdir(), 'ssrf-ws-'));

const { __toolPolicyTest } = await import('./agent.js');
const call = (tool, args) => __toolPolicyTest.callTool(tool, args);

let passed = 0, failed = 0;
const test = async (n, f) => {
  try { await f(); passed++; console.log('  ok    ' + n); }
  catch (e) { failed++; console.error('  FAIL  ' + n + '\n        ' + String(e.message).split('\n').slice(0, 4).join('\n        ')); }
};

/** A refusal, not a network error: the tool must never have opened a socket. */
const REFUSED = /private or loopback|refusing to fetch/i;

console.log('\nweb_fetch refuses what download_file refuses\n');

// ── the addresses that matter ────────────────────────────────────────────────
const BLOCKED = [
  ['the hub\'s own API - the exact case download_file\'s comment names', 'http://localhost:3001/api/keys'],
  ['loopback by IP', 'http://127.0.0.1:11434/api/tags'],
  ['cloud instance metadata', 'http://169.254.169.254/latest/meta-data/iam/security-credentials/'],
  ['GCP metadata by name', 'http://metadata.google.internal/computeMetadata/v1/'],
  ['IPv6 loopback', 'http://[::1]:3001/api/keys'],
  ['private range 10/8', 'http://10.0.0.5/'],
  ['private range 192.168/16', 'http://192.168.1.1/'],
  ['private range 172.16/12', 'http://172.16.0.1/'],
  ['0.0.0.0', 'http://0.0.0.0:3001/'],
];

for (const [what, url] of BLOCKED) {
  await test(`web_fetch REFUSES ${what}`, async () => {
    const r = String(await call('web_fetch', { url }));
    assert.match(r, REFUSED, `web_fetch returned: ${r.slice(0, 160)}`);
  });
}

// ── the control that keeps the fix honest ────────────────────────────────────
// A fix that refuses every URL would pass everything above. These prove the gate is a HOST check
// and not a blanket refusal.
await test('CONTROL: a public host is NOT refused by the host gate', async () => {
  // A domain that cannot resolve, so no real request leaves this machine. What matters is WHICH
  // failure comes back: a DNS/fetch error means the host gate let it through, which is correct.
  const r = String(await call('web_fetch', { url: 'http://nonexistent.invalid/some/page' }));
  assert.doesNotMatch(r, REFUSED, 'a public host must reach the fetch, not the host gate');
  assert.match(r, /ERROR: fetch failed|ENOTFOUND|getaddrinfo|EAI_AGAIN/i, `got: ${r.slice(0, 160)}`);
});

await test('CONTROL: the scheme check still fires before the host check', async () => {
  const r = String(await call('web_fetch', { url: 'file:///etc/passwd' }));
  assert.match(r, /must start with http/i, `got: ${r.slice(0, 160)}`);
});

// ── the sibling this rule was copied from must still work ────────────────────
await test('CONTROL: download_file still refuses the same address (the rule it came from)', async () => {
  process.env.AGENT_ALLOW_DOWNLOADS = '1';
  try {
    const r = String(await call('download_file', { url: 'http://169.254.169.254/latest/meta-data/', path: 'x.txt' }));
    assert.match(r, REFUSED, `download_file returned: ${r.slice(0, 160)}`);
  } finally { delete process.env.AGENT_ALLOW_DOWNLOADS; }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
