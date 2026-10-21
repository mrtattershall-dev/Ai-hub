/**
 * watchersTick.mjs - one unattended tick of the Watchers: a health check, then at most ONE Inspector job.
 *
 *   node server/watchersTick.mjs          (run by the legasus-watchers systemd user timer; safe to run by hand)
 *
 * HEALTH, written to data/watch-status.txt every tick, from typed records only: is Ollama answering and with which
 * model loaded, is the fuzzer alive and is any batch still showing the STRAY apparatus failure, how far REL-1/REL-2
 * have got, and what the Watchers have spent.
 *
 * INSPECT: the backlog (server/watchersQueue.json) is tests that fail on committed code. The next entry not tried in
 * the last 24 hours is re-run here FIRST, on the host, in a few minutes: if it now passes it is marked fixed and no
 * credit is spent. If it still fails, its real failure output becomes the Inspector's focus, and the Inspector runs
 * its own gates - RED, governedEdit, GREEN, STRESS 10/10 - and commits only to a watchers/<id> branch. Merging is the
 * owner's decision. The Watchers' hard cap (WATCHERS_BUDGET_USD) applies to every call.
 */
import { spawnSync, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spent } from './watchers.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const QUEUE = join(HERE, 'watchersQueue.json');
const STATUS = join(REPO, 'data', 'watch-status.txt');
const sh = (cmd, args, opts = {}) => { try { return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000, ...opts }).trim(); } catch (e) { return `ERR ${String(e.message).split('\n')[0]}`; } };
const tail = (f, n = 3) => { try { return readFileSync(f, 'utf8').trim().split('\n').slice(-n).join('\n'); } catch { return '(none)'; } };

// ── health ──
const lines = [`Legasus Watchers - ${new Date().toISOString()}`];
lines.push(`ollama: ${sh('curl', ['-s', '-m', '5', 'localhost:11434/api/version'])} | loaded: ${sh('bash', ['-c', "ollama ps | tail -n +2 | awk '{print $1}' | tr '\\n' ' '"]) || 'none'}`);
lines.push(`fuzz: ${sh('node', [join(HERE, 'fuzzStatus.mjs')]).split('\n').slice(0, 1).join(' ')}`);
const batches = join(REPO, 'fuzz-out', 'batches.jsonl');
if (existsSync(batches)) {
  const rows = readFileSync(batches, 'utf8').trim().split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const stray = rows.filter((r) => (r.kinds || {}).STRAY).length;
  const last = rows.at(-1);
  lines.push(`fuzz batches: ${rows.length}, ${last ? `${last.totalClean}/${last.totalRuns} clean` : '-'}${stray ? ` | WARNING: ${stray} batch(es) still show STRAY - the apparatus fix did not hold` : ' | no STRAY (apparatus fix holds)'}`);
}
for (const x of ['rel1', 'rel2']) lines.push(`${x}: ${tail(join(REPO, 'data', 'gather', `${x}.log`), 1)}`);
lines.push(`watchers spend: $${spent().toFixed(4)} of $${process.env.WATCHERS_BUDGET_USD || '10'}`);

// ── at most one inspection ──
const q = JSON.parse(readFileSync(QUEUE, 'utf8'));
const now = Date.now();
// --health: refresh the status only. No test is run and no credit is spent (the `legasus-status` command).
const next = process.argv.includes('--health') ? null : q.find((e) => !e.fixed && (!e.triedAt || now - Date.parse(e.triedAt) > 24 * 3600_000));
if (process.argv.includes('--health')) lines.push(`inspect: (health check only) last result - ${(q.filter((e) => e.lastResult || e.fixed).at(-1) || {}).lastResult || 'none yet'}`.slice(0, 300));
else if (!next) lines.push('inspect: backlog clear or every entry tried in the last 24h');
else {
  next.triedAt = new Date().toISOString();
  const t = spawnSync(process.execPath, [join(HERE, next.test)], { cwd: REPO, encoding: 'utf8', timeout: 15 * 60_000, maxBuffer: 16 << 20 });
  const out = `${t.stdout || ''}${t.stderr || ''}`;
  if (t.status === 0) {
    next.fixed = next.triedAt;
    lines.push(`inspect: ${next.test} now PASSES on the working tree - marked fixed, nothing spent`);
  } else {
    const failure = out.split('\n').filter((l) => /FAIL|Error|expected|!==|known-open/i.test(l)).slice(0, 12).join('\n').slice(0, 1500);
    const focus = `This existing test fails on committed code: server/${next.test} (exit ${t.status}). Its failure output:\n${failure}\n`
      + `${next.note || ''}\nFind out whether the defect is in the code under test or in the test itself (a stale expectation is a real finding too), `
      + 'and prove it. If the cause is outside the files in SCOPE, report no finding and say where it is in notes.';
    const args = [join(HERE, 'inspector.mjs'), '--files', next.files.join(','), '--max', '1', '--focus', focus, ...(next.excerpt ? ['--excerpt', next.excerpt] : [])];
    const r = spawnSync(process.execPath, args, { cwd: REPO, encoding: 'utf8', timeout: 3 * 3600_000, maxBuffer: 16 << 20 });
    const summary = `${r.stdout || ''}`.trim().split('\n').slice(-3).join(' | ').slice(0, 400);
    next.lastResult = summary;
    lines.push(`inspect: ${next.test} -> ${summary}`);
  }
  writeFileSync(QUEUE, JSON.stringify(q, null, 2) + '\n');
}
writeFileSync(STATUS, lines.join('\n') + '\n');
console.log(lines.join('\n'));
