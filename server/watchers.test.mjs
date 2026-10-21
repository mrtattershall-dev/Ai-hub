/**
 * watchers.test.mjs - the postmortem Watcher against a mock Anthropic API. No credit is spent.
 *
 *   node server/watchers.test.mjs
 *
 * Checks: what is selected for review, what is sent (model, schema, fallbacks, the run's own replies),
 * that the verdict and its cost reach Enoch, and that the budget cap stops a review BEFORE the call.
 */
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const dir = mkdtempSync(join(tmpdir(), 'watchers-'));
let seen = [];
const verdict = {
  outcome: 'failed', goal_met: 'no', first_failure_step: 3, failure_category: 'reply_format', secondary_categories: ['looping'],
  at_fault: 'model', when: 'step 3', how: 'two actions in one reply', why: 'did not wait for a tool result', evidence: [{ step: 3, quote: 'ACTION' }],
  hub_fix: 'none', prompt_fix: 'none', confidence: 'medium', reproduce: 'goal X',
};
const server = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    seen.push({ url: req.url, headers: req.headers, body: JSON.parse(body) });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', stop_reason: 'end_turn',
      content: [{ type: 'text', text: JSON.stringify(verdict) }],
      usage: { input_tokens: 10_000, output_tokens: 2_000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    }));
  });
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));

process.env.WATCHERS = '1';
process.env.WATCHERS_DIR = dir;
process.env.WATCHERS_BASE_URL = `http://127.0.0.1:${server.address().port}`;
const W = await import('./watchers.js');
const db = { api_keys: { claude: { key_value: 'sk-test' } } };
const loadDb = () => db;
const run = (over = {}) => ({
  id: 'r1', goal: 'make calc.js', status: 'stopped', provider: 'ollama', model: 'qwen2.5-coder:7b', modelCalls: 4, parseLog: [true, false],
  plan: '1. write calc.js', history: [{ role: 'system', content: 'AGENT RULES' }, { role: 'user', content: 'GOAL' }, { role: 'assistant', content: 'RAW REPLY ONE' }],
  steps: [{ n: 1, type: 'tool', tool: 'write_file', args: { path: 'calc.js', content: 'x' }, thought: 't', result: 'ok' }], ...over,
});

// ── selection ──
assert.equal(W.selectReason(run({ status: 'running' })), null, 'unfinished runs are not reviewed');
assert.equal(W.selectReason(run({ provider: 'claude' })), null, "Claude's own runs are not the subject");
assert.equal(W.selectReason(run()), 'failed:stopped', 'every failure is reviewed');
assert.equal(W.selectReason(run({ status: 'done' }), () => 0.4), 'sample:done_unverified');
assert.equal(W.selectReason(run({ status: 'done' }), () => 0.6), null);
assert.equal(W.selectReason(run({ status: 'done', verified: true }), () => 0.05), 'sample:verified');

// ── a review ──
const row = await W.reviewRun(run(), loadDb);
assert.equal(seen.length, 1, 'one API call');
const req = seen[0];
assert.equal(req.url, '/v1/messages?beta=true');
assert.equal(req.body.model, 'claude-sonnet-5-5');
assert.equal(req.body.fallbacks, 'default');
assert.match(req.headers['anthropic-beta'], /server-side-fallback-2026-07-01/);
assert.equal(req.body.output_config.format.type, 'json_schema');
assert.equal(req.body.temperature, undefined, 'no sampling params');
assert.match(req.body.system[1].text, /AGENT RULES/, "the agent's instructions are sent");
assert.match(req.body.messages[0].content, /RAW REPLY ONE/, 'raw replies are in the dossier');
assert.match(req.body.messages[0].content, /UNPARSEABLE REPLIES: 1 of last 2/);
assert.deepEqual(row.verdict, verdict);
assert.equal(row.costUsd, 0.04, '10k in x $2 + 2k out x $10 per MTok');
const onDisk = readFileSync(W.enochPath(), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
assert.equal(onDisk.length, 1);
assert.equal(onDisk[0].runId, 'r1');
assert.equal(W.spent(), 0.04);

// ── off by default ──
process.env.WATCHERS = '0';
assert.equal(await W.reviewRun(run(), loadDb), null);
process.env.WATCHERS = '1';

// ── no key: recorded, not called ──
const before = seen.length;
const nokey = await W.reviewRun(run({ id: 'r2' }), () => ({ api_keys: {} }));
assert.match(nokey.skipped, /no Claude key/);
assert.equal(seen.length, before);

// ── the cap stops the call before it is made ──
process.env.WATCHERS_BUDGET_USD = '0.5';
const capped = await W.reviewRun(run({ id: 'r3' }), loadDb);
assert.match(capped.skipped, /budget/);
assert.equal(seen.length, before, 'no call once the worst case could cross the cap');
assert.equal(W.spent(), 0.04, 'skips cost nothing');

// ── a long run is cut visibly, not silently ──
const big = W.buildDossier(run({ history: [{ role: 'system', content: '' }, ...Array.from({ length: 200 }, () => ({ role: 'assistant', content: 'y'.repeat(2400) }))] }));
assert.ok(big.length < 95_000);
assert.match(big, /chars of the middle of this run omitted/);

server.close();
console.log(`watchers: all checks passed (enoch at ${existsSync(W.enochPath()) ? W.enochPath() : '?'})`);
