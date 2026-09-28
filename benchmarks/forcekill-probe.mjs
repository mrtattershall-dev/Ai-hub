// DOES `taskkill /T /F` REACH A LIVE, NON-DETACHED GRANDCHILD? — question (c), for the BIND-1 session.
//
// Their case, as they describe it: a root force-killed by taskkill /T /F, whose GRANDCHILD hub inherited
// pipe ends from the test's own pipes. No `detached: true` anywhere under server/. The test was healthy
// at the 180s budget — exitCode 1, signal null, timedOut true, normal `ok` lines to the tail — so nothing
// hung; something merely outlived the kill and kept `close` open for ~50 minutes.
//
//   leaf SURVIVES  -> /T is not walking to it, and record-every-pid-and-sweep is the only bound
//   leaf DIES      -> the holder came from another lineage and it is not their apparatus
//
// This differs from orphan-probe.mjs in the one variable that matters: the parent is FORCE-KILLED rather
// than exiting normally, and every process is alive at the moment of the kill. It also varies the
// grandchild's stdio between piped (their configuration) and inherited, because the earlier probe showed
// stdio to be irrelevant to survival and that must not be assumed to carry over to a different mechanism.
//
// DIRECT EVIDENCE, not just inference: taskkill /T prints one line per pid it terminates. That output is
// captured, so the question "did the walk reach the grandchild" is answered by the walk itself and not
// only by a corpse count afterwards.
//
// SAFETY: every kill is BY PID against a pid this file spawned. No kill by image name, anywhere.
import { spawn, execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const NL = String.fromCharCode(10);
const dir = mkdtempSync(join(tmpdir(), 'fk-'));

const alive = (pid) => {
  if (!pid) return null;                          // null = UNMEASURED, not dead
  try {
    return /node\.exe/i.test(execFileSync('tasklist', ['/FI', 'PID eq ' + pid, '/NH'],
      { encoding: 'utf8', timeout: 15000, windowsHide: true }));
  } catch (e) { return null; }
};
const killPid = (pid) => {
  if (!pid) return;
  try { execFileSync('taskkill', ['/PID', String(pid), '/F'],
    { stdio: 'ignore', timeout: 20000, windowsHide: true }); } catch (e) { /* gone */ }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readPid = (f) => {
  try { const v = Number(readFileSync(f, 'utf8')); return Number.isFinite(v) && v > 0 ? v : null; }
  catch (e) { return null; }
};

// Each level reports its pid through a FILE. Reporting up a pipe would make the measurement depend on
// the very handle under test.
writeFileSync(join(dir, 'leaf.mjs'),
  ['import { writeFileSync } from "node:fs";',
    'writeFileSync(process.argv[2], String(process.pid), "utf8");',
    'setInterval(() => {}, 100000);'].join(NL), 'utf8');

writeFileSync(join(dir, 'mid.mjs'),
  ['import { spawn } from "node:child_process";',
    'import { writeFileSync } from "node:fs";',
    'import { join, dirname } from "node:path";',
    'import { fileURLToPath } from "node:url";',
    'const here = dirname(fileURLToPath(import.meta.url));',
    'const [, , mode, leafOut, midOut] = process.argv;',
    '// their hub: stdio ["ignore","pipe","pipe"], NO detached flag',
    'const opts = mode === "piped" ? { stdio: ["ignore", "pipe", "pipe"] } : { stdio: "inherit" };',
    'spawn(process.execPath, [join(here, "leaf.mjs"), leafOut], opts);',
    'writeFileSync(midOut, String(process.pid), "utf8");',
    'setInterval(() => {}, 100000);'].join(NL), 'utf8');

writeFileSync(join(dir, 'root.mjs'),
  ['import { spawn } from "node:child_process";',
    'import { join, dirname } from "node:path";',
    'import { fileURLToPath } from "node:url";',
    'const here = dirname(fileURLToPath(import.meta.url));',
    'const [, , mode, leafOut, midOut] = process.argv;',
    'spawn(process.execPath, [join(here, "mid.mjs"), mode, leafOut, midOut], { stdio: "inherit" });',
    'setInterval(() => {}, 100000);'].join(NL), 'utf8');

async function probe(mode) {
  const leafOut = join(dir, 'leaf-' + mode + '.txt');
  const midOut = join(dir, 'mid-' + mode + '.txt');
  const root = spawn(process.execPath, [join(dir, 'root.mjs'), mode, leafOut, midOut],
    { stdio: ['ignore', 'pipe', 'pipe'] });

  let closedAt = null;
  const t0 = Date.now();
  root.on('close', () => { closedAt = Date.now() - t0; });

  for (let i = 0; i < 25 && !(existsSync(leafOut) && existsSync(midOut)); i++) await sleep(300);
  const mid = readPid(midOut);
  const leaf = readPid(leafOut);

  // PRECONDITION: all three must be ALIVE at the moment of the kill, or the question is not being asked.
  const before = { root: alive(root.pid), mid: alive(mid), leaf: alive(leaf) };
  const admissible = before.root === true && before.mid === true && before.leaf === true;

  let killOut = '';
  if (admissible) {
    try {
      killOut = execFileSync('taskkill', ['/PID', String(root.pid), '/T', '/F'],
        { encoding: 'utf8', timeout: 20000, windowsHide: true });
    } catch (e) { killOut = String((e && (e.stdout || e.message)) || e); }
  }
  await sleep(3000);
  const after = { root: alive(root.pid), mid: alive(mid), leaf: alive(leaf) };
  await sleep(2000);

  for (const p of [leaf, mid, root.pid]) if (alive(p)) killPid(p);
  return { mode, pids: { root: root.pid, mid, leaf }, before, after, admissible,
    killOut: killOut.trim(), closeFired: closedAt !== null, closedAt };
}

console.log('DOES taskkill /T /F REACH A LIVE NON-DETACHED GRANDCHILD?');
console.log('root -> mid -> leaf, all alive, none detached. Every kill is BY PID.');
console.log('');

for (const mode of ['piped', 'inherit']) {
  const r = await probe(mode);
  console.log('  grandchild stdio: ' + mode.toUpperCase()
    + (mode === 'piped' ? '   <- their hub configuration' : ''));
  console.log('    pids               root ' + r.pids.root + '  mid ' + r.pids.mid
    + '  leaf ' + r.pids.leaf);
  if (!r.admissible) {
    console.log('    INADMISSIBLE - not all three were alive at the kill: root=' + r.before.root
      + ' mid=' + r.before.mid + ' leaf=' + r.before.leaf);
    console.log('');
    continue;
  }
  console.log('    alive AFTER /T /F  root=' + r.after.root + ' mid=' + r.after.mid
    + ' leaf=' + r.after.leaf);
  console.log('    parent close       ' + (r.closeFired ? 'fired (' + r.closedAt + 'ms)'
    : 'NEVER FIRED  <- stdio still held by something'));
  console.log('    taskkill said:');
  for (const line of r.killOut.split(/\r?\n/).filter(Boolean)) console.log('      ' + line);
  console.log('    VERDICT: ' + (r.after.leaf === true
    ? 'GRANDCHILD SURVIVED - /T did not walk to it; record-every-pid-and-sweep is the only bound'
    : r.after.leaf === false
      ? 'grandchild DIED - /T reached it; the 50-minute holder came from another lineage'
      : 'UNMEASURED - no claim'));
  console.log('');
}

rmSync(dir, { recursive: true, force: true });
console.log('cleanup: every spawned pid killed by pid');
