/**
 * qwen15bRun.mjs - fire ONE real hub goal at a local model and report exactly where it broke.
 *
 *   node server/qwen15bRun.mjs            # level 1, the simplest thing that is still a real run
 *   RUN_LEVEL=2 node server/qwen15bRun.mjs
 *   RUN_GOAL="..." node server/qwen15bRun.mjs
 *
 * tatte 2026-09-12: "keep firing single prompts, finding bugs, tracing them to root cause, then fix
 * backwards ... If you keep getting perfect scores, complicate the prompts even more. Start simple,
 * perfect that, then expand."
 *
 * So this is a LADDER, not a single test. Each level adds exactly one capability the level below did
 * not need, so a failure names its own cause instead of needing to be bisected afterwards.
 *
 * WHY A LADDER AND NOT THE HARD GOAL FIRST. The gate ladder scored qwen2.5:1.5b at 154/170 = 91%
 * when every call was ONE narrow job carrying its own decision rule. This is the opposite: the
 * shipped SYSTEM_PROMPT, ~15,916 characters and 24 tools, driving the full ReAct loop. The ladder
 * already predicts the failure - routing with a big menu scored 1/4 without a stated rule, and
 * `finish` was UNREACHABLE from a four-way menu (0/10) while scoring 10/10 asked alone. Starting at
 * the hard goal would confirm "it failed" and teach nothing about which step did it.
 *
 * WHAT IS DELIBERATELY NOT IN THE EARLY LEVELS: anything needing run_command. The hub's approval
 * mode here is strict and the run is unattended, so an executing command is DENIED by policy - that
 * is the hub refusing, not the model failing, and mixing the two would make the result unreadable.
 * verify_project is an AUTO tool and runs the entry point itself, so the finish gate still demands
 * real proof without the model ever needing a shell.
 *
 * IDENTITY, the honest version. The hub's /api/health reports {ok, time, auth} and does NOT name a
 * model - my first attempt gated on it and stopped the run for the wrong reason. Two real checks
 * instead: Ollama's own /api/tags must list the model BEFORE anything starts, and run.model (stamped
 * by noteModelCall from the call that actually happened) is asserted AFTER. The second is the one
 * that cannot be fooled by configuration.
 *
 * ISOLATION: scratch() + startHub() set every override - own hub.json, workspace, queue, runs dir,
 * traces dir, run index, on a free port. The live hub and the training corpus are untouched.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { scratch, startHub, TERMINAL_RUN } from './testHarness.mjs';

const OLLAMA = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const MODEL = process.env.LADDER_MODEL || 'qwen2.5:1.5b';
const LEVEL = parseInt(process.env.RUN_LEVEL || '1', 10);
const MAX_MIN = parseInt(process.env.RUN_MAX_MIN || '20', 10);

/**
 * The ladder. Each rung adds ONE thing.
 *   1  write one file, one function            - can it produce a single valid action at all?
 *   2  write one file with input validation    - does added spec detail survive the big prompt?
 *   3  write a module AND its own test file    - two files, so it must not stop after the first
 *   4  EDIT a file that already exists         - the path the archive says most failures live on
 *   5  edit + extend without losing what exists - the destroy-your-own-work failure
 */
const LEVELS = {
  1: { goal: 'Create add.js exporting a function add(a, b) that returns a + b.',
       wants: ['add.js'], needs: 'one valid action, one file' },
  2: { goal: 'Create s1_library.js exporting a Library class with addBook(isbn, title, copies) that throws a TypeError unless copies is a positive integer.',
       wants: ['s1_library.js'], needs: 'a class plus a validation rule' },
  3: { goal: 'Create s1_library.js exporting a Library class with addBook(isbn, title, copies) that throws a TypeError unless copies is a positive integer. Also create s1_library.test.js with node:test cases covering both the valid and the throwing case.',
       wants: ['s1_library.js', 's1_library.test.js'], needs: 'two files in one run' },
  4: { goal: 'Add a removeBook(isbn) method to the Library class in s1_library.js. Keep everything already in the file.',
       wants: ['s1_library.js'], seed: { 's1_library.js': `class Library {\n  constructor() {\n    this.books = new Map();\n  }\n\n  addBook(isbn, title, copies) {\n    if (!Number.isInteger(copies) || copies <= 0) {\n      throw new TypeError('copies must be a positive integer');\n    }\n    this.books.set(isbn, { title, copies });\n  }\n\n  find(isbn) {\n    return this.books.get(isbn);\n  }\n}\n\nmodule.exports = { Library };\n` },
       needs: 'editing an existing file without destroying it' },
  5: { goal: 'Add removeBook(isbn) and count() to the Library class in s1_library.js. Every method already in the file must still work.',
       wants: ['s1_library.js'], seed: LEVELS_SEED(),
       needs: 'two additions, nothing lost' },
};
function LEVELS_SEED() {
  return { 's1_library.js': `class Library {\n  constructor() {\n    this.books = new Map();\n  }\n\n  addBook(isbn, title, copies) {\n    if (!Number.isInteger(copies) || copies <= 0) {\n      throw new TypeError('copies must be a positive integer');\n    }\n    this.books.set(isbn, { title, copies });\n  }\n\n  find(isbn) {\n    return this.books.get(isbn);\n  }\n\n  titles() {\n    return [...this.books.values()].map((b) => b.title);\n  }\n}\n\nmodule.exports = { Library };\n` };
}

const rung = LEVELS[LEVEL] || LEVELS[1];
const GOAL = process.env.RUN_GOAL || rung.goal;

console.log(`\n=== REAL HUB RUN - ${MODEL} - LEVEL ${LEVEL} (${rung.needs}) ===`);
console.log(`GOAL: ${GOAL}\n`);

// ── PRE-FLIGHT: does Ollama actually have this model? ────────────────────────────────────────
let tags = null;
try {
  const r = await fetch(`${OLLAMA}/api/tags`, { signal: AbortSignal.timeout(10_000) });
  tags = await r.json();
} catch (e) {
  console.log(`STOPPING: Ollama is not reachable at ${OLLAMA} (${e.message}).`);
  process.exit(2);
}
const have = (tags.models || []).map((m) => m.name);
if (!have.includes(MODEL)) {
  console.log(`STOPPING: Ollama does not have ${MODEL}. It has: ${have.join(', ') || '(nothing)'}`);
  process.exit(2);
}
console.log(`pre-flight OK - Ollama serves ${MODEL}.`);

const dir = scratch('qwen15b', { baseUrl: OLLAMA, model: MODEL });
const { hub, api, log, port, died } = await startHub(dir, {
  env: {
    AGENT_MAX_STEPS: process.env.RUN_MAX_STEPS || '15',
    AGENT_MAX_MINUTES: String(MAX_MIN),
    AGENT_UNATTENDED: '1',
    // OPTIONAL GENERATION CAP, off unless asked for: RUN_NUM_PREDICT=120 node server/qwen15bRun.mjs
    //
    // agent.js reads NUM_PREDICT from the environment at load and defaults it to -1, meaning "generate
    // until done, never truncate a long file mid-write". That default is right for a model writing a
    // 300-line file and badly wrong for one that echoes: measured 2026-09-12, qwen2.5:1.5b produced
    // 720 output tokens for what should have been a two-line action, three times, and the second run
    // spent over fourteen minutes inside a SINGLE call still generating. With no cap and no stop
    // sequence there is nothing to end a turn early, so one echo costs the whole run.
    //
    // This is a lever, not a fix - capping generation would truncate a legitimate large write, which
    // is exactly why the default exists. It is here so the ECHO hypothesis can be tested cheaply and
    // separately: if a capped run suddenly produces actions, the problem is runaway generation; if it
    // produces truncated echoes instead, the problem is the model, and the answer is a shorter prompt
    // or one narrow job per call.
    ...(process.env.RUN_NUM_PREDICT ? { NUM_PREDICT: String(process.env.RUN_NUM_PREDICT) } : {}),
    // OPTIONAL BATCH ACTIONS, off unless asked for: RUN_BATCH=1 node server/qwen15bRun.mjs
    //
    // Measured 2026-09-12 on the first successful 1.5B run. It sent write_file AND run_python in one
    // reply, every turn. The hub ran the first, discarded the second, and told it so in plain terms -
    // "You sent 2 actions in one response. ONLY THE FIRST (write_file) was executed - the other 1
    // were DISCARDED and did NOT happen. Send exactly ONE action per response" - on turns 3, 4, 5 and
    // 6. The nudge fired correctly every time. The model re-sent the IDENTICAL reply anyway.
    //
    // That is this project's oldest wall, already written down: every hub recovery is a sentence in a
    // tool result, and the hub's own experiment scored advisory 0/5 productive against mechanical 5/5.
    // A better sentence is not the fix. AGENT_BATCH_ACTIONS=1 simply RUNS the actions in order, under
    // the rules at planBatch() (stop at the first failure, never execute a batched finish, approval
    // untouched), and batchActions.test.mjs holds it at 15/0. It is off by default.
    //
    // So this is the experiment the transcript asked for: does executing what the model actually sent
    // break the repeat loop that telling it never did?
    ...(process.env.RUN_BATCH === '1' ? { AGENT_BATCH_ACTIONS: '1' } : {}),
    // APPROVAL MODE - and this one is a HARNESS DEFECT I caused, not a hub defect.
    //
    // AGENT_UNATTENDED=1 above turns every 'ask' verdict into a DENY. The default approval mode is
    // 'strict', and approvalPolicy.js:241 answers run_python with {decision:'ask'} under strict. So
    // the two settings together make verification IMPOSSIBLE, permanently.
    //
    // Measured 2026-09-12, the batch run: the model's plan every single turn was write the file then
    // verify it. Steps 6, 9, 12 and 16 are all "DENIED: strict mode does not execute code
    // unattended". It never received a success signal, so it never stopped trying, and steps 18-29
    // degenerated into task_add nine times over. I chose AGENT_UNATTENDED=1 deliberately so that
    // policy refusals would not be confused with model failures - and instead made a policy refusal
    // the dominant signal of the entire run. The harness decided the outcome.
    //
    // describeMode() is authoritative: strict / build / yolo. 'build' = "installs deps and runs code
    // inside the workspace unattended (blast-zone mode)", which is exactly right for a disposable
    // scratch hub in a temp directory - it lets the model verify its own work, which is the thing it
    // has been trying to do on every turn of every run. yolo is not needed; the hard denylist applies
    // in every mode anyway.
    ...(process.env.RUN_APPROVAL ? { AGENT_APPROVAL_MODE: String(process.env.RUN_APPROVAL) } : {}),
  },
});
// Kill the hub on EVERY exit. The first version did not, and exiting while the spawned child was
// live produced a libuv "handle is closing" assertion and exit 127 - a teardown artefact that looked
// like a crash in the thing under test.
const stop = (code) => { try { hub.kill(); } catch { /* already gone */ } process.exit(code); };
process.on('uncaughtException', (e) => { console.log('runner threw: ' + e.message); stop(1); });

console.log(`hub on :${port}   scratch ${dir}\n`);

// Seed the workspace for the edit levels, through the hub's own upload route so the file lands
// exactly where a previous run would have left it.
if (rung.seed) {
  for (const [path, content] of Object.entries(rung.seed)) {
    const r = await api('/agent/upload', { method: 'POST', body: JSON.stringify({ path, content }) });
    console.log(`seeded ${path}: ${JSON.stringify(r)}`);
  }
  console.log('');
}

const started = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal: GOAL }) });
if (!started.runId) { console.log('could not start: ' + JSON.stringify(started)); stop(1); }
const id = started.runId;
console.log(`run ${id}\n--- steps as they land ---`);

const t0 = Date.now();
let shown = 0, run = null;
const deadline = t0 + MAX_MIN * 60_000;
while (Date.now() < deadline) {
  if (died()) { console.log('\nHUB DIED: ' + died() + '\n' + log.join('').slice(-1200)); break; }
  try { run = await api(`/agent/${id}`); } catch { /* keep polling */ }
  if (run && Array.isArray(run.steps)) {
    for (const s of run.steps.slice(shown)) {
      const head = String(s.text || s.result || s.summary || '').replace(/\s+/g, ' ').slice(0, 140);
      const where = s.tool ? `${s.tool} ${(s.args && (s.args.path || s.args.cmd)) || ''}`.slice(0, 42) : '';
      console.log(`  [${String(s.n).padStart(2)}] ${String(s.type).padEnd(17)} ${where.padEnd(42)} ${head}`);
    }
    shown = run.steps.length;
  }
  if (run && TERMINAL_RUN.includes(run.status)) break;
  await new Promise((r) => setTimeout(r, 4000));
}

const mins = ((Date.now() - t0) / 60000).toFixed(1);
console.log(`\n--- VERDICT  level ${LEVEL}  after ${mins} min ---`);
if (!run) { console.log('no run state came back'); stop(1); }

// IDENTITY, asserted from the call that actually happened rather than from configuration.
//
// But ONLY when a call actually completed. noteModelCall stamps run.provider/run.model after a
// SUCCESSFUL loop call, so a run that times out mid-first-call has neither - and the first version of
// this line printed "served by undefined/undefined !! EXPECTED qwen2.5:1.5b", which reads like the
// wrong model answered when in truth no model finished answering at all. Pre-flight already proved
// Ollama serves it. A report that manufactures an alarm out of missing data is worse than silence.
if (!run.model) {
  console.log(`served by     (not stamped - no model call COMPLETED, so nothing to attribute)`);
} else {
  console.log(`served by     ${run.provider}/${run.model}${run.model === MODEL ? '  (matches)' : `  !! EXPECTED ${MODEL}`}`);
}
if (!(run.callStats || []).length) {
  console.log(`VERDICT IS INCONCLUSIVE: the window closed with the first call still in flight.`);
  console.log(`  Not evidence for or against any hub fix - no turn completed. Re-run with RUN_NUM_PREDICT`);
  console.log(`  to cap generation so a turn can finish, or raise RUN_MAX_MIN.`);
  // SAY WHAT WAS IN FLIGHT, rather than leaving it to be dug out afterwards.
  //
  // The first inconclusive run cost a manual investigation to establish something the runner already
  // had in reach: appendTranscript only writes a turn AFTER callModel returns, so a mid-call timeout
  // leaves the planner entry and nothing else. "turns recorded: 0" is therefore the direct evidence
  // that no turn completed - as opposed to one completing and being unparseable, which looks similar
  // from the step feed and means something entirely different.
  try {
    const tf = join(dir, 'runs', `${id}.transcript.jsonl`);
    if (existsSync(tf)) {
      const lines = readFileSync(tf, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
      const kinds = {};
      for (const l of lines) kinds[l.kind || '?'] = (kinds[l.kind || '?'] || 0) + 1;
      const turns = lines.filter((l) => l.kind === 'turn');
      console.log(`  transcript: ${lines.length} entr(ies) - ${Object.entries(kinds).map(([k, v]) => `${k}x${v}`).join(' ') || 'none'}`);
      console.log(`  completed loop turns: ${turns.length}${turns.length ? `, last reply ${String(turns[turns.length - 1].reply || '').length} chars` : ' (so the model never finished a reply)'}`);
    } else {
      console.log(`  transcript: not written at all - the run never got past planning.`);
    }
  } catch (e) { console.log(`  transcript unreadable: ${e.message}`); }
}
console.log(`status        ${run.status}`);
console.log(`finishKind    ${run.finishKind || '(none)'}`);
console.log(`model calls   ${run.modelCalls}`);

const cs = run.callStats || [];
if (cs.length) {
  const tps = cs.map((c) => c.tokPerSec).filter(Boolean);
  const pt = cs.map((c) => c.promptTok).filter(Boolean);
  console.log(`callStats     ${cs.length} calls; tok/s ${Math.min(...tps)}-${Math.max(...tps)}; promptTok ${Math.min(...pt)}-${Math.max(...pt)}`);
}

const errs = (run.steps || []).filter((s) => s.type === 'error').map((s) => String(s.text || '').replace(/\s+/g, ' ').slice(0, 190));
if (errs.length) { console.log(`\nerrors (${errs.length}):`); for (const e of errs.slice(0, 14)) console.log('  - ' + e); }

const used = {};
for (const s of run.steps || []) if (s.tool) used[s.tool] = (used[s.tool] || 0) + 1;
console.log(`\ntools used:   ${Object.keys(used).length ? Object.entries(used).map(([k, v]) => `${k}x${v}`).join(' ') : '(NONE - it never made a valid tool call)'}`);

// ── the only thing that counts: what is on disk ───────────────────────────────────────────────
const ws = join(dir, 'workspace');
console.log(`\nworkspace:`);
try {
  for (const f of readdirSync(ws)) {
    try { console.log(`  ${f}${statSync(join(ws, f)).isDirectory() ? '/' : `  (${statSync(join(ws, f)).size} bytes)`}`); } catch {}
  }
} catch { console.log('  (unreadable)'); }

let allThere = true;
for (const f of rung.wants) {
  const p = join(ws, f);
  if (!existsSync(p)) { console.log(`\n${f}: NOT WRITTEN`); allThere = false; continue; }
  console.log(`\n--- ${f} ---`);
  console.log(readFileSync(p, 'utf8').split('\n').slice(0, 28).map((l) => '  ' + l).join('\n'));
}
console.log(`\nLEVEL ${LEVEL} FILES PRESENT: ${allThere ? 'yes' : 'NO'}`);

// FILE PRESENT IS NOT GOAL MET, and reporting only presence overstates the result.
//
// Level 1 asked for a file that EXPORTS add. The first successful run wrote
//     function add(a, b) { return a + b; }
// with no module.exports at all - so require('./add.js').add is undefined and the goal is NOT met.
// The verdict still said "FILES PRESENT: yes", which reads like a pass. That is the same class of
// harness fault as the "served by undefined/undefined !! EXPECTED" alarm: a report that says
// something other than what it measured. The hub's own checkers score CONTENT, so this must too.
const REQUIRES = {
  1: [[/\bfunction\s+add\b|\badd\s*[:=]/, 'defines add'], [/module\.exports|exports\.\w+|export\s/, 'EXPORTS it']],
  2: [[/class\s+Library/, 'class Library'], [/addBook/, 'addBook'], [/throw\s+new\s+TypeError/, 'throws TypeError'], [/module\.exports|export\s/, 'exports it']],
  3: [[/class\s+Library/, 'class Library'], [/module\.exports|export\s/, 'exports it']],
  4: [[/removeBook/, 'removeBook added'], [/addBook/, 'addBook KEPT'], [/find\s*\(/, 'find KEPT']],
  5: [[/removeBook/, 'removeBook'], [/count\s*\(/, 'count'], [/addBook/, 'addBook KEPT'], [/titles\s*\(/, 'titles KEPT']],
}[LEVEL] || [];
if (REQUIRES.length && rung.wants.length) {
  const p = join(ws, rung.wants[0]);
  const src = existsSync(p) ? readFileSync(p, 'utf8') : '';
  const missed = REQUIRES.filter(([re]) => !re.test(src)).map(([, what]) => what);

  // A REGEX OVER SOURCE TEXT IS NOT A PASS - the comment above fixed presence-vs-content and left a
  // second hole of the same shape. Stress run 1 (2026-09-13) wrote
  //     export function add(a, b) { return a + b; }
  // into a "type":"commonjs" workspace. BOTH regexes above match that, so this line printed
  //     LEVEL 1 GOAL MET:      YES
  // three lines below the run's own error saying add.js does not parse. Measured in the workspace
  // afterwards: `node --check add.js` exits 1 on Unexpected token 'export', and import() fails the
  // same way. The file cannot load, the goal is not met, and the instrument said it was - while
  // contradicting itself inside one report. Text can only ever say a file LOOKS right; ask node
  // whether it IS right. This is the same lesson the verifier itself just had to learn.
  let loadErr = '';
  if (existsSync(p)) {
    try {
      execFileSync(process.execPath, ['--check', p], { cwd: ws, stdio: 'pipe' });
    } catch (e) {
      const out = String(e.stderr || e.message || '');
      loadErr = (out.split('\n').find((l) => /SyntaxError|Unexpected|Cannot use/.test(l)) || 'does not parse').trim().slice(0, 90);
    }
  }
  const why = [...missed, ...(loadErr ? [`DOES NOT LOAD (${loadErr})`] : [])];
  console.log(`LEVEL ${LEVEL} GOAL MET:      ${!why.length && allThere ? 'YES' : `NO - missing: ${why.join(', ') || '(file absent)'}`}`);
}

// The replies themselves. If it never produced a parseable ACTION, the answer is in here.
try {
  const tf = join(dir, 'runs', `${id}.transcript.jsonl`);
  if (existsSync(tf)) {
    const lines = readFileSync(tf, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const plan = lines.find((l) => l.kind === 'plan');
    const turns = lines.filter((l) => l.kind === 'turn');
    if (plan) console.log(`\n--- PLANNER reply (${String(plan.reply || '').length} chars) ---\n` + String(plan.reply || '').slice(0, 600));
    turns.slice(0, 3).forEach((t, i) => {
      console.log(`\n--- loop reply ${i + 1} (${String(t.reply || '').length} chars) ---\n` + String(t.reply || '').slice(0, 800));
    });
  }
} catch (e) { console.log('transcript unreadable: ' + e.message); }

console.log(`\nscratch kept at ${dir}`);
stop(0);
