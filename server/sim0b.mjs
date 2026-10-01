/**
 * sim0b.mjs - runs SIM-0b through EH1: sim0.mjs pointed at sim0b.py. Frozen with SIM-0b_PREREG.md.
 *
 *   SIM0_SUBJECT=<path to slot main.py> SIM0_RUNS=<evidence root> node server/sim0b.mjs
 *
 * The subject is NOT in the repo (no licence found). Its sha256 is checked by sim0.py, which
 * refuses any other file. Python's version is part of the world: random.seed(str) and
 * random.choice are only reproducible within one Python implementation.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openRun, EVIDENCE_CLASS } from './evidenceRun.mjs';

const subject = process.env.SIM0_SUBJECT;
const root = process.env.SIM0_RUNS || join(tmpdir(), 'sim0-runs');
if (!subject) { console.error('SIM0_SUBJECT is required'); process.exit(2); }

const run = openRun({ root, label: 'SIM-0b', command: 'node server/sim0b.mjs', repo: process.cwd(),
  evidenceClass: EVIDENCE_CLASS.ORIGINAL, note: `subject ${subject} (outside the repo)` });
const pyv = spawnSync('python', ['-c', 'import sys,platform;print(sys.version);print(platform.python_implementation())'], { encoding: 'utf8' });
run.artifact('python.txt', pyv.stdout);
const out = join(mkdtempSync(join(tmpdir(), 'sim0b-')), 'results.json');
const r = spawnSync('python', ['server/sim0b.py', subject, out], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 26 });
run.artifact('stdout.txt', r.stdout || '');
run.artifact('stderr.txt', r.stderr || '');
if (r.status === 0) run.artifact('results.json', readFileSync(out, 'utf8'));
run.seal({ exitStatus: r.status ?? 1 });
console.log(r.stdout); if (r.stderr) console.error(r.stderr);
console.log(`EH1 ${run.id}  exit ${r.status}`);
process.exit(r.status ?? 1);
