/**
 * interruption.test.mjs — does an INJECTED CRASH actually fail the campaign?
 *
 *   node server/interruption.test.mjs
 *
 * The pilot's 1.5B arm was launched with a shell loop whose last command was `echo`. Page p4 died in
 * round 4, wrote no record, and the campaign reported exit 0. An echo decided whether an experiment
 * succeeded, and a missing file was the only trace.
 *
 * This kills a real run through the real launcher and requires all three of:
 *   a NON-ZERO campaign exit
 *   an explicit INTERRUPTED record, not an absence
 *   reconciliation of what the record claims against what the corpus holds
 *
 * The positive control matters as much: an uninterrupted campaign must still exit 0 and be marked
 * COMPLETE, or the gate is just a way of failing everything.
 */
import { createServer } from 'node:http';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileRaw = execFile;
const exec = promisify(execFile);
const NL = String.fromCharCode(10);
let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };

const ITEMS = ['apple', 'apricot', 'banana', 'cherry', 'date'];
const BASE = `<!DOCTYPE html><html><body>
<h1>Fruit</h1>
<input type="text" id="filter" placeholder="filter">
<ul id="list">${ITEMS.map((x) => `<li class="item">${x}</li>`).join('')}</ul>
<script>
const input = document.getElementById('filter');
const items = Array.from(document.querySelectorAll('#list .item'));
function applyFilter() {
  const q = input.value.toLowerCase();
  items.forEach((li) => { li.style.display = li.textContent.toLowerCase().includes(q) ? '' : 'none'; });
}
input.addEventListener('input', applyFilter);
</script></body></html>`;

const GOOD = `
const clearBtn = document.createElement('button');
clearBtn.id = 'clear-filter';
clearBtn.textContent = 'Clear';
document.body.appendChild(clearBtn);
clearBtn.addEventListener('click', () => { input.value = ''; applyFilter(); });`;

/**
 * A scripted backend that can be told to DIE. `killAfter` closes the connection and destroys every
 * socket on the Nth request, which kills the runner mid-flight exactly as an interrupted run does -
 * rather than simulating the failure by writing a file that says "interrupted".
 */
function backend(completion, killAfter, hangAfter) {
  const seen = [];
  const sockets = new Set();
  return new Promise((done) => {
    const srv = createServer((req, res) => {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        seen.push(1);
        // NEVER RETURN. Not a slow reply and not an error - the request is simply never answered.
        // This is the case a between-page deadline cannot see, and a hosted GPU bills straight through it.
        if (hangAfter && seen.length >= hangAfter) return;
        if (killAfter && seen.length >= killAfter) {
          for (const s of sockets) { try { s.destroy(); } catch { /* going away */ } }
          try { srv.close(); } catch { /* going away */ }
          return;
        }
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ response: completion, done: true, done_reason: 'stop', eval_count: 40, prompt_eval_count: 300 }));
      });
    });
    srv.on('connection', (s) => sockets.add(s));
    srv.listen(0, '127.0.0.1', () => done({ srv, port: srv.address().port, seen }));
  });
}

async function campaign({ killAfter, hangAfter, pages, maxGpuSeconds, killRunnerAfterMs }) {
  const root = mkdtempSync(join(tmpdir(), 'camp-'));
  // A token unique to THIS campaign, present in the child's own --dir argument, so the process we
  // kill is provably the one this test spawned rather than any node process that happens to exist.
  const stamp = root.split(/[\\/]/).filter(Boolean).pop();
  const pagesDir = join(root, 'pages');
  const outDir = join(root, 'out');
  const { srv, port } = await backend(GOOD, killAfter, hangAfter);
  try {
    for (const p of pages) {
      mkdirSync(join(pagesDir, p), { recursive: true });
      writeFileSync(join(pagesDir, p, 'baseline-as-delivered.html'), BASE, 'utf8');
      await exec(process.execPath, ['server/emitTaskAuto.mjs', '--dir', join(pagesDir, p)],
        { cwd: process.cwd(), windowsHide: true, maxBuffer: 20e6 });
    }
    const cargs = ['server/campaign.mjs', '--pages', pagesDir, '--out', outDir, '--model-url', `http://127.0.0.1:${port}`];
    if (maxGpuSeconds) cargs.push('--max-gpu-seconds', String(maxGpuSeconds));
    const t0 = Date.now();
    const child = execFileRaw(process.execPath, cargs, { cwd: process.cwd(), windowsHide: true, maxBuffer: 50e6 });
    // ABRUPT RUNNER DEATH: find the campaign's OWN child - the managerRun process - and kill it BY PID.
    // Destroying sockets tests a connection failure; this tests the supervisor noticing that its child
    // died without finalising anything. Killed by pid, never by a name pattern.
    let killedPid = null;
    let killedIdentity = null;
    let campaignAlive = true;
    child.on('close', () => { campaignAlive = false; });
    if (killRunnerAfterMs) {
      // POLL for a live runner rather than killing on a fixed delay. A fixed delay is a race: the
      // first attempt of this test fired at 7s, by which time the scripted campaign had already
      // finished, so it killed an unrelated pid and 'proved' the supervisor was fine. Waiting for a
      // real child to exist means the kill lands on a runner that is actually working.
      (async () => {
        const deadline = Date.now() + 60000;
        while (campaignAlive && !killedPid && Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 400));
          if (!campaignAlive) break;
          try {
            // IDENTITY IS CONFIRMED BEFORE KILLING, by command line, not by 'first node child'.
            // The first version of this test killed pid 14388 on a fixed delay after the campaign
            // had already exited. Windows recycles pids, so ParentProcessId matched a process that
            // was not the runner at all - and it is now UNIDENTIFIABLE, because nothing about it
            // was recorded before it was killed. Never kill a pid whose identity is not asserted.
            const { stdout: o } = await exec('powershell', ['-NoProfile', '-Command',
              `Get-CimInstance Win32_Process -Filter "ParentProcessId=${child.pid}" | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -like '*managerRun.mjs*' -and $_.CommandLine -like '*${stamp}*' } | Select-Object -First 1 | ForEach-Object { $_.ProcessId.ToString() + '|' + $_.CommandLine }`],
              { windowsHide: true });
            const [pidText, cmdline] = String(o).trim().split('|');
            const pid = parseInt(pidText, 10);
            if (pid && cmdline && cmdline.includes('managerRun.mjs') && cmdline.includes(stamp) && campaignAlive) {
              killedIdentity = { pid, cmdline: cmdline.slice(0, 220) };
              process.kill(pid, 'SIGKILL');
              killedPid = pid;
            }
          } catch { /* keep polling; the assertions report a failure to find one */ }
        }
      })();
    }
    const done = await new Promise((res) => {
      let o = '';
      child.stdout.on('data', (d) => { o += d; });
      child.on('close', (c) => res({ c, o }));
    });
    const code = done.c; const stdout = done.o;
    const wall = (Date.now() - t0) / 1000;
    const sum = existsSync(join(outDir, '_campaign.json'))
      ? JSON.parse(readFileSync(join(outDir, '_campaign.json'), 'utf8')) : null;
    const wd = existsSync(join(outDir, '_watchdog.json'))
      ? JSON.parse(readFileSync(join(outDir, '_watchdog.json'), 'utf8')) : null;
    return { code, stdout, sum, wall, wd, killedPid, killedIdentity };
  } finally {
    try { srv.close(); } catch { /* best effort */ }
    try { rmSync(root, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

// ══ 1. positive control: an uninterrupted campaign succeeds ═════════════════════════════════════
console.log('\n1. positive control - nothing is injected, and the campaign must pass');
const ok = await campaign({ killAfter: 0, pages: ['a1', 'a2'] });
say(ok.code === 0, `the campaign exits 0 (${ok.code})`);
say(!!ok.sum, 'a campaign summary was written');
say(ok.sum.completed === 2 && ok.sum.interrupted === 0, `both pages COMPLETED (${ok.sum.completed} completed, ${ok.sum.interrupted} interrupted)`);
say(ok.sum.results.every((r) => r.status === 'COMPLETE'), 'each run record says COMPLETE');
say(ok.sum.results.every((r) => r.attemptsInCorpus >= r.attemptsRecorded),
  'the corpus holds at least as many attempts as each record claims');
say(ok.sum.accepted === 2, `and the work actually happened - ${ok.sum.accepted} accepted`);

// ══ 2. an injected crash must fail the campaign ═════════════════════════════════════════════════
console.log('\n2. the backend dies mid-campaign - a real kill, not a simulated flag');
const bad = await campaign({ killAfter: 2, pages: ['b1', 'b2'] });
say(bad.code !== 0, `the campaign exits NON-ZERO (${bad.code}) - an echo cannot decide this`);
say(!!bad.sum, 'a campaign summary was still written - "no file" never means "nothing to see"');
say(bad.sum.interrupted > 0, `${bad.sum.interrupted} page(s) are named as interrupted`);
const hurt = bad.sum.results.find((r) => !r.ok);
say(!!hurt && /INTERRUPTED|NO_RECORD/.test(hurt.status), `the failing page carries an explicit status (${hurt && hurt.status})`);
say(!!hurt && hurt.problems.length > 0, `and states its problem: ${hurt && hurt.problems[0]}`);
say(/CAMPAIGN FAILED/.test(bad.stdout), 'the campaign says so in plain words, not only in an exit code');
say(bad.sum.results.some((r) => r.attemptsInCorpus > 0),
  'attempts made before the interruption survive in the corpus and are counted');

console.log(`\n  interruption gate: ${passed} passed, ${failed} failed -> ${failed ? 'AN INTERRUPTED RUN CAN STILL LOOK LIKE A COMPLETED ONE' : 'an interrupted run fails the campaign, names itself, and keeps what it had'}`);
// == 3. a request that NEVER RETURNS must be terminated in flight ==============================
console.log('\n3. the backend accepts a request and never answers - the case a between-page check cannot see');
const hung = await campaign({ hangAfter: 1, pages: ['c1'], maxGpuSeconds: 20 });
say(hung.wall < 120, `the campaign ended after ${hung.wall.toFixed(0)}s rather than hanging forever`);
say(hung.code !== 0, `it exits NON-ZERO (${hung.code})`);
say(!!hung.sum && hung.sum.terminatedInFlight === true, 'and reports a RUNNING page terminated in flight, not merely one never started');
const kp = hung.sum && hung.sum.results.find((r) => r.killedByWatchdog);
say(!!kp, `the page is named as killed by the watchdog (${kp && kp.page})`);
say(!!kp && /TERMINATED IN FLIGHT/.test(kp.problems.join(' ')), 'with the reason recorded, not inferred from an exit code');
say(!!hung.sum && hung.sum.wallClockSeconds >= 18, `the clock ran from process start, so startup exposure is inside the budget (${hung.sum && hung.sum.wallClockSeconds}s against 20s)`);

// == 4. the runner PROCESS is killed outright, mid-page ========================================
console.log('\n4. the runner process is killed by pid - not its connection - mid-page');
const slain = await campaign({ pages: ['d1', 'd2'], killRunnerAfterMs: 1 });
say(slain.killedPid !== null, `a child pid was located and killed (${slain.killedPid})`);
say(!!slain.killedIdentity && /managerRun\.mjs/.test(slain.killedIdentity.cmdline),
  `its identity was CONFIRMED before the kill, not assumed: ${slain.killedIdentity && slain.killedIdentity.cmdline.slice(0, 90)}`);
say(slain.code !== 0, `the campaign exits NON-ZERO (${slain.code}) - the supervisor noticed its child died`);
say(!!slain.sum, 'a summary was still written by the supervisor, which the child could not have written');
const dead = slain.sum && slain.sum.results.find((r) => !r.ok);
say(!!dead, 'the killed page is named as a problem');
say(!!dead && /NO_RECORD|INTERRUPTED/.test(dead.status), `with a status the child never finalised (${dead && dead.status})`);
say(!!dead && typeof dead.attemptsInCorpus === 'number', `and persisted records were reconciled independently (${dead && dead.attemptsInCorpus} attempt(s) in the corpus)`);

process.exit(failed ? 1 : 0);
