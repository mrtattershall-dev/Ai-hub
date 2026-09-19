// LEGAEXERCISE — the missing layer. How do I make reality reveal the behaviour being judged?
//
//     OBSERVE -> DECIDE -> [ EXERCISE ] -> RENDER -> PROPOSE -> CONSTRAIN -> PROVE -> COMMIT
//
// Repo B Attempt 0 admitted ZERO of 56 candidates, and the reason was not that r2 could not repair them.
// It was that the apparatus could not make the code RUN. Filling every parameter with "1.0" raises
// TypeError before reaching anything, and a canary that never gets reached proves nothing:
//
//     NO OBSERVATION WITHOUT EXECUTION. NO PROOF WITHOUT OPPORTUNITY TO FALSIFY.
//
// The stdlib development set hid this because `isleap(1900)` is trivially callable - I was supplying
// EXERCISE by hand without noticing it was a layer.
//
// DO NOT SYNTHESIZE THE WORLD IF THE REPOSITORY ALREADY CONTAINS A MACHINE FOR CREATING IT. The wrong
// abstraction here is "construct arguments from type annotations", which is 200 heuristics about Python
// objects. The right one is: run what the repository already runs, instrument it, and record real
// executions. A `Version`, a parsed email message, a wheel filename - the repository knows how to build
// all of them, and its own examples and tests do it correctly by construction.
//
// TRACE FIRST, CANARY SECOND.
//     the TRACE establishes OPPORTUNITY  - reality touched this code
//     the CANARY establishes AUTHORITY   - this source caused the behaviour
// That ordering is the non-vacuity rule embodied architecturally rather than restated.
//
// THE STATES ARE DIRECTLY OBSERVABLE, which is what replaces increasingly elaborate canary inference:
//
//     INVOCATION_FAILED        the call raised before entry           -> invalid witness
//     FUNCTION_NOT_ENTERED     public behaviour happened, target did  -> alternate execution authority
//                              not run                                   (a C accelerator, a wrapper)
//     SITE_NOT_REACHED         entered, but the line never ran        -> path not exercised here
//                                                                        (a platform branch)
//     SITE_REACHED             the line ran                           -> authority experiment is VALID
import { execFileSync } from 'node:child_process';

const NL = String.fromCharCode(10);

export const WITNESS = {
  INVOCATION_FAILED: 'INVOCATION_FAILED',
  FUNCTION_NOT_ENTERED: 'FUNCTION_NOT_ENTERED',
  SITE_NOT_REACHED: 'SITE_NOT_REACHED',
  SITE_REACHED: 'SITE_REACHED',
  UNOBSERVABLE: 'UNOBSERVABLE',
};

export const PROVENANCE = {
  EXISTING_TEST: 'EXISTING_TEST',
  DOCTEST: 'DOCTEST',
  TRACE: 'TRACE',
  SYNTHESIZED: 'SYNTHESIZED',
};

// Run one invocation under a LINE tracer, recording every (module, function) entered and every line
// executed inside the package. Line granularity is what makes SITE_NOT_REACHED observable rather than
// inferred from a canary that failed to fire.
export function observe({ rootDir, packageName, setup = [], invocation, namespaceModule = '',
  timeoutMs = 30000 }) {
  const prog = [
    'import sys, json, os',
    'sys.path.insert(0, sys.argv[1])',
    'pkg = sys.argv[2]',
    'entered = set()',
    'lines = set()',
    'root = os.path.abspath(sys.argv[1]).replace("\\\\", "/")',
    'marker = "/" + pkg + "/"',
    'sources = set()',
    'def tracer(frame, event, arg):',
    '    code = frame.f_code',
    '    fn = code.co_filename.replace("\\\\", "/")',
    '    if marker not in fn:',
    '        return None',
    '    # THE COPY UNDER TEST, not whichever one the interpreter found first. Without this the witness',
    '    # silently observes the INSTALLED package from site-packages while claiming to measure the',
    '    # corpus - the same hazard class as a C accelerator or stale bytecode, one level up.',
    '    if not fn.startswith(root):',
    '        sources.add(fn)',
    '        return None',
    '    mod = os.path.basename(fn)[:-3]',
    '    if event == "call":',
    '        entered.add(mod + "." + code.co_name)',
    '        return tracer',
    '    if event == "line":',
    '        lines.add(mod + ":" + str(frame.f_lineno))',
    '    return tracer',
    'ns = {}',
    // THE REPOSITORY'S OWN NAMESPACE. A doctest runs with its module's globals, which is why an authored
    // example can write Version("1.0a5") without importing anything. Reconstructing that namespace is how
    // mined examples stay the repository's machine rather than becoming my reconstruction of it.
    'nsmod = sys.argv[5] if len(sys.argv) > 5 else ""',
    'setup = json.loads(sys.argv[3])',
    'src = sys.argv[4]',
    'status = "OK"; rendered = None',
    'try:',
    '    if nsmod:',
    '        import importlib',
    '        ns = dict(vars(importlib.import_module(nsmod)))',
    '    for line in setup:',
    '        exec(line, ns)',
    'except Exception as e:',
    '    print(json.dumps({"status": "SETUP_FAILED:" + type(e).__name__,',
    '                      "entered": [], "lines": [], "value": None}))',
    '    raise SystemExit(0)',
    'sys.settrace(tracer)',
    'try:',
    '    try:',
    '        value = eval(compile(src, "<witness>", "eval"), ns)',
    '    except SyntaxError:',
    '        exec(compile(src, "<witness>", "exec"), ns)',
    '        value = None',
    '    rendered = repr(value)',
    'except Exception as e:',
    '    status = "RAISED:" + type(e).__name__',
    'finally:',
    '    sys.settrace(None)',
    'print(json.dumps({"status": status, "value": rendered,',
    '                  "entered": sorted(entered), "lines": sorted(lines),',
    '                  "foreignSources": sorted(sources)[:3]}))',
  ].join(NL);
  try {
    const raw = execFileSync('python',
      ['-c', prog, rootDir, packageName, JSON.stringify(setup), invocation, namespaceModule],
      { encoding: 'utf8', timeout: timeoutMs, stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
    return JSON.parse(raw);
  } catch (e) {
    return null;                      // UNOBSERVABLE: never an empty success
  }
}

// Build an execution witness for a target site.
//
//   target  { module, callable, line }  the line is optional; without it only entry is judged
//
// The witness answers one question and records how it knows: CAN REALITY BE MADE TO TOUCH THIS CODE?
export function witnessFor({ rootDir, packageName, setup, invocation, target, provenance,
  namespaceModule = '' }) {
  const r = observe({ rootDir, packageName, setup, invocation, namespaceModule });
  const base = { target, invocation, setup, provenance, namespaceModule, replayable: false };
  if (r === null) {
    return { ...base, state: WITNESS.UNOBSERVABLE,
      why: 'the invocation could not be run at all, so nothing is claimed' };
  }
  if (String(r.status).startsWith('SETUP_FAILED')) {
    return { ...base, state: WITNESS.INVOCATION_FAILED, status: r.status,
      why: 'the setup for this invocation failed, so it never became an experiment' };
  }

  // If nothing from the intended corpus was traced but foreign copies were, the experiment was pointed at
  // the wrong code and no claim may be made about the source under test.
  if ((r.entered || []).length === 0 && (r.foreignSources || []).length > 0) {
    return { ...base, state: WITNESS.UNOBSERVABLE, foreignSources: r.foreignSources,
      why: 'execution went to a DIFFERENT copy of the package than the one under test: '
        + r.foreignSources[0] };
  }

  const key = target.module.replace(/\.py$/, '') + '.' + target.callable;
  const entered = (r.entered || []).includes(key);

  // A RAISE is not automatically an invalid witness: if the target was entered, reality did touch the
  // code, and an exception may be exactly the behaviour under test.
  if (!entered) {
    return { ...base, state: String(r.status).startsWith('RAISED:')
      ? WITNESS.INVOCATION_FAILED : WITNESS.FUNCTION_NOT_ENTERED,
    status: r.status, entered: r.entered,
    why: String(r.status).startsWith('RAISED:')
      ? 'the call raised before entering the target, so it never became an experiment'
      : 'the invocation succeeded and the target never ran: another implementation has authority' };
  }

  if (target.line === undefined || target.line === null) {
    return { ...base, state: WITNESS.SITE_REACHED, status: r.status, value: r.value,
      entered: r.entered, replayable: true,
      outcome: String(r.status).startsWith('RAISED:') ? 'RAISED' : 'RETURNED',
      why: 'the target callable was entered; no specific site was requested. Entering and RAISING is'
        + ' still reality touching the code - only a line target can say whether a deeper site ran' };
  }

  const siteKey = target.module.replace(/\.py$/, '') + ':' + target.line;
  const reached = (r.lines || []).includes(siteKey);
  return { ...base,
    state: reached ? WITNESS.SITE_REACHED : WITNESS.SITE_NOT_REACHED,
    status: r.status, value: r.value, entered: r.entered, replayable: reached,
    linesInTarget: (r.lines || []).filter((l) => l.startsWith(target.module.replace(/\.py$/, '') + ':')).length,
    why: reached
      ? 'the exact site executed: an authority experiment on this line is valid'
      : 'the callable ran but this line did not execute in this environment: the path is not'
        + ' exercised here, which is NOT the same as the source lacking authority' };
}

// Only witnesses that actually reached the site may license an experiment.
export const isValidExperiment = (w) => w && w.state === WITNESS.SITE_REACHED;

// A witness must replay. One that worked once and cannot be reproduced is an anecdote.
export function replay(w, { rootDir, packageName }) {
  const again = witnessFor({ rootDir, packageName, setup: w.setup, invocation: w.invocation,
    target: w.target, provenance: w.provenance, namespaceModule: w.namespaceModule });
  return { reproduced: again.state === w.state && again.value === w.value, state: again.state };
}

export { NL };
