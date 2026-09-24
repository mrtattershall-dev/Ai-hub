/**
 * effectivePrompt.test.mjs - THE PROMPT DESCRIBES THE TOOLS THE MODEL ACTUALLY HAS.
 *
 *   node server/effectivePrompt.test.mjs
 *
 * BENCH-2: the prompt told the model "run verify_project" while route bounding had removed it.
 * Now the system prompt is rendered from the effective tool set. Proven on what actually
 * REACHES the model (a recording backend), with the unbounded hub as the positive control.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const { scratch, startHub, freePorts } = await import('./testHarness.mjs');
const { SYSTEM_PROMPT, systemPromptFor } = await import('./agentPrompt.js');

let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const REMOVED = ['verify_project', 'verify_godot', 'see_screen', 'spawn_subtask'];
const dirs = [];

async function systemMessageSeen(env, label) {
  const [hubPort, fakePort] = await freePorts(2);
  const dir = scratch(`ep-${label}`, { baseUrl: `http://127.0.0.1:${fakePort}`, model: 'fake' });
  dirs.push(dir);
  mkdirSync(join(dir, 'workspace'), { recursive: true });
  const rf = join(dir, 'replies.json'); writeFileSync(rf, JSON.stringify(['THOUGHT: Done.\nACTION: finish\nTEXT:\nok']), 'utf8');
  const promptLog = join(dir, 'prompts.jsonl');
  const fake = spawn(process.execPath, [join(HERE, 'fakemodel.mjs'), '--port', String(fakePort), '--replies', rf], { stdio: 'ignore', env: { ...process.env, FAKE_PROMPT_LOG: promptLog } });
  let hub = null;
  try {
    const started = await startHub(dir, { port: hubPort, env: { AGENT_APPROVAL_MODE: 'build', ...env } });
    hub = started.hub;
    const { runId } = await started.api('/agent/start', { method: 'POST', body: JSON.stringify({ goal: 'Say ok.' }) });
    for (let i = 0; i < 60; i++) {
      const r = await started.api(`/agent/${runId}`).catch(() => null);
      if (r && r.status !== 'running' && !r.busy) break;
      await sleep(500);
    }
    const reqs = existsSync(promptLog) ? readFileSync(promptLog, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
    // the action loop's system message (the planner has its own)
    const turn = reqs.find((r) => r.messages.some((m) => m.role === 'system' && /autonomous coding agent/.test(String(m.content))));
    return turn ? turn.messages.find((m) => m.role === 'system').content : null;
  } finally {
    try { hub && hub.kill('SIGKILL'); } catch { /* best effort */ }
    try { fake.kill('SIGKILL'); } catch { /* best effort */ }
  }
}

try {
  console.log('=== unit: rendering from the tool set ===');
  const all = new Set(SYSTEM_PROMPT.match(/^([a-z_]+) — /gm).map((s) => s.replace(' — ', '')));
  say(systemPromptFor(all) === SYSTEM_PROMPT, 'with every tool available the prompt is byte-identical to SYSTEM_PROMPT (control)');
  const bounded = systemPromptFor(new Set([...all].filter((t) => !REMOVED.includes(t))));
  say(REMOVED.every((t) => !bounded.includes(t)), 'with the bounded set, none of the removed tools is mentioned anywhere');
  say(/run your own checks with run_python or run_command/.test(bounded), 'the finishing rule names what IS available');
  say(bounded.includes('run_python —') && bounded.includes('edit_file —'), 'the remaining tool docs are intact');

  console.log('\n=== real route: what reaches the model ===');
  const b = await systemMessageSeen({ AGENT_BOUND_ROUTES: '1', AGENT_WORKER_EXEC: '1' }, 'bounded');
  say(!!b, 'the bounded hub sent a system message');
  say(!!b && REMOVED.every((t) => !b.includes(t)), 'under bounding the model is never told about verify_project / verify_godot / see_screen / spawn_subtask');
  say(!!b && /run your own checks with run_python or run_command/.test(b), 'and is told to verify with run_python / run_command');
  const u = await systemMessageSeen({ AGENT_BOUND_ROUTES: '', AGENT_WORKER_EXEC: '' }, 'unbounded');
  say(!!u && REMOVED.every((t) => u.includes(t)), 'POSITIVE CONTROL: the unbounded hub still documents all four');
  say(!!u && u === SYSTEM_PROMPT, 'and its prompt is exactly SYSTEM_PROMPT');
} finally {
  for (const d of dirs) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
}
console.log(`\n  effective prompt: ${passed} passed, ${failed} failed -> ${failed ? 'THE PROMPT STILL CONTRADICTS THE TOOL SET' : 'the model is told only about tools it has'}`);
process.exit(failed ? 1 : 0);
