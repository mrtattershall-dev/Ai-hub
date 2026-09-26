/**
 * caseSetTimeout.test.mjs - case measurement is BOUNDED on the host side when docker does not
 * return (EVAL-1's two-hour hang).
 *
 *   node server/caseSetTimeout.test.mjs
 *
 * A stand-in `docker` that never exits for `run` (and exits 0 for `rm -f`) is passed as
 * dockerCmd. caseSet must return within timeoutSec + 30 s with error and timedOut set, and must
 * have issued the forced removal of its NAMED container.
 */
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const { caseSet } = await import('./caseSet.js');
let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };

const dir = mkdtempSync(join(tmpdir(), 'cst-'));
const log = join(dir, 'docker-calls.jsonl');
// The stand-in: records every call; `run` never returns; everything else exits 0.
const fakeDocker = join(dir, 'fakeDocker.mjs');
writeFileSync(fakeDocker, `
import { appendFileSync } from 'node:fs';
appendFileSync(${JSON.stringify(log)}, JSON.stringify(process.argv.slice(2)) + '\\n');
if (process.argv[2] === 'run') setInterval(() => {}, 1000); else process.exit(0);
`, 'utf8');
// dockerCmd as [node, script]: the stand-in is a node script.
const cmd = [process.execPath, fakeDocker];
const cand = join(dir, 'cand');
import('node:fs').then(({ mkdirSync }) => mkdirSync(cand, { recursive: true }));
await new Promise((r) => setTimeout(r, 100));
writeFileSync(join(cand, 'm.py'), 'def m(x):\n    return x\n', 'utf8');

try {
  const t0 = Date.now();
  const res = await caseSet(cand, 'm', '[[1], 1]\n', { timeoutSec: 1, dockerCmd: cmd });
  const sec = (Date.now() - t0) / 1000;
  say(res.timedOut === true && /timed out after 31s/.test(res.error || ''), `returned timedOut with the reason: ${res.error}`);
  say(sec >= 30 && sec < 45, `returned after ${sec.toFixed(1)}s (bound 31s), not indefinitely`);
  say(res.passing.size === 0 && res.failing.size === 0 && res.total === null, 'no cases claimed either way');
  const calls = existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
  const run = calls.find((c) => c[0] === 'run'), rm = calls.find((c) => c[0] === 'rm');
  const nameIdx = run ? run.indexOf('--name') : -1;
  say(!!run && nameIdx > -1 && /^caseset-/.test(run[nameIdx + 1]), 'the container was NAMED');
  say(!!rm && rm[1] === '-f' && run && rm[2] === run[nameIdx + 1], 'and force-removed by that name after the timeout');
} finally {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}
console.log(`\n  caseSet timeout: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
