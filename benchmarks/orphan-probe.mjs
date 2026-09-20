// DOES A CHILD SURVIVE ITS PARENT EXITING ON THIS BOX?
//
// Asked because taskkill-survival.mjs could not set up the state it wanted to test: its leaf was already
// dead by the time the parent exited, so the orphan the experiment needed never existed. That refusal
// was correct, and it left a sharper question behind — because 263 witness processes WERE observed
// alive with "(parent gone)" earlier today. Both cannot be true of the same machine without a
// distinguishing condition, so the condition is what this measures.
//
// Three spawn modes, otherwise identical:
//   plain     stdio inherited from the parent
//   detached  detached:true + unref()
//   piped     stdio piped rather than inherited (the child holds no handle of the grandparent's)
//
// SAFETY: every kill is BY PID against a pid this file spawned. No kill by image name.
import { spawn, execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const NL = String.fromCharCode(10);
const dir = mkdtempSync(join(tmpdir(), 'orph-'));

const alive = (pid) => {
  if (!pid) return null;                 // NOT false: an unmeasured pid is not a dead one
  try {
    return /node\.exe/i.test(execFileSync('tasklist', ['/FI', 'PID eq ' + pid, '/NH'],
      { encoding: 'utf8', timeout: 15000, windowsHide: true }));
  } catch (e) { return null; }
};
const killPid = (pid) => {
  if (!pid) return;
  try { execFileSync('taskkill', ['/PID', String(pid), '/F'],
    { stdio: 'ignore', timeout: 20000, windowsHide: true }); } catch (e) { /* already gone */ }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

writeFileSync(join(dir, 'leaf.mjs'),
  ['import { writeFileSync } from "node:fs";',
    '// the leaf reports through a FILE, not through the pipe it may or may not hold - otherwise the',
    '// measurement depends on the very handle under test',
    'writeFileSync(process.argv[2], String(process.pid), "utf8");',
    'setInterval(() => {}, 100000);'].join(NL), 'utf8');

writeFileSync(join(dir, 'mid.mjs'),
  ['import { spawn } from "node:child_process";',
    'import { join, dirname } from "node:path";',
    'import { fileURLToPath } from "node:url";',
    'const here = dirname(fileURLToPath(import.meta.url));',
    'const mode = process.argv[2];',
    'const out = process.argv[3];',
    'const opts = mode === "piped" ? { stdio: "pipe" } : { stdio: "inherit" };',
    'if (mode === "detached") { opts.detached = true; }',
    'const leaf = spawn(process.execPath, [join(here, "leaf.mjs"), out], opts);',
    'if (mode === "detached") leaf.unref();',
    'setTimeout(() => process.exit(0), 600);'].join(NL), 'utf8');

async function probe(mode) {
  const out = join(dir, 'pid-' + mode + '.txt');
  const mid = spawn(process.execPath, [join(dir, 'mid.mjs'), mode, out],
    { stdio: ['ignore', 'inherit', 'ignore'] });

  await sleep(1500);
  let leaf = null;
  try { const v = Number(readFileSync(out, 'utf8')); if (Number.isFinite(v) && v > 0) leaf = v; }
  catch (e) { leaf = null; }

  const midAliveBefore = alive(mid.pid);
  await sleep(1500);                       // mid exits at 600ms; it is gone by now
  const midAliveAfter = alive(mid.pid);

  const checks = [];
  for (let i = 0; i < 4; i++) { checks.push(alive(leaf)); await sleep(800); }

  killPid(leaf); killPid(mid.pid);
  return { mode, leafPid: leaf, midAliveBefore, midAliveAfter, checks };
}

console.log('DOES A CHILD SURVIVE ITS PARENT EXITING?   (leaf reports its pid via a FILE, not the pipe)');
console.log('');
for (const mode of ['plain', 'detached', 'piped']) {
  const r = await probe(mode);
  if (r.leafPid === null) {
    console.log('  ' + mode.padEnd(9) + 'INADMISSIBLE - the leaf never reported a pid, so nothing is'
      + ' established for this mode');
    continue;
  }
  console.log('  ' + mode.padEnd(9) + 'leaf ' + String(r.leafPid).padEnd(7)
    + 'mid alive before/after its exit: ' + r.midAliveBefore + '/' + r.midAliveAfter
    + '   leaf alive at +0.0/0.8/1.6/2.4s: ' + r.checks.join(' '));
}
console.log('');
console.log('null means UNMEASURED, not dead - an instrument that could not answer is not a corpse.');
rmSync(dir, { recursive: true, force: true });
