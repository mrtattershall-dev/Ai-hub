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

// r4 / V2 — THE EXECUTION MODEL BECOMES AN EXPLICIT, RECORDED COORDINATE.
//
// Repo C measured the defect precisely: r3's stated reason was right 57 of 57 times - a preceding example
// really did fail - while the ENTAILMENT it drew was wrong 8 times. r3 concludes "this example cannot
// become an experiment" because ITS model requires the reconstructed prefix to succeed. doctest runs every
// example in a docstring in order over SHARED GLOBALS and carries on regardless, so those 8 ran and
// passed.
//
//     A FAILED PREFIX BLOCKS THE EXAMPLE ONLY UNDER RECONSTRUCTION. THAT IS A PROPERTY OF THE MODEL,
//     NOT OF THE SUBJECT.
//
// So the repair is not a smarter inference. It is to stop the model being an unrecorded assumption. Both
// models are available, each result carries the model it was produced under, and the two are DIFFERENT
// SUBJECTS - which is precisely what the `history` scope coordinate was admitted for. Comparing a
// RECONSTRUCTED_PREFIX result with a SEQUENTIAL_SHARED one is a scope mismatch the algebra already
// refuses, rather than a disagreement to be adjudicated.
//
// Per-example replayability is what the witness bank requires and is NOT abandoned; it is now one named
// model among two rather than the only one.
export const MODEL = {
  RECONSTRUCTED_PREFIX: 'RECONSTRUCTED_PREFIX',
  SEQUENTIAL_SHARED: 'SEQUENTIAL_SHARED',
};

// Run a whole docstring in doctest's own model: one namespace, every example attempted in order, a
// failure never preventing the next. Built on the V1 isolated channel, so the two repairs compose.
export function observeSequential({ rootDir, packageName, dotted, examples, timeoutMs = 120000 }) {
  const body = [
    'import sys, json, os, importlib',
    'sys.path.insert(0, sys.argv[1])',
    'spec = json.loads(sys.argv[2])',
    'out = []',
    'try:',
    '    ns = dict(vars(importlib.import_module(spec["dotted"])))',
    'except Exception as e:',
    '    _emit({"model": "SEQUENTIAL_SHARED", "importFailed": type(e).__name__, "results": []})',
    '    raise SystemExit(0)',
    'for ex in spec["examples"]:',
    '    status = "OK"; rendered = None',
    '    try:',
    '        try:',
    '            value = eval(compile(ex, "<witness>", "eval"), ns)',
    '        except SyntaxError:',
    '            exec(compile(ex, "<witness>", "exec"), ns)',
    '            value = None',
    '        rendered = repr(value)',
    '    except Exception as e:',
    '        status = "RAISED:" + type(e).__name__',
    '    out.append({"invocation": ex, "status": status, "value": rendered})',
    '_emit({"model": "SEQUENTIAL_SHARED", "results": out})',
  ].join(NL);
  const r = runIsolated({ body, timeoutMs,
    args: [rootDir, JSON.stringify({ dotted, examples })] });
  if (r.protocol === null) {
    return { model: MODEL.SEQUENTIAL_SHARED, unobservable: true,
      why: r.parseError || r.threw || 'no protocol emitted', results: [] };
  }
  return { ...r.protocol, subjectBytes: r.subjectBytes };
}

// r4 / V2b — ASSERTION EVALUATION, with the comparison DELEGATED rather than reimplemented.
//
// W2 failed and located this: SEQUENTIAL_SHARED observed execution only. It recorded whether an example
// raised and never compared the result against the documented output, so it could not detect an output
// mismatch at all - 2 of 5 slipped through as successes.
//
// THE COMPARISON IS DELEGATED TO doctest.OutputChecker. Reimplementing CPython's comparison rules -
// <BLANKLINE>, ELLIPSIS, whitespace normalisation, exception-detail matching - is exactly what produced
// the 86% agreement ceiling on packaging. THE AUTHORITY THAT DEFINES A COMPARISON SHOULD PERFORM IT.
//
// WHAT THIS IS AND IS NOT FOR. The purpose is to give the witness a FAITHFUL FAILURE VOCABULARY so that
// "the documented behaviour does not hold" becomes observable evidence at all. It is NOT to maximise
// agreement with doctest: the more this borrows doctest's own machinery, the less any agreement between
// them means. Agreement here is expected BY CONSTRUCTION and must not be reported as a finding.
//
// LAYERED CAPTURE. The V1 fd-level isolation protects the protocol from anything, including C extensions
// and children. A per-example Python-level redirect sits inside it purely to ATTRIBUTE output to the
// right example. If a native write escapes attribution it still lands in the subject file rather than
// corrupting evidence.
export function observeSequentialChecked({ rootDir, packageName, dotted, examples,
  timeoutMs = 120000 }) {
  const body = [
    'import sys, json, os, io, contextlib, importlib, doctest, traceback',
    'sys.path.insert(0, sys.argv[1])',
    'spec = json.loads(sys.argv[2])',
    'checker = doctest.OutputChecker()',
    'flags = 0',
    'out = []',
    'try:',
    '    ns = dict(vars(importlib.import_module(spec["dotted"])))',
    'except Exception as e:',
    '    _emit({"model": "SEQUENTIAL_SHARED_CHECKED", "importFailed": type(e).__name__,',
    '           "results": []})',
    '    raise SystemExit(0)',
    'for ex in spec["examples"]:',
    '    src = ex["invocation"]; want = ex.get("wants") or ""',
    '    sink = io.StringIO(); exc = None',
    '    try:',
    '        with contextlib.redirect_stdout(sink):',
    '            try:',
    '                value = eval(compile(src, "<w>", "eval"), ns)',
    '                if value is not None:',
    '                    sink.write(repr(value) + chr(10))',
    '            except SyntaxError:',
    '                exec(compile(src, "<w>", "exec"), ns)',
    '    except Exception:',
    '        exc = traceback.format_exc()',
    '    got = sink.getvalue()',
    '    if exc is not None:',
    '        # doctest treats a documented Traceback as an EXPECTATION, not a failure.',
    '        if want.strip().startswith("Traceback"):',
    '            ok = checker.check_output(want, exc, flags)',
    '            outcome = "PASS" if ok else "UNEXPECTED_EXCEPTION"',
    '        else:',
    '            outcome = "UNEXPECTED_EXCEPTION"',
    '    else:',
    '        outcome = "PASS" if checker.check_output(want, got, flags) else "OUTPUT_MISMATCH"',
    '    out.append({"invocation": src, "outcome": outcome, "got": got[:400],',
    '                "raised": exc is not None})',
    '_emit({"model": "SEQUENTIAL_SHARED_CHECKED", "results": out})',
  ].join(NL);
  const r = runIsolated({ body, timeoutMs, args: [rootDir, JSON.stringify({ dotted, examples })] });
  if (r.protocol === null) {
    return { model: 'SEQUENTIAL_SHARED_CHECKED', unobservable: true,
      why: r.parseError || r.threw || 'no protocol emitted', results: [] };
  }
  return { ...r.protocol, subjectBytes: r.subjectBytes };
}
