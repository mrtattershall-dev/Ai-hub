/**
 * evictInterrupted.test.mjs - a restart must not throw away the work it exists to restore.
 *
 *   node server/evictInterrupted.test.mjs
 *
 * THE BUG (item 11 of the post-set-G plan). loadRuns() runs once, at boot, inside agentRouter(). It flips every
 * mid-flight run to 'interrupted' so the UI and the supervisor can offer Resume - and then, in the SAME read loop,
 * called evictOldRuns(), whose filter spared only 'running' and 'awaiting_approval'. 'interrupted' was evictable.
 * So in any battery with more than AGENT_MAX_RUNS (40) run files, the restart that exists to RESTORE resumable
 * work was itself what discarded it: the run file stays on disk, the run is gone from memory, and every consumer
 * was a `runs.get()` with no fallback - GET /:id 404s, POST /:id/resume 404s, and the supervisor, which resumes by
 * enumerating runs.values(), never sees it. Recorded, and unresumable.
 *
 * The live hub runs at the defaults (start-hub.bat -> npm start sets no AGENT_*), so this is certain in a 100-goal
 * battery, not probable. The measurement harness sets AGENT_MAX_RUNS=1000, which is why set G/H never showed it.
 *
 * Port-free on purpose: agentRouter() returns an express Router without binding anything, and express will route a
 * request through app.handle() with plain req/res objects. Nothing here listens, spawns a hub, or calls a model.
 *
 * TWO DISAPPEARANCES, KEPT APART. A run file can vanish from memory (evictOldRuns, AGENT_MAX_RUNS) or from disk
 * (reapRuns, AGENT_MAX_RUN_FILES, default 300, which runs BEFORE the read). This sets the file cap absurdly high
 * and asserts the file is still on disk, so a failure here can only mean eviction.
 *
 * THREE THINGS THIS FIXTURE DOES DELIBERATELY, each because a mutant escaped without it:
 *   - directory order is the REVERSE of createdAt order (run-000 is the NEWEST). Naming the files in createdAt
 *     order makes evicting inside the read loop indistinguishable from evicting after it, and the mutant that
 *     puts the eviction back inside the loop escapes.
 *   - /list is snapshotted at boot, before any by-id request. A by-id lookup REHYDRATES a run from disk, so a
 *     later /list would show runs that boot had actually discarded, and the case that protects the supervisor
 *     (which never does a by-id lookup) passes on work another case did.
 *   - a real escape target is planted outside the runs directory, with its internal id set to the traversing
 *     string, so the path guard is the only thing standing between the request and that file.
 *
 *   A  46 run files, the 3 OLDEST 'interrupted': all 3 survive boot, their files stay on disk, and the runs
 *      evicted to make room are the oldest FINISHED ones
 *   A  an evicted-but-recorded finished run is still fetchable by id (the disk fallback); an unrecorded id, a
 *      file whose contents disagree with its name, and a path that climbs out of the runs directory are not
 *   B  (child process) more resumable runs than the cap: the cap yields rather than dropping resumable work
 */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCENARIO = process.env.EVICT_SCENARIO || 'A';

// ── isolation. Every one of these is a file the developer actually has; without the override the test rewrites
// the real work queue, the real training corpus and the real run index. ───────────────────────────────────────
const TMP = mkdtempSync(join(tmpdir(), `evict-${SCENARIO}-`));
const RUNS_DIR = join(TMP, 'runs');
mkdirSync(RUNS_DIR, { recursive: true });
process.env.AGENT_RUNS_DIR = RUNS_DIR;
process.env.AGENT_QUEUE_FILE = join(TMP, 'agent-queue.json');
process.env.RUN_INDEX = join(TMP, 'run-index.jsonl');
process.env.AGENT_TRACES_DIR = join(TMP, 'traces');
process.env.AGENT_WORKSPACE = join(TMP, 'ws');
process.env.AGENT_SUPERVISOR = '0';          // or supervisorTick flips 'interrupted' to 'running' under us
process.env.AGENT_MAX_RUN_FILES = '100000';  // reapRuns must never be the reason a fixture file is missing
writeFileSync(process.env.AGENT_QUEUE_FILE, JSON.stringify({ items: [] }), 'utf8');

const CAP = SCENARIO === 'B' ? 2 : 40;       // A uses the live default; B makes resumable runs outnumber the cap
process.env.AGENT_MAX_RUNS = String(CAP);

let passed = 0, failed = 0, known = 0;
const openCases = [];
const test = async (name, fn) => {
  try { await fn(); passed++; console.log(`  ok    ${name}`); }
  catch (e) {
    if (name.startsWith('(known)')) { known++; openCases.push(name); console.log(`  known ${name}\n        ${String(e.message).slice(0, 300)}`); }
    else { failed++; console.error(`  FAIL  ${name}\n        ${String(e.message).slice(0, 700)}`); }
  }
};

// ── the fixture: run files as a real restart would find them ──────────────────────────────────────────────────
// A carries a SURPLUS of finished runs (cap + 6), not cap + 1: with a surplus of one, the only evicted run is an
// interrupted one, and the "evicted run is fetchable from disk" case below would be answered out of MEMORY by a
// run that was never evicted - green against a fix that adds no fallback at all.
//
// createdAt runs BACKWARDS against the filenames: run-000 is the newest, run-045 the oldest. readdirSync order is
// alphabetical, so this is the general case (directory order telling you nothing about age), and it is the only
// arrangement in which evicting mid-read is distinguishable from evicting after it.
const RESUMABLE = SCENARIO === 'B' ? 5 : 3;
const TOTAL = SCENARIO === 'B' ? 5 : CAP + 6;
const SURPLUS = Math.max(0, TOTAL - CAP);
const BASE_TS = 1_700_000_000_000;
const ids = [];
for (let i = 0; i < TOTAL; i++) {
  const id = `run-${String(i).padStart(3, '0')}`;
  ids.push(id);
  const age = TOTAL - 1 - i;                  // 0 = oldest ... TOTAL-1 = newest
  const run = {
    id,
    goal: `goal ${i}`,
    // The OLDEST runs are the interrupted ones - exactly the ones evictOldRuns reaches first, and exactly the
    // shape a restart produces when the process died mid-battery.
    status: age < RESUMABLE ? 'interrupted' : 'done',
    createdAt: BASE_TS + age * 1000,
    modelCalls: 3,
    // Real work on disk. The live example this was written for (coder30b-sethctl goal 41) ended 'interrupted'
    // holding a written source file - that is the thing the restart is supposed to hand back.
    steps: [{ n: 1, ts: BASE_TS + age * 1000, type: 'tool', tool: 'write_file', args: { path: `s${i}_library.js`, content: 'module.exports = {};\n' }, result: 'wrote' }],
    history: [{ role: 'system', content: 'sys' }, { role: 'user', content: `goal ${i}` }],
  };
  writeFileSync(join(RUNS_DIR, `${id}.json`), JSON.stringify(run), 'utf8');
}
const byAge = [...ids].reverse();                        // oldest first
const INTERRUPTED = byAge.slice(0, RESUMABLE);           // the oldest RESUMABLE runs
const OLDEST_FINISHED = byAge.slice(RESUMABLE);          // finished, oldest first
const NEWEST = ids.slice(0, SURPLUS);                    // must never be evicted

// A file OUTSIDE the runs directory whose internal id is the traversing string itself. Without the path guard in
// getRun, `join(RUNS_DIR, '../escape.json')` reaches it and the id check agrees - so this is the one vector that
// the guard, and only the guard, refuses.
writeFileSync(join(TMP, 'escape.json'),
  JSON.stringify({ id: '../escape', goal: 'outside the runs directory', status: 'done', createdAt: BASE_TS, steps: [] }), 'utf8');

// ── drive the router without binding a port ───────────────────────────────────────────────────────────────────
const { default: express } = await import('express');
const { default: agentRouter } = await import('./agent.js');   // env must be set BEFORE this: the caps are consts

const app = express();
app.use('/agent', agentRouter({
  loadDb: () => ({ settings: {} }),
  saveDb: () => {},
  withDb: (fn) => fn(),
}));

const request = (method, url) => new Promise((resolve) => {
  const req = { method, url, headers: {}, connection: {}, socket: {} };
  const chunks = [];
  const res = {
    statusCode: 200, _headers: {},
    setHeader(k, v) { this._headers[k.toLowerCase()] = v; },
    getHeader(k) { return this._headers[k.toLowerCase()]; },
    removeHeader(k) { delete this._headers[k.toLowerCase()]; },
    writeHead(code) { this.statusCode = code; },
    write(c) { chunks.push(c); return true; },
    end(c) {
      if (c) chunks.push(c);
      let body = chunks.join('');
      try { body = JSON.parse(body); } catch { /* an express error page is not JSON; keep the text */ }
      resolve({ status: this.statusCode, body });
    },
    on() {}, once() {}, emit() {}, listeners() { return []; },
  };
  app.handle(req, res, () => resolve({ status: 599, body: 'no route matched' }));
});

// THE BOOT SNAPSHOT, taken before any other request. A by-id lookup rehydrates a run from disk into the map, so
// every later /list is contaminated by whatever the earlier cases fetched. What boot itself decided to keep is
// only observable right here - and it is what the supervisor, which never looks a run up by id, is left with.
const BOOT_LIST = new Set(((await request('GET', '/agent/list')).body || []).map((x) => x.id));

console.log(`\ninterrupted runs survive the restart that created them  [scenario ${SCENARIO}, cap ${CAP}, ${TOTAL} run files]\n`);

if (SCENARIO === 'A') {
  // 1. The memory half, measured at boot. This is the set supervisorTick filters over (runs.values()) and the
  //    only thing standing between an unattended battery and a goal nobody ever continues.
  await test('boot keeps every interrupted run in memory, where the supervisor can find it to resume', () => {
    const missing = INTERRUPTED.filter((id) => !BOOT_LIST.has(id));
    assert.equal(missing.length, 0,
      `discarded resumable work it had just restored: ${missing.join(', ')} - the supervisor enumerates memory and will never resume these`);
  });

  // 2. Eviction still has to do its job, and choose correctly. 46 files, cap 40, 3 resumable spared => the six
  //    evicted must be the oldest FINISHED runs. Evicting inside the read loop cannot get this right: it decides
  //    while it is still reading the runs it is choosing between.
  await test('the cap still binds, and what it evicts is the oldest finished runs', () => {
    assert.equal(BOOT_LIST.size, CAP, `${BOOT_LIST.size} runs in memory, cap is ${CAP} - the cap stopped binding`);
    const shouldBeGone = OLDEST_FINISHED.slice(0, SURPLUS);
    const wronglyKept = shouldBeGone.filter((id) => BOOT_LIST.has(id));
    assert.equal(wronglyKept.length, 0, `kept runs older than ones it dropped: ${wronglyKept.join(', ')}`);
    const wronglyDropped = NEWEST.filter((id) => !BOOT_LIST.has(id));
    assert.equal(wronglyDropped.length, 0, `evicted the NEWEST runs (${wronglyDropped.join(', ')}) - not in createdAt order`);
  });

  // 3. ...and the run the UI opens is the whole run, not a husk.
  await test('an interrupted run is reachable by id, with its work still attached', async () => {
    for (const id of INTERRUPTED) {
      const r = await request('GET', `/agent/${id}`);
      assert.equal(r.status, 200, `${id} is gone (${r.status})`);
      assert.equal(r.body.status, 'interrupted', `${id} came back as ${r.body.status}`);
    }
    const first = await request('GET', `/agent/${INTERRUPTED[0]}`);
    assert.equal(first.body.steps?.length, 1, 'the run came back without its steps');
    assert.match(first.body.steps[0].args.path, /_library\.js$/, 'the written file is not in the restored run');
  });

  // 4. The OTHER disappearance. If this fails the file was reaped, not evicted, and nothing above is evidence
  //    about eviction at all.
  await test('their run files are still on disk (so a failure above is eviction, not reaping)', () => {
    for (const id of INTERRUPTED) {
      assert.ok(existsSync(join(RUNS_DIR, `${id}.json`)), `${id}.json was deleted from disk - wrong bug`);
    }
  });

  // 5. The disk fallback: evicted from memory is "recorded", and a recorded run must still be openable. The two
  //    preconditions are what give this case meaning - it must name a run that is REALLY gone from memory and
  //    REALLY on disk, or it passes against a fix that adds no fallback whatsoever.
  await test('a finished run evicted from memory is still fetchable by id from disk', async () => {
    const evicted = OLDEST_FINISHED[0];
    assert.ok(existsSync(join(RUNS_DIR, `${evicted}.json`)), 'precondition: its file is on disk');
    assert.ok(!BOOT_LIST.has(evicted), `precondition: ${evicted} was NOT evicted, so this cannot test the fallback`);
    const r = await request('GET', `/agent/${evicted}`);
    assert.equal(r.status, 200, `evicted-but-recorded run 404s (${r.status}) - recorded and unreachable`);
    assert.equal(r.body.id, evicted, 'the fallback returned the wrong run');
    assert.equal(r.body.steps?.length, 1, 'the fallback returned the run without its work');
  });

  // 6. ...and the fallback must not invent runs. A lookup that answers 200 for anything is worse than a 404.
  await test('an id that was never recorded is still a 404', async () => {
    const r = await request('GET', '/agent/run-does-not-exist');
    assert.equal(r.status, 404, `unknown id answered ${r.status}`);
  });

  // 7. Nor may it be walked out of the runs directory. The first vector is the real one: that file exists and its
  //    internal id matches what is being asked for, so ONLY the path guard refuses it.
  await test('the fallback cannot be walked out of the runs directory', async () => {
    const planted = await request('GET', '/agent/..%2Fescape');
    assert.equal(planted.status, 404,
      `served a file from outside the runs directory (${planted.status}) - an id became a path`);
    for (const bad of ['..%2F..%2Fhub', 'run-000.json', '.%2Frun-000', 'a%5C..%5C..%5Cescape']) {
      const r = await request('GET', `/agent/${bad}`);
      assert.equal(r.status, 404, `${bad} answered ${r.status}`);
    }
  });

  // 8. A file whose contents disagree with its name is not evidence about the id being asked for. Written AFTER
  //    boot on purpose: at boot loadRuns() would have filed it under the id INSIDE it, and the lookup under test
  //    here would never reach disk.
  await test('a run file whose contents disagree with its filename is not served as that run', async () => {
    writeFileSync(join(RUNS_DIR, 'run-mismatch.json'),
      JSON.stringify({ id: 'run-imposter', goal: 'not the run you asked for', status: 'done', createdAt: BASE_TS, steps: [] }), 'utf8');
    const r = await request('GET', '/agent/run-mismatch');
    assert.equal(r.status, 404, `served a run whose own id is 'run-imposter' as 'run-mismatch' (${r.status})`);
  });

  // 9. A run file that appears after boot and still says 'running' was left by a process that is no longer
  //    driving it. Handing it back as 'running' would make activeTopLevelRun() report the workspace lock held by
  //    a run with no loop behind it, and nothing would ever start again.
  await test('a run found on disk still marked running comes back interrupted, not running', async () => {
    writeFileSync(join(RUNS_DIR, 'run-orphan.json'),
      JSON.stringify({ id: 'run-orphan', goal: 'died mid-flight', status: 'running', createdAt: BASE_TS, steps: [], history: [] }), 'utf8');
    const r = await request('GET', '/agent/run-orphan');
    assert.equal(r.status, 200, 'the orphan was not reachable at all');
    assert.equal(r.body.status, 'interrupted', `came back as '${r.body.status}' - a lock nothing will ever release`);
  });
}

if (SCENARIO === 'B') {
  // The question the cap cannot dodge: what happens when resumable runs alone outnumber MAX_RUNS? Dropping the
  // excess would be the same bug with a higher threshold, so the cap yields and memory is bounded by how much
  // work is genuinely unfinished.
  await test('when resumable runs outnumber the cap, the cap yields rather than dropping resumable work', () => {
    const missing = INTERRUPTED.filter((id) => !BOOT_LIST.has(id));
    assert.equal(missing.length, 0, `cap ${CAP} discarded resumable runs: ${missing.join(', ')}`);
    assert.equal(BOOT_LIST.size, RESUMABLE, `expected all ${RESUMABLE} resumable runs held, got ${BOOT_LIST.size}`);
  });
}

// ── scenario B runs in its own process: the caps are module-level consts, read once at import ─────────────────
if (SCENARIO === 'A') {
  console.log('\n  -- scenario B (child process: cap 2, five resumable runs) --');
  const child = spawnSync(process.execPath, [join(HERE, 'evictInterrupted.test.mjs')], {
    encoding: 'utf8',
    env: { ...process.env, EVICT_SCENARIO: 'B' },
  });
  process.stdout.write((child.stdout || '').split('\n').map((l) => (l ? `  ${l}` : l)).join('\n'));
  if (child.stderr) process.stderr.write(child.stderr);
  if (child.status === 0) { passed++; console.log('  ok    scenario B passed in its own process'); }
  else { failed++; console.error(`  FAIL  scenario B failed (exit ${child.status})`); }
}

const KNOWN_EXPECTED = 0;   // bugs known open today; see the header for what and why
console.log(`\n${passed} passed, ${failed} failed, ${known} known-open`);
console.log(`KNOWN-OPEN: ${known} of ${KNOWN_EXPECTED} expected`);
if (openCases.length) console.log('  still open: ' + openCases.join(' | '));
if (known !== KNOWN_EXPECTED) {
  console.error(`  FAIL  known-open count changed: ${known}, expected ${KNOWN_EXPECTED}`
    + (known > KNOWN_EXPECTED ? ' - a NEW failure is hiding behind the "(known)" label'
      : ' - a "(known)" case now PASSES; fix the expectation and the header, or drop the label'));
  failed++;
}
process.exit(failed ? 1 : 0);
