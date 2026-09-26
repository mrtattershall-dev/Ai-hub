/**
 * playCheck.test.mjs - the declared farm play, against a POSITIVE control that must pass and
 * two NEGATIVE controls that must fail in the expected places. A check that cannot fail is
 * not a check (memory: "checker branch that cannot fail"; "lenient proof: only tried the easy
 * input").
 *
 *   node server/playCheck.test.mjs
 *
 * Uses the Chrome/Edge installed on this machine through puppeteer-core. No browser download.
 */
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const { playCheck, findBrowser } = await import('./playCheck.js');
let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };

const FARM = join(HERE, '..', 'legasus', 'bench', 'farm');
const spec = JSON.parse(readFileSync(join(FARM, 'play.json'), 'utf8'));
say(!!findBrowser(), `a browser was found: ${findBrowser()}`);
say(spec.steps.length === 8, `the spec declares 8 steps (${spec.steps.length})`);

console.log('\n=== POSITIVE control: a hand-written page that satisfies the contract ===');
{
  const t0 = Date.now();
  const r = await playCheck(join(FARM, 'controls', 'positive'), spec, { timeoutMs: 60_000 });
  console.log(r.log.split('\n').map((l) => '        ' + l).join('\n'));
  say(r.status === 'OK', `the play ran (${r.status}${r.reason ? ': ' + r.reason : ''})`);
  say(r.total === 8 && r.passing.size === 8 && r.failing.size === 0, `8/8 cases pass (${r.passing.size}/${r.total})`);
  say(/SUMMARY 8\/8 cases pass, 0 fail/.test(r.log), 'the summary line has the case-runner shape');
  say(Date.now() - t0 < 45_000, `finished in ${Math.round((Date.now() - t0) / 1000)}s`);
}

console.log('\n=== NEGATIVE control 1: crops never grow, harvest does nothing, no save ===');
{
  const r = await playCheck(join(FARM, 'controls', 'negative-noharvest'), spec, { timeoutMs: 60_000 });
  console.log(r.log.split('\n').map((l) => '        ' + l).join('\n'));
  say(r.status === 'OK', 'the play ran');
  say([1, 2, 3, 4, 8].every((n) => r.passing.has(n)), 'load, movement and planting pass');
  say([5, 6, 7].every((n) => r.failing.has(n)), 'growth, harvest and save FAIL - the check can fail, in the right places');
  const c5 = r.cases.find((c) => c.n === 5);
  say(c5 && /expected .*stage/.test(c5.text) && /state \{/.test(c5.text), 'a failing case says what was expected and shows the observed state');
}

console.log('\n=== NEGATIVE control 2: the page throws on load ===');
{
  const r = await playCheck(join(FARM, 'controls', 'negative-throws'), spec, { timeoutMs: 60_000 });
  console.log(r.log.split('\n').map((l) => '        ' + l).join('\n'));
  say(r.status === 'OK', 'the play ran (a broken page is a verdict, not an apparatus failure)');
  say(r.failing.has(1) && r.failing.has(8), 'the load step and the final no-errors step FAIL');
  say(r.passing.size === 0, `nothing passes on a page with no state (${r.passing.size} passing)`);
  say(r.errors.some((e) => /undefinedFunction|ReferenceError/.test(e)), 'the recorded error names the thrown reference');
}

console.log('\n=== the served directory, and an entry page that cannot be served ===');
{
  // A forward-slash directory used to 404 every request: `join` normalises to backslashes on
  // Windows and the containment guard compared that against the caller's raw string. The play
  // then reported every step FAILING - blaming the candidate for the harness's own defect.
  const fwd = join(FARM, 'controls', 'positive').replace(/\\/g, '/');
  const r = await playCheck(fwd, spec, { timeoutMs: 60_000 });
  say(r.status === 'OK' && r.passing.size === 8, `a forward-slash directory serves correctly (${r.passing.size}/${r.total})`);
  say(!(r.errors || []).some((e) => /HTTP 404/.test(e)), 'and no 404 was recorded');

  // An entry page that is not there is an APPARATUS failure, never failing steps.
  const empty = mkdtempSync(join(tmpdir(), 'noentry-'));
  const u = await playCheck(empty, spec, { timeoutMs: 30_000 });
  say(u.status === 'UNAVAILABLE' && u.total === null && u.passing.size === 0, `a missing entry page is UNAVAILABLE, not a verdict (${u.status})`);
  say(/could not be served \(HTTP 404\)/.test(String(u.reason)), `and the reason names it: ${String(u.reason).slice(0, 80)}`);
  try { rmSync(empty, { recursive: true, force: true }); } catch { /* best effort */ }
}

console.log('\n=== apparatus failure is reported as UNAVAILABLE, never as a verdict ===');
{
  const r = await playCheck(join(FARM, 'controls', 'positive'), spec, { browserPath: 'C:\\no\\such\\browser.exe', timeoutMs: 20_000 });
  say(r.status === 'UNAVAILABLE' && r.total === null && r.passing.size === 0, `a missing browser is UNAVAILABLE (${r.status}: ${String(r.reason).slice(0, 60)})`);
}

console.log(`\n  playCheck: ${passed} passed, ${failed} failed -> ${failed ? 'THE GAME CHECK IS NOT ESTABLISHED' : 'the declared play passes the positive control and fails the negatives where it should'}`);
process.exit(failed ? 1 : 0);
