/**
 * pipeConnected.test.mjs - defects from the 2026-09-12 full-codebase audit, each one a case where the hub DETECTED
 * something and then failed to act on it.
 *
 *   node server/pipeConnected.test.mjs
 *
 * EVERY case below runs the SHIPPED rule and the PROPOSED rule side by side and asserts they DISAGREE on a concrete
 * input. That is deliberate. The first draft of this file asserted only the proposed rule, so two of its three bug
 * cases passed the moment they were written and could never have failed - the same vacuous shape that made
 * tolerantIndent.test.mjs report 1 known-open instead of 3. A case that cannot fail is not a test.
 *
 * 1. THE EXIT ANCHOR. The repeat-call notice is appended AFTER the trailing "EXIT: n" line while batchStepFailed's
 *    regex is anchored to the END of the string, so annotating a failing command makes it unclassifiable as failed.
 *    SCOPE, established by tracing: batch mode is opt-in (AGENT_BATCH_ACTIONS === '1') and set J ran the default, so
 *    batchStepFailed never executed. This is a real defect on the batch path and explains NONE of the observed
 *    verified-despite-failure runs. It is fixed here as correctness, not as a cause.
 *
 * 2. APPEND ESCAPES BOTH WRITE GUARDS. beforeSrc is captured only for write_file/edit_file, and the destructive,
 *    duplicate, lost-def and lost-export checks all gate on `beforeSrc !== null`. Live: 26 appends left
 *    add_assignment defined 23 times, 826 -> 8973 bytes, zero refusals.
 *
 * 3. THE TOLERANT MATCHER SWALLOWS THE BLANK LINE ABOVE ITS REGION. scanTolerant skips blanks while matching but
 *    anchors the region at the loop index, so the splice deletes a separator the caller never named - and because a
 *    deleted blank guarantees out !== content, it also defeats noChangeAt in exactly the case that refusal exists for.
 */
import assert from 'node:assert/strict';

let passed = 0, failed = 0;
const test = (n, f) => {
  try { f(); passed++; console.log(`  ok    ${n}`); }
  catch (e) { failed++; console.error(`  FAIL  ${n}\n        ${e.message.split('\n').slice(0, 5).join('\n        ')}`); }
};
console.log('\ndetections that must be connected to an action (old rule vs new rule)\n');

// ── 1. the EXIT anchor ────────────────────────────────────────────────────────────────────────
const NOTICE = '\n\n⚠ You already ran this exact run_command in this run and got exactly this answer.';
const failedOLD = (r) => /(^|\n)EXIT: (?!0\s*$)\S+\s*$/.test(String(r ?? ''));
// NEW: classify the answer as it was BEFORE any advisory was appended.
const rawOf = (r) => String(r ?? '').split('\n\n⚠')[0];
const failedNEW = (r) => failedOLD(rawOf(r));

test('both rules agree a plain failing command failed', () => {
  assert.equal(failedOLD('STDOUT:\nboom\nEXIT: 1'), true);
  assert.equal(failedNEW('STDOUT:\nboom\nEXIT: 1'), true);
});
test('both rules agree a plain passing command passed', () => {
  assert.equal(failedOLD('STDOUT:\nfine\nEXIT: 0'), false);
  assert.equal(failedNEW('STDOUT:\nfine\nEXIT: 0'), false);
});
test('THE BUG: the notice hides a non-zero exit from the OLD rule, and must not from the NEW', () => {
  const annotated = 'STDOUT:\nboom\nEXIT: 1' + NOTICE;
  assert.equal(failedOLD(annotated), false, 'precondition: the shipped rule is fooled by the notice');
  assert.equal(failedNEW(annotated), true,
    'the fix must classify the raw answer, so the appended advisory cannot mask the exit code');
});
test('the NEW rule still does not invent a failure when the exit was zero', () => {
  assert.equal(failedNEW('STDOUT:\nfine\nEXIT: 0' + NOTICE), false);
});

// ── 2. append escapes the write guards ────────────────────────────────────────────────────────
const CODE = /\.(py|c?js|mjs)$/i;
const capturesOLD = (tool, path) => (tool === 'write_file' || tool === 'edit_file') && !!path && CODE.test(path);
const capturesNEW = (tool, path) =>
  (tool === 'write_file' || tool === 'edit_file' || tool === 'append_file') && !!path && CODE.test(path);

test('both rules capture for write_file and edit_file', () => {
  for (const t of ['write_file', 'edit_file']) {
    assert.equal(capturesOLD(t, 's8_grades.py'), true);
    assert.equal(capturesNEW(t, 's8_grades.py'), true);
  }
});
test('THE BUG: append_file captures nothing under the OLD rule, so every write guard is unreachable', () => {
  assert.equal(capturesOLD('append_file', 's8_grades.py'), false, 'precondition: the shipped rule skips appends');
  assert.equal(capturesNEW('append_file', 's8_grades.py'), true,
    'beforeSrc stays null for an append and all four checks gate on beforeSrc !== null');
});
test('both rules still ignore a non-code file (the extension gate is untouched)', () => {
  assert.equal(capturesOLD('append_file', 'notes.txt'), false);
  assert.equal(capturesNEW('append_file', 'notes.txt'), false);
});

// ── 3. the blank-line swallow ─────────────────────────────────────────────────────────────────
const scan = (hay, needles, fixed) => {
  const at = [];
  for (let i = 0; i < hay.length; i++) {
    let fi = i, ki = 0;
    while (fi < hay.length && ki < needles.length) {
      const t = hay[fi].trim();
      if (t === '') { fi++; continue; }
      if (t === needles[ki]) { fi++; ki++; } else break;
    }
    if (ki === needles.length) {
      let s = i;
      if (fixed) while (s < fi && hay[s].trim() === '') s++;   // start where FIND actually matched
      at.push({ start: s, end: fi - 1 });
      i = fi - 1;
    }
  }
  return at;
};
const scanOLD = (h, n) => scan(h, n, false);
const scanNEW = (h, n) => scan(h, n, true);

const FILE = ['class M {', '  a() {', '    return 1;', '  }', '', '  b() {', '    return 2;', '  }', '}'];
const FIND = ['b() {', 'return 2;', '}'];
const splice = (m, replace) => [...FILE.slice(0, m.start), replace, ...FILE.slice(m.end + 1)].join('\n');

test('the premise: both rules locate exactly one region', () => {
  assert.equal(scanOLD(FILE, FIND).length, 1);
  assert.equal(scanNEW(FILE, FIND).length, 1);
});
test('THE BUG: the OLD region starts on a blank line, the NEW one starts on the matched code', () => {
  const o = scanOLD(FILE, FIND)[0], n = scanNEW(FILE, FIND)[0];
  assert.equal(FILE[o.start].trim(), '', `precondition: the shipped rule starts at line ${o.start}, a blank`);
  assert.notEqual(FILE[n.start].trim(), '', `the fixed rule starts at line ${n.start}: ${JSON.stringify(FILE[n.start])}`);
});
test('the blank separator survives a real edit under the NEW rule and dies under the OLD', () => {
  const replace = '  b() {\n    return 22;\n  }';
  assert.doesNotMatch(splice(scanOLD(FILE, FIND)[0], replace), /\}\n\n {2}b\(\)/, 'precondition: the shipped rule deletes it');
  assert.match(splice(scanNEW(FILE, FIND)[0], replace), /\}\n\n {2}b\(\)/, 'the separator between a() and b() must survive');
});
test('THE CONSEQUENCE: a resend of an already-landed edit is a true no-op only under the NEW rule', () => {
  const same = '  b() {\n    return 2;\n  }';
  const before = FILE.join('\n');
  assert.notEqual(splice(scanOLD(FILE, FIND)[0], same), before,
    'precondition: under the shipped rule a swallowed blank makes out !== content, so noChangeAt cannot fire');
  assert.equal(splice(scanNEW(FILE, FIND)[0], same), before,
    'under the fix the resend produces an identical file, so noChangeAt can tell the model it ALREADY LANDED');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
