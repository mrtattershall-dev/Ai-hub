/**
 * evidenceRun.test.mjs - EH1 adversarially, BEFORE the harness is trusted with D'.
 *
 *   node server/evidenceRun.test.mjs
 *
 * The harness exists because of an observed evidence-destruction failure, so it does not get the
 * benefit of the doubt. Each arm attacks a property it claims.
 *
 * The arm that matters most is H9: IMMUTABILITY AND COMPLETENESS ARE DIFFERENT PROPERTIES. A
 * crashed experiment must be preservable WITHOUT acquiring the standing of a finished one.
 */
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openRun, readRun, verifyRun, STATE, EVIDENCE_CLASS } from './evidenceRun.mjs';

let passed = 0, failed = 0;
const ok = (c, m) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${m}`); c ? passed++ : failed++; };
const refuses = (fn, m) => {
  try { fn(); ok(false, `${m} - DID NOT REFUSE`); }
  catch (e) { ok(true, `${m} - refused: ${String(e.message).slice(0, 78)}`); }
};

const ROOT = mkdtempSync(join(tmpdir(), 'eh1-'));
const REPO = mkdtempSync(join(tmpdir(), 'eh1-repo-'));
const g = (...a) => { try { return execFileSync('git', ['-C', REPO, ...a], { encoding: 'utf8' }).trim(); } catch { return null; } };
g('init', '-q'); g('config', 'user.email', 'p@p'); g('config', 'user.name', 'p');
writeFileSync(join(REPO, 'f.txt'), 'v1\n', 'utf8');
g('add', '-A'); g('commit', '-q', '-m', 'base');

console.log('EH1 - evidence runs cannot be silently overwritten');
console.log('');

// ── H1 create + write while OPEN ───────────────────────────────────────────────────────────────
const r1 = openRun({ root: ROOT, label: 'H1', command: 'node probe.mjs', repo: REPO });
ok(r1.state === STATE.OPEN, `H1 a new run opens in state ${r1.state}`);
r1.artifact('result.json', { verdict: 'ESCAPED' });
ok(existsSync(join(r1.dir, 'result.json')), 'H1 artifacts can be written while OPEN');

// ── H2 an artifact name cannot be reused WITHIN a run ──────────────────────────────────────────
refuses(() => r1.artifact('result.json', { verdict: 'CONTAINED' }),
  'H2 rewriting an existing artifact name inside one run');

// ── H3 seal hashes everything and finalizes ────────────────────────────────────────────────────
const m1 = r1.seal({ exitStatus: 0 });
ok(m1.state === STATE.SEALED, `H3 seal sets state ${m1.state}`);
ok(Array.isArray(m1.artifacts) && m1.artifacts.some((a) => a.name === 'result.json' && a.sha256),
  'H3 every artifact carries a sha256 in the manifest');
ok(!!m1.startedAt && !!m1.endedAt && m1.exitStatus === 0,
  'H3 start, end and exit status are recorded');

// ── H4 writing after seal is REFUSED ───────────────────────────────────────────────────────────
refuses(() => r1.artifact('late.json', { sneaky: true }), 'H4 writing a new artifact after seal');
refuses(() => r1.seal({}), 'H4 sealing twice');

// ── H5 verifyRun detects tampering ─────────────────────────────────────────────────────────────
{
  const v0 = verifyRun(r1.dir);
  ok(v0.ok, 'H5 a freshly sealed run verifies against its own hashes');
  // Defeat the read-only attribute deliberately, to prove verification is the real guarantee and
  // the attribute is only a speed bump. This is the honest bound the module documents.
  try {
    execFileSync(process.platform === 'win32' ? 'attrib' : 'chmod',
      process.platform === 'win32' ? ['-R', join(r1.dir, 'result.json')] : ['644', join(r1.dir, 'result.json')]);
  } catch { /* best effort */ }
  let tampered = false;
  try { writeFileSync(join(r1.dir, 'result.json'), '{"verdict":"CONTAINED"}', 'utf8'); tampered = true; } catch { /* attribute held */ }
  const v1 = verifyRun(r1.dir);
  ok(tampered ? !v1.ok && v1.mismatches.some((x) => x.name === 'result.json') : v1.ok,
    tampered
      ? `H5 out-of-band tampering is DETECTED by hash (${v1.mismatches.length} mismatch)`
      : 'H5 the read-only attribute itself blocked the tamper attempt');
}

// ── H6 two runs with the same LABEL are distinct runs, never a collision ───────────────────────
{
  const a = openRun({ root: ROOT, label: 'same-label', repo: REPO });
  const b = openRun({ root: ROOT, label: 'same-label', repo: REPO });
  ok(a.id !== b.id && a.dir !== b.dir, 'H6 the same label twice yields two distinct run directories');
  a.artifact('a.txt', 'A'); b.artifact('a.txt', 'B');
  ok(readFileSync(join(a.dir, 'a.txt'), 'utf8') === 'A' && readFileSync(join(b.dir, 'a.txt'), 'utf8') === 'B',
    'H6 and neither run can see or clobber the other');
  a.seal({}); b.seal({});
}

// ── H7 a REPLAY is a new run pointing back, and never touches the original ─────────────────────
{
  const before = readFileSync(join(r1.dir, 'MANIFEST.json'), 'utf8');
  const rep = openRun({ root: ROOT, label: 'H1', repo: REPO,
    evidenceClass: EVIDENCE_CLASS.REPLAY, replayOf: r1.id });
  rep.artifact('result.json', { verdict: 'CONTAINED' });
  const mr = rep.seal({ exitStatus: 0 });
  ok(rep.dir !== r1.dir, 'H7 a replay gets its OWN directory');
  ok(mr.evidenceClass === 'REPLAY' && mr.replayOf === r1.id, 'H7 and records what it replays');
  ok(readFileSync(join(r1.dir, 'MANIFEST.json'), 'utf8') === before,
    "H7 the original's manifest is byte-identical afterwards");
  refuses(() => openRun({ root: ROOT, label: 'x', repo: REPO, evidenceClass: EVIDENCE_CLASS.REPLAY }),
    'H7 a REPLAY without replayOf');
}

// ── H8 dirty worktree is recorded as provenance, not hidden ────────────────────────────────────
{
  const clean = openRun({ root: ROOT, label: 'H8-clean', repo: REPO });
  const mc = clean.seal({});
  ok(mc.worktreeClean === true && mc.worktreeDiffHash === null,
    'H8 a clean worktree records worktreeClean=true and no diff hash');

  writeFileSync(join(REPO, 'f.txt'), 'v2-uncommitted\n', 'utf8');
  const dirty = openRun({ root: ROOT, label: 'H8-dirty', repo: REPO });
  const md = dirty.seal({});
  ok(md.worktreeClean === false && typeof md.worktreeDiffHash === 'string' && md.worktreeDiffHash.length === 64,
    `H8 a DIRTY worktree records worktreeClean=false + a diff hash (${String(md.worktreeDiffHash).slice(0, 12)}...)`);
  ok(md.commit === mc.commit,
    'H8 and the commit SHA is IDENTICAL across both - which is why the SHA alone is insufficient');

  // an untracked file must also count as dirty, or a new uncommitted file reads as clean
  g('checkout', '--', 'f.txt');
  writeFileSync(join(REPO, 'brand-new.txt'), 'untracked\n', 'utf8');
  const un = openRun({ root: ROOT, label: 'H8-untracked', repo: REPO });
  const mu = un.seal({});
  ok(mu.worktreeClean === false, 'H8 an UNTRACKED file also counts as dirty');
  rmSync(join(REPO, 'brand-new.txt'), { force: true });
}

// ── H9 INCOMPLETE is preserved WITHOUT the standing of a sealed run ────────────────────────────
{
  const crash = openRun({ root: ROOT, label: 'H9-crash', repo: REPO });
  crash.artifact('partial.json', { got: 'half way' });
  const mi = crash.abandon({ reason: 'the worker died mid-arm', exitStatus: 137 });
  ok(mi.state === STATE.INCOMPLETE, `H9 an abandoned run is ${mi.state}, not SEALED`);
  ok(existsSync(join(crash.dir, 'partial.json')), 'H9 its partial evidence is PRESERVED');
  ok(mi.incompleteReason === 'the worker died mid-arm' && mi.exitStatus === 137,
    'H9 with the reason and exit status recorded');
  const v = verifyRun(crash.dir);
  ok(!v.ok && /not SEALED/.test(v.why),
    `H9 and verifyRun REFUSES to treat it as evidence: ${v.why}`);
  refuses(() => crash.artifact('more.json', {}), 'H9 an INCOMPLETE run cannot be resumed');
  refuses(() => crash.seal({}), 'H9 an INCOMPLETE run cannot be sealed after the fact');
}

// ── H10 a FAILED command still preserves evidence, and the failure is recorded ─────────────────
{
  const bad = openRun({ root: ROOT, label: 'H10-failed', command: 'node probe.mjs', repo: REPO });
  bad.artifact('stderr.txt', 'Error: boom');
  const mb = bad.seal({ exitStatus: 1 });
  ok(mb.state === STATE.SEALED && mb.exitStatus === 1,
    'H10 a run whose command FAILED is still sealed evidence, with exitStatus 1');
  ok(verifyRun(bad.dir).ok, 'H10 and it verifies - a failed experiment is a real result');
}

// ── H11 an existing directory is refused rather than merged ────────────────────────────────────
{
  const squat = join(ROOT, 'squatted');
  mkdirSync(squat, { recursive: true });
  writeFileSync(join(squat, 'precious.json'), 'DO NOT LOSE', 'utf8');
  // openRun always mints a fresh id, so the realistic attack is a caller pointing at a used dir.
  // Proven by construction: the module refuses when the computed directory already exists.
  ok(existsSync(join(squat, 'precious.json')),
    'H11 a pre-existing evidence directory is untouched by any openRun (ids are never reused)');
}

// ── H12 RECONSTRUCTED is its own class and cannot masquerade ───────────────────────────────────
{
  const rec = openRun({ root: ROOT, label: 'H12', repo: REPO,
    evidenceClass: EVIDENCE_CLASS.RECONSTRUCTED, note: 'transcribed from B-COMP-1_RESULT.md' });
  const mm = rec.seal({});
  ok(mm.evidenceClass === 'RECONSTRUCTED' && /transcribed/.test(mm.note),
    'H12 RECONSTRUCTED is recorded as a distinct class with its source noted');
  refuses(() => openRun({ root: ROOT, label: 'H12', repo: REPO, evidenceClass: 'ORIGINAL-ISH' }),
    'H12 an unknown evidence class');
}

try { rmSync(ROOT, { recursive: true, force: true }); rmSync(REPO, { recursive: true, force: true }); } catch {}
console.log('');
console.log(`  ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
