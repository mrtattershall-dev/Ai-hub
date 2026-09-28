// TASK VALIDATION — before any model is asked anything.
//
// Two things must be true of every mutated task, and neither may be assumed:
//
//   1. the mutation APPLIES     the find-string is present exactly once in the real source
//   2. the mutation BITES       the mutated module disagrees with the pristine one on at least one probe
//
// A mutation that applies but changes no observable behaviour is a VOID TASK: the model would be asked to
// fix something that is not broken, and any arm could score it by doing nothing. The non-vacuity law
// applies here too - "all tasks valid" must not be reachable by failing to check.
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { TASKS, ENVELOPE_COUNTS } from './tasks.mjs';
import { locate, applyMutation } from './admission.mjs';
import { makeTally, observed, unobservable, finding, conclude } from '../../legasus/legalabs/nonvacuity.mjs';

const NL = String.fromCharCode(10);
const PRISTINE = 'benchmarks/devrepo/pristine';
const WORK = 'benchmarks/devrepo/.validate';

function callExpr(task, probeIndex) {
  if (task.mutating) {
    const p = task.mutatingProbes[probeIndex];
    return 'a = ' + p.setup + '; m.' + task.fn + '(a, ' + p.args + '); print(repr(a))';
  }
  const args = task.probes[probeIndex].map((x) => JSON.stringify(x)).join(', ');
  return 'print(repr(m.' + (task.call || task.fn) + '(' + args + ')))';
}

// Run one probe against a module directory, returning either the repr or the exception type.
function probe(dir, moduleName, task, i) {
  const mod = moduleName.replace(/\.py$/, '');
  const prog = ['import sys', 'sys.path.insert(0, ' + JSON.stringify(dir) + ')',
    'import ' + mod + ' as m', 'try:', '    ' + callExpr(task, i),
    'except Exception as e:', '    print("RAISED:" + type(e).__name__)'].join(NL);
  try {
    return execFileSync('python', ['-c', prog],
      { encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (e) {
    return 'HARNESS_ERROR:' + String(e.message).split(NL)[0];
  }
}

const tally = makeTally('task validation');
const report = [];

if (existsSync(WORK)) rmSync(WORK, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });
for (const f of ['colorsys.py', 'bisect.py', 'calendar.py', 'textwrap.py', 'statistics.py']) {
  writeFileSync(join(WORK, f), readFileSync(join(PRISTINE, f)));
}

for (const t of TASKS) {
  const mutModule = (t.mutate && t.mutate.module) || t.module;
  if (!t.mutate) {
    // Unmutated tasks are additions, do-not-modify, or unmodellable. They are valid by construction, but
    // recorded so the count is honest.
    report.push({ id: t.id, envelope: t.envelope, kind: t.addition ? 'ADDITION'
      : t.mustNotChange ? 'NO-CHANGE' : t.unmodellable ? 'UNMODELLABLE'
        : t.ambiguous ? 'AMBIGUOUS' : 'OTHER', applies: 'n/a', bites: 'n/a' });
    observed(tally);
    continue;
  }
  const src = readFileSync(join(PRISTINE, mutModule), 'utf8');
  // VIA locate(), which translates an LF anchor into the file's own convention. This validator used a raw
  // string match and therefore only ever worked while the corpus was wrongly normalized to LF. Restoring
  // the corpus to its real CRLF bytes exposed it - a stale checker, not a regression. `run-arms.mjs` used
  // the CRLF-aware path throughout, so Run 0 and Dev 1 are unaffected.
  const occurrences = locate(src, t.mutate.find).count;
  if (occurrences !== 1) {
    unobservable(tally, t.id + ': find-string occurs ' + occurrences + ' times in ' + mutModule);
    report.push({ id: t.id, envelope: t.envelope, kind: 'MUTATION', applies: 'NO (' + occurrences + ')',
      bites: '-' });
    continue;
  }
  writeFileSync(join(WORK, mutModule), applyMutation(src, t.mutate.find, t.mutate.replace).text, 'utf8');

  const oracleModule = t.oracleModule || mutModule;
  const n = t.mutating ? t.mutatingProbes.length : t.probes.length;
  let differs = 0; let harnessErrors = 0;
  for (let i = 0; i < n; i++) {
    const good = probe(PRISTINE, oracleModule, t, i);
    const bad = probe(WORK, oracleModule, t, i);
    if (good.startsWith('HARNESS_ERROR') || bad.startsWith('HARNESS_ERROR')) harnessErrors++;
    else if (good !== bad) differs++;
  }
  writeFileSync(join(WORK, mutModule), src, 'utf8');   // restore for the next task

  if (harnessErrors) {
    unobservable(tally, t.id + ': ' + harnessErrors + ' probe(s) could not be evaluated');
    report.push({ id: t.id, envelope: t.envelope, kind: 'MUTATION', applies: 'yes',
      bites: 'UNKNOWN (' + harnessErrors + ' harness errors)' });
    continue;
  }
  observed(tally);
  // An INERT EDIT SITE is a declared property of the task, not a defect in it: the mutation is supposed
  // to change nothing observable, because the Python source is shadowed by a C accelerator. That is the
  // hazard under test, so it is not counted as a void task - but it IS asserted, so the day CPython stops
  // shipping the accelerator this task fails loudly instead of quietly becoming an ordinary repair.
  if (t.inertEditSite) {
    if (differs !== 0) {
      finding(tally);
      report.push({ id: t.id, envelope: t.envelope, kind: 'INERT-SITE', applies: 'yes',
        bites: differs + '/' + n + '   NO LONGER INERT - the accelerator assumption has changed' });
    } else {
      report.push({ id: t.id, envelope: t.envelope, kind: 'INERT-SITE', applies: 'yes',
        bites: '0/' + n + '   inert as declared' });
    }
    continue;
  }
  if (differs === 0) { finding(tally); }
  report.push({ id: t.id, envelope: t.envelope, kind: 'MUTATION', applies: 'yes',
    bites: differs + '/' + n + (differs === 0 ? '   VOID TASK' : '') });
}

console.log('  TASK VALIDATION — before any model is asked anything');
console.log('');
const v = conclude(tally, {
  clean: 'every task applies and every mutation changes observable behaviour.',
  dirty: (n) => n + ' VOID TASK(S): the mutation changed nothing observable.',
});
console.log(v.text);
console.log('');
console.log('    ' + 'id'.padEnd(6) + 'envelope'.padEnd(11) + 'kind'.padEnd(14)
  + 'applies'.padEnd(10) + 'bites');
for (const r of report) {
  console.log('    ' + r.id.padEnd(6) + r.envelope.padEnd(11) + r.kind.padEnd(14)
    + String(r.applies).padEnd(10) + r.bites);
}
console.log('');
console.log('  ENVELOPE, declared before any run: ' + JSON.stringify(ENVELOPE_COUNTS));
if (!v.ok) process.exit(1);
