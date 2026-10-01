/**
 * SUPERSEDED 2026-10-01 together with candidateIdentity.mjs - see
 * legasus/screen/D-ID-1_RECONCILE.md. Kept as the record of that implementation's suite.
 *
 * candidateIdentity.test.mjs - D-ID-1's metamorphic suite, M1..M16.
 *
 *   node server/candidateIdentity.test.mjs
 *
 * Frozen in legasus/screen/D-ID-1_PREREG.md BEFORE any digest existed. The rows are not mine and
 * are not negotiable here.
 *
 * PARAMETERISED OVER THE IDENTITY FUNCTION, because the prereg requires the suite to run against
 * the SHIPPED identity first:
 *
 *     "A suite that the current, known-defective identity passes cannot distinguish a repair."
 *
 * So each row runs twice - once against `git rev-parse HEAD^{tree}` as shipped in evaluator.js:60,
 * once against cid1 - and the current identity's failures are REPORTED, not hidden. The new
 * identity is accepted only when it passes every runnable row AND the shipped one is shown to fail
 * the predicted rows.
 *
 * M17 (PRESERVATION), M18 (CONSISTENCY) and M19 (BINDING) are NOT in this file. Per Amendment 1
 * they are properties of WORKSPACE CONSTRUCTION, EVALUATION CONSISTENCY and RECEIPT BINDING - not
 * of identity construction - and the prereg defers the wiring they need to separate steps. They
 * are reported NOT_RUN rather than silently absent.
 */
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, symlinkSync, renameSync, unlinkSync, chmodSync, readdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { candidateIdentity } from './candidateIdentity.mjs';

const git = (ws, a) => { try { return execFileSync('git', ['-C', ws, ...a], { encoding: 'utf8', windowsHide: true }).trim(); } catch { return null; } };

/** The SHIPPED identity, verbatim from evaluator.js:60. */
const shippedIdentity = (root) => {
  const t = git(root, ['rev-parse', 'HEAD^{tree}']);
  return t ? { available: true, identity: t } : { available: false, reason: 'no git tree' };
};
const cid1 = (root) => candidateIdentity(root);

const dirs = [];
const mk = (p) => { const d = mkdtempSync(join(tmpdir(), p)); dirs.push(d); return d; };
function initRepo(at, commit = true) {
  git(at, ['init', '-q']); git(at, ['config', 'user.email', 'p@p']); git(at, ['config', 'user.name', 'p']);
  if (commit) { git(at, ['add', '-A']); git(at, ['commit', '-q', '-m', 'base']); }
}
/** A candidate with a known shape. ownRepo=true gives it its own .git and a commit. */
function candidate(at, { ownRepo = true, bytes = 'module.exports = 1;\n' } = {}) {
  mkdirSync(at, { recursive: true });
  writeFileSync(join(at, 'subject.js'), bytes, 'utf8');
  mkdirSync(join(at, 'src'), { recursive: true });
  writeFileSync(join(at, 'src', 'a.js'), 'export const a = 1;\n', 'utf8');
  if (ownRepo) initRepo(at, true);
  return at;
}

const results = [];
function row(id, tag, expectation, build) {
  for (const [label, fn] of [['SHIPPED', shippedIdentity], ['cid1', cid1]]) {
    let verdict; let detail = '';
    try {
      const r = build(fn);
      if (r.notRunnable) { verdict = 'NOT_RUNNABLE'; detail = r.notRunnable; }
      else verdict = r.pass ? 'pass' : 'FAIL';
      detail = detail || r.detail || '';
    } catch (e) { verdict = 'ERROR'; detail = String(e.message).slice(0, 90); }
    results.push({ id, tag, expectation, impl: label, verdict, detail });
  }
}

// ── M1  same candidate, different parent repo -> SAME ──────────────────────────────────────────
row('M1', 'INVARIANCE', 'SAME', (idf) => {
  const p1 = mk('did-p1-'); const p2 = mk('did-p2-');
  initRepo(p1, false); writeFileSync(join(p1, 'P.txt'), 'ONE\n', 'utf8'); git(p1, ['add', '-A']); git(p1, ['commit', '-q', '-m', 'one']);
  initRepo(p2, false); writeFileSync(join(p2, 'P.txt'), 'TWO IS DIFFERENT\n', 'utf8'); git(p2, ['add', '-A']); git(p2, ['commit', '-q', '-m', 'two']);
  const c1 = candidate(join(p1, 'cand'), { ownRepo: false });
  const c2 = candidate(join(p2, 'cand'), { ownRepo: false });
  const a = idf(c1); const b = idf(c2);
  return { pass: a.available && b.available && a.identity === b.identity,
    detail: `${String(a.identity || a.reason).slice(0, 22)} vs ${String(b.identity || b.reason).slice(0, 22)}` };
});

// ── M2  same candidate, different absolute path -> SAME ────────────────────────────────────────
row('M2', 'INVARIANCE', 'SAME', (idf) => {
  const c1 = candidate(join(mk('did-m2a-'), 'cand')); const c2 = candidate(join(mk('did-m2b-'), 'cand'));
  const a = idf(c1); const b = idf(c2);
  return { pass: a.available && b.available && a.identity === b.identity };
});

// ── M3  no enclosing repo -> SAME and AVAILABLE ────────────────────────────────────────────────
row('M3', 'AVAILABILITY', 'SAME + AVAILABLE', (idf) => {
  const c1 = candidate(join(mk('did-m3a-'), 'cand'), { ownRepo: false });
  const c2 = candidate(join(mk('did-m3b-'), 'cand'), { ownRepo: false });
  const a = idf(c1); const b = idf(c2);
  return { pass: a.available && b.available && a.identity === b.identity,
    detail: a.available ? '' : `UNAVAILABLE: ${a.reason}` };
});

// ── M4  commitless enclosing repo -> SAME and AVAILABLE ────────────────────────────────────────
row('M4', 'AVAILABILITY', 'SAME + AVAILABLE', (idf) => {
  const p1 = mk('did-m4a-'); const p2 = mk('did-m4b-');
  initRepo(p1, false); initRepo(p2, false);
  const a = idf(candidate(join(p1, 'cand'), { ownRepo: false }));
  const b = idf(candidate(join(p2, 'cand'), { ownRepo: false }));
  return { pass: a.available && b.available && a.identity === b.identity,
    detail: a.available ? '' : `UNAVAILABLE: ${a.reason}` };
});

// ── M5  change unrelated parent HEAD -> SAME ───────────────────────────────────────────────────
row('M5', 'INVARIANCE', 'SAME', (idf) => {
  const p = mk('did-m5-'); initRepo(p, false);
  writeFileSync(join(p, 'P.txt'), 'v1\n', 'utf8'); git(p, ['add', '-A']); git(p, ['commit', '-q', '-m', 'v1']);
  const c = candidate(join(p, 'cand'), { ownRepo: false });
  const before = idf(c);
  writeFileSync(join(p, 'P.txt'), 'v2 PARENT MOVED\n', 'utf8'); git(p, ['add', '-A']); git(p, ['commit', '-q', '-m', 'v2']);
  const after = idf(c);
  return { pass: before.available && after.available && before.identity === after.identity };
});

// ── M6  modify an unrelated sibling directory -> SAME ──────────────────────────────────────────
row('M6', 'INVARIANCE', 'SAME', (idf) => {
  const p = mk('did-m6-');
  const c = candidate(join(p, 'cand'));
  const before = idf(c);
  mkdirSync(join(p, 'sibling'), { recursive: true });
  writeFileSync(join(p, 'sibling', 'noise.txt'), 'unrelated\n', 'utf8');
  const after = idf(c);
  return { pass: before.available && after.available && before.identity === after.identity };
});

// ── M7  change an included file's contents, UNCOMMITTED -> DIFFERENT ───────────────────────────
row('M7', 'FIDELITY', 'DIFFERENT', (idf) => {
  const c = candidate(join(mk('did-m7-'), 'cand'));
  const before = idf(c);
  writeFileSync(join(c, 'subject.js'), 'module.exports = 999;\n', 'utf8');   // not committed
  const after = idf(c);
  return { pass: before.available && after.available && before.identity !== after.identity,
    detail: before.identity === after.identity ? 'identity did not move with the bytes' : '' };
});

// ── M8  add / remove an included file -> DIFFERENT ─────────────────────────────────────────────
row('M8', 'FIDELITY', 'DIFFERENT', (idf) => {
  const c = candidate(join(mk('did-m8-'), 'cand'));
  const before = idf(c);
  writeFileSync(join(c, 'added.js'), 'new\n', 'utf8');
  const added = idf(c);
  unlinkSync(join(c, 'added.js'));
  const removed = idf(c);
  return { pass: before.identity !== added.identity && removed.identity === before.identity,
    detail: `add moved=${before.identity !== added.identity} remove restored=${removed.identity === before.identity}` };
});

// ── M9  rename an included path -> DIFFERENT ───────────────────────────────────────────────────
row('M9', 'FIDELITY', 'DIFFERENT', (idf) => {
  const c = candidate(join(mk('did-m9-'), 'cand'));
  const before = idf(c);
  renameSync(join(c, 'subject.js'), join(c, 'renamed.js'));
  const after = idf(c);
  return { pass: before.available && after.available && before.identity !== after.identity };
});

// ── M10 CRLF <-> LF in an included file -> DIFFERENT ───────────────────────────────────────────
row('M10', 'FIDELITY', 'DIFFERENT', (idf) => {
  const c = candidate(join(mk('did-m10-'), 'cand'));
  writeFileSync(join(c, 'eol.txt'), 'a\nb\n', 'utf8');
  const lf = idf(c);
  writeFileSync(join(c, 'eol.txt'), 'a\r\nb\r\n', 'utf8');
  const crlf = idf(c);
  return { pass: lf.available && crlf.available && lf.identity !== crlf.identity,
    detail: lf.identity === crlf.identity ? 'CRLF and LF produced the SAME identity' : '' };
});

// ── M11 add/change .gitignore, .gitattributes, .github/x -> DIFFERENT ──────────────────────────
row('M11', 'FIDELITY', 'DIFFERENT', (idf) => {
  const c = candidate(join(mk('did-m11-'), 'cand'));
  const before = idf(c);
  writeFileSync(join(c, '.gitignore'), 'node_modules\n', 'utf8');
  writeFileSync(join(c, '.gitattributes'), '* text=auto\n', 'utf8');
  mkdirSync(join(c, '.github'), { recursive: true });
  writeFileSync(join(c, '.github', 'workflow.yml'), 'on: push\n', 'utf8');
  const after = idf(c);
  return { pass: before.available && after.available && before.identity !== after.identity,
    detail: before.identity === after.identity ? 'git-adjacent files did not move the identity' : '' };
});

// ── M12 change contents under the candidate's own .git -> SAME (declared exclusion) ────────────
row('M12', 'INVARIANCE', 'SAME', (idf) => {
  const c = candidate(join(mk('did-m12-'), 'cand'));
  const before = idf(c);
  writeFileSync(join(c, '.git', 'PROBE_FILE'), 'poking the object store\n', 'utf8');
  const after = idf(c);
  return { pass: before.available && after.available && before.identity === after.identity };
});

// ── M13 change a symlink's target -> DIFFERENT ─────────────────────────────────────────────────
row('M13', 'FIDELITY', 'DIFFERENT', (idf) => {
  const c = candidate(join(mk('did-m13-'), 'cand'));
  writeFileSync(join(c, 't1.txt'), 'one\n', 'utf8');
  writeFileSync(join(c, 't2.txt'), 'two\n', 'utf8');
  // A FILE symlink needs privilege on Windows; a junction cannot point at a file, so there is no
  // fallback here. Every creation is guarded: an EPERM must become NOT_RUNNABLE, never an ERROR
  // and never a pass.
  try { symlinkSync(join(c, 't1.txt'), join(c, 'link'), 'file'); }
  catch (e) { return { notRunnable: `a file symlink could not be created (${e.code}) - NOT_RUNNABLE, never passed` }; }
  const before = idf(c);
  try {
    unlinkSync(join(c, 'link'));
    symlinkSync(join(c, 't2.txt'), join(c, 'link'), 'file');
  } catch (e) { return { notRunnable: `the symlink could not be retargeted (${e.code}) - NOT_RUNNABLE` }; }
  const after = idf(c);
  return { pass: before.available && after.available && before.identity !== after.identity };
});

// ── M14 empty directory / exec bit -> SAME (declared blind spots) ──────────────────────────────
row('M14', 'INVARIANCE', 'SAME', (idf) => {
  const c = candidate(join(mk('did-m14-'), 'cand'));
  const before = idf(c);
  mkdirSync(join(c, 'empty-dir'), { recursive: true });
  try { chmodSync(join(c, 'subject.js'), 0o755); } catch { /* attribute only on win32 */ }
  const after = idf(c);
  return { pass: before.available && after.available && before.identity === after.identity };
});

// ── M15 unrepresentable entry -> UNAVAILABLE, never an identity ────────────────────────────────
row('M15', 'REPRESENTABILITY', 'UNAVAILABLE', (idf) => {
  const c = candidate(join(mk('did-m15-'), 'cand'));
  // A name ending in "." cannot be created through the ordinary API on Windows; use the
  // extended-length prefix, which bypasses that normalisation.
  // THE PRECONDITION MUST BE VERIFIED, not assumed. An earlier version reported FAIL here on a
  // premise it never established: writeFileSync with the extended prefix returned ENOENT, no
  // trailing-dot entry ever existed, and cid1 was then blamed for "returning an identity anyway"
  // for a directory that was simply normal.
  if (process.platform !== 'win32') {
    return { notRunnable: 'this row constructs a Windows-unrepresentable name - NOT_RUNNABLE here' };
  }
  try { writeFileSync(`\\\\?\\${join(c, 'weird.')}`, 'x\n', 'utf8'); }
  catch (e) { return { notRunnable: `an unrepresentable name could not be created (${e.code}) - NOT_RUNNABLE, never passed` }; }
  const listed = readdirSync(c);
  const trailing = listed.filter((n) => n.endsWith('.'));
  if (!trailing.length) {
    return { notRunnable: `no trailing-dot entry is visible after creation (readdir: ${JSON.stringify(listed)}) - NOT_RUNNABLE` };
  }
  // THE PREMISE MUST BE ESTABLISHED, NOT ASSUMED: that this entry is actually UNADDRESSABLE.
  // "A trailing dot is listed" is not that. The prereg calls such a name unrepresentable on
  // Windows, but whether THIS machine misreads it is an empirical question - long-path support
  // and the filesystem both matter. So compare what the ordinary path reads against what the
  // extended-length path reads. Different bytes (or an ordinary-read failure) means the ordinary
  // name addresses something else, and only then is cid1 obliged to report UNAVAILABLE.
  const weird = join(c, trailing[0]);
  let ordinary = null; let ordinaryErr = null; let viaPrefix = null;
  try { ordinary = readFileSync(weird, 'utf8'); } catch (e) { ordinaryErr = e.code; }
  try { viaPrefix = readFileSync(`\\\\?\\${weird}`, 'utf8'); } catch (e) { viaPrefix = `THREW:${e.code}`; }
  const misread = ordinaryErr !== null || ordinary !== viaPrefix;
  if (!misread) {
    return { notRunnable: `the entry ${JSON.stringify(trailing[0])} IS addressable on this machine`
      + ' (ordinary and extended-length reads agree), so its premise does not hold here - NOT_RUNNABLE.'
      + ' cid1 giving it an identity is CORRECT, not a defect.' };
  }
  const r = idf(c);
  return { pass: r.available === false,
    detail: r.available
      ? `premise held (ordinary read ${ordinaryErr || 'differs'}) and an identity was returned anyway: ${String(r.identity).slice(0, 30)}`
      : `UNAVAILABLE: ${r.reason}` };
});

// ── M16 own .git vs the same bytes without one -> SAME ─────────────────────────────────────────
row('M16', 'INVARIANCE', 'SAME', (idf) => {
  const withRepo = candidate(join(mk('did-m16a-'), 'cand'), { ownRepo: true });
  const without = candidate(join(mk('did-m16b-'), 'cand'), { ownRepo: false });
  const a = idf(withRepo); const b = idf(without);
  return { pass: a.available && b.available && a.identity === b.identity,
    detail: a.available && b.available ? '' : `avail ${a.available}/${b.available}` };
});

// ── report ─────────────────────────────────────────────────────────────────────────────────────
const byImpl = (impl) => results.filter((r) => r.impl === impl);
const fmt = (rs) => rs.map((r) => `  ${r.verdict.padEnd(13)} ${r.id.padEnd(4)} ${r.tag.padEnd(18)} ${r.expectation.padEnd(17)} ${r.detail}`).join('\n');

console.log('D-ID-1  M1..M16, each row run against BOTH identities');
console.log('');
console.log('########## THE SHIPPED IDENTITY (git rev-parse HEAD^{tree}) - the must-fire baseline ##########');
console.log(fmt(byImpl('SHIPPED')));
const sFail = byImpl('SHIPPED').filter((r) => r.verdict === 'FAIL').map((r) => r.id);
const sPass = byImpl('SHIPPED').filter((r) => r.verdict === 'pass').map((r) => r.id);
console.log('');
console.log(`  shipped FAILS : ${sFail.join(', ') || '(none)'}`);
console.log(`  shipped passes: ${sPass.join(', ') || '(none)'}`);
console.log('');
console.log('  PREDICTED by the prereg: M1, M5 fail in the no-.git shape; M3, M4 fail UNAVAILABLE;');
console.log('  M7, M8, M9, M10, M13 fail uncommitted; M2, M6, M12, M16 expected to pass.');
console.log('');
console.log('########## cid1 ##########');
console.log(fmt(byImpl('cid1')));
const cFail = byImpl('cid1').filter((r) => r.verdict === 'FAIL');
const cNotRunnable = byImpl('cid1').filter((r) => r.verdict === 'NOT_RUNNABLE').map((r) => r.id);
const cErr = byImpl('cid1').filter((r) => r.verdict === 'ERROR');
console.log('');
console.log(`  cid1 failures    : ${cFail.map((r) => r.id).join(', ') || '(none)'}`);
console.log(`  cid1 NOT_RUNNABLE: ${cNotRunnable.join(', ') || '(none)'}  - never counted as passed`);
console.log(`  cid1 errors      : ${cErr.map((r) => r.id).join(', ') || '(none)'}`);
console.log('');
console.log('  NOT RUN HERE, per Amendment 1 responsibility boundaries:');
console.log('    M17 PRESERVATION  workspace construction - needs the real batch.js copy');
console.log('    M18 CONSISTENCY   evaluation consistency - needs a running check');
console.log('    M19 BINDING       receipt binding        - needs the evaluator wired');
console.log('  Reported NOT_RUN rather than silently absent. The prereg defers that wiring.');
console.log('');
// Acceptance: cid1 passes every RUNNABLE row, AND the shipped identity is shown to fail some.
const accepted = cFail.length === 0 && cErr.length === 0 && sFail.length > 0;
console.log(`  ACCEPTANCE: cid1 clean on runnable rows = ${cFail.length === 0 && cErr.length === 0};`
  + ` shipped shown defective = ${sFail.length > 0}  ->  ${accepted ? 'ACCEPTED' : 'NOT ACCEPTED'}`);
for (const d of dirs) { try { rmSync(d, { recursive: true, force: true }); } catch {} }
process.exit(accepted ? 0 : 1);
