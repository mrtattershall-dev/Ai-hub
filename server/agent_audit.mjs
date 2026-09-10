/**
 * agent_audit.mjs - verify the agent is internally consistent and its layers work.
 *
 *   node server/agent_audit.mjs
 *
 * Most of tonight's bugs were CONSISTENCY failures, not logic errors: download_file was
 * defined but not documented, then documented but not parsed - enabled and completely
 * unusable either way, with no error to notice. A tool is only real when four things
 * agree:
 *
 *   1. it exists in the tool table
 *   2. the prompt tells the model it exists
 *   3. the parser can turn the model's text into its arguments
 *   4. its approval status is deliberate
 *
 * This checks all four mechanically, then exercises the git and notes layers for real.
 */
import { readFileSync, readdirSync, existsSync, unlinkSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * The agent's source as ONE string, across however many files it now lives in.
 *
 * Sixty-odd checks below are regexes over `src`. While the agent was a single 3,400-line
 * file that was the same thing as "the agent". The moment any of it moves to agentTools.js
 * or agentPrompt.js, every check looking for the moved code searches an empty haystack and
 * reports PASS. The suite would go green BY LOSING ITS SUBJECT - silently, during a
 * refactor, which is exactly when it is the only thing standing between a mistake and the
 * loop.
 *
 * Globbed rather than listed: a list is one forgotten line away from the same silent hole.
 */
const AGENT_SOURCES = readdirSync(__dirname).filter((f) => /^agent[A-Za-z]*\.js$/.test(f)).sort();
if (!AGENT_SOURCES.includes('agent.js')) {
  console.error('FATAL: agent.js not found - this audit would have checked nothing and said so cheerfully.');
  process.exit(1);
}
const src = AGENT_SOURCES.map((f) => readFileSync(join(__dirname, f), 'utf8')).join('\n');
console.log(`auditing: ${AGENT_SOURCES.join(', ')}`);
// The live-layer tests get their OWN throwaway workspace.
//
// They used to run against the REAL workspace, so every audit left probe commits in the
// user's git history — and running the audit while an agent was working produced
// spurious failures as the two raced to commit. Caught 2026-09-09 with a 1,400-step
// marathon in flight: "undo restores the previous content" failed because the agent had
// committed between the audit's write and its revert.
const WORKSPACE = mkdtempSync(join(tmpdir(), 'agent-audit-'));

let pass = 0, fail = 0;
const fails = [];
const check = (name, ok, detail) => {
  ok ? pass++ : fail++;
  if (!ok) fails.push(name + (detail ? '  -- ' + detail : ''));
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? '  -- ' + detail : ''}`);
};

// ---------------------------------------------------------------------------
console.log('\n--- tool table / prompt / parser consistency ---');

// tools defined in the table
// Match both `name({ args })` and `name()` - recall takes no arguments, and requiring
// a destructured parameter reported it as missing when it was defined all along.
const toolNames = [...src.matchAll(/^\s{2}(?:async\s+)?(\w+)\s*\(\s*(?:\{|\))/gm)].map((m) => m[1])
  .filter((n) => !['constructor', 'if', 'for', 'while', 'catch', 'function'].includes(n));
const declared = [...new Set(toolNames)];

// the AUTO_TOOLS set
const autoLine = src.match(/const AUTO_TOOLS = new Set\(\[([\s\S]*?)\]\)/);
const autoTools = autoLine ? [...autoLine[1].matchAll(/'([\w_]+)'/g)].map((m) => m[1]) : [];

// tools the prompt documents (lines like "name — description")
const documented = [...src.matchAll(/^(\w+) — /gm)].map((m) => m[1]);

// tools the parser has an explicit branch for
const parsed = [...src.matchAll(/tool === '([\w_]+)'/g)].map((m) => m[1]);

const EXPECTED = ['list_dir', 'read_file', 'search_file', 'outline_file', 'write_file', 'edit_file',
  'run_command', 'run_python', 'test_web', 'web_search', 'web_fetch',
  'download_file', 'remember', 'recall', 'git_diff', 'git_log', 'git_commit', 'git_undo',
  // the autonomy set
  'task_list', 'task_add', 'task_done', 'see_screen', 'verify_project',
  'spawn_subtask', 'queue_task'];

for (const t of EXPECTED) {
  check(`${t}: defined in the tool table`, declared.includes(t), declared.length + ' tools found');
}
console.log('');
for (const t of EXPECTED) {
  // A tool the prompt never mentions is invisible to the model.
  check(`${t}: documented in the prompt`, documented.includes(t));
}
console.log('');
// Only tools with non-trivial args need a parser branch; PATH-only ones use the generic path.
const NEEDS_PARSER = ['download_file', 'remember', 'recall', 'git_diff', 'git_log', 'git_commit', 'git_undo', 'web_fetch', 'finish',
  'task_list', 'task_add', 'task_done', 'see_screen', 'verify_project', 'spawn_subtask', 'queue_task'];
for (const t of NEEDS_PARSER) {
  check(`${t}: has a parser branch`, parsed.includes(t));
}

console.log('\n--- approval policy is deliberate ---');
const MUST_BE_GATED = ['run_command', 'run_python', 'download_file', 'git_commit', 'git_undo'];
for (const t of MUST_BE_GATED) {
  check(`${t}: requires approval`, !autoTools.includes(t), autoTools.includes(t) ? 'IS auto-approved' : '');
}
const SHOULD_BE_AUTO = ['read_file', 'list_dir', 'git_diff', 'git_log', 'remember', 'recall',
  'task_list', 'task_add', 'task_done', 'see_screen', 'verify_project', 'queue_task', 'spawn_subtask'];
for (const t of SHOULD_BE_AUTO) {
  check(`${t}: runs without approval`, autoTools.includes(t));
}

console.log('\n--- guards and budgets ---');
check('budgets replace the fixed step ceiling',
  /AGENT_MAX_STEPS/.test(src) && /AGENT_MAX_MINUTES/.test(src) && !/const MAX_STEPS = 30;/.test(src));
check('loop guard uses a window, not the previous response only',
  /run\.recent/.test(src) && !/norm === run\.lastNorm/.test(src));
check('parse failures counted over a window, not a resettable streak',
  /parseLog/.test(src));
check('runs are evicted (no unbounded map)', /evictOldRuns/.test(src) && /MAX_RUNS/.test(src));
check('running / awaiting runs are never evicted',
  /status !== 'running' && r\.status !== 'awaiting_approval'/.test(src.replace(/\s+/g, ' ')) ||
  /r\.status !== 'running'[\s\S]{0,60}awaiting_approval/.test(src));
check('auto-checkpoint before destructive tools', /AUTO-CHECKPOINT/.test(src) && /MUTATING/.test(src));
check('downloads are flag-gated', /AGENT_ALLOW_DOWNLOADS/.test(src));
check('SSRF protection present', /169\.254/.test(src) && /metadata\.google\.internal/.test(src));
check('history preserved by marker, not index', /GOAL:/.test(src) && /Your notes from earlier work/.test(src));
check('follow-up resets the guard state that actually exists',
  /run\.recent = \[\]/.test(src) && /run\.parseLog = \[\]/.test(src) &&
  !/run\.repeat = 0/.test(src) && !/run\.errStreak = 0/.test(src));
check('follow-up gets a fresh time budget (budgetStart, not createdAt)',
  /run\.budgetStart = Date\.now\(\)/.test(src) && /run\.budgetStart \|\| run\.createdAt/.test(src));
check('run persistence exists (and is not duplicated)',
  (src.match(/function persist\(/g) || []).length === 1 && (src.match(/function loadRuns\(/g) || []).length === 1);

console.log('\n--- autonomy layers: consistency ---');
check('approval is a policy decision, not a binary gate',
  /classifyCommand/.test(src) && /classifyPython/.test(src)
  && /decision === 'deny'/.test(src) && /decision === 'ask'/.test(src));
check('a denied command does NOT halt the run (it continues)',
  /policy_denied[\s\S]{0,400}continue;/.test(src));
check('an auto-approved command is recorded as a policy decision',
  /policy_allowed/.test(src));
check('the ledger is injected per call, never pushed into history',
  /function withLedger/.test(src) && /withLedger\(run\.history\)/.test(src)
  && !/history\.push\(\{ role: 'user', content: block/.test(src));
check('the plan seeds the ledger, and only when it is empty',
  /ledger\.fromPlan/.test(src) && /!ledger\.read\(WORKSPACE\)\.length/.test(src));
check('the finish gate blocks on unfinished tasks',
  /ledger\.progress\(WORKSPACE\)/.test(src) && /task\(s\) still open/.test(src));
check('the finish gate covers NON-web projects',
  /!hasWeb \|\| !run\.touchedWeb\) && !run\.verified/.test(src) && /verifier\.verify\(WORKSPACE\)/.test(src));
// The web checks must key on what THIS RUN touched, not on a file merely existing in
// the workspace. Gating on existence alone blocked a Node build forever because a stale
// index.html from a previous project was lying around.
check('web checks gate on touchedWeb, not on index.html merely existing',
  /hasWeb && run\.touchedWeb && run\.needsTest/.test(src)
  && /hasWeb && run\.touchedWeb && !run\.sawScreen/.test(src)
  && /run\.touchedWeb = true/.test(src));
check('the finish gate checks what is actually on screen',
  /visual\.hasProblems/.test(src));
// A gate that latches BEFORE its check is bypassed by simply calling finish twice: the
// first attempt blocks, the second finds the flag already set and skips the check. Found
// 2026-09-09 driving the agent through the OpenAI-compatible provider path.
check('finish-gate flags latch only AFTER the check passes',
  /run\.sawScreen = true;\s*\/\/ passed/.test(src) && /run\.verified = true;\s*\/\/ passed/.test(src)
  && !/run\.sawScreen = true;\s*\/\/ check once/.test(src) && !/run\.verified = true;\s*\/\/ check once/.test(src));
check('the agent can use providers other than ollama',
  /AGENT_PROVIDER/.test(src) && /chat\/completions/.test(src) && /data: \[DONE\]|\[DONE\]/.test(src));
check('finish-gate one-shot checks re-arm on follow-up',
  /run\.sawScreen = false; run\.verified = false/.test(src));
check('sub-task depth comes from the RUN, not the model arguments',
  /args\.depth = \(run\.depth \|\| 0\) \+ 1/.test(src));
check('a sub-task cannot spawn another sub-task',
  /already a sub-task/.test(src));
check('a sub-task never waits on approval (it reports back instead)',
  /needs approval/.test(src) && /Do that step yourself in the parent run/.test(src));
check('terminal states escalate to a human',
  /escalate\(WORKSPACE/.test(src) && /'error', 'stopped', 'interrupted'/.test(src));
// Updated 2026-09-10 by ai-native-engine-00 (flagged in COORD.md). The supervisor moved
// from a module const to a persisted, runtime-toggleable setting, so the old regex on
// `SUPERVISOR` stopped matching. The invariant it guarded is unchanged; it is asserted in
// three halves now, because a FAILED run gained a behaviour it did not have back then.
check('the NEXT queued goal is only pulled after a CLEAN finish',
  /supervisorEnabled && run\.status === 'done' && !run\.depth/.test(src));
check('a failed step retries at most once, and never one a human stopped',
  // Assert the INTENT, not the exact source line. This check used to pin the literal
  // `if (run.status && run.status !== 'error')`, and broke the moment a real improvement
  // added a condition to it - a brittle test that fails on correct changes teaches people
  // to ignore the suite. What must stay true: a repair is never repaired again; a run that
  // is not in 'error' is gated; a GUARD-fired stop is retryable while a HUMAN stop is not.
  /if \(!item \|\| item\.repairOf\) return null;/.test(src)
  && /run\.status !== 'error'/.test(src)
  && /machineFailure/.test(src)
  && /you stopped this one/.test(src));
check('unattended pickup stays off unless it was explicitly turned on',
  /let supervisorEnabled = SUPERVISOR_FORCED;/.test(src)
  && /settings\?\.agentSupervisor/.test(src));
check('Google WRITE tools are absent from AUTO_TOOLS',
  /\.\.\.GOOGLE_READ_TOOLS,/.test(src) && !/\.\.\.GOOGLE_WRITE_TOOLS/.test(src));
check('token spend is accounted per run',
  /run\.tokens = \(run\.tokens \|\| 0\) \+ estimateTokens/.test(src));
check('orphaned queue items are recovered after a restart',
  /requeueOrphans/.test(src));

console.log('\n--- server/client step-type agreement ---');
{
  // The server pushes a step type; the client renders it. Nothing linked the two, so
  // policy_denied (which carries step.tool) fell through the client's TOOL_LABEL lookup
  // and a REFUSED command displayed as "Ran" - the safety layer reporting the opposite
  // of what happened. Exactly the defined-but-invisible class this audit exists for,
  // just across the server/client seam instead of within agent.js.
  const page = join(__dirname, '..', 'client', 'src', 'pages', 'AgentPage.jsx');
  if (!existsSync(page)) {
    check('AgentPage.jsx present', false, page);
  } else {
    const ui = readFileSync(page, 'utf8');
    const emitted = [...new Set([...src.matchAll(/pushStep\([^)]*?type:\s*'([\w_]+)'/g)].map((m) => m[1]))]
      .filter((t) => t !== 'tool');   // 'tool' is the generic case, rendered via the TOOL_LABEL fallback
    check('server emits a discoverable set of step types', emitted.length >= 8, emitted.join(', '));
    for (const t of emitted) {
      check(`step type "${t}" is rendered by the client`, ui.includes(`'${t}'`) || (t.startsWith('subtask') && /startsWith\('subtask'\)/.test(ui)));
    }
    // Every tool must have a human label, or half the feed reads as snake_case.
    const labelBlock = (ui.match(/const TOOL_LABEL = \{[\s\S]*?\};/) || [''])[0];
    for (const t of EXPECTED) {
      check(`tool "${t}" has a UI label`, labelBlock.includes(t + ':'));
    }
  }
}

console.log('\n--- task ledger (live) ---');
{
  const L = await import('./taskLedger.js');
  const { rmSync } = await import('fs');
  try { rmSync(join(WORKSPACE, 'TASKS.md')); } catch {}
  L.seed(WORKSPACE, ['build the thing', 'test the thing', 'polish the thing']);
  check('seeds a checklist', L.read(WORKSPACE).length === 3);
  check('starts with nothing done', L.progress(WORKSPACE).done === 0);
  check('marks by number', L.mark(WORKSPACE, 2, 'done').ok && L.progress(WORKSPACE).done === 1);
  check('marks by title fragment', L.mark(WORKSPACE, 'polish', 'done').ok && L.progress(WORKSPACE).done === 2);
  check('rejects a task that does not exist', !L.mark(WORKSPACE, 'nonexistent', 'done').ok);
  L.add(WORKSPACE, ['a new discovery']);
  check('adds work found mid-run', L.read(WORKSPACE).length === 4);
  L.add(WORKSPACE, ['a new discovery']);
  check('does not duplicate an identical task', L.read(WORKSPACE).length === 4);
  const b = L.contextBlock(WORKSPACE);
  check('the context block names what is LEFT, not what is done',
    /build the thing/.test(b) && !/polish the thing/.test(b), (b || '').slice(0, 80));
  check('the context block stays small', b.length < 700, b.length + ' chars');
  L.mark(WORKSPACE, 1, 'doing');
  L.mark(WORKSPACE, 4, 'doing');
  check('only one task is ever in progress',
    L.read(WORKSPACE).filter((t) => t.state === 'doing').length === 1);
  const plan = '1. SYSTEMS NEEDED\n- input handling\n- collision\n2. BUILD ORDER\n- draw the paddle';
  const items = L.fromPlan(plan);
  // Updated 2026-09-10. This asserted length === 3 - i.e. EVERY bullet becomes a task,
  // including "input handling" and "collision", which are architecture notes, not work.
  // Measured on a live game run: that rule seeded 29 TASKS from one sensible plan and the
  // run could not finish inside its step budget. fromPlan now takes the BUILD ORDER
  // section when the plan has one, which took 29 -> 5 and a three-goal chain from
  // stopped/stopped/done to done/done/done. The heading rule is unchanged and still checked.
  check('a plan becomes tasks: the BUILD ORDER steps, not every bullet',
    items.length === 1 && items[0] === 'draw the paddle'
      && !items.some((i) => /SYSTEMS NEEDED|BUILD ORDER/.test(i)), items.join(' | '));
  check('a plan with no BUILD ORDER section still yields its bullets',
    L.fromPlan('1. WHAT IT DOES\n- adds two numbers\n- exports add()').length === 2);
  try { rmSync(join(WORKSPACE, 'TASKS.md')); } catch {}
}

console.log('\n--- work queue (live) ---');
{
  const Q = await import('./queue.js');
  const before = Q.list().length;
  const a = Q.enqueue('audit probe A', { priority: 0 });
  const b = Q.enqueue('audit probe B', { priority: 5 });
  check('enqueues work', a.ok && b.ok);
  check('rejects an empty goal', !Q.enqueue('  ').ok);
  const next = Q.dequeue();
  check('higher priority is taken first', !!next && next.goal === 'audit probe B', next && next.goal);
  const again = Q.dequeue();
  check('a taken item is not handed out twice', !again || again.id !== next.id);
  Q.complete(next.id, { status: 'done' });
  check('completion is recorded', Q.list().find((i) => i.id === next.id)?.status === 'done');
  Q.remove(a.item.id); Q.remove(b.item.id);
  check('items can be removed', Q.list().length === before, Q.list().length + ' vs ' + before);
}

// ── runaway-autonomy guards ────────────────────────────────────────────────────
// Regression for the defect found 2026-09-09 the first time the supervisor and the queue
// ran together: 40 completed runs in 60 seconds, because each finished run queued the
// work it had just done and the supervisor dutifully started it again.
console.log('\n--- runaway guards (live) ---');
{
  const Q = await import('./queue.js');
  const before = Q.list().length;

  const one = Q.enqueue('build the thing');
  const two = Q.enqueue('build the thing');
  check('the same goal cannot be queued twice', one.ok && two.duplicate === true, String(two.error || ''));

  const vary = Q.enqueue('  Build   The Thing.  ');
  check('dedup survives case, spacing and trailing punctuation', vary.duplicate === true);

  // The actual 40-run mechanism: the goal was already DONE, and re-queuing a completed
  // goal is what let the chain restart itself forever.
  const t = Q.dequeue();
  Q.complete(t.id, { status: 'done' });
  const redo = Q.enqueue('build the thing');
  check('a goal that already completed cannot be re-queued by the agent', redo.duplicate === true);

  const forced = Q.enqueue('build the thing', { force: true });
  check('a human can deliberately re-run it with force', forced.ok === true);
  if (forced.ok) Q.remove(forced.item.id);

  const gen = Q.enqueue('a follow-on step', { source: 'agent', generation: 3 });
  check('machine-queued work records how many hops from a human it is', gen.item.generation === 3);
  const held = Q.dequeue();
  Q.release(held.id);
  check('an item the supervisor declines goes back on the queue, not lost',
    Q.list().find((i) => i.id === held.id)?.status === 'queued');

  for (const i of Q.list()) if (/build the thing|a follow-on step/i.test(i.goal)) Q.remove(i.id);
  check('guard probes cleaned up', Q.list().length === before, Q.list().length + ' vs ' + before);

  const A = await import('./agent.js');
  const S = A.__supervisorTest;
  if (!S) check('supervisor brake is exported for testing', false);
  else {
    const caps = S.caps();
    S.reset();
    check('a first-generation goal is allowed through', S.brake({ generation: 1 }) === '');
    check('a goal past the hop cap is braked',
      /hops from anything a human asked for/.test(S.brake({ generation: caps.generations })));
    S.reset();
    for (let i = 0; i < caps.perHour; i++) S.record();
    check('the hourly auto-start cap is braked even at generation 0',
      /started automatically in the last hour/.test(S.brake({ generation: 0 })));
    S.reset();
    check('the rate limit clears once the window is reset', S.brake({ generation: 0 }) === '');
  }
}

// Ledger ownership across runs. Regression for 2026-09-09: the plan gate only seeds "if
// the ledger is empty", so a NEW run inherited the previous run's open tasks - and if that
// run had called task_add the plan marker was gone, so the inherited tasks counted as
// commitments and the new run's finish gate blocked on work it never agreed to.
console.log('\n--- ledger ownership across runs (live) ---');
{
  const L = await import('./taskLedger.js');
  const { mkdtempSync } = await import('fs');
  const { tmpdir } = await import('os');
  const w = mkdtempSync(join(tmpdir(), 'ledger-'));

  L.add(w, ['run one task A', 'run one task B']);
  L.mark(w, 1, 'done');
  check('a run own its added tasks', L.progress(w).remainingOwn === 1);

  // A new run starts in the same workspace.
  const ad = L.adopt(w, 'run-2');
  check('starting a new run carries the previous run\'s open tasks', ad.carried === 1);
  const p1 = L.progress(w);
  check('carried work no longer counts as this run\'s commitment', p1.remainingOwn === 0, `remainingOwn=${p1.remainingOwn}`);
  check('but it is still counted and visible', p1.remaining === 1 && p1.carried === 1);
  check('the completed task is untouched', p1.done === 1);
  check('the carried marker survives a read/write round trip',
    L.read(w).find((t) => t.title === 'run one task B')?.carried === true);
  check('the marker is not leaked into the task title',
    !/carried/.test(L.read(w).find((t) => t.state !== 'done')?.title || 'carried'));
  check('the model is told carried work is context, not an instruction',
    /left over from earlier work/.test(L.contextBlock(w) || ''));

  // The new run adds its own work: that IS binding, and the carried task must not become
  // binding again alongside it.
  L.add(w, ['run two task C']);
  const p2 = L.progress(w);
  check('the new run\'s own task is binding', p2.remainingOwn === 1, `remainingOwn=${p2.remainingOwn}`);
  check('adding new work does not re-arm the carried task', p2.carried === 1);
  L.mark(w, 'run two task C', 'done');
  check('closing its own work clears the gate even with carried work open',
    L.progress(w).remainingOwn === 0);
  check('adopt is idempotent within one run', L.adopt(w, 'run-2').carried === 0);

  try { rmSync(w, { recursive: true, force: true }); } catch {}
  check('the finish gate is the thing that consumes remainingOwn', /p\.remainingOwn > 0/.test(src));
  check('a new run adopts the ledger before it starts', /ledger\.adopt\(WORKSPACE, id\)/.test(src));
}

// A paused run must say what actually went wrong. Regression for 2026-09-09: two runs on
// OPENROUTER were rate-limited and both told the user to re-point an Ollama tunnel.
{
  check('pause advice is derived, not hardcoded', /function pauseAdvice\(e\)/.test(src));
  check('it names the provider actually in use', /AGENT_PROVIDER \|\| 'ollama'\)\.toLowerCase\(\)/.test(src));
  check('a daily quota is not described as a temporary throttle', /per\.\?day\|daily/.test(src));
  check('the Ollama tunnel is only mentioned for ollama',
    !/Tunnel\/model unreachable/.test(src) && /re-point the tunnel in Settings/.test(src));
}

// One workspace means one run. Regression for 2026-09-09: six concurrent runs shared one
// TASKS.md, and the Phaser run read another run's parse.js tasks as its own stale work and
// planned to dismiss them as out of scope. Contamination does not just clobber files, it
// feeds a model false premises.
{
  check('a single definition decides whether the workspace is taken', /function activeTopLevelRun\(\)/.test(src));
  check('both entry points use it, so they cannot drift',
    (src.match(/activeTopLevelRun\(\)/g) || []).length >= 3);
  check('a run parked on an approval still counts as holding the workspace',
    /awaiting_approval'\]\.includes\(r\.status\)/.test(src));
  check('sub-runs are exempt (they run inside a parent turn)', /!r\.depth &&/.test(src));
  check('starting a second run is refused, not silently interleaved', /busy: true, activeRunId/.test(src));
  check('the refused goal can go to the queue instead', /queueIfBusy/.test(src));
  check('starting a queued item by hand preserves its hop count',
    /source: 'queue', generation: next\.generation/.test(src));
  const ui2 = readFileSync(join(__dirname, '..', 'client', 'src', 'pages', 'AgentPage.jsx'), 'utf8');
  check('the client turns a busy refusal into a queued goal rather than a dead end',
    /e\.status === 409 && e\.body\?\.busy/.test(ui2));
  const api2 = readFileSync(join(__dirname, '..', 'client', 'src', 'lib', 'api.js'), 'utf8');
  check('the api layer exposes the status so callers can branch on it', /e\.status = res\.status/.test(api2));
}

// The server/client seam. A guard the server enforces but the UI swallows is worse than
// no guard: on 2026-09-09 addToQueue() cleared the input box and caught{} the error, so a
// REFUSED add looked identical to a successful one. Same shape as policy_denied once
// rendering as "Ran".
{
  const ui = readFileSync(join(__dirname, '..', 'client', 'src', 'pages', 'AgentPage.jsx'), 'utf8');
  const api = readFileSync(join(__dirname, '..', 'client', 'src', 'lib', 'api.js'), 'utf8');
  check('the server can refuse a duplicate add (409)', /status\(409\)/.test(src));
  check('the client keeps the typed goal when an add is refused',
    /setQueueDupe\(\{ goal: g/.test(ui));
  check('the refusal is actually rendered, not just stored', /queueDupe\.message/.test(ui));
  check('the client can override a refusal deliberately', /queueAdd\(g, 0, force\)/.test(ui) && /force = false/.test(api));
  check('a self-queued chain shows its hop count in the UI', /gen \{item\.generation\}/.test(ui));
}

// ── the asset library ─────────────────────────────────────────────────────────
// The "no assets" training rule was never a preference: page.setContent() gave the
// verifier no base URL, so asset paths could not resolve, so asset-loading code could
// not be verified, so the gate had to reject it. The library removes the constraint at
// the root. These checks hold its four consumers - hub, agent, verifiers, gate - to the
// same manifest, because the moment they disagree the eval stops measuring the model.
console.log('\n--- asset library (live) ---');
{
  const A = await import('./assets.js');
  const { pathToFileURL } = await import('url');
  check('the manifest module exposes its full surface',
    ['add', 'remove', 'resolve', 'search', 'contextBlock', 'version', 'flush', 'kindOf', 'safeName'].every((k) => typeof A[k] === 'function'));
  check('a traversal name is reduced to its basename', A.safeName('../../server/index.js') === 'index.js');
  check('script-bearing types are refused', ['x.svg', 'x.html', 'x.js', 'x.mjs'].every((n) => A.kindOf(n) === null));
  check('game asset types are accepted', ['a.png', 'b.mp3', 'c.ttf', 'd.json', 'e.tmx', 'f.wav'].every((n) => !!A.kindOf(n)));
  check('resolve() refuses a name that is not in the manifest', A.resolve('assets/definitely-not-here.png') === null);
  check('resolve() refuses traversal', A.resolve('assets/../../server/index.js') === null);
  const t = A.totals();
  check('the library is populated', t.files > 0, `${t.files} files`);
  if (t.files) {
    const first = A.list().find((i) => i.kind === 'image');
    const hit = first && A.resolve(first.path);
    check('resolve() finds a real asset by its public path', !!hit && hit.full.endsWith(first.name));
    const block = A.contextBlock() || '';
    check('the per-call summary is compact, not a listing', block.split('\n').length <= 8, `${block.split('\n').length} lines`);
    const ex = block.match(/'(assets\/[^']+)'\)/);
    check('the example path in the summary really exists', !!ex && !!A.resolve(ex[1]), ex && ex[1]);
    check('the summary tells the agent how to look things up', /list_assets FILTER:/.test(block));
    check('search narrows by words', A.search(first.name.split('_')[0]).total >= 1);
  }

  // The gate now has two contracts. The old one must be UNCHANGED - every existing
  // assembler depends on it meaning "self-contained".
  const G = await import(pathToFileURL(join(__dirname, '..', 'training-data', 'factory', 'gate.mjs')).href);
  check('the strict contract still rejects any asset load',
    !G.dependsOnExternalResources("this.load.image('p','assets/p.png');").portable);
  const lib = ['hero.png', 'jump.mp3'];
  check('runnableWithAssets passes an asset IN the library', G.runnableWithAssets("this.load.image('h','assets/hero.png');", lib).runnable);
  check('runnableWithAssets fails an asset NOT in the library', !G.runnableWithAssets("this.load.image('h','assets/nope.png');", lib).runnable);
  check('runnableWithAssets still rejects a remote CDN', !G.runnableWithAssets("this.load.setBaseURL('https://cdn.phaserfiles.com/v385');", lib).runnable);
  check('referencedAssets sees load.pack paths, not only direct loaders', G.referencedAssets("this.load.pack('p','assets/pack.json');").includes('pack.json'));
  check('with no manifest it collapses to the strict rule', !G.runnableWithAssets("this.load.image('h','assets/hero.png');", []).runnable);

  // The local verifier.
  const gv = readFileSync(join(__dirname, 'gameVerify.js'), 'utf8');
  check('the verifier gives the page a base URL so asset paths resolve', /<base href="' \+ ASSET_HOST/.test(gv));
  check('the verifier intercepts asset requests', /setRequestInterception\(true\)/.test(gv));
  check('a missing asset FAILS verification, not just warns', /&& !missingAssets/.test(gv));
  check('the verdict names the missing file and points at list_assets', /Use list_assets for exact names/.test(gv));
  check('the response reports which assets were used and missing', /assetsUsed: assetTrace\.used/.test(gv) && /assetsMissing: assetTrace\.missing/.test(gv));

  // The Modal verifier must agree with the local one, or the eval measures a different world.
  const mc = readFileSync(join(__dirname, '..', 'training-data', 'factory', 'modal_chromium.py'), 'utf8');
  check('the Modal verifier mounts the asset volume', /modal\.Volume\.from_name\("hub-assets"/.test(mc) && /volumes=\{VOL_MOUNT: assets_vol\}/.test(mc));
  check('the Modal verifier reads the library one level under the mount (volume put nests the dir)',
    /ASSET_DIR = "\/vol\/assets"/.test(mc));
  check('the Modal verifier routes the same asset host', /page\.route\(f"\{ASSET_HOST\}\*\*"/.test(mc));
  check('the Modal verifier fails on missing assets too', /and not missing\)/.test(mc));
  check('both verifiers compute the same version hash', /hexdigest\(\)\[:16\]/.test(mc));
  const asrc = readFileSync(join(__dirname, 'assets.js'), 'utf8');
  const versionFn = asrc.slice(asrc.indexOf('export function version()'), asrc.indexOf('export function', asrc.indexOf('export function version()') + 10));
  check('the hub hashes names in codepoint order, matching Python, not localeCompare',
    /sort\(byCodepoint\)/.test(versionFn) && !/\.localeCompare\(/.test(versionFn));

  // The agent.
  check('list_assets is a tool', /async list_assets\(\{ filter/.test(src));
  check('list_assets needs no approval', /'list_assets'\]\);/.test(src));
  check('list_assets is documented to the model', /ACTION: list_assets\r?\nFILTER:/.test(src));
  check('list_assets is dispatched with its FILTER', /tool === 'list_assets'/.test(src) && /FILTER:\\s\*/.test(src));
  check('the library summary is injected on every call, beside the ledger',
    /assetLib\.contextBlock\(\)/.test(src) && /extra\.push\(\{ role: 'user', content: canon \? /.test(src));

  // The canonical vocabulary. A model learns asset NAMES; the only names it can be trained
  // on safely are ones guaranteed to exist in every library the code will run against.
  const C = await import('./canonicalAssets.mjs');
  check('the vocabulary covers the eval: player, enemy, coin, ball, paddle, brick, ship, bullet, platform, particle, button, jump, hit, pickup',
    ['player.png', 'enemy.png', 'coin.png', 'ball.png', 'paddle.png', 'brick.png', 'ship.png', 'bullet.png', 'platform.png', 'particle.png', 'button.png', 'jump.wav', 'hit.wav', 'pickup.wav', 'level.json', 'tileset.png']
      .every((n) => C.CANON_NAMES.includes(n)));
  const missing = C.CANON_NAMES.filter((n) => !A.resolve('assets/' + n));
  check('every canonical name resolves in the library right now', missing.length === 0, missing.slice(0, 5).join(', '));
  check('generated stand-ins are marked as placeholders',
    C.CANON_NAMES.every((n) => { const it = A.resolve('assets/' + n); return it && (it.placeholder === true || !it.placeholder); }) && A.list().some((i) => i.placeholder));
  check('the agent is told which names always resolve', /canonicalSummary\(\)/.test(src) && /Always-available canonical names/.test(readFileSync(join(__dirname, 'canonicalAssets.mjs'), 'utf8')));
  // Replace-in-place: real art uploaded under a placeholder's name keeps the name.
  {
    const probe = 'audit_probe_canon.png';
    const p1 = A.add({ name: probe, dataB64: Buffer.from('placeholder-bytes-1').toString('base64'), placeholder: true });
    const p2 = A.add({ name: probe, dataB64: Buffer.from('real-bytes-2').toString('base64') });
    check('uploading over a placeholder replaces it under the SAME name', p1.ok && p2.ok && p2.replaced === true && p2.item.name === probe && p2.item.placeholder === false);
    const p3 = A.add({ name: probe, dataB64: Buffer.from('real-bytes-3').toString('base64') });
    check('uploading over REAL art without replace gets a suffixed name instead', p3.ok && !p3.replaced && p3.item.name !== probe);
    A.remove(p3.item.id); A.remove(p2.item.id);
    check('probe cleaned up', !A.resolve('assets/' + probe));
  }
  check('the canonical set is one click in the UI', /assetsCanonical\(/.test(readFileSync(join(__dirname, '..', 'client', 'src', 'pages', 'AssetsPage.jsx'), 'utf8')));

  // Labels. Icon packs ship numbered files (1.png, fa1.png), so without labels 11,000
  // icons are unsearchable - the library returned nothing at all for "potion".
  check('assets can carry a searchable label', typeof A.label === 'function');
  {
    const withLabel = A.list().filter((i) => i.label).length;
    check('the icon library is labelled', withLabel > 1000, `${withLabel} labelled`);
    for (const q of ['healing potion', 'steel sword', 'golden key', 'ruby']) {
      check(`search finds "${q}" by label`, A.search(q, { limit: 1 }).total > 0);
    }
    // The first labelling pass collapsed five index sections that each restart at 1, and
    // read the importer's own `_2` dedupe suffix as an icon number. Both produced
    // confidently wrong labels, so both are pinned.
    const mc = A.list().find((i) => /minecraft.*heart_of_the_sea_2\.png$/.test(i.name));
    check('a name ending in the dedupe suffix is not read as an icon number',
      !mc || !mc.label || /heart|sea/i.test(mc.label), mc && mc.label);
    const potion = A.list().find((i) => /base_set_individual_icons_48x48_82\.png$/.test(i.name));
    check('base-set numbering is not overwritten by a later expansion section',
      !potion || potion.label === 'healing potion', potion && potion.label);
  }

  // PNG tooling. Needed because real art arrives as spritesheets and half the vocabulary
  // is single images.
  const P = await import('./pngTool.mjs');
  {
    const src = A.resolve('assets/player_sheet.png');
    check('a real spritesheet decodes', !!src);
    if (src) {
      const img = P.decode(readFileSync(src.full));
      check('decode returns RGBA of the right size', img.px.length === img.w * img.h * 4);
      const one = P.crop(img, 0, 0, 32, 48);
      check('crop produces one frame', one.w === 32 && one.h === 48);
      check('a cropped frame has content', P.coverage(one) > 0.1);
      const round = P.decode(P.encode(one));
      check('encode/decode round-trips exactly', round.px.equals(one.px));
    }
    // Frame size is per-creature, not per-pack: guessing produced four orcs in one frame,
    // then a sliced-off golem.
    const orc = A.resolve('assets/orc_orc1_idle_with_shadow.png');
    const golem = A.resolve('assets/golem_golem1_idle_with_shadow.png');
    if (orc) check('detectFrame measures the orc sheet at 64px', P.detectFrame(P.decode(readFileSync(orc.full)))?.frame === 64);
    if (golem) check('detectFrame measures the golem sheet at 128px', P.detectFrame(P.decode(readFileSync(golem.full)))?.frame === 128);
  }

  // Promotion: canonical slots backed by the user's real art.
  {
    const REAL = ['player.png', 'player_sheet.png', 'enemy.png', 'boss.png', 'coin.png',
      'potion.png', 'sword.png', 'chest.png', 'tileset.png', 'tree.png', 'skeleton.png'];
    const stillFake = REAL.filter((n) => A.resolve('assets/' + n)?.placeholder);
    check('canonical slots with a fantasy equivalent hold REAL art, not placeholders',
      stillFake.length === 0, stillFake.join(', '));
    check('promoted slots keep a role describing what they are',
      REAL.every((n) => !!A.resolve('assets/' + n)?.role));
    // Arcade names have no honest fantasy source; they must still RESOLVE.
    const ARCADE = ['ball.png', 'paddle.png', 'brick.png', 'ship.png', 'alien.png', 'asteroid.png'];
    check('arcade slots still resolve, as placeholders', ARCADE.every((n) => !!A.resolve('assets/' + n)));
    check('arcade slots are honestly marked as placeholders', ARCADE.every((n) => A.resolve('assets/' + n)?.placeholder));
  }

  // A replace must beat content-dedupe. Promoting the real coin icon into `coin.png` used
  // to match the identical bytes under its pack name, return a "duplicate", and leave
  // coin.png a placeholder while reporting success.
  {
    const bytes = Buffer.from(`audit-dedupe-probe-${Date.now()}`).toString('base64');
    const a1 = A.add({ name: 'audit_probe_src.png', dataB64: bytes });
    const a2 = A.add({ name: 'audit_probe_dst.png', dataB64: bytes, placeholder: true });
    check('identical bytes under a NEW name are deduped', a1.ok && a2.ok && a2.duplicate === true);
    const a3 = A.add({ name: 'audit_probe_dst2.png', dataB64: Buffer.from('placeholder').toString('base64'), placeholder: true });
    const a4 = A.add({ name: 'audit_probe_dst2.png', dataB64: bytes, replace: true });
    check('a replace onto an existing name wins over dedupe', a4.ok && a4.replaced === true && a4.item.name === 'audit_probe_dst2.png');
    check('replacing clears the placeholder flag', a4.ok && a4.item.placeholder === false);
    for (const n of ['audit_probe_src.png', 'audit_probe_dst.png', 'audit_probe_dst2.png']) A.remove(n);
    check('dedupe probes cleaned up', !A.resolve('assets/audit_probe_dst2.png'));
  }

  // Licences. Terms have to survive import, including a filename with a space in it.
  {
    const lic = readFileSync(join(A.ASSETS_DIR, 'LICENSES.md'), 'utf8');
    check('licence record names the packs that require attribution', /ATTRIBUTION REQUIRED/.test(lic));
    check('licence record flags archives that carry no terms', /NO TERMS IN ARCHIVE/.test(lic));
    check('CraftPix terms are recognised from their URL-only licence file', /CraftPix file licence/.test(lic));
    const imp2 = readFileSync(join(__dirname, 'importAssetPacks.mjs'), 'utf8');
    check('"License and index.txt" is recognised as a licence file',
      /licen\[cs\]\(e\|ing\)/.test(imp2) && !/licen\[cs\]e\|readme\|terms\|credits\?\|description\|about\|info\)\(\\\.\|\$\)/.test(imp2));
  }

  // The hub itself. A game opened from /workspace/index.html resolves `assets/x.png` to
  // /workspace/assets/x.png, so the library must be reachable there too - the first
  // agent-level test had the agent do everything right and the hub 404 its sprite.
  const idx = readFileSync(join(__dirname, 'index.js'), 'utf8');
  check('the library is served at /assets', /app\.use\('\/assets', express\.static\(ASSETS_DIR/.test(idx));
  check('the library is ALSO served under the workspace path', /app\.use\('\/workspace\/assets', express\.static\(ASSETS_DIR/.test(idx));
  check('the workspace mount comes first, so a project\'s own assets/ wins',
    idx.indexOf("app.use('/workspace', express.static(WORKSPACE))") < idx.indexOf("app.use('/workspace/assets'"));
  check('served assets are nosniff with an explicit type', (idx.match(/X-Content-Type-Options/g) || []).length >= 2);
  const vite = readFileSync(join(__dirname, '..', 'client', 'vite.config.js'), 'utf8');
  check('the dev server proxies /assets, so the page works in dev as well as built', /'\/assets':\s*\{/.test(vite));

  // The importer.
  const imp = readFileSync(join(__dirname, 'importAssetPacks.mjs'), 'utf8');
  check('bulk import defers manifest writes', /defer: true/.test(imp) && /assets\.flush\(\)/.test(imp));
  check('bulk import records licences instead of serving them', /LICENSES\.md/.test(imp));
  check('the licence record exists beside the library', existsSync(join(A.ASSETS_DIR, 'LICENSES.md')));

  // The client seam.
  const ui = readFileSync(join(__dirname, '..', 'client', 'src', 'pages', 'AgentPage.jsx'), 'utf8');
  check('the new step type has a label, so it never renders as "Ran"', /list_assets: 'Looked up assets'/.test(ui));
  const views = readFileSync(join(__dirname, '..', 'client', 'src', 'lib', 'views.jsx'), 'utf8');
  check('the Assets page is registered as a view', /assets:\s+AssetsPage/.test(views));
  // Test the invariant, not the implementation. The sidebar used to hold its own copy of
  // the nav list and now derives it from views.jsx NAV_GROUPS - a good change that broke a
  // check pinned to the old literal. What actually matters is that Assets is REACHABLE.
  check('the Assets page is reachable from the nav',
    /NAV_GROUPS[\s\S]*?'assets'[\s\S]*?\];/.test(views)
    || /id: 'assets'/.test(readFileSync(join(__dirname, '..', 'client', 'src', 'components', 'Sidebar.jsx'), 'utf8')));
  const api = readFileSync(join(__dirname, '..', 'client', 'src', 'lib', 'api.js'), 'utf8');
  check('the client uploads in batches', /assetsAdd\s*=\s*\(files\)/.test(api));
}

console.log('\n--- project verification (live) ---');
{
  const V = await import('./verifyProject.js');
  const { mkdtempSync, writeFileSync: wf } = await import('fs');
  const { tmpdir } = await import('os');
  const d1 = mkdtempSync(join(tmpdir(), 'ver-'));
  wf(join(d1, 'main.py'), 'print("hello from a real run")\n');
  const r1 = await V.verify(d1);
  check('a working Python script verifies', r1.ok && r1.kind === 'python', JSON.stringify(r1.problems));
  const d2 = mkdtempSync(join(tmpdir(), 'ver-'));
  wf(join(d2, 'main.py'), 'def broken(:\n');
  const r2 = await V.verify(d2);
  check('a Python syntax error is caught', !r2.ok, JSON.stringify(r2.evidence));
  const d3 = mkdtempSync(join(tmpdir(), 'ver-'));
  wf(join(d3, 'index.js'), 'process.exit(3)\n');
  const r3 = await V.verify(d3);
  check('a Node script that exits non-zero fails', !r3.ok, JSON.stringify(r3.evidence));
  const d4 = mkdtempSync(join(tmpdir(), 'ver-'));
  wf(join(d4, 'index.html'), '<!doctype html><body>hi</body>');
  const r4 = await V.verify(d4);
  check('a web project is detected as web', r4.kind === 'web' && r4.needsBrowser);
}

console.log('\n--- git layer (live) ---');
{
  const g = await import('./workspaceGit.js');
  const probe = join(WORKSPACE, '_audit_probe.txt');
  const { writeFileSync } = await import('fs');
  const repo = await g.ensureRepo(WORKSPACE);
  check('workspace is a git repo', repo.ok);
  writeFileSync(probe, 'audit v1');
  const c1 = await g.commitAll(WORKSPACE, 'audit probe v1');
  check('commits a change', c1.ok && !!c1.sha, c1.error || '');
  writeFileSync(probe, 'audit v2');
  check('detects uncommitted work', await g.isDirty(WORKSPACE));
  const c2 = await g.commitAll(WORKSPACE, 'audit probe v2');
  const d = await g.diff(WORKSPACE, 'HEAD~1');
  check('produces a diff', d.ok && /_audit_probe/.test(d.summary), d.summary?.slice(0, 40));
  const u = await g.undo(WORKSPACE, { sha: 'HEAD' });
  check('undo restores the previous content', u.ok && readFileSync(probe, 'utf8') === 'audit v1', readFileSync(probe, 'utf8'));
  const l = await g.log(WORKSPACE, 5);
  check('history is readable', l.ok && l.out.split('\n').length >= 3);
  try { unlinkSync(probe); } catch {}
  await g.commitAll(WORKSPACE, 'audit: remove probe');
  check('no remote is configured (agent cannot publish)',
    !existsSync(join(WORKSPACE, '.git', 'config')) || !/\[remote /.test(readFileSync(join(WORKSPACE, '.git', 'config'), 'utf8')));
}

console.log('\n--- notes layer (live) ---');
{
  const notes = join(WORKSPACE, 'NOTES.md');
  const had = existsSync(notes) ? readFileSync(notes, 'utf8') : null;
  const { appendFileSync, writeFileSync } = await import('fs');
  if (!had) writeFileSync(notes, '# Project notes\n\n', 'utf8');
  appendFileSync(notes, `- [audit] probe entry ${Date.now()}\n`, 'utf8');
  const body = readFileSync(notes, 'utf8');
  check('notes file is writable and readable', /probe entry/.test(body));
  check('notes are injected into a run\'s opening context', /Your notes from earlier work/.test(src));
  if (had === null) { try { unlinkSync(notes); } catch {} }
  else writeFileSync(notes, had, 'utf8');
}

try { rmSync(WORKSPACE, { recursive: true, force: true }); } catch {}
console.log(`\n================  ${pass} passed, ${fail} failed  ================`);
if (fail) { console.log('\nfailures:'); fails.forEach((f) => console.log('  ' + f)); }
process.exit(fail ? 1 : 0);
