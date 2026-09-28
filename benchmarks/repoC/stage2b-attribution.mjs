// REPO C, STAGE 2b — PER-EXAMPLE ATTRIBUTION, because three claims in the stage 1-2 write-up were
// aggregations that had not been individually established.
//
//   CLAIM 1  "43 unobservable examples are the stdout-corruption chain"
//            A-E were probed. F - that this chain explains EACH of the 43 - was not.
//   CLAIM 2  "the 44 SETUP_FAILED|UNEXPECTED_EXCEPTION are correct"
//            CPython failing 7/7 in pyparsing.actions establishes the phenomenon, not the bucket. And
//            both systems saying "failure" is not reason-topology correspondence: the external failure
//            could be at execution rather than at setup.
//   CLAIM 3  the 182 -> 180 denominator transition had no stated reason.
//
// Collapsing "43 external PASSes" into "43 stdout failures" is exactly the aggregation Legasus itself
// prohibits. This script attributes each case or records it as UNATTRIBUTED.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const NL = String.fromCharCode(10);
const ROOT = 'benchmarks/repoC/pristine';
const sweep = JSON.parse(readFileSync('benchmarks/repoC/sweep.json', 'utf8'));

// ---- CLAIM 3 FIRST: reconstruct the denominator mechanically.
const keyOf = (r) => r.module.replace(/\.py$/, '') + '|' + r.invocation.trim();
const counts = new Map();
for (const r of sweep.runs) counts.set(keyOf(r), (counts.get(keyOf(r)) || 0) + 1);
const dupKeys = [...counts.entries()].filter(([, n]) => n > 1);
const dupRuns = dupKeys.reduce((a, [, n]) => a + n, 0);
console.log('DENOMINATOR');
console.log('  mined by r3                        : ' + sweep.runs.length);
console.log('  distinct (module|source) keys      : ' + counts.size);
console.log('  keys carrying MORE THAN ONE run    : ' + dupKeys.length
  + '  covering ' + dupRuns + ' runs');
console.log('  -> the contingency table matched r3 RUNS against a Map of DISTINCT external keys, so a');
console.log('     single external verdict can be reused by several r3 runs. That is a real denominator');
console.log('     weakness and it is disclosed rather than smoothed.');

// ---- CLAIM 1: does each unobservable example actually emit stdout?
const PROBE = [
  'import sys, json, io, contextlib, importlib',
  'sys.path.insert(0, sys.argv[1])',
  'spec = json.loads(sys.argv[2])',
  'sink = io.StringIO()',
  'printed = False; err = None',
  'try:',
  '    with contextlib.redirect_stdout(sink), contextlib.redirect_stderr(io.StringIO()):',
  '        mod = importlib.import_module(spec["dotted"])',
  '        ns = dict(vars(mod))',
  '        for line in spec["setup"]:',
  '            try:',
  '                exec(line, ns)',
  '            except Exception:',
  '                pass',
  '        try:',
  '            eval(compile(spec["invocation"], "<x>", "eval"), ns)',
  '        except SyntaxError:',
  '            exec(compile(spec["invocation"], "<x>", "exec"), ns)',
  '        except Exception as e:',
  '            err = type(e).__name__',
  '    printed = len(sink.getvalue()) > 0',
  'except BaseException as e:',
  '    err = type(e).__name__',
  'sys.stderr.write(json.dumps({"printed": printed, "err": err,',
  '                             "nbytes": len(sink.getvalue())}))',
].join(NL);

const probe = (spec) => {
  const s = spawnSync('python', ['-c', PROBE, ROOT, JSON.stringify(spec)],
    { encoding: 'utf8', timeout: 60000,
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
  try { return JSON.parse(s.stderr); } catch (e) { return null; }
};

const unobs = sweep.runs.filter((r) => r.status === 'UNOBSERVABLE');
console.log('');
console.log('CLAIM 1 — per-example attribution of the ' + unobs.length + ' UNOBSERVABLE runs');
const attribution = { PRINTS: 0, SILENT: 0, UNATTRIBUTED: 0 };
const silent = [];
for (const r of unobs) {
  const p = probe({ dotted: r.dotted, setup: r.setup, invocation: r.invocation });
  if (p === null) { attribution.UNATTRIBUTED++; continue; }
  if (p.printed) attribution.PRINTS++;
  else { attribution.SILENT++; silent.push({ inv: r.invocation.slice(0, 60), err: p.err }); }
}
console.log('  emits stdout (chain applies)       : ' + attribution.PRINTS);
console.log('  SILENT - chain does NOT apply      : ' + attribution.SILENT);
console.log('  probe itself unattributable        : ' + attribution.UNATTRIBUTED);
for (const s of silent.slice(0, 8)) console.log('     silent: ' + s.inv + '   err=' + s.err);

// ---- CLAIM 2: reason-topology for SETUP_FAILED. r3 says "a preceding example raised". Supported only if
// an EARLIER example in the same docstring also fails externally.
const extRaw = JSON.parse(readFileSync('benchmarks/repoC/external.json', 'utf8'));
const extBy = new Map();
for (const x of extRaw) if (x.source) extBy.set(x.module.split('.').pop() + '|' + String(x.source).trim(), x.outcome);

const setupFailed = sweep.runs.filter((r) => String(r.status).startsWith('SETUP_FAILED'));
let supported = 0; let unsupported = 0; let noSetup = 0;
for (const r of setupFailed) {
  if (!r.setup.length) { noSetup++; continue; }
  const mod = r.module.replace(/\.py$/, '');
  const earlierFails = r.setup.some((s) => {
    const o = extBy.get(mod + '|' + String(s).trim());
    return o === 'OUTPUT_MISMATCH' || o === 'UNEXPECTED_EXCEPTION';
  });
  if (earlierFails) supported++; else unsupported++;
}
console.log('');
console.log('CLAIM 2 — REASON topology for the ' + setupFailed.length + ' SETUP_FAILED runs');
console.log('  an EARLIER example in the same docstring also fails externally : ' + supported);
console.log('  no earlier example fails externally (reason unsupported)       : ' + unsupported);
console.log('  r3 said SETUP_FAILED with an EMPTY setup (impossible reason)   : ' + noSetup);
console.log('  -> "both systems report failure" is NOT reason correspondence. Only the first row is.');

writeFileSync('benchmarks/repoC/attribution.json', JSON.stringify({
  denominator: { minedRuns: sweep.runs.length, distinctKeys: counts.size,
    duplicateKeys: dupKeys.length, runsUnderDuplicateKeys: dupRuns },
  claim1: attribution, silentExamples: silent.slice(0, 20),
  claim2: { supported, unsupported, noSetup, total: setupFailed.length },
}, null, 1), 'utf8');
console.log('');
console.log('wrote benchmarks/repoC/attribution.json');
