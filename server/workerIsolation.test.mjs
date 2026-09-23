/**
 * workerIsolation.test.mjs - QUALIFY THE ISOLATED EXECUTION ENVIRONMENT.
 *
 *   node server/workerIsolation.test.mjs
 *
 * The campaign may not start on this laptop until this passes. Small and decisive, through the
 * ACTUAL agent command route:
 *
 *     permitted workspace operations              SUCCEED
 *     known-path audit reads                      FAIL
 *     cross-run reads                             FAIL
 *     attempts to REMOVE those restrictions       FAIL
 *
 * THE NEGATIVE CONTROL IS THE DEMONSTRATED BYPASS. Section 5 runs the same-user ACL revoke on
 * the host - the one that WORKED - and requires it to work again. Without it, "the worker could
 * not read the audit store" is indistinguishable from "this probe cannot read anything", which
 * is the exact failure that once printed "a real permission boundary exists" over a mangled
 * command. A boundary claim needs a demonstration that the probe can still detect success.
 *
 * ENOENT IS THE RIGHT SIGNAL HERE, AND THAT IS NOT A CONTRADICTION. d2Access had to reject
 * ENOENT because it was denying reads of a path that existed; absence there would have meant a
 * broken probe. This mechanism is different in kind: the audit store is NOT PRESENT in the
 * worker's filesystem namespace at all. Absence is the isolation. It only counts as isolation
 * because section 4 also shows the worker cannot MAKE the path appear - no mount, no docker
 * socket, no network. Absence plus inability to obtain is the claim; absence alone would not be.
 *
 * NOT CLAIMED: container escape resistance against a kernel-level attack. The claim is scoped to
 * what the campaign needs - an agent command route that cannot reach host audit storage, other
 * runs, or credentials.
 */
import { exec as execCb, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const exec = promisify(execCb);
const { runInWorker, workerArgs, workerAvailable, WORKER_IMAGE } = await import('./worker.js');
const { quarantine, lockAuditDir, unlockAuditDir, modelEnv } = await import('./d2.js');

let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };
const note = (m) => console.log(`        ${m}`);

const USER = process.env.USERNAME || process.env.USER;
const BASE = mkdtempSync(join(tmpdir(), 'wiso-'));
const WS = join(BASE, 'ws');
const OTHER = join(BASE, 'other-run-repo');
mkdirSync(WS); mkdirSync(OTHER);
const git = (...a) => execFileSync('git', ['-C', WS, ...a], { encoding: 'utf8' }).trim();

/** A host-side command as the model USED to run them - kept only as the negative control. */
const asHostUser = async (cmd) => {
  try { const { stdout, stderr } = await exec(cmd, { cwd: WS, timeout: 30_000, windowsHide: true, env: modelEnv() }); return String(stdout) + String(stderr); }
  catch (e) { return String(e.stdout || '') + String(e.stderr || e.message || ''); }
};

const cleanup = [];
try {
  // ── 0. the environment must exist before anything below means anything ──
  console.log('=== 0. is an isolated worker available? ===');
  const avail = await workerAvailable();
  say(avail.ok, avail.ok ? `docker server ${avail.server}` : `NO ISOLATED WORKER: ${avail.error}`);
  if (!avail.ok) {
    console.log('\n  The campaign may not run without this. Reporting the concrete requirement');
    console.log('  rather than substituting another cosmetic restriction.');
    console.log(`\n  worker isolation: ${passed} passed, ${failed} failed -> NO ISOLATED ENVIRONMENT`);
    process.exit(1);
  }

  // fixture: a workspace, an audit capture on the HOST, and another run's repository
  git('init', '-q');
  writeFileSync(join(WS, 'package.json'), '{"name":"fx","type":"commonjs"}\n', 'utf8');
  writeFileSync(join(WS, 'allowed.txt'), 'WORKSPACE_CONTENT\n', 'utf8');
  writeFileSync(join(WS, 'secret_work.js'), 'module.exports = { CANARY: true };\n', 'utf8');
  git('add', '-A'); git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'candidate');
  const CAND = git('rev-parse', 'HEAD');
  execFileSync('git', ['-C', OTHER, 'init', '-q'], { encoding: 'utf8' });
  writeFileSync(join(OTHER, 'other-secret.txt'), 'OTHER_RUN_CANARY\n', 'utf8');

  const q = await quarantine(WS, 'run-iso', CAND);
  cleanup.push(q.dir);
  say(q.ok, `a real audit capture exists on the host (${q.ok ? 'ok' : q.error})`);

  // ── 1. the flags that ARE the boundary, asserted on the real argument list ──
  console.log('\n=== 1. the boundary is in the actual argument list, not in a comment ===');
  const args = workerArgs(WS, 'true');
  const has = (f, v) => { const i = args.indexOf(f); return i >= 0 && (v === undefined || args[i + 1] === v); };
  say(has('--network', 'none'), '--network none: no credentials, no APIs, no remote fetch');
  say(has('--cap-drop', 'ALL') && has('--security-opt', 'no-new-privileges'), 'capabilities dropped, no privilege escalation');
  const mounts = args.filter((a, i) => args[i - 1] === '-v');
  say(mounts.length === 1 && mounts[0] === `${WS}:/work`, `exactly ONE mount, the workspace (${mounts.join(' ') || 'none'})`);
  say(!args.some((a) => /docker\.sock|\/\/\.\/pipe\/docker/.test(a)), 'no docker socket is mounted - no control-plane escape');

  // ── 2. PERMITTED WORKSPACE OPERATIONS SUCCEED (the positive control) ──
  console.log('\n=== 2. POSITIVE CONTROL: permitted workspace operations succeed ===');
  const r = await runInWorker(WS, 'cat allowed.txt');
  say(r.out.includes('WORKSPACE_CONTENT'), 'the worker READS a workspace file');
  const w = await runInWorker(WS, 'printf WORKER_WROTE_THIS > from_worker.txt && cat from_worker.txt');
  say(w.out.includes('WORKER_WROTE_THIS'), 'the worker WRITES, and the write is visible to it');
  say(existsSync(join(WS, 'from_worker.txt')), 'and the write landed in the real workspace on the host - this is a working agent, not a sealed box');
  const n = await runInWorker(WS, 'node -e "console.log(2+2)"');
  say(n.out.includes('4'), 'the worker runs its required tools');
  note('Everything below is only meaningful because these four passed.');

  // ── 3. AUDIT STORAGE AND OTHER RUNS ARE NOT REACHABLE ──
  console.log('\n=== 3. known-path audit reads and cross-run reads FAIL ===');
  const bundleIn = q.bundle.replace(/\\/g, '/');
  const a1 = await runInWorker(WS, `cat "${bundleIn}" 2>&1; ls "${q.dir.replace(/\\/g, '/')}" 2>&1`);
  say(!/PACK|v2 git bundle/.test(a1.out), `the known audit path yields nothing (${a1.out.replace(/\s+/g, ' ').trim().slice(0, 60)})`);
  const a2 = await runInWorker(WS, `cat "${join(OTHER, 'other-secret.txt').replace(/\\/g, '/')}" 2>&1`);
  say(!a2.out.includes('OTHER_RUN_CANARY'), 'another run\'s repository yields nothing');
  // The host's drive must not be present under any of the usual container mount points either.
  const a3 = await runInWorker(WS, 'ls / 2>&1; ls /mnt 2>&1; ls /host_mnt 2>&1; ls /c 2>&1');
  say(!/Users/.test(a3.out), 'the host filesystem is not mounted anywhere the worker can see');
  note(`worker root: ${a3.out.replace(/\s+/g, ' ').trim().slice(0, 90)}`);

  // ── 4. ATTEMPTS TO REMOVE THE RESTRICTION FAIL ──
  // Absence is only isolation if the worker cannot make the path appear. This is the section
  // that distinguishes this mechanism from the ACL one it replaces.
  console.log('\n=== 4. the worker cannot LIFT the restriction ===');
  const m1 = await runInWorker(WS, 'mount -t tmpfs none /mnt 2>&1 || echo MOUNT_REFUSED');
  say(/MOUNT_REFUSED|denied|not permitted|must be superuser|Operation not permitted/i.test(m1.out), `it cannot mount (${m1.out.replace(/\s+/g, ' ').trim().slice(0, 60)})`);
  const m2 = await runInWorker(WS, 'which docker || echo NO_DOCKER_CLI; ls /var/run/docker.sock 2>&1 || echo NO_SOCKET');
  say(/NO_DOCKER_CLI/.test(m2.out) && /NO_SOCKET|No such file/.test(m2.out), 'it has no docker CLI and no socket - it cannot start a privileged sibling');
  const m3 = await runInWorker(WS, 'id -u; su -c id root 2>&1 || echo NO_ROOT');
  say(!/^0$/m.test(m3.out.split('\n')[0] || ''), `it does not run as root (uid ${(m3.out.split('\n')[0] || '?').trim()})`);
  const m4 = await runInWorker(WS, 'wget -qO- http://example.com 2>&1 || curl -s http://example.com 2>&1 || echo NO_NETWORK');
  say(/NO_NETWORK|bad address|not resolve|unreachable|not found/i.test(m4.out), 'it has no network, so it cannot fetch a credential or call an API');

  // ── 5. NEGATIVE CONTROL: the demonstrated bypass still works on the host ──
  // This is preserved deliberately. If the ACL revoke stopped working, every "FAIL" above could
  // be a broken probe rather than a boundary.
  console.log('\n=== 5. NEGATIVE CONTROL: the same-user bypass, which WORKED, still works ===');
  const sealed = await lockAuditDir(q.dir);
  say(sealed.ok, `the host capture is sealed again (${sealed.ok ? sealed.code : sealed.error})`);
  await asHostUser(`icacls "${q.dir}" /remove:d "${USER}" 2>&1 & icacls "${q.dir}" /remove:d "${USER}" /T 2>&1`);
  const bypassed = existsSync(q.bundle);
  say(bypassed, bypassed
    ? 'a HOST-USER command still revokes the lock and reaches the capture - so the probes above detect success when it exists'
    : 'the known bypass did NOT reproduce - the negative control is broken, and nothing above can be trusted');
  note('The worker cannot do this because the path is not in its namespace at all,');
  note('and section 4 shows it cannot put it there.');
} finally {
  for (const d of cleanup) { try { await unlockAuditDir(d); } catch { /* best effort */ } }
  try { rmSync(BASE, { recursive: true, force: true }); } catch { /* best effort */ }
}

console.log(`\n  worker isolation (${WORKER_IMAGE}): ${passed} passed, ${failed} failed -> ${failed ? 'ISOLATION NOT QUALIFIED - the campaign may not start' : 'isolated execution environment qualified'}`);
process.exit(failed ? 1 : 0);
