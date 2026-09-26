/**
 * campaignWall.test.mjs - the CAMPAIGN-level wall fires when a unit's post-processing never
 * returns, and the account is complete.
 *
 *   node server/campaignWall.test.mjs
 *
 * EVAL-1 hung for two hours after unit 21: an unbounded docker wait in case measurement, i.e.
 * in the runner's post-processing, which no per-unit wall covers, and the campaign deadline
 * was only tested between units. The relevant condition is injected here
 * (AUTODIAG_INJECT_HANG_IN_RECORD=1: post-processing of unit 1 never returns) through the
 * real entry point. What is established:
 *   1. the campaign wall FIRES and the process EXITS (code 3) instead of waiting forever
 *   2. the hung unit is recorded INTERRUPTED with the reason; every other planned unit is
 *      UNATTEMPTED with the wall reason; UNACCOUNTED 0
 *   3. the report, DONE file and COMPLETE line are written, marked as halted by the wall
 */
import { spawn } from 'node:child_process';
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const { freePorts } = await import('./testHarness.mjs');
let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };

const dir = mkdtempSync(join(tmpdir(), 'cwall-'));
const [fakePort] = await freePorts(1);
const fake = spawn(process.execPath, [join(HERE, 'fakemodel.mjs'), '--port', String(fakePort), '--script', 'loop'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const doneFile = join(dir, 'DONE');
const t0 = Date.now();
let out = '';
const runner = spawn(process.execPath, [join(HERE, 'autodiag1.mjs'), `http://127.0.0.1:${fakePort}`], {
  env: { ...process.env, AUTODIAG_EXPERIMENT: 'SMOKE-WALL', AUTODIAG_ARMS: 'CONTROL,AUTODIAG_ARM', AUTODIAG_REPS: '1', AUTODIAG_TASK_IDS: 'ext-gcd,ext-pascal',
    AUTODIAG_PER_TASK_SEC: '20', AUTODIAG_UNIT_GRACE_MS: '3000', AUTODIAG_TOTAL_SEC: '190', AUTODIAG_DONE_FILE: doneFile, AUTODIAG_INJECT_HANG_IN_RECORD: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
runner.stdout.on('data', (d) => { out += d; }); runner.stderr.on('data', (d) => { out += d; });
const code = await new Promise((resolve) => { const k = setTimeout(() => { try { runner.kill('SIGKILL'); } catch {} resolve('KILLED_BY_TEST'); }, 6 * 60_000); runner.on('exit', (c) => { clearTimeout(k); resolve(c); }); });
const elapsed = Math.round((Date.now() - t0) / 1000);
try { fake.kill('SIGKILL'); } catch { /* best effort */ }

const summaryPath = (out.match(/summary: (.+summary\.jsonl)/) || [])[1];
const raw = summaryPath && existsSync(summaryPath) ? readFileSync(summaryPath, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
const rows = raw.filter((r) => r.kind === 'run');
const root = summaryPath ? dirname(summaryPath) : null;
try {
  console.log('=== 1. the wall fires; the process exits ===');
  say(/\[fault injection\] post-processing of unit 1 will never return/.test(out), 'the hang was injected in post-processing');
  say(code === 3, `exit code 3 = halted by the campaign wall (${code})`);
  say(elapsed < 240, `finished in ${elapsed}s, not indefinitely (deadline 10s + unit 20s + grace 3s + 60s)`);
  say(/CAMPAIGN WALL/.test(out), 'the wall announced itself');
  console.log('=== 2. the account ===');
  const inter = rows.filter((r) => r.state === 'INTERRUPTED'), unatt = rows.filter((r) => r.state === 'UNATTEMPTED');
  say(rows.length === 4, `4 rows for 4 planned units (${rows.length})`);
  say(inter.length === 1 && /post-processing did not return/.test(inter[0].reason || ''), `the hung unit is INTERRUPTED with the reason: ${inter[0]?.task} - ${String(inter[0]?.reason).slice(0, 70)}`);
  say(unatt.length === 3 && unatt.every((r) => /campaign wall clock/.test(r.reason || '')), 'the three never-started units are UNATTEMPTED with the wall reason');
  say(unatt.every((r) => ['CONTROL', 'AUTODIAG_ARM'].includes(r.arm) && r.rep === 1), 'their arm and replicate are parsed');
  const rep = root && existsSync(join(root, 'SMOKE-WALL_REPORT.json')) ? JSON.parse(readFileSync(join(root, 'SMOKE-WALL_REPORT.json'), 'utf8')) : null;
  say(rep && rep.byStatus?.UNACCOUNTED === 0 && rep.reconciliation?.ok === true, `report reconciles: UNACCOUNTED ${rep?.byStatus?.UNACCOUNTED}`);
  console.log('=== 3. completion artefacts ===');
  say(existsSync(doneFile), 'DONE file written (the watchdog would stop the GPU on it)');
  say(/SMOKE-WALL COMPLETE \S+Z \(HALTED BY THE CAMPAIGN WALL/.test(out), 'COMPLETE line marked as halted by the wall');
  say(/SMOKE-WALL EXIT \S+Z code 3/.test(out), 'EXIT line with code 3');
} finally {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}
console.log(`\n  campaign wall: ${passed} passed, ${failed} failed`);
if (failed) console.log(out.slice(-2500));
process.exit(failed ? 1 : 0);
