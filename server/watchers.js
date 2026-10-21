/**
 * watchers.js - the Watchers: a paid reviewer reads every finished local-model run and writes down
 * where it went wrong, when, how and why. Enoch is the scribe: every verdict goes to enoch.jsonl,
 * append-only, with what it cost.
 *
 * The local model (qwen2.5-coder:7b) does the work for free; Claude only reads the record afterwards.
 * Nothing here runs inside the agent loop: reviewRun() is called after the run is finalized and
 * persisted, is queued behind any review already in flight, and swallows its own failures. A review
 * that cannot happen (no key, budget spent, API error) is written to Enoch as such, never silently skipped.
 *
 * A VERDICT IS A HYPOTHESIS. The reviewer reads a transcript; it did not watch the run. A diagnosis
 * counts once it reproduces (fuzz seed replay, or the same goal failing the same way again).
 *
 *   WATCHERS=1                   enable (off by default, so test and fuzz hubs never spend)
 *   WATCHERS_BUDGET_USD=10       hard cap on total spend across every review ever recorded in Enoch
 *   WATCHERS_MODEL               default claude-sonnet-5-5
 *   WATCHERS_EFFORT              default medium
 *   WATCHERS_DONE_SAMPLE=0.5     share of "done" runs that were never verified to review (failures: all)
 *   WATCHERS_VERIFIED_SAMPLE=0.1 share of verified runs to review (the control: what does success look like)
 *   WATCHERS_REVIEW_CLAUDE=1     also review runs Claude itself drove (off: the subject is the local model)
 *   WATCHERS_DIR                 where enoch.jsonl lives (default server/enoch)
 *   WATCHERS_BASE_URL            override the API base (tests point it at a mock)
 */
import Anthropic from '@anthropic-ai/sdk';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENOCH_DIR = () => process.env.WATCHERS_DIR || join(__dirname, 'enoch');
export const enochPath = () => join(ENOCH_DIR(), 'enoch.jsonl');

// $ per million tokens, first-party API rates. A fallback can answer on a different model, so cost is
// priced by the model that RESPONDED; an unlisted model is priced at the most expensive tier, so the
// cap errs towards stopping early rather than overspending.
const PRICES = {
  'claude-sonnet-5-5': { in: 2, out: 10, cacheRead: 0.2 },
  'claude-sonnet-5': { in: 2, out: 10, cacheRead: 0.2 },
  'claude-opus-5-5': { in: 4, out: 20, cacheRead: 0.2 },
  'claude-opus-5': { in: 5, out: 25, cacheRead: 0.5 },
  'claude-opus-4-8': { in: 5, out: 25, cacheRead: 0.5 },
};
const WORST = { in: 10, out: 50, cacheRead: 1 };
export const priceOf = (model) => PRICES[model] || WORST;
export { WORST };
// Cache writes bill at 1.25x input (5-minute TTL).
export function costUsd(model, u = {}) {
  const p = priceOf(model);
  return ((u.input_tokens || 0) * p.in + (u.cache_creation_input_tokens || 0) * p.in * 1.25
    + (u.cache_read_input_tokens || 0) * p.cacheRead + (u.output_tokens || 0) * p.out) / 1e6;
}

const MAX_TOKENS = 16000;            // thinking + the verdict; non-streaming, so kept under SDK timeouts
const DOSSIER_MAX = 90_000;          // chars of run record sent (~22k tokens); the cut is marked, never silent
const ARG_MAX = 700, RESULT_MAX = 900, REPLY_MAX = 2500;

export function spent() {
  if (!existsSync(enochPath())) return 0;
  let total = 0;
  for (const line of readFileSync(enochPath(), 'utf8').split('\n')) {
    if (!line) continue;
    try { total += JSON.parse(line).costUsd || 0; } catch { /* a torn line costs nothing */ }
  }
  return total;
}

/** Which runs get reviewed, and why. Returns null to skip. */
export function selectReason(run, rand = Math.random) {
  if (!['done', 'error', 'stopped', 'refused_d2', 'stopped_d2_restored'].includes(run.status)) return null;
  if (run.provider === 'claude' && process.env.WATCHERS_REVIEW_CLAUDE !== '1') return null;
  if (run.status !== 'done') return `failed:${run.status}`;
  const verified = run.verified || run.finishKind === 'verified';
  const rate = parseFloat(verified ? (process.env.WATCHERS_VERIFIED_SAMPLE ?? '0.1') : (process.env.WATCHERS_DONE_SAMPLE ?? '0.5'));
  return rand() < rate ? (verified ? 'sample:verified' : 'sample:done_unverified') : null;
}

const cut = (s, n) => { s = typeof s === 'string' ? s : JSON.stringify(s ?? ''); return s.length > n ? `${s.slice(0, n)} [...${s.length - n} chars cut]` : s; };

/** The run as the reviewer sees it: what was asked, what the model said, what the hub did with it. */
export function buildDossier(run) {
  const head = [
    `GOAL: ${run.goal}`,
    `FINAL STATUS: ${run.status}   finishKind: ${run.finishKind || (run.verified ? 'verified' : 'none')}   protection: ${run.protection || 'n/a'}`,
    `MODEL: ${run.provider || '?'} / ${run.model || '?'}   model calls: ${run.modelCalls ?? '?'}   steps: ${run.steps?.length ?? 0}`,
    `UNPARSEABLE REPLIES: ${(run.parseLog || []).filter((ok) => !ok).length} of last ${(run.parseLog || []).length}   repeated-error count: ${run.sameErr ?? 0}   last error signature: ${run.lastErrSig || 'none'}`,
    run.plan ? `\nPLAN THE MODEL WROTE:\n${cut(run.plan, 4000)}` : '',
  ].join('\n');

  const steps = (run.steps || []).map((s) => {
    const parts = [`#${s.n} [${s.type}${s.tool ? ':' + s.tool : ''}]`];
    if (s.thought) parts.push(`thought: ${cut(s.thought, 400)}`);
    if (s.args) parts.push(`args: ${cut(s.args, ARG_MAX)}`);
    if (s.result !== undefined) parts.push(`result: ${cut(s.result, RESULT_MAX)}`);
    if (s.text) parts.push(`text: ${cut(s.text, 600)}`);
    return parts.join('\n  ');
  }).join('\n');

  // The raw replies, numbered in order. Steps show what the hub PARSED; a format failure is only visible here.
  const replies = (run.history || []).filter((m) => m.role === 'assistant')
    .map((m, i) => `--- reply ${i + 1} ---\n${cut(m.content, REPLY_MAX)}`).join('\n');

  let body = `${head}\n\n=== STEPS (what the hub did) ===\n${steps}\n\n=== RAW MODEL REPLIES (what the model actually said) ===\n${replies}`;
  if (body.length > DOSSIER_MAX) {
    const keep = DOSSIER_MAX / 2;
    body = `${body.slice(0, keep)}\n\n[... ${body.length - DOSSIER_MAX} chars of the middle of this run omitted for length ...]\n\n${body.slice(-keep)}`;
  }
  return body;
}

const CATEGORIES = ['none', 'reply_format', 'wrong_tool', 'bad_tool_args', 'lost_goal', 'hallucinated_api', 'broken_code',
  'looping', 'gave_up_early', 'false_completion', 'bad_plan', 'context_overflow', 'hub_bug', 'environment', 'other'];

export const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['outcome', 'goal_met', 'first_failure_step', 'failure_category', 'secondary_categories', 'at_fault',
    'when', 'how', 'why', 'evidence', 'hub_fix', 'prompt_fix', 'confidence', 'reproduce'],
  properties: {
    outcome: { type: 'string', enum: ['succeeded', 'partial', 'failed', 'unclear'] },
    goal_met: { type: 'string', enum: ['yes', 'partly', 'no', 'unknown'] },
    first_failure_step: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    failure_category: { type: 'string', enum: CATEGORIES },
    secondary_categories: { type: 'array', items: { type: 'string', enum: CATEGORIES } },
    at_fault: { type: 'string', enum: ['model', 'hub', 'both', 'environment', 'none', 'unclear'] },
    when: { type: 'string' },
    how: { type: 'string' },
    why: { type: 'string' },
    evidence: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['step', 'quote'], properties: { step: { type: 'integer' }, quote: { type: 'string' } } },
    },
    hub_fix: { type: 'string' },
    prompt_fix: { type: 'string' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    reproduce: { type: 'string' },
  },
};

const REVIEWER = `You are a Watcher: you review one finished run of a coding agent and find exactly where, when, how and why it went wrong.

The agent is a small local model (often qwen2.5-coder:7b) driven by a hub. Each turn the model replies in the hub's action format; the hub parses one action, executes the tool, and feeds back the result. You get the agent's own instructions, the steps the hub recorded, and the model's raw replies.

Judge the run, not the hub's label. "done" means the model said it finished; it does not mean the goal was met. Check the files it wrote and the results it got against the goal.

Categories:
- reply_format: the reply did not follow the action format (prose instead of an action, two actions in one reply, broken fence, leaked line numbers)
- wrong_tool / bad_tool_args: a valid action, but the wrong one, or malformed or incorrect arguments
- lost_goal: drifted from what was asked, or redid finished work
- hallucinated_api: used a function, file, library or flag that does not exist
- broken_code: wrote code that fails (syntax, runtime, wrong logic)
- looping: repeated the same action or error without changing approach
- gave_up_early / false_completion: stopped, or declared done, with the goal unmet
- bad_plan: the plan itself was wrong or missing required parts
- context_overflow: lost track because the conversation grew too long
- hub_bug: the hub mis-parsed, mis-executed or mis-reported something the model did correctly
- environment: missing tool, permission, network, timeout outside both
- none: the run achieved the goal

Rules:
- first_failure_step is the step number (#n) where it first went wrong, or null if nothing did.
- Every claim in how/why must be backed by an evidence item quoting the step or reply it comes from. Do not invent quotes.
- why is the root cause: what the model misunderstood, or what the hub did that caused it. Not a restatement of the symptom.
- hub_fix: a concrete change to the hub (parser, tool, guard, check) that would have prevented or caught this; prompt_fix: a concrete change to the agent's instructions. Write "none" if there is none.
- reproduce: how someone could make this failure happen again (goal, state, the reply pattern).
- If the record is not enough to tell, say so, lower confidence, and use outcome "unclear".`;

let chain = Promise.resolve();

/**
 * Queue a review of a finalized run. Never throws, never blocks the caller.
 * loadDb gives the hub's stored keys; the Claude key there is the reviewer's key.
 */
export function reviewRun(run, loadDb, { rand } = {}) {
  if (process.env.WATCHERS !== '1') return Promise.resolve(null);
  const reason = selectReason(run, rand);
  if (!reason) return Promise.resolve(null);
  // Snapshot now: the run object keeps living (followups, queue) after this returns.
  const snap = JSON.parse(JSON.stringify({ ...run, abort: undefined }));
  const job = chain.then(() => doReview(snap, reason, loadDb)).catch((e) => record({ runId: snap.id, reason, error: `watcher crashed: ${e.message}` }));
  chain = job;
  return job;
}

export function record(row) {
  try {
    mkdirSync(ENOCH_DIR(), { recursive: true });
    const full = { at: new Date().toISOString(), watcher: 'postmortem', costUsd: 0, ...row };
    appendFileSync(enochPath(), JSON.stringify(full) + '\n');
    return full;
  } catch { return null; }
}

async function doReview(run, reason, loadDb) {
  const base = { runId: run.id, reason, goal: run.goal, status: run.status, subject: `${run.provider || '?'}/${run.model || '?'}` };
  const db = loadDb();
  const row = db.api_keys?.claude;
  if (!row?.key_value) return record({ ...base, skipped: 'no Claude key saved in the hub' });

  const model = process.env.WATCHERS_MODEL || 'claude-sonnet-5-5';
  const cap = parseFloat(process.env.WATCHERS_BUDGET_USD || '10');
  const dossier = buildDossier(run);
  const instructions = String(run.history?.[0]?.content || '');
  // Worst case for THIS call: every input token uncached plus a full max_tokens reply, priced at the
  // responding model's rate or worse. If that could cross the cap, the review does not start.
  const estIn = Math.ceil((REVIEWER.length + instructions.length + dossier.length) / 3);
  const worst = (estIn * Math.max(priceOf(model).in * 1.25, WORST.in) + MAX_TOKENS * WORST.out) / 1e6;
  const already = spent();
  if (already + worst > cap) return record({ ...base, skipped: `budget: $${already.toFixed(4)} of $${cap} spent, this review could cost up to $${worst.toFixed(4)}` });

  const client = new Anthropic({ apiKey: row.key_value, ...(process.env.WATCHERS_BASE_URL ? { baseURL: process.env.WATCHERS_BASE_URL } : {}) });
  const t0 = Date.now();
  let res;
  try {
    res = await client.beta.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: process.env.WATCHERS_EFFORT || 'medium', format: { type: 'json_schema', schema: VERDICT_SCHEMA } },
      // The reviewer brief and the agent's instructions are near-identical across runs: cached once, read cheap after.
      system: [
        { type: 'text', text: REVIEWER },
        { type: 'text', text: `THE AGENT'S INSTRUCTIONS (its system prompt for this run):\n\n${instructions}`, cache_control: { type: 'ephemeral' } },
      ],
      messages: [{ role: 'user', content: `Review this run.\n\n${dossier}` }],
    });
  } catch (e) {
    const kind = e instanceof Anthropic.RateLimitError ? 'rate_limited' : e instanceof Anthropic.AuthenticationError ? 'bad_key'
      : e instanceof Anthropic.BadRequestError ? 'bad_request' : e instanceof Anthropic.APIError ? `api_${e.status}` : 'network';
    return record({ ...base, model, error: `${kind}: ${String(e.message).slice(0, 300)}`, ms: Date.now() - t0 });
  }

  const responded = res.model || model;
  const cost = costUsd(responded, res.usage);
  const meta = { ...base, model: responded, ms: Date.now() - t0, usage: res.usage, costUsd: +cost.toFixed(6), stop: res.stop_reason, dossierChars: dossier.length };
  if (res.stop_reason === 'refusal') return record({ ...meta, error: `refused: ${res.stop_details?.category || 'unknown'}` });
  const text = (res.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  let verdict;
  try { verdict = JSON.parse(text); }
  catch { return record({ ...meta, error: `unparseable verdict (${res.stop_reason})`, raw: text.slice(0, 2000) }); }
  return record({ ...meta, verdict });
}
