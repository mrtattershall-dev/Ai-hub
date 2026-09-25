/**
 * seedProbe.mjs - does the served backend ACCEPT and HONOUR a per-request seed?
 *
 *   node server/seedProbe.mjs <modelBaseUrl> [seed]
 *
 * Three short chat requests, each a few tokens: two with the same seed, one with none. Reports
 * whether the seeded pair returned identical text and whether any request errored. It is a
 * check to run once against a fresh deployment before a campaign relies on seeds - a claim
 * about determinism is made only from what it observed, for this build, on this day.
 */
const BASE = process.argv[2];
const SEED = parseInt(process.argv[3] || '101', 10);
if (!BASE) { console.error('usage: node server/seedProbe.mjs <modelBaseUrl> [seed]'); process.exit(2); }

const messages = [
  { role: 'system', content: 'You are a terse assistant.' },
  { role: 'user', content: 'Write one Python function that returns the second largest element of a list. Code only.' },
];
async function ask(seed) {
  const body = { model: 'mycoder', messages, stream: false, options: { temperature: 0.7, num_predict: 96, ...(seed !== null ? { seed } : {}) } };
  const t0 = Date.now();
  const r = await fetch(`${BASE.replace(/\/$/, '')}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(120_000) });
  const text = await r.text();
  let content = null;
  try { content = JSON.parse(text)?.message?.content ?? null; } catch { /* leave null */ }
  return { status: r.status, ms: Date.now() - t0, content, raw: content === null ? text.slice(0, 200) : null };
}
const a = await ask(SEED), b = await ask(SEED), c = await ask(null);
const ok = a.status === 200 && b.status === 200 && c.status === 200 && a.content !== null && b.content !== null && c.content !== null;
console.log(JSON.stringify({
  base: BASE, seed: SEED, allOk: ok,
  statuses: [a.status, b.status, c.status], ms: [a.ms, b.ms, c.ms],
  seededPairIdentical: ok ? a.content === b.content : null,
  seededDiffersFromUnseeded: ok ? a.content !== c.content : null,
  sampleA: a.content?.slice(0, 120) ?? a.raw, sampleB: b.content?.slice(0, 120) ?? b.raw,
}, null, 2));
process.exit(ok ? 0 : 1);
