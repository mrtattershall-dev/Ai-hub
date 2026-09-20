// LIFECYCLE CONTROLS — written after TRANSFER-1 RUN 1 was lost to a subject that ended the process.
//
//     THE INVARIANT: a subject's control over its own lifetime must not control whether the observer
//     records that observation's epistemic state, nor whether subsequent observations occur.
//
// Development on Legasus never forced these, because node:test subjects return. The hub's ninety
// bespoke runners all call process.exit, and the frozen mechanism died on the second one. So every
// lifecycle outcome the observer must tell apart is forced here, from a fixture, before a new digest
// is frozen.
import test from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RUNNER = fileURLToPath(new URL('../../benchmarks/run-backward.mjs', import.meta.url));

// Five subjects, one per lifecycle outcome, each writing a file so an effect really happens.
const SUBJECTS = {
  'a-normal.test.mjs': `
    import { writeFileSync } from 'fs';
    writeFileSync(process.env.LGS_FIXTURE_OUT + '/a.txt', 'a');
  `,
  'b-exit0.test.mjs': `
    import { writeFileSync } from 'fs';
    writeFileSync(process.env.LGS_FIXTURE_OUT + '/b.txt', 'b');
    process.exit(0);
  `,
  'c-exit1.test.mjs': `
    import { writeFileSync } from 'fs';
    writeFileSync(process.env.LGS_FIXTURE_OUT + '/c.txt', 'c');
    process.exit(1);
  `,
  'd-throws.test.mjs': `
    import { writeFileSync } from 'fs';
    writeFileSync(process.env.LGS_FIXTURE_OUT + '/d.txt', 'd');
    throw new Error('a subject may refuse');
  `,
  // Exits BEFORE causing any effect. The dangerous one: it must not read as "ran, caused nothing".
  'e-exit-first.test.mjs': 'process.exit(0);\n',
};

function runFixture(extra = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'lgs-life-'));
  const outDir = mkdtempSync(join(tmpdir(), 'lgs-life-out-'));
  for (const [name, src] of Object.entries({ ...SUBJECTS, ...extra })) {
    writeFileSync(join(dir, name), src);
  }
  const r = spawnSync(process.execPath, [RUNNER, '--root', dir],
    { encoding: 'utf8', timeout: 240000,
      env: { ...process.env, LGS_FIXTURE_OUT: outDir, LGS_ENTRY_MS: '20000', LGS_GRACE_MS: '4000',
        PYTHONDONTWRITEBYTECODE: '1' } });
  const text = (r.stdout || '') + (r.stderr || '');
  const num = (label) => {
    const m = new RegExp('\\b' + label + '\\s+(\\d+)').exec(text);
    return m ? Number(m[1]) : null;
  };
  const cleanup = () => { rmSync(dir, { recursive: true, force: true });
    rmSync(outDir, { recursive: true, force: true }); };
  return { text, num, outDir, dir, cleanup, effects: () => readdirSync(outDir) };
}

test('EVERY LIFECYCLE OUTCOME IS RECORDED, AND LATER ENTRIES STILL RUN', () => {
  const f = runFixture();
  try {
    // The first thing to establish: a subject that exits does not stop the ones after it.
    assert.equal(f.effects().length, 4,
      'four of the five subjects cause an effect, and all four happened despite b, c and e exiting');

    assert.equal(f.num('COMPLETE'), 1, 'a returned normally');
    assert.equal(f.num('REFUSED'), 1, 'd threw on load - observed, and not the observer failing');
    assert.equal(f.num('SUBJECT_TERMINATED'), 3, 'b, c and e ended the process themselves');
    assert.equal(f.num('TIMED_OUT'), 0);
    assert.equal(f.num('NO_RECORD'), 0, 'the observer recorded something for every single entry');
  } finally { f.cleanup(); }
});

test('MUST FIRE — exiting BEFORE any effect is UNESTABLISHED, not "caused nothing"', () => {
  const f = runFixture();
  try {
    // e-exit-first produces an empty event list from an incomplete protocol. If that were counted as
    // a completed entry, the report would say it ran and caused no effects - a successful empty
    // observation, which is the exact family this whole line of work exists to refuse.
    const un = /EFFECTS ARE UNESTABLISHED: (\d+)/.exec(f.text);
    assert.ok(un, 'the report states the unestablished count');
    assert.equal(Number(un[1]), 3, 'b, c and e cannot support a claim about what they caused');
    assert.match(f.text, /is NOT "no effects"/);
  } finally { f.cleanup(); }
});

test('MUST FIRE — a subject that never returns is TIMED_OUT, and does not stop the run', () => {
  // THE HANDLE IS WHAT MAKES IT A HANG. The first version of this control used a bare unsettled
  // top-level await, and Node exits code 13 when the loop drains with a pending promise - so the
  // fixture terminated by itself and the control could not fire. A live interval keeps the loop
  // alive, which is what a subject that starts a server actually does.
  const f = runFixture({ 'f-hangs.test.mjs':
    'const h = setInterval(() => {}, 1000); void h;\nawait new Promise(() => {});\n' });
  try {
    assert.equal(f.num('SUBJECT_TERMINATED'), 4,
      'the hang never finished loading, so it joins b, c and e as unestablished');
    assert.equal(f.num('TIMED_OUT'), 0,
      'the WATCHDOG ended it before the parent timeout had to - the parent kill is the path that orphans');
    assert.equal(f.effects().length, 4, 'and the four effecting subjects still ran');
  } finally { f.cleanup(); }
});

test('MUST FIRE — a subject that FINISHES but holds the loop is DRAIN_INCOMPLETE', () => {
  // Distinct from the hang: this module evaluates to the end, so the entry loaded. What it will not
  // do is let go. Its observations are real; whether it had finished its work is not established.
  const f = runFixture({ 'g-holds.test.mjs': `
    import { writeFileSync } from 'fs';
    writeFileSync(process.env.LGS_FIXTURE_OUT + '/g.txt', 'g');
    const h = setInterval(() => {}, 1000); void h;
  ` });
  try {
    assert.equal(f.num('DRAIN_INCOMPLETE'), 1);
    assert.equal(f.num('COMPLETE'), 1, 'and it is NOT counted as a complete entry');
    assert.equal(f.effects().length, 5, 'its write was still witnessed');
  } finally { f.cleanup(); }
});

test('MUST FIRE — NO CHILD OUTLIVES THE RUN', () => {
  // The leak that made this control necessary: "let the subject drain" with no bound left one orphan
  // per entry. 261 accumulated across runs, two other sessions on this machine hit fork failures,
  // and every timing taken in that window was measuring my own load rather than any subject.
  // A swept count above zero means the watchdog failed and the parent had to kill something.
  const f = runFixture({ 'g-holds.test.mjs':
    'const h = setInterval(() => {}, 1000); void h;\n' });
  try {
    const m = /children swept at end of run \(must be 0\): (\d+)/.exec(f.text);
    assert.ok(m, 'the run reports whether it left anything behind');
    assert.equal(Number(m[1]), 0, 'every child ended itself; none had to be reaped');
  } finally { f.cleanup(); }
});

test('the effects of an exiting subject are still WITNESSED, not discarded', () => {
  const f = runFixture();
  try {
    // b and c exit immediately after writing. Their writes must appear in the witnessed total, or
    // the repair would have traded one silence for another.
    const m = /EFFECT_WITNESSED\s+(\d+)/.exec(f.text);
    assert.ok(m && Number(m[1]) >= 4,
      'at least the four writes were witnessed; got ' + (m && m[1]));
  } finally { f.cleanup(); }
});

test('THE OBSERVER IS NOT IN THE SUBJECT TREE — its own writes are not the subject\'s effects', () => {
  const f = runFixture();
  try {
    assert.doesNotMatch(f.text, /legascreen\//,
      'no instrument frame is reported as production code of the subject');
  } finally { f.cleanup(); }
});

test('the fixture subjects really do exercise the lifecycle they claim', () => {
  // A control on the control: if these files did not actually exit, the tests above would pass
  // vacuously against subjects that all return normally.
  assert.match(SUBJECTS['b-exit0.test.mjs'], /process\.exit\(0\)/);
  assert.match(SUBJECTS['c-exit1.test.mjs'], /process\.exit\(1\)/);
  assert.match(SUBJECTS['e-exit-first.test.mjs'], /^process\.exit\(0\);/);
  assert.doesNotMatch(SUBJECTS['a-normal.test.mjs'], /process\.exit/);
  void readFileSync;
});
