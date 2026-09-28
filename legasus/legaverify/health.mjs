// LEGAVERIFY — THE REPOSITORY HEALTH FLOOR, beneath every semantic check.
//
// T06 is why this exists. An ungated 1.5B answered a repair request with prose - "To correct the rule...
// Here's the corrected code:" - which was written into `calendar.py`. The module stopped importing. Every
// probe returned a harness error. The repository was destroyed, and nothing in the semantic layer was even
// reached, because there was no longer a module to ask questions of.
//
//     A CANDIDATE THAT CANNOT BE IMPORTED IS REJECTED BEFORE ANY SEMANTIC QUESTION IS ASKED.
//
// This is a FLOOR, not a verifier. It proves nothing about correctness. It exists so that the expensive,
// interesting checks are never the first line of defence against something this crude - and so that a
// harness error is never silently scored as a behavioural disagreement, which is exactly what happened in
// Run 0 before this existed.
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const NL = String.fromCharCode(10);

export const HEALTH = {
  OK: 'OK',
  DOES_NOT_PARSE: 'DOES_NOT_PARSE',
  DOES_NOT_IMPORT: 'DOES_NOT_IMPORT',
  UNOBSERVABLE: 'UNOBSERVABLE',
};

// Can every module in the working surface still be parsed and imported?
//
// Parse and import are separated on purpose: a file that parses but fails on import has a different
// defect (a bad module-level statement, a missing name) from one that is not Python at all, and the two
// are widened by different work.
export function repositoryHealth(dir, modules = null) {
  const files = modules || readdirSync(dir).filter((f) => f.endsWith('.py'));
  const prog = [
    'import sys, json, importlib, ast',
    'sys.path.insert(0, ' + JSON.stringify(dir) + ')',
    'out = {}',
    'for name in ' + JSON.stringify(files.map((f) => f.replace(/\.py$/, ''))) + ':',
    '    path = ' + JSON.stringify(dir) + ' + "/" + name + ".py"',
    '    try:',
    '        src = open(path, encoding="utf8", errors="replace").read()',
    '    except Exception as e:',
    '        out[name] = {"parses": False, "imports": False, "error": "unreadable: " + str(e)}',
    '        continue',
    '    try:',
    '        ast.parse(src)',
    '    except SyntaxError as e:',
    '        out[name] = {"parses": False, "imports": False, "error": str(e)}',
    '        continue',
    '    try:',
    '        importlib.import_module(name)',
    '        out[name] = {"parses": True, "imports": True, "error": None}',
    '    except Exception as e:',
    '        out[name] = {"parses": True, "imports": False, "error": type(e).__name__ + ": " + str(e)}',
    'print(json.dumps(out))',
  ].join(NL);

  let parsed;
  try {
    const raw = execFileSync('python', ['-c', prog],
      { encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] });
    parsed = JSON.parse(raw);
  } catch (e) {
    // The floor could not be measured. That is UNOBSERVABLE, never OK - the non-vacuity law applies to
    // health exactly as it applies to everything else.
    return { status: HEALTH.UNOBSERVABLE, modules: {},
      why: 'the health check itself could not be run: ' + String(e.message).split(NL)[0] };
  }

  const broken = Object.entries(parsed).filter(([, v]) => !v.imports);
  if (!broken.length) {
    return { status: HEALTH.OK, modules: parsed, why: 'every module parses and imports' };
  }
  const unparseable = broken.filter(([, v]) => !v.parses);
  return {
    status: unparseable.length ? HEALTH.DOES_NOT_PARSE : HEALTH.DOES_NOT_IMPORT,
    modules: parsed,
    broken: broken.map(([k, v]) => k + ': ' + v.error),
    why: (unparseable.length ? unparseable.length + ' module(s) do not parse'
      : broken.length + ' module(s) do not import')
      + ' - no semantic question is meaningful until that is fixed',
  };
}

// The gate a candidate must clear before PROVE spends anything on it.
export function healthGate(dir, modules) {
  const h = repositoryHealth(dir, modules);
  return {
    admit: h.status === HEALTH.OK,
    status: h.status,
    why: h.why,
    broken: h.broken || [],
    // UNOBSERVABLE is explicitly NOT an admission. A floor that admits when it cannot see is not a floor.
    observable: h.status !== HEALTH.UNOBSERVABLE,
  };
}

export { NL };
