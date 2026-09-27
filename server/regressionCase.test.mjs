/**
 * regressionCase.test.mjs - the ASSIST-2 artifact is kept as a REGRESSION CASE.
 *
 *   node server/regressionCase.test.mjs
 *
 * ASSIST-2 produced a page that the gate ACCEPTED while it silently broke a previously accepted
 * behaviour: planting stops when the seeds run out. Two things had to be true for that to happen - the
 * completion was not structurally contained, and the protected set had been hand-picked rather than
 * accumulated. Both are now fixed, so this file pins the fix in place from both directions:
 *
 *   the corrected system REFUSES that artifact                 - it must never be accepted again
 *   and still ADMITS a bounded implementation of growth         - the fix must not just refuse
 *                                                                everything
 *
 * A fix that only satisfies the first half is a fix that has stopped the system working.
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const { containsSafely } = await import('./localEdit.mjs');
const { evaluate } = await import('./evaluator.js');
const { farmTasks } = await import('./benchTasks.js');
let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };

const grow = farmTasks().find((t) => t.id === 'farm-grow');
const REGRESSING = readFileSync(join(HERE, '..', 'legasus', 'screen', 'ASSIST-2_accepted_index.html'), 'utf8');
const BEFORE = readFileSync(join(HERE, '..', 'legasus', 'screen', 'ASSIST-1_accepted_index.html'), 'utf8');
const run = JSON.parse(readFileSync(join(HERE, '..', 'legasus', 'screen', 'ASSIST-2_run.json'), 'utf8'));
const acceptedAttempt = run.attempts.find((a) => a.outcome === 'ACCEPTED');

/** A bounded growth implementation: exactly what the slot was for, four lines. */
const BOUNDED_BODY = [
  '            day++;',
  '            for (const key of Object.keys(tiles)) {',
  '                if (tiles[key].stage < 3) tiles[key].stage++;',
  '            }',
].join('\n');
const BOUNDED = BEFORE.replace(
  "        document.addEventListener('keydown', (e) => {",
  [
    "        document.addEventListener('keydown', (e) => {",
    "            if (e.key !== 't') return;",
    BOUNDED_BODY,
    '            try { draw(); } catch (err) { /* redraw is not the change */ }',
    '        });',
    "        document.addEventListener('keydown', (e) => {",
  ].join('\n'),
);

async function judge(label, html) {
  const ws = mkdtempSync(join(tmpdir(), 'regcase-'));
  try {
    writeFileSync(join(ws, 'index.html'), html, 'utf8');
    // The evaluator refuses to judge what it cannot name: no git tree, no verdict. That guard is
    // deliberate, and a test workspace has to satisfy it like any other candidate.
    for (const args of [['init', '-q'], ['config', 'core.autocrlf', 'false'], ['add', '-A'], ['-c', 'user.email=r@r', '-c', 'user.name=r', 'commit', '-q', '-m', 'c']]) {
      execFileSync('git', ['-C', ws, ...args], { windowsHide: true });
    }
    const v = await evaluate(ws, grow, { timeoutSec: 120 });
    const seqs = (v.protected?.sequences || []).map((s) => `${s.from.split(' ')[0]}:${s.verdict}`).join(' ');
    console.log(`        ${label.padEnd(30)} requested ${v.requested?.verdict}  protected ${v.protected?.verdict}  [${seqs}]`);
    return v;
  } finally { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } }
}

console.log('=== the completion that produced it is structurally refused ===');
{
  const c = containsSafely(acceptedAttempt.middleUsed);
  say(c.ok === false, `the ASSIST-2 completion is REFUSED (${c.reason})`);
  say(/TOO_LARGE|ESCAPES_ENCLOSING_BLOCK|ADDS_A_LISTENER/.test(c.reason), `for a structural reason, not because a suffix line was missing: ${c.detail?.slice(0, 80)}`);
  const b = containsSafely(BOUNDED_BODY);
  say(b.ok === true, `and a bounded growth body is CONTAINED (${b.codeLines} lines)`);
}

console.log('\n=== the accumulated protected set refuses the artifact and admits the bounded one ===');
{
  const bad = await judge('the ASSIST-2 artifact', REGRESSING);
  say(bad.protected?.verdict === 'FAIL', `the regressing artifact now FAILS the protected set (${bad.protected?.verdict})`);
  const failing = (bad.protected?.sequences || []).find((s) => s.verdict === 'FAIL');
  say(!!failing && failing.from.startsWith('farm-plant-v2') && failing.failing.includes(6),
    `and the sequence that catches it is the accumulated planting requirement, at step ${failing?.failing?.join(',')}`);
  say(bad.requested?.verdict === 'PASS', 'while its growth behaviour still passes - which is exactly why the old protected set missed it');

  const good = await judge('a bounded growth addition', BOUNDED);
  say(good.requested?.verdict === 'PASS' && good.protected?.verdict === 'PASS',
    'a bounded implementation passes BOTH the new requirement and every accumulated one');
  say((good.protected?.sequences || []).every((s) => s.verdict === 'PASS'),
    `every accumulated sequence passes for it (${(good.protected?.sequences || []).map((s) => s.from.split(' ')[0]).join(', ')})`);
}

console.log('\n=== the intentional-change mechanism is explicit ===');
say(Array.isArray(grow.accumulates) && grow.accumulates.includes('farm-plant-v2'), 'the task names which requirements it carries forward');
say(Array.isArray(grow.supersedes) && grow.supersedes[0].reason.length > 20,
  `and names what it supersedes, with a reason: ${grow.supersedes[0].requirement} -> ${grow.supersedes[0].replacedBy}`);

console.log(`\n  regression case: ${passed} passed, ${failed} failed -> ${failed ? 'THE FIX IS NOT ESTABLISHED' : 'the artifact is refused twice over, and a bounded addition is still admitted'}`);
process.exit(failed ? 1 : 0);
