// R1..R9 — the coverage bridge, repaired. Frozen in COVERAGE-REPAIR_PREREG.md.
//
// G1, G2 and G4 stay against the PRESERVED adapter as specimens. Their repaired counterparts go
// through the production admission path. Clean legitimate cases are included so that refusal alone
// cannot satisfy the experiment.
import test from 'node:test';
import assert from 'node:assert';
import { writeFileSync, readFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { evaluate as preserved } from './adapter-eslint.mjs';
import { evaluate as repaired, makeLinter, analyse, DOMAIN, RULE } from './adapter-eslint-repaired.mjs';

const refused = (r) => r.legasus.decision !== 'ESTABLISHED';

test('R1 — G1 file-level suppression: specimen still admits; repaired refuses via admission', async () => {
  const f = 'attack/g1-file-suppression.js';
  assert.equal((await preserved(f)).legasus.decision, 'ESTABLISHED', 'the specimen is intact');
  const r = await repaired(f);
  assert.ok(refused(r), 'repaired: ' + r.legasus.decision);
  assert.equal(r.legasus.coverageFiled, false, 'no coverage authority was filed');
  assert.match(r.legasus.why, /suppression directive prevented evaluating part of the domain/);
  assert.equal(r.basis.suppressedForRule, 1, 'the basis is eslint suppressedMessages, not absence');
  assert.equal(r.conditions.coverageIncomplete !== undefined, true);
});

test('R2 — G2 line-level suppression: specimen still admits; repaired refuses via admission', async () => {
  const f = 'attack/g2-line-suppression.js';
  assert.equal((await preserved(f)).legasus.decision, 'ESTABLISHED');
  const r = await repaired(f);
  assert.ok(refused(r));
  assert.equal(r.legasus.coverageFiled, false);
  assert.match(r.legasus.why, /suppression directive/);
  assert.equal(r.basis.suppressedForRule, 1);
});

test('R3 — G4 parse failure: specimen still admits; repaired reports analysis incomplete', async () => {
  const f = 'attack/g4-parse-failure.js';
  assert.equal((await preserved(f)).legasus.decision, 'ESTABLISHED');
  const r = await repaired(f);
  assert.ok(refused(r));
  assert.equal(r.legasus.coverageFiled, false);
  assert.match(r.legasus.why, /analysis failed: Parsing error/);
  assert.equal(r.basis.fatalErrorCount, 1, 'the basis is fatalErrorCount, not an empty filter');
  assert.equal(r.linter.decision, 'INCOMPLETE', 'not ACCEPT, not REJECT: incomplete');
});

test('R4 — G3 excluded file: no certificate, and non-emission is not acceptance', async () => {
  const f = 'attack/g3-ignored.js';
  const r = await repaired(f, makeLinter({ ignores: ['attack/g3-ignored.js'] }));
  assert.equal(r.linter.decision, 'EXCLUDED');
  assert.equal(r.legasus.emitted, false, 'nothing was emitted for an excluded file');
  assert.equal(r.legasus.decision, 'NO_CLAIM');
  assert.equal(r.basis.isPathIgnored, true, 'the basis is isPathIgnored');
  // the same file with no ignores is a violation and refuses for THAT reason - the two are distinct
  const r2 = await repaired(f);
  assert.equal(r2.linter.decision, 'REJECT');
});

test('R5 — an unused directive over CLEAN code: coverage incomplete even though nothing was suppressed', async () => {
  const f = 'attack/r5-unused-directive-clean.js';
  writeFileSync(f, '/* eslint-disable array-callback-return */\nexport const ok = (xs) => xs.map((x) => x * 2);\n');
  const r = await repaired(f);
  assert.ok(refused(r), r.legasus.decision);
  assert.equal(r.basis.suppressedForRule, 0, 'nothing was suppressed...');
  assert.equal(r.basis.unusedDirectives, 1, '...but the directive disabled the rule over the file');
  assert.match(r.legasus.why, /suppression directive/);
  // and the intended domain was PRESERVED, not shrunk: the certificate still names the full domain
  assert.equal(r.legasus.domain, DOMAIN);
});

test('R6 — clean legitimate cases ESTABLISH: refusal alone cannot satisfy this experiment', async () => {
  // FOUND ON THE FIRST RUN: eslint 10's default configuration ignores node_modules/**, and the
  // repaired adapter's isPathIgnored check correctly reported the external files as EXCLUDED. The
  // preserved adapter never checked, so the earlier "8 untouched external files" were linted under
  // a configuration that excludes them. The files are evaluated here as BYTE-IDENTICAL COPIES
  // outside the ignored path, with the digest asserted against each original.
  mkdirSync('external', { recursive: true });
  const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
  const ext = ['accessor-pairs.js', 'array-callback-return.js', 'arrow-body-style.js'];
  for (const n of ext) {
    copyFileSync('node_modules/eslint/lib/rules/' + n, 'external/' + n);
    assert.equal(sha('external/' + n), sha('node_modules/eslint/lib/rules/' + n), n + ' is byte-identical');
    const orig = await repaired('node_modules/eslint/lib/rules/' + n);
    assert.equal(orig.legasus.decision, 'NO_CLAIM', n + ' in node_modules is EXCLUDED by the configuration');
  }
  const files = ['cases/b-eval-all-paths-return.js', 'cases/d-eval-foreach-is-not-a-violation.js',
    ...ext.map((n) => 'external/' + n)];
  for (const f of files) {
    const r = await repaired(f);
    assert.equal(r.legasus.decision, 'ESTABLISHED', f + ': ' + r.legasus.why);
    assert.equal(r.legasus.coverageFiled, true, f + ': coverage authority was filed');
    assert.deepEqual(r.conditions, {}, f + ': every coverage condition had a positive basis');
    assert.equal(r.basis.fatalErrorCount, 0);
    assert.equal(r.basis.suppressedForRule, 0);
    assert.equal(r.basis.unusedDirectives, 0);
    assert.ok(r.basis.effectiveRule, 'the effective configuration lists the rule');
  }
});

test('R7 — a real violation refuses, and the diagnostic is preserved verbatim', async () => {
  const r = await repaired('cases/c-eval-missing-return-in-filter.js');
  assert.equal(r.linter.decision, 'REJECT');
  assert.ok(refused(r));
  assert.equal(r.legasus.coverageFiled, true, 'coverage WAS established - the refusal is the violation');
  assert.match(r.legasus.why, /Array\.prototype\.filter\(\) expects a value to be returned/);
});

test('R8 — the by-reference callback: ESTABLISHED under the frozen domain, whose name states the scope', async () => {
  const r = await repaired('attack/g8-behavioural-gap.js');
  assert.equal(r.legasus.decision, 'ESTABLISHED');
  assert.match(r.legasus.domain, /RECOGNISED_BY_ARRAY_CALLBACK_RETURN/,
    'the claim says what it covers: callbacks the rule recognises, not all callbacks');
  // and it says nothing about the by-reference callback - which is the measured gap, unchanged
});

test('R9 — rule absent from the effective configuration: refused, rule did not run', async () => {
  const r = await repaired('cases/b-eval-all-paths-return.js', makeLinter({ ruleOn: false }));
  assert.ok(refused(r), r.legasus.decision);
  assert.equal(r.basis.effectiveRule, null, 'the basis is the effective configuration');
  assert.match(r.legasus.why, /not enabled in the effective configuration/);
  assert.equal(r.legasus.coverageFiled, false);
});

test('R-BASIS — every refusal reason came from admission, not from the adapter short-circuiting', async () => {
  for (const f of ['attack/g1-file-suppression.js', 'attack/g4-parse-failure.js']) {
    const r = await repaired(f);
    assert.equal(r.legasus.emitted, true, 'a certificate was emitted and admission decided');
    assert.ok(['FRONTIER_OPEN', 'CANDIDATE', 'OBSERVED'].includes(r.legasus.decision),
      f + ': admission state ' + r.legasus.decision);
  }
});
