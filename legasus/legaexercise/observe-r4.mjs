// r4 — the execution witness, rebuilt on an ISOLATED channel.
//
// Same question as r3's observe(): CAN REALITY BE MADE TO TOUCH THIS CODE? Same tracer, same states, same
// non-vacuity discipline. The single change is that the protocol no longer shares a transport with the
// subject, which is the violated invariant Repo C demonstrated (V1).
//
// r3's observe() is deliberately left intact and importable, so the two can be run side by side on the
// same corpus. A repair that cannot be A/B compared against the thing it repaired is a claim, not a
// measurement.
import { FINGERPRINT_SRC } from './pysite.mjs';
import { runIsolated } from './channel.mjs';

const NL = String.fromCharCode(10);

export function observeIsolated({ rootDir, packageName, setup = [], invocation,
  namespaceModule = '', timeoutMs = 30000 }) {
  const body = [
    'import sys, json, os, importlib',
    'sys.path.insert(0, sys.argv[1])',
    'pkg = sys.argv[2]',
    FINGERPRINT_SRC,
    'entered = set(); lines = set(); qlines = set(); enteredq = set(); sources = set()',
    'root = os.path.abspath(sys.argv[1]).replace("' + '\\\\' + '", "/")',
    'marker = "/" + pkg + "/"',
    'def tracer(frame, event, arg):',
    '    code = frame.f_code',
    '    fn = code.co_filename.replace("' + '\\\\' + '", "/")',
    '    if marker not in fn:',
    '        return None',
    '    if not fn.startswith(root):',
    '        sources.add(fn)',
    '        return None',
    '    mod = os.path.basename(fn)[:-3]',
    '    if event == "call":',
    '        entered.add(mod + "." + code.co_name)',
    '        qual = getattr(code, "co_qualname", code.co_name)',
    '        enteredq.add(mod + "|" + qual + "#" + sitefp(code))',
    '        return tracer',
    '    if event == "line":',
    '        lines.add(mod + ":" + str(frame.f_lineno))',
    '        qlines.add(sitekey(mod, code, frame.f_lineno))',
    '    return tracer',
    'ns = {}',
    'nsmod = sys.argv[5] if len(sys.argv) > 5 else ""',
    'setup = json.loads(sys.argv[3])',
    'src = sys.argv[4]',
    'status = "OK"; rendered = None; setup_failed = False',
    'try:',
    '    if nsmod:',
    '        ns = dict(vars(importlib.import_module(nsmod)))',
    '    for line in setup:',
    '        exec(line, ns)',
    'except Exception as e:',
    '    setup_failed = True',
    '    status = "SETUP_FAILED:" + type(e).__name__',
    'if not setup_failed:',
    '    sys.settrace(tracer)',
    '    try:',
    '        try:',
    '            value = eval(compile(src, "<witness>", "eval"), ns)',
    '        except SyntaxError:',
    '            exec(compile(src, "<witness>", "exec"), ns)',
    '            value = None',
    '        rendered = repr(value)',
    '    except Exception as e:',
    '        status = "RAISED:" + type(e).__name__',
    '    finally:',
    '        sys.settrace(None)',
    '_emit({"status": status, "value": rendered, "entered": sorted(entered),',
    '       "lines": sorted(lines), "qlines": sorted(qlines), "enteredq": sorted(enteredq),',
    '       "foreignSources": sorted(sources)[:3]})',
  ].join(NL);

  const r = runIsolated({ body, timeoutMs,
    args: [rootDir, packageName, JSON.stringify(setup), invocation, namespaceModule] });

  if (r.protocol === null) {
    // STILL EXPLICITLY UNOBSERVABLE, and now for a reason that cannot be manufactured by the subject
    // printing. The subject's own output is preserved as evidence rather than discarded.
    return { status: 'UNOBSERVABLE', why: r.parseError || r.threw || 'no protocol was emitted',
      subjectBytes: r.subjectBytes, subjectOut: r.subjectOut.slice(0, 400) };
  }
  return { ...r.protocol, subjectBytes: r.subjectBytes };
}

export { NL };

// RETIRED IN THE r4 REPLAY RETIREMENT (see benchmarks/RETIREMENT.md).
//
// `observeSequential` and `observeSequentialChecked` lived here. Both reimplemented doctest DISCOVERY and
// SEQUENCING; the second also borrowed doctest's own OutputChecker for comparison. Neither produced
// anything the external producer does not, and keeping them would have maintained two competing
// representations of the same truth - which is precisely the condition that produced three separate
// defects in one night.
//
// WHAT REMAINS HERE IS WHAT THE PRODUCER CANNOT GIVE: `observeIsolated` reports traced execution SITES.
// doctest reports verdicts and never says which code objects ran, so site-level reachability is not
// duplicated authority and is not retired.
//
// The evidence those functions produced is PRESERVED and provenance-stamped in benchmarks/PROVENANCE.json.
// Retiring a mechanism is not deleting its history, and the records do not retroactively become CPython
// evidence because the newer boundary is better founded.
export const MODEL = {
  RECONSTRUCTED_PREFIX: 'RECONSTRUCTED_PREFIX',
};
