/**
 * farmCampaign.test.mjs - the FIRST farm increment (farm-i1) through the real campaign entry point: an empty
 * workspace, the request, the declared play as diagnostic and as acceptance, the controller
 * on. Scripted replies; the machine's own Chrome; no model. The M1 shape of MILESTONE-1 with
 * the model replaced by a script that writes the positive-control page - proving the loop's
 * software around the model, not the model.
 *
 *   node server/farmCampaign.test.mjs
 *
 *   1. baseline on the empty seed: 0/8 (nothing exists yet); the opening diagnostic says the
 *      entry page does not exist yet
 *   2. the scripted build lands the page; after-edit play 8/8; controller ACCEPT; acceptance
 *      RETAIN (requested play PASS) - the unit is a verified, retained increment
 *   3. the row carries the play's case movement (0 -> 8) and the controller account
 */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const { freePorts } = await import('./testHarness.mjs');
let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };

const FARM = join(HERE, '..', 'legasus', 'bench', 'farm');
const POSITIVE = readFileSync(join(FARM, 'controls', 'positive', 'index.html'), 'utf8');
const PLAN = '1. WHAT IT DOES - a farming game on a canvas\n2. FILES - index.html\n3. BUILD ORDER - write index.html\n4. HOW TO VERIFY - the play runs automatically';
const write = (body) => `THOUGHT: Writing the whole game as one page.\nACTION: write_file\nPATH: index.html\n\`\`\`html\n${body}\n\`\`\``;
const FINISH = 'THOUGHT: The play passes.\nACTION: finish\nTEXT:\nfarm v1 built';

const dir = mkdtempSync(join(tmpdir(), 'farmcamp-'));
const [fakePort] = await freePorts(1);
const rf = join(dir, 'replies.json'); writeFileSync(rf, JSON.stringify([PLAN, write(POSITIVE), FINISH]), 'utf8');
const fake = spawn(process.execPath, [join(HERE, 'fakemodel.mjs'), '--port', String(fakePort), '--replies', rf], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
let out = '';
const runner = spawn(process.execPath, [join(HERE, 'autodiag1.mjs'), `http://127.0.0.1:${fakePort}`], {
  env: { ...process.env, BENCH_GROUP: 'farm', AUTODIAG_EXPERIMENT: 'SMOKE-FARM', AUTODIAG_ARMS: 'RECOVERY_ARM', AUTODIAG_REPS: '1', AUTODIAG_SEEDS: '1', AUTODIAG_TASK_IDS: 'farm-i1', AUTODIAG_PER_TASK_SEC: '240', AUTODIAG_TOTAL_SEC: '1200', AGENT_MAX_STEPS: '25' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
runner.stdout.on('data', (d) => { out += d; }); runner.stderr.on('data', (d) => { out += d; });
const code = await new Promise((resolve) => { const k = setTimeout(() => { try { runner.kill('SIGKILL'); } catch {} resolve('KILLED'); }, 8 * 60_000); runner.on('exit', (c) => { clearTimeout(k); resolve(c); }); });
try { fake.kill('SIGKILL'); } catch { /* best effort */ }

const root = dirname((out.match(/summary: (.+summary\.jsonl)/) || [])[1] || '');
const rows = existsSync(join(root, 'summary.jsonl')) ? readFileSync(join(root, 'summary.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((r) => r.kind === 'run') : [];
const row = rows[0];
const run = row && existsSync(join(root, 'runs', `${row.runId}.json`)) ? JSON.parse(readFileSync(join(root, 'runs', `${row.runId}.json`), 'utf8')) : null;
try {
  say(code === 0 && rows.length === 1, `campaign ran (exit ${code}, ${rows.length} row)`);
  say(/baseline farm-i1: 0\/3 graded cases pass on the seed/.test(out), 'baseline on the empty seed: 0/3');
  const d = (run?.diagnostics || []).filter((x) => !x.skipped);
  say(d.length >= 2 && d[0].importError && /does not exist yet/.test(d[0].importError), `the opening diagnostic said the entry page does not exist yet (${d[0]?.importError})`);
  say(d[1] && d[1].passed === 3 && d[1].attempted === 3, `after the scripted build: ${d[1]?.passed}/${d[1]?.attempted}`);
  say(row?.recovery?.state === 'ACCEPTED' && row.recovery.decisions.join('>') === 'ACCEPT', `controller: ${row?.recovery?.decisions?.join('>')} -> ${row?.recovery?.state}`);
  say(row?.disposition === 'RETAIN' && row.accepted === true && row.requested === 'PASS', `acceptance: ${row?.disposition} (requested ${row?.requested}, protected ${row?.protected})`);
  say(row?.baselineCasesPass === 0 && row?.candidateCasesPass === 3 && row?.casesTotal === 3 && row?.newlyPassing?.length === 3, `case movement on the row: ${row?.baselineCasesPass} -> ${row?.candidateCasesPass}/${row?.casesTotal}`);
  say(row?.provisionalDeliveredAsAccepted === false && row?.controllerAcceptNotRetained === false && row?.isolationOk === true, 'no integrity flag; isolation held');
  say(run?.status === 'done', `the run finished normally (${run?.status})`);
} finally {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}
console.log(`\n  farm campaign: ${passed} passed, ${failed} failed -> ${failed ? 'THE FARM TARGET IS NOT WIRED' : 'an empty workspace, a request, a declared play: built, verified, retained'}`);
if (failed) console.log(out.slice(-2500));
process.exit(failed ? 1 : 0);
