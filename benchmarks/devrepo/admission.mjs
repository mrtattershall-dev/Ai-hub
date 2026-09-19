// TASK ADMISSION — seven conditions, none of them assumed.
//
// Two real-repository hazards forced this module into existence, and neither could arise in a synthetic
// family where the experimenter wrote every line:
//
//   REPRESENTATION MISMATCH      every stdlib file is CRLF, so a logically correct mutation operator
//                                written with \n failed to touch the intended bytes at all.
//   SOURCE != EXECUTION AUTHORITY  bisect.py contains a complete Python implementation that nothing
//                                runs: `from _bisect import *` rebinds the names to a C accelerator.
//
//     VISIBLE SOURCE DOES NOT IMPLY BEHAVIORAL AUTHORITY.
//
// That generalizes far past Python accelerators - generated code, wrappers, transpilation, caches,
// monkeypatching, dependency injection, feature flags, native extensions, build outputs and framework
// dispatch all produce it.
//
// THE PIPELINE:
//
//     TASK CANDIDATE
//        -> anchor unique?                       no -> INVALID_TASK_SPEC
//        -> mutation actually applied?           no -> APPARATUS_FAILURE
//        -> did execution depend on the source?  no -> SHADOWED_SOURCE
//        -> does it alter observable behaviour?  no -> VOID_MUTATION
//        -> VALID_REPAIR_TASK
//
// Newline convention is OBSERVED and PRESERVED rather than normalized away. Rewriting the corpus to LF
// would have modified the artifact before the experiment, turning a repository fact into an assumption.
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const NL = String.fromCharCode(10);
const CR = String.fromCharCode(13);

export const VERDICT = {
  VALID_REPAIR_TASK: 'VALID_REPAIR_TASK',
  INVALID_TASK_SPEC: 'INVALID_TASK_SPEC',
  APPARATUS_FAILURE: 'APPARATUS_FAILURE',
  SHADOWED_SOURCE: 'SHADOWED_SOURCE',
  VOID_MUTATION: 'VOID_MUTATION',
};

// The repository's own convention, observed from its bytes.
export function newlineConvention(src) {
  const crlf = (src.match(new RegExp(CR + NL, 'g')) || []).length;
  const bare = src.split(NL).length - 1 - crlf;
  if (crlf && !bare) return 'CRLF';
  if (bare && !crlf) return 'LF';
  if (!crlf && !bare) return 'NONE';
  return 'MIXED';
}

// Find an anchor written in LF against a file that may not be, WITHOUT rewriting the file. The anchor is
// translated into the file's convention; the file's bytes are never normalized.
export function locate(src, anchorLF) {
  const conv = newlineConvention(src);
  const anchor = conv === 'CRLF' ? anchorLF.split(NL).join(CR + NL) : anchorLF;
  const count = src.split(anchor).length - 1;
  return { convention: conv, anchor, count };
}

export function applyMutation(src, anchorLF, replacementLF) {
  const { convention, anchor, count } = locate(src, anchorLF);
  if (count !== 1) return { ok: false, count, convention };
  const replacement = convention === 'CRLF' ? replacementLF.split(NL).join(CR + NL) : replacementLF;
  return { ok: true, count, convention, text: src.replace(anchor, replacement) };
}

// Run a probe against a module directory. Returns the repr, or RAISED:Type, or throws for a harness
// failure - which the caller must record as unobservable rather than score.
export function runProbe(dir, moduleName, callSource) {
  const mod = moduleName.replace(/\.py$/, '');
  const prog = ['import sys', 'sys.path.insert(0, ' + JSON.stringify(dir) + ')',
    'import ' + mod + ' as m', 'try:', '    ' + callSource,
    'except Exception as e:', '    print("RAISED:" + type(e).__name__)'].join(NL);
  return execFileSync('python', ['-c', prog],
    { encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

// CONDITION 3, and the one bisect taught: does execution actually depend on the source we intend to edit?
//
// Proven, not assumed: a CANARY is injected at the target site - a syntactically valid statement that
// raises a uniquely identifiable exception. If invoking the behaviour does not surface the canary, the
// edited artifact is not on the execution path, whatever the file appears to contain.
export function runtimeAuthority({ dir, moduleName, src, anchorLF, callSource, indent = '    ' }) {
  const canaryLF = indent + 'raise RuntimeError("LEGASUS_CANARY_7F3A")' + NL + anchorLF;
  const mutated = applyMutation(src, anchorLF, canaryLF);
  if (!mutated.ok) return { authoritative: null, why: 'canary could not be placed', count: mutated.count };
  const target = join(dir, moduleName);
  const backup = readFileSync(target);
  try {
    writeFileSync(target, mutated.text, 'utf8');
    let out;
    try { out = runProbe(dir, moduleName, callSource); } catch (e) { out = 'HARNESS:' + e.message; }
    const surfaced = out.includes('LEGASUS_CANARY_7F3A') || out.includes('RAISED:RuntimeError');
    return { authoritative: surfaced, observed: out,
      why: surfaced
        ? 'the canary surfaced, so this source participates causally in the behaviour'
        : 'the canary did NOT surface: the behaviour does not traverse this source' };
  } finally {
    writeFileSync(target, backup);
  }
}

// The whole pipeline for one candidate task.
export function admit({ dir, pristineDir, moduleName, anchorLF, replacementLF, callSources,
  oracleModule }) {
  const src = readFileSync(join(pristineDir, moduleName), 'utf8');
  const loc = locate(src, anchorLF);
  if (loc.count !== 1) {
    return { verdict: VERDICT.INVALID_TASK_SPEC, convention: loc.convention,
      why: 'anchor occurs ' + loc.count + ' times; exactly one is required' };
  }

  const auth = runtimeAuthority({ dir, moduleName, src, anchorLF, callSource: callSources[0] });
  if (auth.authoritative === null) {
    return { verdict: VERDICT.APPARATUS_FAILURE, convention: loc.convention, why: auth.why };
  }
  if (!auth.authoritative) {
    return { verdict: VERDICT.SHADOWED_SOURCE, convention: loc.convention, why: auth.why,
      observed: auth.observed };
  }

  const mutated = applyMutation(src, anchorLF, replacementLF);
  const target = join(dir, moduleName);
  const backup = readFileSync(join(pristineDir, moduleName));
  let differs = 0; let harnessErrors = 0;
  try {
    writeFileSync(target, mutated.text, 'utf8');
    for (const call of callSources) {
      let good; let bad;
      try {
        good = runProbe(pristineDir, oracleModule || moduleName, call);
        bad = runProbe(dir, oracleModule || moduleName, call);
      } catch (e) { harnessErrors++; continue; }
      if (good !== bad) differs++;
    }
  } finally { writeFileSync(target, backup); }

  if (harnessErrors) {
    return { verdict: VERDICT.APPARATUS_FAILURE, convention: loc.convention,
      why: harnessErrors + ' probe(s) could not be evaluated' };
  }
  if (differs === 0) {
    return { verdict: VERDICT.VOID_MUTATION, convention: loc.convention,
      why: 'the mutation applied to authoritative source and still changed nothing observable' };
  }
  return { verdict: VERDICT.VALID_REPAIR_TASK, convention: loc.convention, distinguishing: differs,
    of: callSources.length, why: 'unique anchor, authoritative source, ' + differs + ' distinguishing probes' };
}

// How a refusal is classified matters as much as whether it happened: these say different things about
// what has to be widened next.
export const REFUSAL = {
  SAFE_REFUSAL_UNSUPPORTED_OPERATION: 'SAFE_REFUSAL_UNSUPPORTED_OPERATION',
  SAFE_REFUSAL_NONAUTHORITATIVE_SOURCE: 'SAFE_REFUSAL_NONAUTHORITATIVE_SOURCE',
  SAFE_REFUSAL_UNKNOWN_RUNTIME_PROVENANCE: 'SAFE_REFUSAL_UNKNOWN_RUNTIME_PROVENANCE',
};

export { NL, CR };
