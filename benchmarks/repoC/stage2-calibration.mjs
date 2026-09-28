// REPO C, STAGE 2 — COVERAGE and EPISTEMIC CALIBRATION against the external verifier.
//
// CPython's `doctest` is the externally authored evidence producer. r3 never sees its verdicts as input.
//
// THE TWO MEASUREMENTS ARE KEPT SEPARATE, as the frozen protocol requires:
//
//   COVERAGE     of the eligible surface, how much can r3 obtain enough authority to act on at all?
//   CALIBRATION  when r3 DECLINES, is the stated REASON supported by the external evidence?
//
// An honest "I cannot see this" is a COVERAGE loss, not a calibration error - it claims nothing about the
// subject. A wrong reason IS a calibration error even when declining happened to be safe. Refusing for
// SCOPE_INCOMPATIBLE while the real problem was PRODUCER_FAILED earns no credit.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const NL = String.fromCharCode(10);
const ROOT = 'benchmarks/repoC/pristine';
const PKG = 'pyparsing';

// The external verifier, reporting in ITS OWN vocabulary.
const DOCTEST = [
  'import doctest, importlib, json, sys, io, contextlib',
  'sys.path.insert(0, sys.argv[1])',
  'out = []',
  'sink = io.StringIO()',
  'with contextlib.redirect_stdout(sink), contextlib.redirect_stderr(sink):',
  '    mods = json.loads(sys.argv[2])',
  '    finder = doctest.DocTestFinder(exclude_empty=True)',
  '    for modname in mods:',
  '        try:',
  '            mod = importlib.import_module(modname)',
  '        except BaseException:',
  '            out.append({"module": modname, "source": None, "outcome": "IMPORT_FAILED"})',
  '            continue',
  '        for t in finder.find(mod, modname):',
  '            class R(doctest.DocTestRunner):',
  '                def report_failure(self, o, test, example, got):',
  '                    out.append({"module": modname, "source": example.source.rstrip(),',
  '                                "outcome": "OUTPUT_MISMATCH"})',
  '                def report_unexpected_exception(self, o, test, example, exc_info):',
  '                    out.append({"module": modname, "source": example.source.rstrip(),',
  '                                "outcome": "UNEXPECTED_EXCEPTION"})',
  '                def report_success(self, o, test, example, got):',
  '                    out.append({"module": modname, "source": example.source.rstrip(),',
  '                                "outcome": "PASS"})',
  '            R(verbose=False, optionflags=0).run(t, out=sink.write, clear_globs=False)',
  'sys.stderr.write(json.dumps(out))',
].join(NL);

const sweep = JSON.parse(readFileSync('benchmarks/repoC/sweep.json', 'utf8'));
const modules = [...new Set(sweep.runs.map((r) => r.dotted))];

// The external verdicts arrive on STDERR, because pyparsing's own doctests print to stdout. That is a
// property of the TARGET, discovered here, and it is why the channel has to be chosen rather than assumed.
let external;
try {
  const p = execFileSync('python', ['-c', DOCTEST, ROOT, JSON.stringify(modules)],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 300000,
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
  void p;
  external = null;
} catch (e) {
  external = e.stderr;
}
if (external === null) {
  // execFileSync succeeded; stderr is on the result only when it throws, so re-run capturing both.
  const { spawnSync } = await import('node:child_process');
  const s = spawnSync('python', ['-c', DOCTEST, ROOT, JSON.stringify(modules)],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 300000,
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
  external = s.stderr;
}
let ext;
try {
  ext = JSON.parse(external);
} catch (e) {
  console.log('EXTERNAL VERIFIER UNOBSERVABLE - refusing to score.');
  console.log(String(external).slice(0, 300));
  process.exit(2);
}

const key = (m, src) => m + '|' + String(src).trim();
const extBy = new Map();
for (const x of ext) if (x.source) extBy.set(key(x.module.split('.').pop(), x.source), x.outcome);

// r3's own classification of each example, in ITS vocabulary.
const classify = (r) => {
  if (r.status === 'UNOBSERVABLE') return 'UNOBSERVABLE';
  if (String(r.status).startsWith('SETUP_FAILED')) return 'SETUP_FAILED';
  if (String(r.status).startsWith('RAISED')) return 'OBSERVED_RAISED';
  return 'OBSERVED_OK';
};

const cells = {};
const unmatched = [];
for (const r of sweep.runs) {
  const mine = classify(r);
  const theirs = extBy.get(key(r.module.replace(/\.py$/, ''), r.invocation));
  if (theirs === undefined) { unmatched.push(r.invocation.slice(0, 50)); continue; }
  const k = mine + ' | ' + theirs;
  cells[k] = (cells[k] || 0) + 1;
}

console.log('REPO C / pyparsing 3.3.2 — frozen legasus-freeze-r3');
console.log('');
console.log('examples mined by r3          : ' + sweep.minedCount);
console.log('examples the external verifier reports: ' + extBy.size);
console.log('unmatched by key              : ' + unmatched.length);
console.log('');
console.log('  r3 classification   x   external verdict');
for (const [k, n] of Object.entries(cells).sort((a, b) => b[1] - a[1])) {
  console.log('    ' + k.padEnd(46) + n);
}

const tot = Object.values(cells).reduce((a, b) => a + b, 0);
const observed = Object.entries(cells).filter(([k]) => k.startsWith('OBSERVED'))
  .reduce((a, [, n]) => a + n, 0);
const setupFailed = Object.entries(cells).filter(([k]) => k.startsWith('SETUP_FAILED'))
  .reduce((a, [, n]) => a + n, 0);
const unobs = Object.entries(cells).filter(([k]) => k.startsWith('UNOBSERVABLE'))
  .reduce((a, [, n]) => a + n, 0);
// CALIBRATION: r3 says SETUP_FAILED - "this never became an experiment". Supported iff the external
// verifier also fails it.
const setupSupported = Object.entries(cells)
  .filter(([k]) => k.startsWith('SETUP_FAILED') && !k.endsWith('PASS'))
  .reduce((a, [, n]) => a + n, 0);

console.log('');
console.log('COVERAGE     observed by r3            : ' + observed + '/' + tot
  + '  (' + (100 * observed / tot).toFixed(1) + '%)');
console.log('             unobservable to r3        : ' + unobs + '/' + tot
  + '  (' + (100 * unobs / tot).toFixed(1) + '%)');
console.log('CALIBRATION  SETUP_FAILED supported    : ' + setupSupported + '/' + setupFailed
  + (setupFailed ? '  (' + (100 * setupSupported / setupFailed).toFixed(1) + '%)' : ''));
console.log('             an UNOBSERVABLE the external verifier PASSES is a COVERAGE loss,');
console.log('             not a calibration error - it claims nothing about the subject.');

writeFileSync('benchmarks/repoC/calibration.json',
  JSON.stringify({ cells, tot, observed, setupFailed, setupSupported, unobs,
    unmatched: unmatched.slice(0, 20) }, null, 1), 'utf8');
