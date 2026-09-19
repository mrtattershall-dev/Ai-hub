// EXTERNAL GENERALIZATION — against a verifier nobody here wrote.
//
// Everything so far compares the entitlement algebra against decision procedures I authored, over one
// shared `describe()` primitive. That establishes internal coherence and survives intervention, but the
// generalizable claim is narrower and has not been tested:
//
//     THE ALGEBRA REPRODUCES THE ACCEPT/REJECT AND REASON TOPOLOGY OF VERIFIERS IT DID NOT AUTHOR.
//
// CPython's `doctest` is exactly such a verifier. It was written by other people, it has its own
// comparison semantics that my `assertionHeld()` merely APPROXIMATES - exception formatting, <BLANKLINE>,
// ELLIPSIS, whitespace normalisation, tracebacks matched by last line - and it reports its own failure
// vocabulary. It is not a reimplementation of anything of mine.
//
// PREDICTIONS, frozen before running:
//   X1  CONTROL. On the pristine corpus, CPython doctest and my classifier agree on every example.
//   X2  Under each of the 56 frozen real mutations, the SET of examples CPython reports as failing is
//       IDENTICAL to the set my classifier reports as failing.
//   X3  NON-VACUITY. Mutations actually cause failures, and different mutations cause different failing
//       sets. Without X3, X2 is agreement about an empty set.
//
// FALSIFICATION, and I expect this one to bite somewhere: doctest has subtleties my approximation does
// not implement. Any disagreement names a place where my assertion semantics differs from CPython's, and
// that is a real external finding rather than a defeat - it is the difference between "my abstraction is
// self-consistent" and "my abstraction is correct about someone else's verifier".
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, readdirSync, copyFileSync }
  from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mutate } from '../../legasus/legalabs/mutate.mjs';

const NL = String.fromCharCode(10);
const ROOT = 'benchmarks/repoB/pristine';
const PKG = 'packaging';

// CPython's own runner. Its verdict, its vocabulary, its comparison rules.
const DOCTEST = [
  'import doctest, importlib, json, sys, io',
  'sys.path.insert(0, sys.argv[1])',
  'pkg = sys.argv[2]',
  'out = []',
  'for modname in json.loads(sys.argv[3]):',
  '    try:',
  '        mod = importlib.import_module(pkg + "." + modname)',
  '    except Exception as e:',
  '        out.append({"module": modname, "source": None, "outcome": "IMPORT_FAILED"})',
  '        continue',
  '    finder = doctest.DocTestFinder(exclude_empty=True)',
  '    runner = doctest.DocTestRunner(verbose=False, optionflags=0)',
  '    for t in finder.find(mod, pkg + "." + modname):',
  '        for ex in t.examples:',
  '            pass',
  '        buf = io.StringIO()',
  '        class R(doctest.DocTestRunner):',
  '            def report_failure(self, o, test, example, got):',
  '                out.append({"module": modname, "name": test.name,',
  '                            "source": example.source.rstrip(), "outcome": "OUTPUT_MISMATCH"})',
  '            def report_unexpected_exception(self, o, test, example, exc_info):',
  '                out.append({"module": modname, "name": test.name,',
  '                            "source": example.source.rstrip(),',
  '                            "outcome": "UNEXPECTED_EXCEPTION"})',
  '        R(verbose=False, optionflags=0).run(t, out=buf.write, clear_globs=False)',
  '    del runner',
  'print(json.dumps(out))',
].join(NL);

const runDoctest = (rootDir, modules) => {
  try {
    const raw = execFileSync('python', ['-c', DOCTEST, rootDir, PKG, JSON.stringify(modules)],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 120000,
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
    return JSON.parse(raw);
  } catch (e) { return null; }
};

// MY classifier, run in ONE subprocess: evaluate each mined example and compare to its documented output
// using my own `assertionHeld` semantics, reimplemented here in Python so both sides see the same
// execution and differ only in COMPARISON RULES - which is the thing under test.
const MINE = [
  'import importlib, json, sys, traceback, io, contextlib',
  'sys.path.insert(0, sys.argv[1])',
  'pkg = sys.argv[2]',
  'rows = json.loads(open(sys.argv[3], encoding="utf-8").read())',
  'out = []',
  'cache = {}',
  'for r in rows:',
  '    dotted = r["dotted"]',
  '    try:',
  '        mod = cache.get(dotted) or importlib.import_module(dotted)',
  '        cache[dotted] = mod',
  '        ns = dict(vars(mod))',
  '    except Exception:',
  '        out.append({"module": r["module"], "source": r["invocation"], "outcome": "IMPORT_FAILED"})',
  '        continue',
  '    status = "OK"; value = None',
  '    sink = io.StringIO()',
  '    try:',
  '      with contextlib.redirect_stdout(sink):',
  '        for line in r["setup"]:',
  '            exec(line, ns)',
  '        try:',
  '            value = repr(eval(compile(r["invocation"], "<x>", "eval"), ns))',
  '        except SyntaxError:',
  '            exec(compile(r["invocation"], "<x>", "exec"), ns)',
  '            value = None',
  '        printed = sink.getvalue()',
  '    except Exception as e:',
  '        status = "RAISED:" + type(e).__name__',
  '    wants = (r.get("wants") or "").strip()',
  '    if not wants:',
  '        outcome = "NO_ASSERTION"',
  '    elif wants.startswith("Traceback"):',
  '        hit = status.startswith("RAISED:") and status[7:] in wants',
  '        outcome = "PASS" if hit else "UNEXPECTED_EXCEPTION"',
  '    elif status.startswith("RAISED:"):',
  '        outcome = "UNEXPECTED_EXCEPTION"',
  '    else:',
  '        outcome = "PASS" if str(value) == wants else "OUTPUT_MISMATCH"',
  '    out.append({"module": r["module"], "source": r["invocation"], "outcome": outcome,',
  '                "printed": bool(sink.getvalue())})',
  'print(json.dumps(out))',
].join(NL);

const runMine = (rootDir, rowsFile) => {
  try {
    const raw = execFileSync('python', ['-c', MINE, rootDir, PKG, rowsFile],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 120000,
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
    return JSON.parse(raw);
  } catch (e) { return null; }
};

const sweep = JSON.parse(readFileSync('benchmarks/repoB/sweep.json', 'utf8'));
const rows = sweep.runs.map((r) => ({ module: r.module.replace(/\.py$/, ''), dotted: r.dotted,
  setup: r.setup, invocation: r.invocation, wants: r.wants }));
const MODULES = [...new Set(rows.map((r) => r.module))];
const rowsFile = join(tmpdir(), 'rows-' + process.pid + '.json');
writeFileSync(rowsFile, JSON.stringify(rows), 'utf8');

const failSet = (list) => new Set((list || [])
  .filter((x) => x.outcome === 'OUTPUT_MISMATCH' || x.outcome === 'UNEXPECTED_EXCEPTION')
  .map((x) => x.module + '|' + String(x.source).trim()));
const eqSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

// UNOBSERVABLE IS NEVER AN ADMISSION - a law this project already enforces in legaverify, and which the
// FIRST version of this very harness broke: `runMine` threw, returned null, and failSet(null) scored it
// as ZERO FAILURES. X1/X2/X2b run 0 were invalid for that reason and are recorded as such.
const mustObserve = (r, what) => {
  if (r === null || r === undefined) {
    console.error('REFUSING TO SCORE: ' + what + ' could not be observed. A harness that cannot run has'
      + ' NOT reported a clean result.');
    process.exit(2);
  }
  return r;
};

// REASON TOPOLOGY, not merely accept/reject. Agreeing that an example failed while disagreeing about
// WHY is not reproduction. CPython distinguishes an output mismatch from an unexpected exception, and so
// must the algebra, on the same example, every time.
const kindMap = (list) => {
  const m = new Map();
  for (const x of (list || [])) {
    if (x.outcome === 'OUTPUT_MISMATCH' || x.outcome === 'UNEXPECTED_EXCEPTION') {
      m.set(x.module + '|' + String(x.source).trim(), x.outcome);
    }
  }
  return m;
};
const kindAgreement = (a, b) => {
  const ka = kindMap(a); const kb = kindMap(b);
  let same = 0; let differ = 0; const examples = [];
  for (const [k, v] of ka) {
    if (!kb.has(k)) continue;                       // set membership is scored separately
    if (kb.get(k) === v) same++;
    else { differ++; if (examples.length < 5) examples.push(k + ' cpython=' + v + ' mine=' + kb.get(k)); }
  }
  return { same, differ, examples };
};

// ---- X1 control, on the pristine corpus
const d0 = mustObserve(runDoctest(ROOT, MODULES), 'CPython doctest on the pristine corpus');
const m0 = mustObserve(runMine(ROOT, rowsFile), 'my classifier on the pristine corpus');
const dF0 = failSet(d0); const mF0 = failSet(m0);
console.log('X1 CONTROL on the pristine corpus');
console.log('   CPython doctest failures : ' + dF0.size);
console.log('   my classifier failures   : ' + mF0.size);
console.log('   agreement                : ' + (eqSet(dF0, mF0) ? 'HELD' : 'DISAGREE'));
if (!eqSet(dF0, mF0)) {
  const onlyD = [...dF0].filter((x) => !mF0.has(x));
  const onlyM = [...mF0].filter((x) => !dF0.has(x));
  console.log('   only CPython says fail (' + onlyD.length + '): ' + onlyD.slice(0, 4).join(' ; '));
  console.log('   only mine says fail    (' + onlyM.length + '): ' + onlyM.slice(0, 4).join(' ; '));
}

// ---- X2 under the 56 frozen mutations
const candidates = JSON.parse(readFileSync('benchmarks/repoB/candidates.json', 'utf8'));
let agree = 0; let applied = 0; const varied = new Set(); const disagreements = [];
let kindSame = 0; let kindDiff = 0; const kindExamples = [];
for (const c of candidates) {
  const dir = mkdtempSync(join(tmpdir(), 'ext-'));
  mkdirSync(join(dir, PKG), { recursive: true });
  for (const f of readdirSync(join(ROOT, PKG))) {
    if (f.endsWith('.py')) copyFileSync(join(ROOT, PKG, f), join(dir, PKG, f));
  }
  const target = join(dir, PKG, c.file);
  const src = readFileSync(target, 'utf8');
  const eol = src.includes('\r\n') ? '\r\n' : NL;
  const find = c.anchorLF.split('\n').join(eol);
  const replace = c.replacement.split('\n').join(eol);
  const m = mutate({ file: target, find, replace, write: true, language: 'python',
    expectParses: true });
  if (!m.ok) { rmSync(dir, { recursive: true, force: true }); continue; }
  applied++;
  const d = mustObserve(runDoctest(dir, MODULES), 'doctest under mutation ' + c.fn);
  const mine = mustObserve(runMine(dir, rowsFile), 'my classifier under mutation ' + c.fn);
  const dF = failSet(d); const mF = failSet(mine);
  varied.add([...dF].sort().join('~'));
  const ka = kindAgreement(d, mine);
  kindSame += ka.same; kindDiff += ka.differ;
  for (const ex of ka.examples) if (kindExamples.length < 8) kindExamples.push(ex);
  if (eqSet(dF, mF)) agree++;
  else {
    disagreements.push({ c: c.file + '/' + c.fn, onlyD: [...dF].filter((x) => !mF.has(x)).length,
      onlyM: [...mF].filter((x) => !dF.has(x)).length, dN: dF.size, mN: mF.size });
  }
  rmSync(dir, { recursive: true, force: true });
}

console.log('');
console.log('X2 under the frozen mutations');
console.log('   mutations applied (checked)      : ' + applied + ' of ' + candidates.length);
console.log('   identical failing sets           : ' + agree + '/' + applied
  + (agree === applied ? '   HELD' : '   DISAGREEMENTS: ' + (applied - agree)));
console.log('');
console.log('X2b REASON TOPOLOGY - agreeing WHY, not merely THAT');
console.log('   examples both call failing        : ' + (kindSame + kindDiff));
console.log('   same failure KIND                 : ' + kindSame
  + (kindDiff === 0 ? '   HELD' : '   DIFFERING KIND: ' + kindDiff));
for (const ex of kindExamples) console.log('     ' + ex);
console.log('');
console.log('X3 NON-VACUITY');
console.log('   distinct failing-set signatures  : ' + varied.size
  + (varied.size > 1 ? '   the mutations really do move the answer' : '   WARNING: nothing moved'));
if (disagreements.length) {
  console.log('');
  console.log('DISAGREEMENTS — each names a place my comparison rules differ from CPython doctest:');
  for (const d of disagreements.slice(0, 10)) {
    console.log('   ' + d.c.padEnd(34) + ' cpython=' + d.dN + ' mine=' + d.mN
      + '  onlyCPython=' + d.onlyD + ' onlyMine=' + d.onlyM);
  }
}
rmSync(rowsFile, { force: true });
