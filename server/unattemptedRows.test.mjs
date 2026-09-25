/**
 * unattemptedRows.test.mjs - every planned unit that never runs gets a row that names its
 * arm and replicate correctly. No model, no hub: the campaign wall clock is set so that it has
 * already expired when the queue starts, which is exactly the path that writes UNATTEMPTED rows.
 *
 *   node server/unattemptedRows.test.mjs
 *
 * (The parser of those rows once carried /rd+$/ instead of /r\d+$/ - a heredoc had eaten the
 * backslashes - and would have labelled every such row arm "AUTODIAG_ARMr1", rep 0.)
 */
import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };

let out = '';
const runner = spawn(process.execPath, [join(HERE, 'autodiag1.mjs'), 'http://127.0.0.1:1'], {
  env: {
    ...process.env,
    AUTODIAG_EXPERIMENT: 'UNATTEMPTED-CHECK',
    AUTODIAG_ARMS: 'CONTROL,NOTIFY,AUTODIAG_ARM',
    AUTODIAG_REPS: '2',
    AUTODIAG_SEEDS: '11,22',
    AUTODIAG_TASK_IDS: 'ext-gcd,ext-pascal',
    AUTODIAG_TOTAL_SEC: '181',     // RESERVE_SEC is 180: the campaign deadline is 1s after start
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
runner.stdout.on('data', (d) => { out += d; }); runner.stderr.on('data', (d) => { out += d; });
const code = await new Promise((resolve) => {
  const kill = setTimeout(() => { try { runner.kill('SIGKILL'); } catch {} resolve('KILLED_BY_TEST'); }, 4 * 60_000);
  runner.on('exit', (c) => { clearTimeout(kill); resolve(c); });
});
const summaryPath = (out.match(/summary: (.+summary\.jsonl)/) || [])[1];
const raw = summaryPath && existsSync(summaryPath) ? readFileSync(summaryPath, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
const rows = raw.filter((r) => r.kind === 'run');
const plan = (raw.find((r) => r.kind === 'plan') || {}).tasks || [];

say(code === 0, `runner exited 0 (${code})`);
say(plan.length === 12, `12 units planned (2 tasks x 3 arms x 2 replicates): ${plan.length}`);
say(rows.length === 12 && rows.every((r) => r.state === 'UNATTEMPTED'), `all 12 rows are UNATTEMPTED (${rows.filter((r) => r.state === 'UNATTEMPTED').length})`);
say(rows.every((r) => ['CONTROL', 'NOTIFY', 'AUTODIAG_ARM'].includes(r.arm)), `every row carries a real arm (${[...new Set(rows.map((r) => r.arm))].join(', ')})`);
say(rows.every((r) => r.rep === 1 || r.rep === 2) && rows.filter((r) => r.rep === 2).length === 6, 'replicates parsed as 1 and 2, six of each');
say(rows.every((r) => /wall clock expired/.test(r.reason || '')), 'each row carries the reason it never ran');
say(rows.every((r) => r.task === `${r.task.split('@')[0]}@${r.arm}r${r.rep}`), 'task key, arm and rep are mutually consistent on every row');
const rep = summaryPath ? join(dirname(summaryPath), 'UNATTEMPTED-CHECK_REPORT.json') : null;
say(rep && existsSync(rep) && JSON.parse(readFileSync(rep, 'utf8')).byStatus?.UNACCOUNTED === 0, 'report exists under the experiment name with UNACCOUNTED 0');
if (failed) console.log(out.slice(-2000));
console.log(`\n  unattempted rows: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
