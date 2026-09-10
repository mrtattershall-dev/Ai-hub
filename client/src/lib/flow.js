/**
 * flow.js - how one tab's output becomes the next tab's input.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every tab in the hub was a dead end. You planned in Strategy, then re-typed the plan
 * into Code by hand; you generated in Code, then re-typed the brief into Game. The tabs
 * were siblings, not a pipeline, and a pipeline is the whole point once the thing runs
 * unattended - a 24/7 loop cannot copy-paste between panes.
 *
 * A "handoff" is one typed hop: { to, payload, at }. The source tab produces it, the
 * store carries exactly one at a time, and the destination tab consumes it on mount and
 * prefills itself. One at a time is deliberate - a queue of pending handoffs would
 * silently stack up behind a tab nobody opened, and you would come back to five stale
 * prefills fighting over one textarea. The queue for unattended work is the server's
 * (`server/queue.js`), which is durable and has dependencies; this is the human-speed path.
 *
 * The derivations below are plain functions over text, so they are testable without a
 * browser - see `flow.test.mjs`.
 */
import { splitMarkdownSections, extractCodeBlocks } from './markdown.js';

/**
 * Which hops `OutputBlock` offers, per output kind.
 *
 * Code -> Game is a real hop but it is not here: Code renders chat messages, not output
 * blocks, so it hands off from `ChatMessage` using `codeToGame` below. Listing it here
 * as well would add a button that can never render.
 */
export const FLOW = {
  strategy: [{ to: 'code', label: 'Build this in Code', derive: planToCodeBrief }],
};

/** The hops available for a given output, already bound to it. Empty array if none. */
export function hopsFor(output) {
  const hops = FLOW[output?.kind] || [];
  return hops
    .map((h) => ({ ...h, payload: safeDerive(h.derive, output) }))
    .filter((h) => h.payload != null);
}

function safeDerive(derive, output) {
  try { return derive(output); } catch { return null; }
}

// A section is "the goal" if its label is one of these, best match first. Canvas types
// disagree on what they call it (Goal / Overview / Summary), so match on a list rather
// than on one canvas's shape.
const GOAL_LABELS = ['goal', 'overview', 'summary'];
const WORK_LABELS = ['tasks', 'milestones', 'key components', 'components', 'recommendations'];
const RISK_LABELS = ['risks & mitigations', 'risks', 'tradeoffs', 'weaknesses', 'open questions'];

const pick = (sections, labels) =>
  labels
    .map((l) => sections.find((s) => (s.label || '').trim().toLowerCase() === l))
    .find(Boolean) || null;

/**
 * Strategy canvas -> a build brief for the Code tab.
 *
 * Not a summary: the plan's own words are carried over verbatim. A model that re-reads
 * its own plan compressed into two lines rebuilds the missing detail by guessing, and the
 * guess is not what you planned. Risks come along as constraints because "don't do X" is
 * the part of a plan that most often gets dropped in the handoff and most expensively.
 */
export function planToCodeBrief(output) {
  const text = (output?.response || '').trim();
  if (!text) return null;

  const sections = splitMarkdownSections(text);
  // Guard only: splitMarkdownSections returns a "Response" section for any non-empty
  // text, so this is the empty case, already handled above.
  if (sections.length === 0) return { task: 'generate', input: text, from: 'strategy' };

  const goal = pick(sections, GOAL_LABELS);
  const work = pick(sections, WORK_LABELS);
  const risk = pick(sections, RISK_LABELS);

  const parts = [];
  if (goal) parts.push(`Goal\n${goal.content.trim()}`);
  if (work) parts.push(`Build this\n${work.content.trim()}`);
  if (risk) parts.push(`Constraints to respect\n${risk.content.trim()}`);

  // None of the expected labels matched - an unusual canvas, or a model that ignored the
  // section headings. Fall back to the whole plan instead of handing over an empty brief.
  const input = parts.length ? parts.join('\n\n') : text;
  return { task: 'generate', input, from: 'strategy' };
}

/**
 * Code answer -> the block the Game tab should run, or null if there isn't one.
 *
 * Preference, not position: a reply often ends with a snippet of config or a shell line,
 * so "the last block" runs the wrong thing. Tagged js wins, then html, then an untagged
 * block - untagged last because that is also what prose-in-backticks looks like.
 */
export function codeToGame(text) {
  const blocks = extractCodeBlocks(text || '');
  const block = blocks.find(b => ['js', 'javascript'].includes(b.lang))
    || blocks.find(b => b.lang === 'html')
    || blocks.find(b => b.lang === '');
  return block && block.code.trim() ? { code: block.code, from: 'code' } : null;
}
