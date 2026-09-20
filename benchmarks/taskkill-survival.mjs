// WHAT SURVIVES `taskkill /T /F` ON THIS BOX — characterised, for the BIND-1 session.
//
// Symptom reported: runLifecycle.test.mjs hit its 180s budget, taskkill /T /F fired, and the `close`
// event still took ~50 MINUTES. Something holding stdio outlived the tree kill.
//
// THE HYPOTHESIS, stated before the run:
//
//     taskkill /T walks the CURRENT parent-PID chain. If an intermediate process has already EXITED,
//     its child cannot be reached from the root and survives. Holding an inherited stdio pipe, it then
//     keeps `close` from firing for as long as it lives.
//
// That would also explain the 263 orphans seen earlier today: "parent gone, child alive" is the same
// state from the other side.
//
// APPARATUS DEFECT IN THE FIRST VERSION, recorded rather than quietly fixed. It spawned mid.mjs AS the
// root, so root and mid were ONE process (the output printed the same pid for both). In the exit
// variant the root therefore died before the kill, and taskkill was aimed at an already-dead pid. It
// printed "hypothesis FALSIFIED"; that reading was unsupported and is withdrawn. A THREE-level tree is
// required for the question to be asked at all: a root that stays, a mid that exits, a leaf that holds
// the pipe.
//
// SAFETY, NOT OPTIONAL ON A SHARED MACHINE. Three sessions and Claude Code itself run node here. Every
// kill is BY PID against a pid this file spawned and recorded. There is no kill by image name anywhere
// in this file and there must never be.
import { spawn, execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const NL = String.fromCharCode(10);
const dir = mkdtempSync(join(tmpdir(), 'tks-'));
const spawned = new Set();

const alive = (pid) => {
  if (!pid) return false;
  try {
    const out = execFileSync('tasklist', ['/FI', 'PID eq ' + pid, '/NH'],
      { encoding: 'utf8', timeout: 15000, windowsHide: true });
    return /node\.exe/i.test(out);
  } catch (e) { return false; }
};

const killPid = (pid, tree) => {                    // BY PID ONLY. Never by name.
  if (!pid) return false;
  try {
    execFileSync('taskkill', tree ? ['/PID', String(pid), '/T', '/F'] : ['/PID', String(pid), '/F'],
      { stdio: 'ignore', timeout: 20000, windowsHide: true });
    return true;
  } catch (e) { return false; }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

writeFileSync(join(dir, 'leaf.mjs'),
  ['process.stdout.write("LEAF " + process.pid + "\\n");',
    'setInterval(() => {}, 100000);'].join(NL), 'utf8');

writeFileSync(join(dir, 'mid.mjs'),
  ['import { spawn } from "node:child_process";',
    'import { join, dirname } from "node:path";',
    'import { fileURLToPath } from "node:url";',
    'const here = dirname(fileURLToPath(import.meta.url));',
    'const stay = process.argv[2] === "stay";',
    'const leaf = spawn(process.execPath, [join(here, "leaf.mjs")], { stdio: "inherit" });',
    'process.stdout.write("MID " + process.pid + " " + leaf.pid + "\\n");',
    '// THE VARIABLE: if mid exits, the leaf is unreachable from the root by parent-pid walk',
    'if (stay) setInterval(() => {}, 100000);',
    'else { leaf.unref(); setTimeout(() => process.exit(0), 600); }'].join(NL), 'utf8');

writeFileSync(join(dir, 'root.mjs'),
  ['import { spawn } from "node:child_process";',
    'import { join, dirname } from "node:path";',
    'import { fileURLToPath } from "node:url";',
    'const here = dirname(fileURLToPath(import.meta.url));',
    'const mid = spawn(process.execPath, [join(here, "mid.mjs"), process.argv[2]],',
    '  { stdio: "inherit" });',
    'process.stdout.write("ROOT " + process.pid + " " + mid.pid + "\\n");',
    'setInterval(() => {}, 100000);'].join(NL), 'utf8');

async function trial(mode) {
  const p = { root: null, mid: null, leaf: null };
  const proc = spawn(process.execPath, [join(dir, 'root.mjs'), mode],
    { stdio: ['ignore', 'pipe', 'ignore'] });
  spawned.add(proc.pid);
  p.root = proc.pid;

  let closedAt = null;
  const t0 = Date.now();
  proc.on('close', () => { closedAt = Date.now() - t0; });

  let buf = '';
  await new Promise((resolve) => {
    proc.stdout.on('data', (b) => {
      buf += String(b);
      const m = buf.match(/MID (\d+) (\d+)/);
      const l = buf.match(/LEAF (\d+)/);
      if (m) { p.mid = Number(m[1]); spawned.add(p.mid); }
      if (l) { p.leaf = Number(l[1]); spawned.add(p.leaf); resolve(); }
    });
    setTimeout(resolve, 10000);
  });

  await sleep(2000);          // let mid exit in the 'exit' variant BEFORE the kill
  const before = { root: alive(p.root), mid: alive(p.mid), leaf: alive(p.leaf) };

  killPid(p.root, true);      // taskkill /PID <root> /T /F
  await sleep(3000);
  const after = { root: alive(p.root), mid: alive(p.mid), leaf: alive(p.leaf) };

  await sleep(2000);
  const closeFired = closedAt !== null;

  for (const q of [p.leaf, p.mid, p.root]) if (alive(q)) killPid(q, false);
  return { mode, p, before, after, closeFired, closedAt };
}

const show = (r) => {
  console.log('  variant: mid ' + (r.mode === 'stay' ? 'STAYS ALIVE' : 'EXITS before the kill'));
  console.log('    pids                root ' + r.p.root + '  mid ' + r.p.mid + '  leaf ' + r.p.leaf);
  console.log('    alive BEFORE kill   root=' + r.before.root + ' mid=' + r.before.mid
    + ' leaf=' + r.before.leaf);
  console.log('    alive AFTER  kill   root=' + r.after.root + ' mid=' + r.after.mid
    + ' leaf=' + r.after.leaf);
  console.log('    parent close fired  ' + r.closeFired
    + (r.closedAt !== null ? '  (' + r.closedAt + 'ms)' : '   <- THE SYMPTOM: stdio still held'));
  console.log('');
};

console.log('WHAT SURVIVES taskkill /PID <root> /T /F   (three-level tree: root -> mid -> leaf)');
console.log('every kill is BY PID, against a pid this file spawned');
console.log('');

const stay = await trial('stay');
show(stay);
const exit = await trial('exit');
show(exit);

console.log('READING:');
// THE PRECONDITION CHECK FIRST. If the leaf was not alive and orphaned before the kill, the question
// was never asked and no reading of the kill is admissible.
if (!exit.before.leaf || exit.before.mid) {
  console.log('  INADMISSIBLE. In the exit variant the leaf was ' + (exit.before.leaf ? '' : 'NOT ')
    + 'alive and the mid was ' + (exit.before.mid ? 'STILL alive' : 'gone') + ' before the kill,');
  console.log('  so the orphan state this experiment needs did not exist. Nothing about taskkill is');
  console.log('  established either way - the apparatus did not set up the condition it tests.');
} else if (exit.after.leaf && !stay.after.leaf) {
  console.log('  CONFIRMED. The leaf survives /T only when the MID HAS ALREADY EXITED. taskkill /T');
  console.log('  walks the CURRENT parent-pid chain, so a process whose parent died first is');
  console.log('  unreachable from the root and is not killed. Holding an inherited stdio pipe it keeps');
  console.log('  `close` open for as long as it lives - the ~50 minutes BIND-1 saw.');
} else if (exit.after.leaf && stay.after.leaf) {
  console.log('  Leaf survives in BOTH variants: orphaning is NOT the discriminator, hypothesis WRONG.');
} else {
  console.log('  /T reached the leaf even when orphaned. Hypothesis FALSIFIED on this box.');
}
console.log('');
console.log('  close fired:  stay=' + stay.closeFired + '  exit=' + exit.closeFired);

for (const q of spawned) if (alive(q)) killPid(q, false);
rmSync(dir, { recursive: true, force: true });
console.log('  cleanup: every spawned pid killed by pid');
