/**
 * threeArm.test.mjs - the three-arm, seeded, counterbalanced campaign through the REAL entry
 * point (`server/autodiag1.mjs`), against a scripted backend. No GPU. The diagnostic itself
 * runs in the qualified worker container.
 *
 *   node server/threeArm.test.mjs
 *
 * What is established, in order:
 *   1. WHAT EACH ARM SEES, from the transcripts - CONTROL: no diagnostic message at all.
 *      NOTIFY: the diagnostic header and counts, ZERO case-detail lines, no expected/actual.
 *      AUTODIAG_ARM: the counts AND the failing cases. Isolation is a measured row field.
 *   2. SEED PROVENANCE - the seed named for the replicate reaches every backend request as
 *      options.seed, and the run records what it sent.
 *   3. ORDER - the arm order is the documented rotation, recorded per row as `position`.
 *   4. NAMING AND CLOCKS - the report and console carry the experiment's own name; COMPLETE
 *      and the report are timestamped; the DONE file exists for the watchdog and says the
 *      same thing the log says.
 *   5. ACCOUNTING - every planned unit has a row, no UNACCOUNTED, isolation held.
 */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const { freePorts } = await import('./testHarness.mjs');
const { diagnosticMessage, DIAG } = await import('./autodiag.js');

let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };
const note = (m) => console.log(`        ${m}`);

const EXPERIMENT = 'SMOKE-3ARM';
const SEED = 4242;
const TASK = 'ext-lcs_length';
const BUGGY = '                dp[i, j] = dp[i - 1, j] + 1';
const FIXED = '                dp[i, j] = dp[i - 1, j - 1] + 1';
const PLAN = '1. WHAT IT DOES - lcs_length\n2. FILES - lcs_length.py\n3. BUILD ORDER - fix\n4. HOW TO VERIFY - the diagnostic runs automatically';
const edit = (find, replace) => `THOUGHT: Editing.\nACTION: edit_file\nPATH: lcs_length.py\nFIND:\n${find}\nREPLACE:\n${replace}`;
const FINISH = 'THOUGHT: Done.\nACTION: finish\nTEXT:\nfixed';

// ── 0. the summary-mode message itself, before anything runs ──
console.log('=== 0. the NOTIFY message is truthful and content-free ===');
{
  const full = { status: DIAG.OK, identity: { sha256: 'b'.repeat(64), lines: 20, bytes: 400 }, attempted: 9, passed: 1, failed: 8, omitted: 2,
    failures: Array.from({ length: 8 }, (_, i) => ({ n: i + 1, kind: 'FAIL', text: `lcs_length('a${i}', 'b') -> 0   EXPECTED ${i}` })) };
  const m = diagnosticMessage(full, 'lcs_length', 'start', { mode: 'summary' });
  say(/^AUTOMATIC DIAGNOSTIC - run for you before you started/.test(m), 'same header as the full message');
  say(/RESULT: 9 cases attempted, 1 passed, 8 failed\./.test(m), 'the counts are stated');
  say(!/case \d+ /.test(m) && !/EXPECTED/.test(m) && !/->/.test(m), 'no case, no input, no expected, no actual value');
  say(/counts only/.test(m) && /NOT included/.test(m), 'it says out loud that the cases are not included');
  say(/If you change it, this report is out of date/.test(m), 'the freshness sentence is unchanged');
  const imp = diagnosticMessage({ status: DIAG.OK, identity: { sha256: 'c'.repeat(64), lines: 3, bytes: 30 }, importError: 'SyntaxError: bad' }, 'lcs_length', 'after-edit', { mode: 'summary' });
  say(/does not import\./.test(imp) && !/SyntaxError/.test(imp), 'an import failure is reported without its error text');
  const same = diagnosticMessage(full, 'lcs_length', 'start');
  say(/FAIL case 1 /.test(same) && /EXPECTED/.test(same), 'the default (full) mode is unchanged');
}

// ── the campaign ──
const dir = mkdtempSync(join(tmpdir(), 'threearm-'));
const [fakePort] = await freePorts(1);
const replies = join(dir, 'replies.json');
writeFileSync(replies, JSON.stringify([PLAN, edit(BUGGY, FIXED), FINISH]), 'utf8');
const promptLog = join(dir, 'prompts.jsonl');
const doneFile = join(dir, 'DONE');
const fake = spawn(process.execPath, [join(HERE, 'fakemodel.mjs'), '--port', String(fakePort), '--replies', replies],
  { stdio: 'ignore', env: { ...process.env, FAKE_PROMPT_LOG: promptLog } });
await new Promise((r) => setTimeout(r, 1500));

let out = '';
const runner = spawn(process.execPath, [join(HERE, 'autodiag1.mjs'), `http://127.0.0.1:${fakePort}`], {
  env: {
    ...process.env,
    AUTODIAG_EXPERIMENT: EXPERIMENT,
    AUTODIAG_ARMS: 'CONTROL,NOTIFY,AUTODIAG_ARM',
    AUTODIAG_REPS: '1',
    AUTODIAG_SEEDS: String(SEED),
    AUTODIAG_TASK_IDS: TASK,
    AUTODIAG_PER_TASK_SEC: '120',
    AUTODIAG_TOTAL_SEC: '900',
    AUTODIAG_DONE_FILE: doneFile,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
runner.stdout.on('data', (d) => { out += d.toString(); });
runner.stderr.on('data', (d) => { out += d.toString(); });
const exitCode = await new Promise((resolve) => {
  const kill = setTimeout(() => { try { runner.kill('SIGKILL'); } catch {} resolve('KILLED_BY_TEST'); }, 8 * 60_000);
  runner.on('exit', (c) => { clearTimeout(kill); resolve(c); });
});
try { fake.kill('SIGKILL'); } catch { /* best effort */ }

const root = dirname((out.match(/summary: (.+summary\.jsonl)/) || [])[1] || '');
const rows = existsSync(join(root, 'summary.jsonl')) ? readFileSync(join(root, 'summary.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((r) => r.kind === 'run') : [];
const byArm = Object.fromEntries(rows.map((r) => [r.arm, r]));
const transcript = (r) => {
  const p = join(root, 'runs', `${r.runId}.transcript.jsonl`);
  return existsSync(p) ? readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : [];
};
const diagMsgs = (r) => transcript(r).filter((e) => e.kind === 'turn' && Array.isArray(e.sent)).flatMap((e) => e.sent).map((m) => String(m?.content || '')).filter((c) => /^AUTOMATIC DIAGNOSTIC/.test(c));

try {
  console.log('\n=== campaign ran ===');
  say(exitCode === 0, `runner exited 0 (${exitCode})`);
  say(rows.length === 3, `3 rows recorded (${rows.length}) for 3 arms x 1 task x 1 replicate`);
  say(['CONTROL', 'NOTIFY', 'AUTODIAG_ARM'].every((a) => byArm[a]?.state === 'COMPLETED'), 'every arm COMPLETED');

  console.log('\n=== 1. what each arm SAW, from the transcripts ===');
  const c = byArm.CONTROL, n = byArm.NOTIFY, a = byArm.AUTODIAG_ARM;
  say(c && diagMsgs(c).length === 0 && c.diagnosticMessagesSeen === 0 && c.isolationOk === true, 'CONTROL: zero diagnostic messages in any request; isolationOk true on the row');
  const nm = n ? diagMsgs(n) : [];
  say(nm.length >= 2, `NOTIFY: ${nm.length} diagnostic messages reached requests (start + after the edit)`);
  say(nm.every((m) => /RESULT: \d+ cases attempted, \d+ passed, \d+ failed\./.test(m) || /Every case passes/.test(m)), 'NOTIFY: every one carries the counts');
  say(nm.every((m) => !/case \d+ /.test(m) && !/EXPECTED/.test(m)), 'NOTIFY: none carries a case, an input, an expected or an actual value');
  say(n && n.caseDetailLinesSeen === 0 && n.isolationOk === true, 'NOTIFY: caseDetailLinesSeen 0 and isolationOk true on the row');
  const am = a ? diagMsgs(a) : [];
  say(am.length >= 2 && /FAIL case \d+ /.test(am[0]) && /EXPECTED/.test(am[0]), 'AUTODIAG_ARM: the first message lists failing cases with expected values');
  say(a && a.caseDetailLinesSeen > 0, `AUTODIAG_ARM: caseDetailLinesSeen ${a?.caseDetailLinesSeen} on the row`);
  say(n && n.diagnosticsDelivered === a?.diagnosticsDelivered, `NOTIFY and AUTODIAG_ARM delivered the same number of diagnostics (${n?.diagnosticsDelivered} vs ${a?.diagnosticsDelivered}) - same delivery points`);
  say(rows.every((r) => r.accepted === true && r.disposition === 'RETAIN'), 'the scripted fix was accepted in every arm (the arm changes what is SEEN, not the scripted actions)');

  console.log('\n=== 2. seed provenance ===');
  const prompts = existsSync(promptLog) ? readFileSync(promptLog, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
  say(prompts.length > 0 && prompts.every((p) => p.options?.seed === SEED), `every one of ${prompts.length} backend requests carried options.seed = ${SEED}`);
  say(rows.every((r) => r.seedSent === SEED), 'every row records the seed it sent');
  say(rows.every((r) => r.samplingRecorded?.seed === SEED), 'and the hub recorded the same seed on the run');

  console.log('\n=== 3. order ===');
  const order = rows.slice().sort((x, y) => x.idx - y.idx).map((r) => r.arm);
  say(JSON.stringify(order) === JSON.stringify(['CONTROL', 'NOTIFY', 'AUTODIAG_ARM']), `task index 0, replicate 1: rotation 0 -> ${order.join(' > ')}`);
  say(rows.every((r) => r.position === order.indexOf(r.arm)), 'each row records its position in the order');
  say(rows.every((r) => r.workspaceFresh === true), 'each unit started in a fresh workspace');

  console.log('\n=== 4. naming and clocks ===');
  say(existsSync(join(root, `${EXPERIMENT}_REPORT.json`)), `report written as ${EXPERIMENT}_REPORT.json`);
  const rep = existsSync(join(root, `${EXPERIMENT}_REPORT.json`)) ? JSON.parse(readFileSync(join(root, `${EXPERIMENT}_REPORT.json`), 'utf8')) : {};
  say(rep.experiment === EXPERIMENT, `report.experiment = ${rep.experiment}`);
  say(Array.isArray(rep.config?.arms) && rep.config.arms.length === 3 && rep.config.seeds?.[0] === SEED, 'report records the arms and the seeds');
  say(!/AUTODIAG-1/.test(out), 'the console never says AUTODIAG-1');
  const complete = out.match(new RegExp(`${EXPERIMENT} COMPLETE (\\S+)`));
  say(!!complete && !Number.isNaN(Date.parse(complete[1])), `COMPLETE is timestamped (${complete?.[1]})`);
  say(/report written \S+Z: /.test(out), 'the report write is timestamped');
  say(new RegExp(`${EXPERIMENT} EXIT \\S+Z code 0`).test(out), 'the process exit is timestamped');
  const done = existsSync(doneFile) ? JSON.parse(readFileSync(doneFile, 'utf8')) : null;
  say(!!done && done.completedAt === complete?.[1] && done.experiment === EXPERIMENT, 'the DONE file exists and says the same thing the log says');
  say(existsSync(join(root, `${EXPERIMENT}_DONE`)), 'and a copy sits in the campaign root');

  console.log('\n=== 5. accounting ===');
  say(rep.integrity?.ok === true && rep.reconciliation?.ok === true, 'integrity and reconciliation true');
  say(/isolation: held in every recorded unit/.test(out), 'the console states isolation held');
  say(rows.every((r) => r.hitHardWall === false && r.executionConfirmedStopped === true), 'no hard wall, execution confirmed stopped for every unit');
} finally {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}

console.log(`\n  threeArm: ${passed} passed, ${failed} failed -> ${failed ? 'THE THREE-ARM CAMPAIGN IS NOT READY' : 'each arm sees exactly what its definition says, seeds and order are recorded, the campaign names and times itself'}`);
if (failed) console.log(out.slice(-3000));
process.exit(failed ? 1 : 0);
