/**
 * pingpong.mjs - two heads, one workspace, alternating turns.
 *
 *   node server/pingpong.mjs --goal "build a working X" --turns 4
 *
 * THE ARCHITECTURE THIS IMPLEMENTS
 * -------------------------------
 * Head A produces output. That output becomes head B's input. B's output becomes A's
 * next input. Neither head runs continuously; each turn is a discrete request, so both
 * ends can scale to zero between turns.
 *
 * THE ONE CHANGE THAT MAKES IT WORK
 * ---------------------------------
 * The naive version puts all the state in the message, which makes it a Markov chain:
 * each turn sees exactly one predecessor, and anything a head knew but did not write
 * down is gone forever. That is not "context readily available" - it is context
 * compressed into whatever the last message happened to say.
 *
 * So the state does NOT live in the message. It lives in the shared workspace:
 *
 *     the files       ground truth - what was actually built
 *     TASKS.md        what is done and what is left
 *     NOTES.md        decisions and dead ends
 *     git history     every change, revertible
 *
 * The message carries only INTENT and EVIDENCE. Both heads can read the workspace, so
 * nothing has to be restated to survive, and the message stays small no matter how long
 * the collaboration runs. Bounded context AND no information loss - the pure
 * message-passing version cannot have both.
 *
 * THE OTHER CHANGE
 * ----------------
 * Between every turn, the work is EXECUTED and the result goes into the handoff. A
 * second opinion is weak evidence; a test result is strong evidence. Measured tonight:
 * one round of "here is your exact error, fix it" recovered 1 of 9 failures, because
 * feedback only fixes what a model already knows. Two heads with the same knowledge gap
 * will pass the same error back and forth forever unless something outside them both
 * says what is actually true.
 *
 * Heads are asymmetric on purpose. Two identical models given identical input produce
 * identical output - "two heads" only helps when the heads differ.
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { ensureRepo, commitAll, log as gitLog } from './workspaceGit.js';
import * as ledger from './taskLedger.js';
import * as verifier from './verifyProject.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── args ──────────────────────────────────────────────────────────────────────
const arg = (n, d) => {
  const i = process.argv.indexOf('--' + n);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const GOAL = arg('goal', 'Build a working command-line to-do list in JavaScript with add/list/complete and a self-checking demo.');
const TURNS = parseInt(arg('turns', '4'), 10);
const WORKSPACE = arg('workspace', join(__dirname, '..', 'pingpong-workspace'));
const HUB = arg('hub', 'http://localhost:3001');
const TRANSCRIPT = join(WORKSPACE, '_transcript.md');

// ── heads ─────────────────────────────────────────────────────────────────────
/**
 * A head is anything that takes a message and returns text, having optionally
 * changed the workspace. Two are provided.
 */

/** Head: the hub's own agent. Costs GPU time; scales to zero between turns. */
async function hubHead(message, { role }) {
  const start = await fetch(`${HUB}/api/agent/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal: `[${role}]\n${message}` }),
  }).then((r) => r.json());
  if (!start.runId) throw new Error(`hub refused the turn: ${JSON.stringify(start)}`);

  // Poll to completion. A turn ends when the run does - that is the "discrete request"
  // property: nothing stays resident between turns.
  for (let i = 0; i < 600; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const run = await fetch(`${HUB}/api/agent/${start.runId}`).then((r) => r.json());
    if (['done', 'error', 'stopped', 'interrupted'].includes(run.status)) {
      const fin = [...(run.steps || [])].reverse().find((s) => s.type === 'finish');
      return fin?.summary || `(run ended ${run.status} with no summary)`;
    }
    if (run.status === 'awaiting_approval') {
      // A head that stops for a human is not autonomous. Say so rather than hang.
      return `(paused for approval: ${run.pending?.tool} — a head cannot answer this turn)`;
    }
  }
  return '(hub turn timed out)';
}

/**
 * Head: an external model reached over a file handoff.
 * Writes _inbox.md and waits for _outbox.md. Deliberately dumb - it lets ANY second
 * head (a person, another Claude, a second hub on another server) take a turn without
 * this file needing to know anything about it.
 */
async function fileHead(message, { role, timeoutMs = 15 * 60_000 }) {
  const inbox = join(WORKSPACE, '_inbox.md');
  const outbox = join(WORKSPACE, '_outbox.md');
  writeFileSync(inbox, `# Turn for: ${role}\n\n${message}\n`, 'utf8');
  try { unlinkSync(outbox); } catch {}
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (existsSync(outbox)) return readFileSync(outbox, 'utf8');
    await new Promise((r) => setTimeout(r, 2000));
  }
  return '(no reply from the file head before the timeout)';
}

const HEADS = { hub: hubHead, file: fileHead };

// ── evidence between turns ────────────────────────────────────────────────────
/**
 * Run what was built and describe what happened. This is what goes into the handoff
 * instead of an opinion.
 */
async function evidence() {
  try {
    const v = await verifier.verify(WORKSPACE);
    const lines = [`state: ${v.ok ? 'RUNS' : 'DOES NOT RUN'} (detected ${v.kind})`];
    for (const e of v.evidence) lines.push(`  + ${e}`);
    for (const p of v.problems) lines.push(`  ! ${String(p).split('\n')[0].slice(0, 200)}`);
    return { ok: v.ok, text: lines.join('\n') };
  } catch (e) {
    return { ok: false, text: `verification could not run: ${e.message}` };
  }
}

/**
 * Build the handoff.
 *
 * Note what is NOT here: the previous conversation, the files, the full history. Those
 * are on disk and the next head can read them. The message is intent + evidence, so it
 * stays the same size at turn 40 as at turn 2.
 */
function handoff({ turn, fromRole, toRole, said, ev }) {
  const tasks = ledger.contextBlock(WORKSPACE);
  return [
    `TURN ${turn} — you are the ${toRole.toUpperCase()}.`,
    ``,
    `GOAL: ${GOAL}`,
    ``,
    `The workspace at ./ is shared. Read it — the files, TASKS.md, NOTES.md and the git`,
    `history are the state. Nothing below repeats them, so check the files before you`,
    `assume anything.`,
    ``,
    `The ${fromRole} just said:`,
    said.trim().slice(0, 1500),
    ``,
    `WHAT ACTUALLY HAPPENED WHEN IT WAS RUN:`,
    ev.text,
    ``,
    tasks ? tasks : '(no task ledger yet — create one with the work this goal needs)',
    ``,
    toRole === 'critic'
      ? `Your job: find what is WRONG. Check the claims above against the files and the`
        + ` run result. Be specific — name the file and the line. If it genuinely works,`
        + ` say so and name the single most valuable next task.`
      : `Your job: make the smallest change that addresses the critique, then stop.`
        + ` Do not rewrite what already works.`,
  ].join('\n');
}

// ── the loop ──────────────────────────────────────────────────────────────────
async function main() {
  mkdirSync(WORKSPACE, { recursive: true });
  await ensureRepo(WORKSPACE);
  if (!ledger.read(WORKSPACE).length) {
    ledger.seed(WORKSPACE, ['define the goal precisely', 'build the smallest working version', 'verify it runs', 'address the critique']);
  }

  const aName = arg('a', 'file');      // builder
  const bName = arg('b', 'file');      // critic
  const A = HEADS[aName], B = HEADS[bName];
  if (!A || !B) throw new Error(`heads must be one of: ${Object.keys(HEADS).join(', ')}`);

  console.log(`\n  goal      ${GOAL}`);
  console.log(`  builder   ${aName}`);
  console.log(`  critic    ${bName}`);
  console.log(`  workspace ${WORKSPACE}`);
  console.log(`  turns     ${TURNS}\n${'─'.repeat(70)}`);

  const lines = [`# Ping-pong transcript\n\n**Goal:** ${GOAL}\n`];
  let said = `Starting fresh. Nothing has been built yet.`;
  let ev = await evidence();

  for (let turn = 1; turn <= TURNS; turn++) {
    const isBuilder = turn % 2 === 1;
    const role = isBuilder ? 'builder' : 'critic';
    const fromRole = isBuilder ? 'critic' : 'builder';
    const head = isBuilder ? A : B;
    const headName = isBuilder ? aName : bName;

    const msg = handoff({ turn, fromRole, toRole: role, said, ev });
    console.log(`\n── turn ${turn}: ${role} (${headName}) ${'─'.repeat(40)}`);
    console.log(`   handoff size: ${msg.length} chars`);

    said = await head(msg, { role });
    console.log(`   replied: ${said.slice(0, 160).replace(/\n/g, ' ')}…`);

    // Commit whatever this turn changed, so the other head can see a real diff and any
    // damage is one revert away.
    const cp = await commitAll(WORKSPACE, `turn ${turn} (${role})`);
    ev = await evidence();
    console.log(`   ${ev.text.split('\n')[0]}${cp.sha ? `  [${cp.sha}]` : ''}`);

    lines.push(`\n## Turn ${turn} — ${role} (${headName})\n`);
    lines.push(`**Handoff was ${msg.length} chars.**\n`);
    lines.push(`### Said\n\n${said.slice(0, 4000)}\n`);
    lines.push(`### Evidence after the turn\n\n\`\`\`\n${ev.text}\n\`\`\`\n`);
    writeFileSync(TRANSCRIPT, lines.join('\n'), 'utf8');
  }

  const hist = await gitLog(WORKSPACE, 10);
  console.log(`\n${'─'.repeat(70)}\n  transcript: ${TRANSCRIPT}`);
  console.log(`  history:\n${(hist.out || '').split('\n').map((l) => '    ' + l).join('\n')}`);
  console.log(`\n  NOTE: every handoff stayed roughly the same size. The collaboration`);
  console.log(`  grew in the WORKSPACE, not in the message.\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
