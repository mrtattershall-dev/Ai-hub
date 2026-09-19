// REPO C, STAGE 4a — establish the ORACLE before spending any inference.
//
// A task is only scorable if the INDEPENDENT verifier can detect its mutation. Proving the apparatus can
// represent FAIL is a precondition for scoring PASS; a mutation the external verifier cannot see gives a
// free pass to any candidate, including a candidate that changes nothing.
//
// Mutations are applied with the CHECKED mutate() operation, which refuses a patch that matches nothing,
// matches ambiguously, or produces byte-identical output.
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, readdirSync, copyFileSync }
  from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mutate } from '../../legasus/legalabs/mutate.mjs';

const NL = String.fromCharCode(10);
const ROOT = 'benchmarks/repoC/pristine';
const PKG = 'pyparsing';

const admission = JSON.parse(readFileSync('benchmarks/repoC/admission.json', 'utf8'));
const sweep = JSON.parse(readFileSync('benchmarks/repoC/sweep.json', 'utf8'));
const modules = [...new Set(sweep.runs.map((r) => r.dotted))];
const reached = new Set();
for (const q of sweep.reachedQLines) {
  const b = q.indexOf('|'); const c = q.lastIndexOf(':');
  reached.add(q.slice(0, b) + ':' + q.slice(c + 1));
}

const DOCTEST = [
  'import doctest, importlib, json, sys, io, contextlib',
  'sys.path.insert(0, sys.argv[1])',
  'failed = 0; attempted = 0',
  'sink = io.StringIO()',
  'with contextlib.redirect_stdout(sink), contextlib.redirect_stderr(sink):',
  '    finder = doctest.DocTestFinder(exclude_empty=True)',
  '    runner = doctest.DocTestRunner(verbose=False, optionflags=0)',
  '    for modname in json.loads(sys.argv[2]):',
  '        try:',
  '            mod = importlib.import_module(modname)',
  '        except BaseException:',
  '            continue',
  '        for t in finder.find(mod, modname):',
  '            runner.run(t, out=sink.write, clear_globs=False)',
  '    r = runner.summarize(verbose=False)',
  '    failed, attempted = r.failed, r.attempted',
  'sys.stderr.write(json.dumps({"failed": failed, "attempted": attempted}))',
].join(NL);

const externalVerdict = (dir) => {
  const s = spawnSync('python', ['-c', DOCTEST, dir, JSON.stringify(modules)],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 300000,
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
  try { return JSON.parse(s.stderr); } catch (e) { return null; }
};

const workdir = () => {
  const dir = mkdtempSync(join(tmpdir(), 'repoc-'));
  mkdirSync(join(dir, PKG), { recursive: true });
  for (const f of readdirSync(join(ROOT, PKG))) {
    if (f.endsWith('.py')) copyFileSync(join(ROOT, PKG, f), join(dir, PKG, f));
  }
  return dir;
};

// Baseline. Everything is scored as a DELTA against this, because pyparsing's own doctests do not all
// pass on the pristine corpus - and pretending otherwise would make every mutation look detected.
const base = externalVerdict(ROOT);
if (base === null) { console.log('BASELINE UNOBSERVABLE - refusing to score'); process.exit(2); }
console.log('baseline external verdict: ' + base.failed + ' failed of ' + base.attempted + ' attempted');
console.log('');

// Deterministic operators, applied to a WITNESSED line only.
const OPERATORS = [
  { name: 'COMPARISON_FLIP', fx: (l) => (/[^<>=!]<=[^=]/.test(l) ? l.replace('<=', '<')
    : /[^<>=!]>=[^=]/.test(l) ? l.replace('>=', '>')
      : /[^<>=!]<[^=]/.test(l) ? l.replace('<', '<=')
        : /[^<>=!]>[^=]/.test(l) ? l.replace('>', '>=') : null) },
  { name: 'NEGATION_DROP', fx: (l) => (/\bnot /.test(l) ? l.replace(/\bnot /, '') : null) },
  { name: 'BOUNDARY_SHIFT', fx: (l) => {
    const m = /(?<![\w.])(\d+)(?![\w.])/.exec(l);
    return m ? l.slice(0, m.index) + String(Number(m[1]) + 1) + l.slice(m.index + m[1].length) : null;
  } },
  { name: 'AND_TO_OR', fx: (l) => (/ and /.test(l) ? l.replace(' and ', ' or ') : null) },
];

const admissible = admission.rows.filter((r) => r.admissible);
const tasks = [];
for (const fn of admissible) {
  const path = join(ROOT, PKG, fn.module);
  const src = readFileSync(path, 'utf8');
  const lines = src.split(/\r?\n/);
  const mod = fn.module.replace(/\.py$/, '');
  let made = null;
  for (const lineNo of fn.lines) {
    if (!reached.has(mod + ':' + lineNo)) continue;
    const original = lines[lineNo - 1];
    if (original === undefined || !original.trim() || /^\s*#/.test(original)) continue;
    // an anchor must be unique in the file, or it does not identify a site
    if (src.split(original).length - 1 !== 1) continue;
    for (const op of OPERATORS) {
      const replaced = op.fx(original);
      if (replaced === null || replaced === original) continue;
      const dir = workdir();
      const target = join(dir, PKG, fn.module);
      const m = mutate({ file: target, find: original, replace: replaced, write: true,
        language: 'python', expectParses: true });
      if (!m.ok) { rmSync(dir, { recursive: true, force: true }); continue; }
      const after = externalVerdict(dir);
      rmSync(dir, { recursive: true, force: true });
      if (after === null) continue;
      const detected = after.failed > base.failed;
      if (detected) {
        made = { module: fn.module, fn: fn.name, line: lineNo, operator: op.name,
          anchor: original, replacement: replaced,
          baselineFailed: base.failed, mutatedFailed: after.failed };
        break;
      }
    }
    if (made) break;
  }
  tasks.push(made || { module: fn.module, fn: fn.name, unscorable: true,
    why: 'no deterministic mutation on a witnessed line was DETECTED by the independent verifier' });
}

const scorable = tasks.filter((t) => !t.unscorable);
console.log('admissible callables      : ' + admissible.length);
console.log('SCORABLE (oracle detects) : ' + scorable.length);
console.log('UNSCORABLE (no oracle)    : ' + (tasks.length - scorable.length));
console.log('');
for (const t of tasks) {
  console.log('  ' + (t.module + '/' + t.fn).padEnd(34)
    + (t.unscorable ? 'UNSCORABLE'
      : t.operator + ' L' + t.line + '  failed ' + t.baselineFailed + ' -> ' + t.mutatedFailed));
}
writeFileSync('benchmarks/repoC/tasks.json', JSON.stringify({ baseline: base, tasks }, null, 1), 'utf8');
console.log('');
console.log('wrote benchmarks/repoC/tasks.json');
