// REPO C, STAGE 4b — CAPABILITY and COMMIT PRECISION over the distinct scorable tasks.
//
// n IS TINY. 3 distinct mutations survive the funnel of 450 callables -> 138 witnessed -> 10 admissible
// -> 3 with an oracle that can detect them. NO RATE COMPUTED FROM THIS IS MEANINGFUL, and none is quoted
// as though it were. What IS informative even at n=3 is behaviour: a single state committed that the
// independent verifier rejects is a commit-precision failure regardless of sample size.
//
// Model: local qwen2.5-coder:1.5b. No paid service.
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, readdirSync, copyFileSync }
  from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mutate } from '../../legasus/legalabs/mutate.mjs';
import { authorizeStructural, signatureOf } from '../../legasus/legagate/structural.mjs';

const NL = String.fromCharCode(10);
const ROOT = 'benchmarks/repoC/pristine';
const PKG = 'pyparsing';
const MODEL = 'qwen2.5-coder:1.5b';

const { baseline, tasks } = JSON.parse(readFileSync('benchmarks/repoC/tasks.json', 'utf8'));
const sweep = JSON.parse(readFileSync('benchmarks/repoC/sweep.json', 'utf8'));
const modules = [...new Set(sweep.runs.map((r) => r.dotted))];

// DEDUPLICATE. Two of the four scorable tasks share one anchor because one function is nested inside the
// other. Counting them twice would inflate the denominator with a single mutation.
const seen = new Set();
const distinct = [];
for (const t of tasks.filter((x) => !x.unscorable)) {
  const k = t.module + '|' + t.anchor;
  if (seen.has(k)) continue;
  seen.add(k); distinct.push(t);
}
console.log('distinct scorable tasks: ' + distinct.length + '  (from '
  + tasks.filter((x) => !x.unscorable).length + ' scorable callables)');
console.log('baseline external failures: ' + baseline.failed + ' of ' + baseline.attempted);
console.log('');

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

// APPARATUS REPAIR, RECORDED. The first scorer compared `failed` alone, which admits DESTRUCTION as
// improvement: a candidate that mangles core.py makes doctest discover 52 examples instead of 182, so
// `failed` drops from 73 to 47 and the arm looks like it improved the repository. Verified directly by
// truncating core.py, which reproduces failed=47/attempted=52 exactly.
//
// A state satisfies the independent target only if it PRESERVES THE DISCOVERABLE SURFACE and does not
// increase failures. This repair moves the result AGAINST the RAW arm and flatters nobody.
const satisfiesTarget = (v, base) => v !== null && v.attempted === base.attempted
  && v.failed <= base.failed;

const verdict = (dir) => {
  const s = spawnSync('python', ['-c', DOCTEST, dir, JSON.stringify(modules)],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 300000,
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
  try { return JSON.parse(s.stderr); } catch (e) { return null; }
};

const workdir = () => {
  const dir = mkdtempSync(join(tmpdir(), 'arm-'));
  mkdirSync(join(dir, PKG), { recursive: true });
  for (const f of readdirSync(join(ROOT, PKG))) {
    if (f.endsWith('.py')) copyFileSync(join(ROOT, PKG, f), join(dir, PKG, f));
  }
  return dir;
};

// Extract the enclosing function source so the model sees a bounded unit, as r3's envelope requires.
const EXTRACT = [
  'import ast, sys, json',
  'src = open(sys.argv[1], encoding="utf-8").read()',
  'want = sys.argv[2]',
  'out = None',
  'for n in ast.walk(ast.parse(src)):',
  '    if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name == want:',
  '        seg = ast.get_source_segment(src, n)',
  '        if out is None or len(seg) > len(out):',
  '            out = seg',
  'print(json.dumps(out))',
].join(NL);
const extract = (file, fn) => {
  const s = spawnSync('python', ['-c', EXTRACT, file, fn], { encoding: 'utf8',
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
  try { return JSON.parse(s.stdout); } catch (e) { return null; }
};

const ask = (prompt) => {
  const body = JSON.stringify({ model: MODEL, prompt, stream: false,
    options: { temperature: 0.2, num_predict: 512, num_ctx: 16384 } });
  const s = spawnSync('curl', ['-s', '-m', '600', 'http://localhost:11434/api/generate',
    '-H', 'Content-Type: application/json', '-d', body], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  try { return JSON.parse(s.stdout).response || ''; } catch (e) { return ''; }
};

const codeFrom = (text) => {
  const fence = /```(?:python)?\s*([\s\S]*?)```/.exec(text);
  const body = fence ? fence[1] : text;
  const i = body.indexOf('def ');
  return i >= 0 ? body.slice(i).trimEnd() : body.trim();
};

const results = [];
for (const t of distinct) {
  const dir = workdir();
  const target = join(dir, PKG, t.module);
  const m = mutate({ file: target, find: t.anchor, replace: t.replacement, write: true,
    language: 'python', expectParses: true });
  if (!m.ok) { rmSync(dir, { recursive: true, force: true }); continue; }
  const broken = verdict(dir);
  const mutatedSrc = extract(target, t.fn);
  if (!mutatedSrc) {
    results.push({ task: t.module + '/' + t.fn, unscorable: true, why: 'could not extract the unit' });
    rmSync(dir, { recursive: true, force: true }); continue;
  }

  const prompt = 'Repair the bug in this Python function. Return ONLY the corrected function.' + NL
    + NL + 'The function is:' + NL + NL + mutatedSrc + NL;
  const raw = codeFrom(ask(prompt));

  // ---- RAW arm: apply whatever came back.
  const rawDir = workdir();
  const rawTarget = join(rawDir, PKG, t.module);
  mutate({ file: rawTarget, find: t.anchor, replace: t.replacement, write: true });
  let rawCommitted = false; let rawVerdict = null;
  const rawApply = mutate({ file: rawTarget, find: mutatedSrc, replace: raw, write: true });
  if (rawApply.ok) { rawCommitted = true; rawVerdict = verdict(rawDir); }
  rmSync(rawDir, { recursive: true, force: true });

  // ---- LEGASUS arm: frozen r3 gates it first.
  const sig = signatureOf(readFileSync(join(ROOT, PKG, t.module), 'utf8'), t.fn);
  const gate = authorizeStructural(raw, { fn: t.fn, signature: sig });
  let legCommitted = false; let legVerdict = null; let refusal = null;
  if (!gate.ok) {
    refusal = gate.failed.join(',');
  } else {
    const legDir = workdir();
    const legTarget = join(legDir, PKG, t.module);
    mutate({ file: legTarget, find: t.anchor, replace: t.replacement, write: true });
    const apply = mutate({ file: legTarget, find: mutatedSrc, replace: raw, write: true,
      language: 'python', expectParses: true });
    if (!apply.ok) { refusal = 'APPLY:' + apply.refused; } else {
      const v = verdict(legDir);
      // r3 commits only if the independent behaviour is not made worse than the pristine baseline.
      if (satisfiesTarget(v, baseline)) { legCommitted = true; legVerdict = v; }
      else {
        refusal = 'PROVE:' + (v ? ('failed=' + v.failed + ',attempted=' + v.attempted) : 'unobservable');
        legVerdict = v;
      }
    }
    rmSync(legDir, { recursive: true, force: true });
  }

  rmSync(dir, { recursive: true, force: true });
  results.push({ task: t.module + '/' + t.fn, operator: t.operator,
    brokenFailed: broken ? broken.failed : null,
    raw: { committed: rawCommitted, failed: rawVerdict ? rawVerdict.failed : null,
      attempted: rawVerdict ? rawVerdict.attempted : null,
      satisfies: satisfiesTarget(rawVerdict, baseline) },
    legasus: { committed: legCommitted, failed: legVerdict ? legVerdict.failed : null,
      attempted: legVerdict ? legVerdict.attempted : null, refusal },
    candidateChars: raw.length });
  const r = results[results.length - 1];
  console.log((t.module + '/' + t.fn).padEnd(30)
    + ' broken=' + r.brokenFailed
    + '  RAW ' + (r.raw.committed
      ? 'committed failed=' + r.raw.failed + '/att=' + r.raw.attempted
        + (r.raw.satisfies ? ' SATISFIES' : ' DESTROYS')
      : 'not applied')
    + '  LEGASUS ' + (r.legasus.committed ? 'COMMITTED failed=' + r.legasus.failed
      : 'REFUSED ' + r.legasus.refusal));
}

const legCommits = results.filter((r) => r.legasus.committed);
const legCorrect = legCommits.filter((r) => r.legasus.attempted === baseline.attempted
  && r.legasus.failed <= baseline.failed);
const rawCommits = results.filter((r) => r.raw.committed);
const rawCorrect = rawCommits.filter((r) => r.raw.satisfies);
console.log('');
console.log('n = ' + results.length + ' distinct tasks. NO RATE FROM THIS IS STATISTICALLY MEANINGFUL.');
console.log('  RAW      committed ' + rawCommits.length + ', of which at-or-below baseline '
  + rawCorrect.length);
console.log('  LEGASUS  committed ' + legCommits.length + ', of which at-or-below baseline '
  + legCorrect.length);
console.log('  LEGASUS  refused   ' + (results.length - legCommits.length));
console.log('');
console.log('COMMIT PRECISION is ' + (legCommits.length === 0
  ? 'UNDEFINED (0 commits). It is NOT 100% - a refusal machine has no precision.'
  : legCorrect.length + '/' + legCommits.length));
writeFileSync('benchmarks/repoC/arms.json',
  JSON.stringify({ model: MODEL, baseline, n: results.length, results }, null, 1), 'utf8');
console.log('wrote benchmarks/repoC/arms.json');
