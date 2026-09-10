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
import { CANVAS_TYPES } from './constants.js';

/**
 * Which hops `OutputBlock` offers, per output kind.
 *
 * Two real hops are not in this table because their source does not render output
 * blocks: Code -> Game hands off from `ChatMessage` via `codeToGame`, and Game -> Code
 * hands off from a failed verdict via `verdictToFix`. Listing either here would add a
 * button that can never render.
 */
export const FLOW = {
  strategy: [
    { to: 'code', label: 'Build this in Code', derive: planToCodeBrief },
    {
      to: 'agent',
      label: 'Queue as an unattended chain',
      derive: planToChain,
      action: 'queueChain',
      explain: chainBlockReason,
    },
  ],
};

/**
 * The hops available for a given output, already bound to it. Empty array if none.
 *
 * A hop whose derivation came back empty is NOT dropped when it can say why. It used to
 * be: one drifted heading and "Queue as an unattended chain" simply was not on the block,
 * with nothing to say the unattended path had gone away. A button that tells you what is
 * missing beats the absence of a button, so a blocked hop keeps its place and carries a
 * `blocked` reason for the UI to show instead of firing.
 */
export function hopsFor(output) {
  const hops = FLOW[output?.kind] || [];
  return hops
    .map((h) => {
      const payload = safeDerive(h.derive, output);
      if (payload != null) return { ...h, payload, blocked: null };
      const blocked = h.explain ? safeDerive(h.explain, output) : null;
      return blocked ? { ...h, payload: null, blocked } : null;
    })
    .filter(Boolean);
}

function safeDerive(derive, output) {
  try { return derive(output); } catch { return null; }
}

// A section is "the goal" if its label is one of these, best match first. Canvas types
// disagree on what they call it (Goal / Overview / Summary), so match on a list rather
// than on one canvas's shape.
const GOAL_LABELS = ['goal', 'overview', 'summary'];
export const WORK_LABELS = ['tasks', 'milestones', 'key components', 'components', 'recommendations'];
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

/**
 * The most goals one plan may become. Mirrors MAX_CHAIN in server/agent.js - the server
 * is the one that enforces it, this only avoids posting something certain to be refused.
 */
export const MAX_CHAIN = 12;

/**
 * Strategy canvas -> an ordered list of goals for the agent queue.
 *
 * This is the unattended path, and it is a different shape from planToCodeBrief on
 * purpose. One brief in a composer is something you read before sending. A chain is
 * something that runs while you are asleep, so each link has to stand on its own: the
 * agent picking up step 4 six hours from now has no memory of steps 1-3, and a goal that
 * reads "then wire it up" is worthless to it. Each goal therefore carries its own
 * sub-points inline and a one-line reminder of the plan it belongs to.
 *
 * Only the work section becomes goals. Risks are context, not tasks - queueing
 * "the ball might tunnel through the paddle at high speed" as a goal would have the agent
 * earnestly try to build it.
 */
export function planToChain(output) {
  const text = (output?.response || '').trim();
  if (!text) return null;

  const sections = splitMarkdownSections(text);
  const work = pick(sections, WORK_LABELS);
  if (!work) return null;

  const items = parseListItems(work.content);
  if (!items.length) return null;

  const goalSection = pick(sections, GOAL_LABELS);
  const context = goalSection ? firstLine(goalSection.content) : '';

  const goals = items.slice(0, MAX_CHAIN).map((item) => (
    context ? `${item}\n\nPart of: ${context}` : item
  ));
  return { goals, dropped: Math.max(0, items.length - MAX_CHAIN), from: 'strategy' };
}

const BULLET = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/;

/**
 * Pull top-level list items out of a markdown section, each with its own nested lines
 * folded in.
 *
 * Indentation decides nesting, and models are inconsistent about it - two spaces, four,
 * or a tab. Anything indented at all belongs to the item above it; only a bullet at
 * column zero starts a new one. A section with no bullets at all yields nothing rather
 * than one goal made of the whole paragraph, because "no list here" and "a one-item list"
 * are different things and only the first should decline to queue.
 */
export function parseListItems(content) {
  const items = [];
  for (const raw of String(content || '').split('\n')) {
    if (!raw.trim()) continue;
    const indented = /^[ \t]/.test(raw);
    const m = raw.match(BULLET);
    if (m && !indented) { items.push([m[1].trim()]); continue; }
    if (!items.length) continue;             // prose before the first bullet: not part of any item
    items[items.length - 1].push((m ? m[1] : raw).trim());
  }
  return items.map((lines) => lines.filter(Boolean).join('\n')).filter((t) => t.trim());
}

const firstLine = (text) => String(text || '').split('\n').map(l => l.trim()).find(Boolean) || '';

/** Longest run of code carried into a repair brief before it is truncated. */
export const MAX_FIX_CODE = 12000;
/** Distinct console errors worth passing on. Past this it is the same failure repeating. */
export const MAX_FIX_ERRORS = 8;

/**
 * A failed Chromium verdict -> a repair brief for the Code tab. Null when it passed.
 *
 * This is the link that closes the loop. Verification could already tell you a game was
 * broken and then left you to retype the failure into Code yourself, which is exactly the
 * copy-paste step the flow exists to remove - and the step where the useful detail
 * (which check failed, which asset was missing) quietly gets dropped because it is
 * tedious to transcribe.
 *
 * The code travels with the brief. A repair is not a conversation the model can pick up
 * from memory: the buffer in the Game tab may have been hand-edited, or pasted from
 * somewhere else entirely, so the thing that actually failed has to be the thing that
 * gets sent back.
 */
export function verdictToFix(verdict, { code = '', engine = '' } = {}) {
  if (!verdict || verdict.ok) return null;

  const parts = [`This ${engine || 'game'} code failed verification in headless Chromium. Fix it.`];
  if (verdict.verdict) parts.push(`Verdict: ${verdict.verdict}`);

  const c = verdict.checks;
  if (c) {
    const failed = [];
    if (!c.engineLoaded) failed.push('the engine never loaded');
    // A canvas of 0x0 is a pass on "rendered" by accident, so report the size either way.
    if (!c.rendered) failed.push(`nothing rendered (canvas ${c.canvasWidth || 0}x${c.canvasHeight || 0})`);
    if (failed.length) parts.push(`Failed checks: ${failed.join('; ')}`);
  }

  // The same error fires once per frame, so an unfiltered list is one message copied 60
  // times and the real second error scrolled off the end.
  const errors = [...new Set((verdict.errors || []).map((e) => String(e?.message || e).trim()).filter(Boolean))];
  if (errors.length) {
    parts.push(`Console errors:\n${errors.slice(0, MAX_FIX_ERRORS).map((e) => `- ${e}`).join('\n')}`);
    if (errors.length > MAX_FIX_ERRORS) parts.push(`(${errors.length - MAX_FIX_ERRORS} further distinct errors omitted)`);
  }

  if (verdict.assetsMissing?.length) {
    parts.push(
      `These assets do not exist: ${verdict.assetsMissing.join(', ')}.\n` +
      `Use canonical asset names only - every canonical name is guaranteed to resolve.`
    );
  }

  if (code) {
    const truncated = code.length > MAX_FIX_CODE;
    parts.push(
      `Return the corrected file in full, not a diff.\n\n\`\`\`js\n` +
      (truncated ? `${code.slice(0, MAX_FIX_CODE)}\n/* ...truncated... */` : code) +
      '\n```'
    );
  }

  return { task: 'debug', input: parts.join('\n\n'), from: 'game' };
}

/**
 * Which of a canvas's own sections carries the work, or null if none does.
 *
 * WORK_LABELS order decides, not the canvas's order, because that is the order `pick`
 * reads in: the Action Plan canvas has both Milestones and Tasks, and asking a model for
 * bullets in the one the chain will not read is the same as asking for nothing.
 */
export function workSectionOf(canvas) {
  const byLabel = new Map((canvas?.sections || []).map((s) => [s.trim().toLowerCase(), s]));
  for (const label of WORK_LABELS) {
    if (byLabel.has(label)) return byLabel.get(label);
  }
  return null;
}

/**
 * Why this plan cannot become a chain, in words a person can act on. Null when it can.
 *
 * The chain is the only path from a plan to unattended execution, so its absence is the
 * most expensive silent failure in the flow: you write a plan at midnight, the button is
 * not there, and nothing runs while you sleep. Both failures it reports are fixed by
 * refining the plan, so each one names the fix rather than the rule that was broken.
 */
export function chainBlockReason(output) {
  // An empty response is not a plan that failed to chain, it is an output block with
  // nothing in it - Code declines it too, so the block should carry no buttons at all
  // rather than one that exists only to explain the emptiness back to you.
  const text = (output?.response || '').trim();
  if (!text) return null;

  const sections = splitMarkdownSections(text);
  const work = pick(sections, WORK_LABELS);

  if (!work) {
    // Name the section THIS canvas was asked for where we know it. "no ## Tasks section"
    // is something you can act on; the full list of labels the matcher accepts is trivia.
    const canvas = CANVAS_TYPES.find((c) => c.id === output?.canvasId);
    const wanted = (canvas && workSectionOf(canvas)) || 'Tasks';
    const have = sections.map((s) => s.label).filter((l) => l && l !== 'Response');
    return `A chain is built from the "## ${wanted}" section, and this plan has none` +
      (have.length ? ` - it has ${andList(have)}.` : '.') +
      ` Refine it and ask for the work as a ${wanted} section of bullet points.`;
  }

  if (!parseListItems(work.content).length) {
    return `"${work.label}" is written as prose. One queued goal comes from one top-level bullet, ` +
      `so refine the plan and ask for ${work.label.toLowerCase()} as a bulleted list.`;
  }

  // Both checks passed, so this plan chains. Saying so - rather than returning a vague
  // "could not" that is only true when hopsFor asks - keeps the function honest for any
  // caller: null means the chain is available, a string is the reason it is not.
  return null;
}

// "A, B and C" - for listing what a plan actually has.
const andList = (labels) => {
  const shown = labels.map((l) => `"${l}"`);
  if (shown.length <= 1) return shown.join('');
  return `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`;
};

/**
 * A saved history row -> a strategy output you can act on again.
 *
 * Every Strategy request is already stored server-side, but the History tab renders it as
 * a transcript: you can read last night's plan and you cannot build it. The plan text is
 * the only thing the hops need, so reviving one is re-wrapping the row - no new storage,
 * no second copy of the truth.
 */
export function historyToPlan(row) {
  const response = String(row?.response || '').trim();
  if (!response) return null;
  const canvas = CANVAS_TYPES.find((c) => c.id === row?.task);
  return {
    kind: 'strategy',
    response,
    providerId: row?.provider || 'unknown',
    canvasId: canvas ? canvas.id : null,
    label: canvas ? canvas.label : 'Saved plan',
    prompt: String(row?.prompt || ''),
    tokens: Number(row?.tokens_used || 0),
    // The DB keeps seconds; every timestamp in the client is milliseconds.
    createdAt: row?.created_at ? row.created_at * 1000 : Date.now(),
    fromHistory: true,
  };
}
