/**
 * escalate.js - tell someone when the agent gets stuck.
 *
 * When a run hit its budget, tripped the loop guard, or gave up on parsing, it flipped
 * a status field and stopped. That is fine when a human is watching the screen. It is
 * useless at 4am: the whole point of an unattended agent is that nobody IS watching,
 * so "it stopped and said so in a UI nobody has open" is the same as silence.
 *
 * Two sinks, both optional, neither able to break a run:
 *   ESCALATIONS.md    - always written, next to the workspace. The durable record.
 *   AGENT_ESCALATE_WEBHOOK - POSTed if set. Slack/Discord-shaped JSON ({text}), which
 *                       is also what most generic webhook receivers accept.
 *
 * Deliberately never throws: an agent that crashes while reporting that it is stuck
 * is worse than one that just gets stuck.
 */
import { appendFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import fetch from 'node-fetch';

const FILE = 'ESCALATIONS.md';

/** Reasons worth waking someone for, and what a human would actually do about each. */
const ADVICE = {
  budget: 'Raise AGENT_MAX_STEPS / AGENT_MAX_MINUTES, or split the goal into smaller runs.',
  loop: 'The model repeated itself. It usually needs a clearer goal or a stronger model.',
  parse: 'The model could not produce a valid action repeatedly — usually a model/prompt mismatch.',
  approval: 'A command needs your decision. Open the run and approve or deny it.',
  same_error: 'The same bug survived several fix attempts — likely structural, needs a human read.',
  tunnel: 'The model endpoint was unreachable. Re-point the Ollama tunnel, then Resume.',
  error: 'The run failed with an error. Check the last step for the message.',
  verify_failed: 'The project does not run. The agent could not get it to a working state.',
};

export async function escalate(workspace, { runId, goal, reason, detail, status } = {}) {
  const kind = reason || 'error';
  const when = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const advice = ADVICE[kind] || '';
  const line =
    `\n## ${when} — ${kind}\n` +
    `- run: \`${runId || '?'}\`  (status: ${status || '?'})\n` +
    `- goal: ${String(goal || '').slice(0, 300)}\n` +
    `- what happened: ${String(detail || '').slice(0, 800)}\n` +
    (advice ? `- what to do: ${advice}\n` : '');

  try {
    const f = join(workspace, FILE);
    if (!existsSync(f)) {
      writeFileSync(f, '# Escalations\n\nRuns that stopped and need a person. Newest at the bottom.\n', 'utf8');
    }
    appendFileSync(f, line, 'utf8');
  } catch { /* never let reporting break the run */ }

  const hook = process.env.AGENT_ESCALATE_WEBHOOK;
  if (hook) {
    const text = `🤖 Agent stopped (${kind})\nGoal: ${String(goal || '').slice(0, 200)}\n${String(detail || '').slice(0, 400)}${advice ? `\n→ ${advice}` : ''}`;
    try {
      await fetch(hook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, runId, reason: kind, goal, detail, status }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch { /* a dead webhook is not the run's problem */ }
  }
  return line;
}

/**
 * Rough token accounting.
 *
 * Ollama's /api/chat returns prompt_eval_count / eval_count, but the streaming path
 * discards everything except the content, and re-plumbing that is a bigger change than
 * this is worth. ~4 chars per token is close enough for the purpose: knowing when a run
 * has spent an unreasonable amount, not billing anyone.
 */
export function estimateTokens(messages, reply = '') {
  const chars = messages.reduce((n, m) => n + String(m.content || '').length, 0) + String(reply).length;
  return Math.ceil(chars / 4);
}

export function tokenBudgetExceeded(run) {
  const cap = parseInt(process.env.AGENT_MAX_TOKENS || '0', 10);
  if (!cap) return null;
  return (run.tokens || 0) >= cap ? `token budget (${cap.toLocaleString()} tokens)` : null;
}
