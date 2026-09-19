// CHECKED MUTATION — the controls are the three defects this operation was built after, each of which
// reported success while doing nothing.
import test from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mutate, parses, REFUSED } from './mutate.mjs';

const NL = String.fromCharCode(10);
const SRC = ['def f(x):', '    return x + 1', ''].join(NL);

test('AN ANCHOR THAT MATCHES NOTHING IS A REFUSAL, not a silent success', () => {
  // The exact defect: a patch script that printed "threshold tightened", matched nothing, changed
  // nothing, and asserted nothing.
  const r = mutate({ text: SRC, find: 'a string that is not present', replace: 'x' });
  assert.equal(r.ok, false);
  assert.equal(r.refused, REFUSED.ANCHOR_ABSENT);
  assert.match(r.why, /silently/);
});

test('AN AMBIGUOUS ANCHOR does not identify a site', () => {
  const doubled = SRC + SRC;
  const r = mutate({ text: doubled, find: 'return x + 1', replace: 'return x + 2' });
  assert.equal(r.ok, false);
  assert.equal(r.refused, REFUSED.ANCHOR_AMBIGUOUS);
  assert.equal(r.occurrences, 2);
});

test('A TRANSFORM THAT PRODUCES IDENTICAL BYTES IS A REFUSAL', () => {
  const r = mutate({ text: SRC, transform: (s) => s });
  assert.equal(r.ok, false);
  assert.equal(r.refused, REFUSED.NO_CHANGE);
  // ...and a transform DECLARED non-mutating is fine, so this is not simply a ban on identity.
  const ok = mutate({ text: SRC, transform: (s) => s, expectChange: false });
  assert.equal(ok.ok, true);
});

test('a transform that declines to produce a result has NOT succeeded', () => {
  const r = mutate({ text: SRC, transform: () => null });
  assert.equal(r.ok, false);
  assert.equal(r.refused, REFUSED.POSTCONDITION);
});

test('PARSE SANITY is opt-in in BOTH directions, because damage is a valid intent', () => {
  const good = mutate({ text: SRC, find: 'x + 1', replace: 'x + 2',
    language: 'python', expectParses: true });
  assert.equal(good.ok, true, JSON.stringify(good));

  // A mutation that claims it will parse and does not is refused...
  const bad = mutate({ text: SRC, find: 'def f(x):', replace: 'def f(x)',
    language: 'python', expectParses: true });
  assert.equal(bad.ok, false);
  assert.equal(bad.refused, REFUSED.UNPARSEABLE);

  // ...and DELIBERATE damage is a legitimate, declarable intent. Without this the operation could not
  // build the destructive interventions the topology experiment depends on.
  const damage = mutate({ text: SRC, find: 'def f(x):', replace: 'def f(x)',
    language: 'python', expectParses: false });
  assert.equal(damage.ok, true, JSON.stringify(damage));
});

test('AN UNRUNNABLE CHECK HAS NOT PASSED', () => {
  const r = mutate({ text: SRC, find: 'x + 1', replace: 'x + 2',
    language: 'a-language-with-no-parser', expectParses: true });
  assert.equal(r.ok, false);
  assert.equal(r.refused, REFUSED.UNPARSEABLE);
  assert.match(r.why, /has NOT passed/);
  assert.equal(parses('whatever', 'a-language-with-no-parser').ok, null,
    'UNKNOWN is never an approval');
});

test('POSTCONDITIONS are checked before anything is written', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mut-'));
  const f = join(dir, 'm.py');
  writeFileSync(f, SRC, 'utf8');
  const r = mutate({ file: f, find: 'x + 1', replace: 'x + 2', write: true,
    postconditions: [{ why: 'the result must still mention f', test: (a) => a.includes('zzz') }] });
  assert.equal(r.ok, false);
  assert.equal(r.refused, REFUSED.POSTCONDITION);
  assert.equal(readFileSync(f, 'utf8'), SRC, 'NOTHING may be written when a postcondition failed');
  rmSync(dir, { recursive: true, force: true });
});

test('the happy path writes, and reports both digests so the change is auditable', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mut2-'));
  const f = join(dir, 'm.py');
  writeFileSync(f, SRC, 'utf8');
  const r = mutate({ file: f, find: 'x + 1', replace: 'x + 2', write: true,
    language: 'python', expectParses: true,
    postconditions: [{ why: 'the function survives', test: (a) => /def f\(x\)/.test(a) }] });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.wrote, true);
  assert.notEqual(r.beforeSha, r.afterSha);
  assert.match(readFileSync(f, 'utf8'), /x \+ 2/);
  rmSync(dir, { recursive: true, force: true });
});

test('a missing file is refused rather than treated as empty', () => {
  const r = mutate({ file: join(tmpdir(), 'definitely-not-here-' + Date.now() + '.py'),
    find: 'a', replace: 'b' });
  assert.equal(r.refused, REFUSED.NO_SUCH_FILE);
});
