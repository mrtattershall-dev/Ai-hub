/**
 * d2Access.test.mjs - QUALIFY THE ACCESS BOUNDARY.
 *
 *   node server/d2Access.test.mjs
 *
 * d2Visibility.test.mjs established DISCOVERABILITY: the audit store is outside the workspace,
 * no ref points at it, and its path is stripped from the model's environment. That is a real
 * property and it is NOT access control. The model's commands run as the SAME OS USER as the
 * hub, with no container, so anything that user can read the model can read if it guesses or is
 * told the path. The campaign needs the stronger claim:
 *
 *     PERMITTED workspace reads SUCCEED
 *     KNOWN-PATH reads of audit storage FAIL, for ACCESS reasons
 *
 * WHY EVERY PROBE CARRIES A POSITIVE CONTROL. An earlier version of this probe ran its reads
 * through execFileSync('cmd', ['/c', ...]), which mangled quoted Windows paths - so an existing
 * file reported MISSING, every probe returned DENIED, and the run printed "a real permission
 * boundary exists". A broken probe denies everything. The control is what separates "denied"
 * from "the probe cannot read anything". If the control fails, the rest of the line is void.
 *
 * WHY IT JUDGES ON CONTENT, NOT EXIT CODES. Same reason as d2Recovery: a command's status is
 * not evidence about state. A read counts as permitted only when the expected BYTES come back,
 * and as denied only on EPERM/EACCES - ENOENT is a missing file, which is a different claim.
 *
 * THE ORDER THE CAMPAIGN MUST USE, and this test pins it:
 *     capture -> VERIFY (needs read) -> LOCK
 * Locking denies READ only, so the hub can still write later captures while nothing on this
 * host can read any of them back. Recovery becomes an offline act by someone with different
 * access - which is the correct shape for an audit artifact. It is deliberately NOT a recovery
 * resource for either arm.
 */
import { exec as execCb, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const exec = promisify(execCb);
const { quarantine, lockAuditDir, modelEnv, treeOf } = await import('./d2.js');

let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };

const USER = process.env.USERNAME || process.env.USER;
const BASE = mkdtempSync(join(tmpdir(), 'd2acc-'));
const WS = join(BASE, 'ws');
const OTHER = join(BASE, 'other-run-repo');       // "another run's repository"
mkdirSync(WS); mkdirSync(OTHER);
const git = (...a) => execFileSync('git', ['-C', WS, ...a], { encoding: 'utf8' }).trim();

/**
 * Run a command the way the MODEL's run_command does - shell, workspace cwd, stripped env.
 * Probing through any other path measures a different thing than the one at risk.
 */
const asModel = async (cmd) => {
  try {
    const { stdout, stderr } = await exec(cmd, { cwd: WS, timeout: 20_000, windowsHide: true, env: modelEnv() });
    return String(stdout) + String(stderr);
  } catch (e) { return String(e.stdout || '') + String(e.stderr || e.message || ''); }
};
const readFileAsModel = (p) =>
  asModel(`node -e "try{process.stdout.write(require('fs').readFileSync(process.argv[1],'utf8'))}catch(e){process.stdout.write('ERRNO:'+e.code)}" "${p}"`);
const listDirAsModel = (p) =>
  asModel(`node -e "try{process.stdout.write(require('fs').readdirSync(process.argv[1]).join(','))}catch(e){process.stdout.write('ERRNO:'+e.code)}" "${p}"`);

const DENIED = (s) => /ERRNO:(EPERM|EACCES)/.test(s);

let auditDir = null;
const dirsToUnlock = [];
try {
  // ── fixture: a workspace with a candidate worth preserving ──
  git('init', '-q');
  writeFileSync(join(WS, 'package.json'), '{"name":"fx","type":"commonjs"}\n', 'utf8');
  writeFileSync(join(WS, 'allowed.txt'), 'WORKSPACE_CONTENT\n', 'utf8');
  writeFileSync(join(WS, 'newwork.js'), 'module.exports = { valuable: true };\n', 'utf8');
  git('add', '-A'); git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'candidate');
  const CAND = git('rev-parse', 'HEAD');
  // a second run's repository, which this run must also not be able to read
  execFileSync('git', ['-C', OTHER, 'init', '-q'], { encoding: 'utf8' });
  writeFileSync(join(OTHER, 'other-secret.txt'), 'OTHER_RUN_CONTENT\n', 'utf8');

  // ── 1. capture, and VERIFY IT BEFORE LOCKING (verification needs read) ──
  console.log('=== 1. capture and verify, while the store is still readable ===');
  const q = await quarantine(WS, 'run-acc', CAND);
  say(q.ok, `quarantine succeeded and self-verified (${q.ok ? q.bundle : q.error})`);
  say(q.tree === await treeOf(WS, CAND), 'the audit artifact holds the candidate tree');
  auditDir = q.dir;

  // ── 2. BEFORE the lock: everything is readable. This is the state being fixed. ──
  console.log('\n=== 2. before the lock - discoverability alone is NOT access control ===');
  const b0 = await readFileAsModel(join(WS, 'allowed.txt'));
  const b1 = await readFileAsModel(q.bundle);
  say(b0.includes('WORKSPACE_CONTENT'), 'positive control: the workspace read succeeds');
  say(!DENIED(b1), 'and the audit bundle IS readable by a model command that knows the path');
  console.log('      ^ an external directory and a stripped env var hide it; they do not deny it.');

  // ── 3. LOCK, then probe. Positive control repeated in the NEW state. ──
  console.log('\n=== 3. after the lock - permitted reads succeed, audit reads are denied ===');
  const lock = await lockAuditDir(auditDir);
  say(lock.ok, `the deny ACE was applied AND proven by a failing read (${lock.ok ? lock.code : lock.error})`);

  const a0 = await readFileAsModel(join(WS, 'allowed.txt'));
  say(a0.includes('WORKSPACE_CONTENT'),
    'POSITIVE CONTROL: the permitted workspace read still succeeds - the probe is not broken');
  // Everything below is only meaningful because the line above passed.
  const a1 = await readFileAsModel(q.bundle);
  say(DENIED(a1), `KNOWN-PATH read of the audit bundle FAILS for an access reason (${a1.trim().slice(0, 40)})`);
  const a2 = await listDirAsModel(auditDir);
  say(DENIED(a2), `listing the audit directory FAILS for an access reason (${a2.trim().slice(0, 40)})`);
  // ENOENT would mean "missing", which is a DIFFERENT claim and must not pass as denial.
  say(!/ERRNO:ENOENT/.test(a1 + a2), 'and the failure is DENIAL, not absence - ENOENT would be a different claim');

  // ── 4. the artifact is not reachable as a git OBJECT either ──
  console.log('\n=== 4. not reachable through git, either ===');
  const cloned = await asModel(`git clone -q "${q.bundle}" recovered 2>&1 || echo CLONE_FAILED`);
  say(/CLONE_FAILED|denied|Permission|cannot|fatal/i.test(cloned), 'a model-issued clone of the audit bundle fails');
  const refs = git('show-ref');
  say(!/legasus-audit/.test(refs), 'no workspace ref points at the audit branch');

  // ── 5. A LATER RUN CAN STILL CAPTURE while this one stays locked ──
  // This is the property the per-run directory exists for. A single shared audit directory
  // would deny the next run's `bundle verify` too, and unlocking to capture would re-expose
  // every earlier artifact for the duration of that capture.
  console.log('\n=== 5. a later run still captures, and this one stays locked ===');
  const q2 = await quarantine(WS, 'run-acc-2', CAND);
  say(q2.ok, `the NEXT run's capture succeeds and self-verifies while run-acc is denied (${q2.ok ? 'ok' : q2.error})`);
  say(q2.dir !== q.dir, 'and it lands in its own directory, so locking it cannot touch run-acc');
  const still = await readFileAsModel(q.bundle);
  say(DENIED(still), "run-acc's artifact was never unlocked to let that capture happen");
  const lock2 = await lockAuditDir(q2.dir);
  dirsToUnlock.push(q2.dir);
  say(lock2.ok, `the later capture locks independently (${lock2.ok ? lock2.code : lock2.error})`);
  const a3 = await readFileAsModel(q2.bundle);
  say(DENIED(a3), 'and it is denied too - each capture is sealed as soon as it is verified');

  // ── 6. SYMMETRY: the same procedure applies to another run's repository ──
  console.log('\n=== 6. the same lock denies another run\'s repository ===');
  const o0 = await readFileAsModel(join(OTHER, 'other-secret.txt'));
  say(!DENIED(o0), 'before: this run can read the other run\'s repository (the leak being closed)');
  const oLock = await lockAuditDir(OTHER);
  say(oLock.ok, `the other run's repository locks by the same procedure (${oLock.ok ? oLock.code : oLock.error})`);
  const oc = await readFileAsModel(join(WS, 'allowed.txt'));
  say(oc.includes('WORKSPACE_CONTENT'), 'POSITIVE CONTROL: the workspace read still succeeds');
  const o1 = await readFileAsModel(join(OTHER, 'other-secret.txt'));
  say(DENIED(o1), `after: the other run's repository is denied (${o1.trim().slice(0, 40)})`);
} finally {
  // Unlock before cleanup, or the temp tree cannot be removed.
  for (const d of [auditDir, ...dirsToUnlock, OTHER, BASE]) {
    if (!d) continue;
    try { execFileSync('icacls', [d, '/remove:d', USER, '/T'], { windowsHide: true, stdio: 'ignore' }); } catch { /* best effort */ }
  }
  try { rmSync(BASE, { recursive: true, force: true }); } catch { /* best effort */ }
}

console.log(`\n  d2 access boundary: ${passed} passed, ${failed} failed -> ${failed ? 'NO QUALIFIED BOUNDARY - DO NOT RUN THE CAMPAIGN' : 'access boundary qualified'}`);
process.exit(failed ? 1 : 0);
