/**
 * hubWorker.test.mjs - DOES THE REAL HUB CONSISTENTLY USE THE WORKER?
 *
 *   node server/hubWorker.test.mjs
 *
 * workerIsolation.test.mjs qualified the worker CONFIGURATION. That is a different claim from
 * "the Hub actually routes through it", and only the second one protects the campaign. This
 * drives the Hub's own tools.
 *
 * THE FROZEN RULE UNDER TEST: worker failure is an EXECUTION ERROR, never permission to retry
 * on the host. So an unavailable worker must produce an infrastructure error AND NO HOST-SIDE
 * EFFECT - asserted by looking for a marker file the command would have created had it leaked
 * onto the host, not by reading the error message.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };
const note = (m) => console.log(`        ${m}`);

/**
 * Call a Hub tool the way the run loop does - through agent.js's own `callTool`, in a child
 * process so AGENT_WORKSPACE and the campaign flags bind at import.
 */
function callTool(ws, tool, args, env = {}) {
  const src = `const m = await import(${JSON.stringify('file:///' + join(HERE, 'agent.js').replace(/\\/g, '/'))});
const r = await m.__toolPolicyTest.callTool(${JSON.stringify(tool)}, ${JSON.stringify(args)});
process.stdout.write(String(r));`;
  try {
    return execFileSync(process.execPath, ['--input-type=module', '-e', src], {
      encoding: 'utf8', timeout: 180_000,
      env: { ...process.env, AGENT_WORKSPACE: ws, AGENT_WORKER_EXEC: '1', AGENT_APPROVAL_MODE: 'build', ...env },
    });
  } catch (e) { return String(e.stdout || '') + String(e.stderr || e.message || ''); }
}

const BASE = mkdtempSync(join(tmpdir(), 'hubwk-'));
const WS = join(BASE, 'ws');
mkdirSync(WS, { recursive: true });
try {
  // ── 1. a real Hub command writes a marker THROUGH the worker ──
  console.log('=== 1. Hub -> worker -> result, and the workspace really changed ===');
  const out = callTool(WS, 'run_command', { cmd: 'printf MARKER_FROM_WORKER > marker.txt; cat marker.txt' });
  say(/MARKER_FROM_WORKER/.test(out), `the Hub returned the worker's output (${out.replace(/\s+/g, ' ').trim().slice(0, 60)})`);
  const landed = existsSync(join(WS, 'marker.txt')) && readFileSync(join(WS, 'marker.txt'), 'utf8').includes('MARKER_FROM_WORKER');
  say(landed, 'and the INTENDED WORKSPACE changed on the host - the mount round-trips');
  say(!/docker run|--network|--cap-drop/.test(out), 'the result does not expose docker\'s host-side argv');

  // ── 2. it really went through the worker, not the host ──
  // The container is alpine with uid 1000; the host is Windows as the hub user. Asking the
  // command itself where it ran is stronger than trusting the flag.
  console.log('\n=== 2. the command ran in the container, not on the host ===');
  const who = callTool(WS, 'run_command', { cmd: 'uname -s; id -u' });
  say(/Linux/.test(who), `uname reports Linux, so this is not the Windows host (${who.replace(/\s+/g, ' ').trim().slice(0, 40)})`);
  say(/\b1000\b/.test(who), 'and it ran as the non-root worker user');

  // ── 3. run_python works, because the image actually has Python ──
  // Node being present does not imply Python: the previous pinned image reported NO_PYTHON.
  console.log('\n=== 3. run_python has a Python in the pinned image ===');
  writeFileSync(join(WS, 'calc.py'), 'print(6 * 7)\n', 'utf8');
  const py = callTool(WS, 'run_python', { path: 'calc.py' });
  say(/\b42\b/.test(py), `run_python executed in the worker (${py.replace(/\s+/g, ' ').trim().slice(0, 60)})`);

  // ── 4. dependencies resolve WITHOUT network, identically ──
  // They are baked into the image, so both arms get the same layer rather than two fetches.
  console.log('\n=== 4. dependencies are present under --network none ===');
  const deps = callTool(WS, 'run_command', { cmd: 'node -v; python3 -V; git --version' });
  say(/v22\./.test(deps) && /Python 3/.test(deps) && /git version/.test(deps), `node, python3 and git all resolve offline (${deps.replace(/\s+/g, ' ').trim().slice(0, 70)})`);
  const net = callTool(WS, 'run_command', { cmd: 'wget -qO- http://example.com 2>&1 || echo NO_NETWORK' });
  say(/NO_NETWORK|bad address|not resolve/i.test(net), 'and there is still no network to fetch anything else from');

  // ── 5. AN UNAVAILABLE WORKER: infrastructure error, and NO HOST-SIDE EFFECT ──
  console.log('\n=== 5. worker unavailable -> execution error, never a host retry ===');
  const before = existsSync(join(WS, 'leaked.txt'));
  const broken = callTool(WS, 'run_command', { cmd: 'printf LEAKED_TO_HOST > leaked.txt' },
    { AGENT_WORKER_IMAGE: 'sha256:' + '0'.repeat(64) });
  say(/INFRASTRUCTURE ERROR/.test(broken), `the Hub reports an INFRASTRUCTURE error (${broken.replace(/\s+/g, ' ').trim().slice(0, 70)})`);
  say(/will not help|NOT a failure of your command/.test(broken), 'and tells the model not to retry it as if the command failed');
  // THE LOAD-BEARING ASSERTION: judged on the filesystem, not on the wording of the error.
  const leaked = !before && existsSync(join(WS, 'leaked.txt'));
  say(!leaked, leaked
    ? 'HOST FALLBACK: the command executed on the host after the worker failed'
    : 'NO HOST-SIDE EFFECT: the file the command would have created does not exist');
  say(!/docker run|--network|--cap-drop|C:\\\\Users/.test(broken), 'and the infrastructure error does not leak docker\'s argv or the host path');
  note('Judged by looking for the file, not by reading the message - an error string');
  note('saying "infrastructure" would not prove the command failed to run.');

  // ── 6. the positive control for section 5 ──
  // If the marker command could not create that file even in a WORKING worker, section 5 would
  // pass for the wrong reason.
  console.log('\n=== 6. POSITIVE CONTROL for the no-effect claim ===');
  const ok = callTool(WS, 'run_command', { cmd: 'printf LEAKED_TO_HOST > leaked.txt; cat leaked.txt' });
  say(/LEAKED_TO_HOST/.test(ok) && existsSync(join(WS, 'leaked.txt')),
    'the SAME command does create that file when the worker works - so its absence above means the container was NEVER STARTED (NOT_STARTED, not merely unconfirmed)');
} finally {
  try { rmSync(BASE, { recursive: true, force: true }); } catch { /* best effort */ }
}

console.log(`\n  hub -> worker routing: ${passed} passed, ${failed} failed -> ${failed ? 'ROUTING NOT QUALIFIED' : 'the Hub executes through the worker, with no host fallback'}`);
process.exit(failed ? 1 : 0);
