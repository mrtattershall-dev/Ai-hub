// LEGALABS — PROBE MINING. Where do inputs that actually exercise real library code come from?
//
// Repo B Attempt 0 admitted ZERO of 56 candidates, because a generated probe that fills every parameter
// with "1.0" raises TypeError before reaching anything. That produced the law this module is built on:
//
//     FAILURE TO OBSERVE AN EFFECT IS EVIDENCE ONLY AFTER OPPORTUNITY FOR THE EFFECT HAS BEEN
//     ESTABLISHED.
//
// A canary that does not surface tells you nothing unless the probe reached the site. So probes are not
// invented here - they are MINED from what the repository's own authors wrote, and then each one is
// TRACED to discover which callables it actually enters. The trace is the opportunity proof.
//
// PROVENANCE IS RECORDED PER PROBE, because it may later turn out to affect measurement quality:
//
//     TEST_DERIVED         from a shipped test suite
//     DOCTEST_DERIVED      from an author-written >>> example inside the package
//     ANNOTATION_DERIVED   constructed from type annotations
//     FIXTURE_DERIVED      from a fixture the repository defines
//     MANUALLY_SPECIFIED   written by me, and therefore the least trustworthy
//
// `packaging` ships no tests - wheels drop them - but carries 163 doctest example lines. Those are real
// calls its authors use to demonstrate its behaviour, which is exactly what a probe should be.
import { execFileSync } from 'node:child_process';

const NL = String.fromCharCode(10);

export const PROVENANCE = {
  TEST_DERIVED: 'TEST_DERIVED',
  DOCTEST_DERIVED: 'DOCTEST_DERIVED',
  ANNOTATION_DERIVED: 'ANNOTATION_DERIVED',
  FIXTURE_DERIVED: 'FIXTURE_DERIVED',
  MANUALLY_SPECIFIED: 'MANUALLY_SPECIFIED',
};

// Extract doctest examples from a package, as runnable statements with their source module.
export function mineDoctests(packageDir, packageName) {
  const prog = [
    'import ast, doctest, json, os, sys, glob',
    'pkg = sys.argv[1]',
    'out = []',
    'for path in sorted(glob.glob(os.path.join(pkg, "*.py"))):',
    '    mod = os.path.basename(path)[:-3]',
    '    try:',
    '        tree = ast.parse(open(path, encoding="utf8").read())',
    '    except SyntaxError:',
    '        continue',
    '    for node in ast.walk(tree):',
    '        doc = ast.get_docstring(node) if isinstance(node,',
    '            (ast.Module, ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) else None',
    '        if not doc:',
    '            continue',
    '        try:',
    '            examples = doctest.DocTestParser().get_examples(doc)',
    '        except Exception:',
    '            continue',
    '        for ex in examples:',
    '            src = ex.source.strip()',
    '            if not src or src.startswith("#"):',
    '                continue',
    '            out.append({"module": mod, "source": src,',
    '                        "want": ex.want.strip()})',
    'print(json.dumps(out))',
  ].join(NL);
  try {
    const raw = execFileSync('python', ['-c', prog, packageDir],
      { encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
    return JSON.parse(raw).map((e) => ({ ...e, provenance: PROVENANCE.DOCTEST_DERIVED,
      packageName }));
  } catch (e) {
    return null;   // NOT an empty list: unobservable and not-found are different answers
  }
}

// THE OPPORTUNITY PROOF. Run a probe under a tracer and report which callables it actually entered.
//
// This is what makes a canary interpretable. It also works for METHODS, which the naive generator could
// never reach, because it asks what the code did rather than guessing what it would do.
export function exercisedBy({ rootDir, packageName, setup = [], source }) {
  const prog = [
    'import sys, json, os',
    'sys.path.insert(0, sys.argv[1])',
    'pkgname = sys.argv[2]',
    'entered = set()',
    'def tracer(frame, event, arg):',
    '    if event != "call":',
    '        return None',
    '    code = frame.f_code',
    '    fn = code.co_filename.replace("\\\\", "/")',
    '    if "/" + pkgname + "/" in fn:',
    '        mod = os.path.basename(fn)[:-3]',
    '        entered.add(mod + "." + code.co_name)',
    '    return None',
    'ns = {}',
    'setup = json.loads(sys.argv[3])',
    'src = sys.argv[4]',
    'status = "OK"',
    'try:',
    '    for line in setup:',
    '        exec(line, ns)',
    '    sys.settrace(tracer)',
    '    try:',
    '        value = eval(compile(src, "<probe>", "eval"), ns)',
    '    except SyntaxError:',
    '        exec(compile(src, "<probe>", "exec"), ns)',
    '        value = None',
    '    finally:',
    '        sys.settrace(None)',
    '    rendered = repr(value)',
    'except Exception as e:',
    '    sys.settrace(None)',
    '    status = "RAISED:" + type(e).__name__',
    '    rendered = None',
    'print(json.dumps({"status": status, "value": rendered, "entered": sorted(entered)}))',
  ].join(NL);
  try {
    const raw = execFileSync('python',
      ['-c', prog, rootDir, packageName, JSON.stringify(setup), source],
      { encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
    return JSON.parse(raw);
  } catch (e) {
    return null;   // unobservable
  }
}

// Build the setup lines a doctest example needs: the imports its module implies.
export function setupFor(example, packageName) {
  return ['from ' + packageName + '.' + example.module + ' import *',
    'import ' + packageName + '.' + example.module + ' as _m'];
}

// TRACE EVERY EXAMPLE ONCE and index by callable. The naive form re-traced all 163 examples for every
// candidate - fifty seconds per lookup, hours for a manifest. Opportunity is a property of the probe, not
// of the question being asked of it, so it is established once.
export function buildProbeIndex({ rootDir, packageName, examples }) {
  const index = new Map();          // "module.callable" -> [probe, ...]
  let observed = 0; let unobservable = 0;
  const raising = [];
  for (const ex of examples) {
    const r = exercisedBy({ rootDir, packageName, setup: setupFor(ex, packageName),
      source: ex.source });
    if (r === null) { unobservable++; continue; }
    observed++;
    if (r.status !== 'OK') raising.push(ex.source.slice(0, 60));
    for (const key of r.entered) {
      if (!index.has(key)) index.set(key, []);
      index.get(key).push({ source: ex.source, provenance: ex.provenance, status: r.status,
        value: r.value, fromModule: ex.module });
    }
  }
  return { index, observed, unobservable, raising, examples: examples.length };
}

export function lookupProbes(index, moduleName, callableName) {
  return index.get(moduleName.replace(/\.py$/, '') + '.' + callableName) || [];
}

// Which mined probes exercise a given callable? Returns only probes PROVEN to enter it.
export function probesExercising({ rootDir, packageName, examples, moduleName, callableName }) {
  const key = moduleName.replace(/\.py$/, '') + '.' + callableName;
  const hits = []; let observed = 0; let unobservable = 0;
  for (const ex of examples) {
    const r = exercisedBy({ rootDir, packageName, setup: setupFor(ex, packageName),
      source: ex.source });
    if (r === null) { unobservable++; continue; }
    observed++;
    if (r.entered.includes(key)) {
      hits.push({ source: ex.source, provenance: ex.provenance, status: r.status,
        value: r.value, fromModule: ex.module });
    }
  }
  return { hits, observed, unobservable };
}

export { NL };
