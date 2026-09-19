// REPO B ADMISSION — every candidate, with enough provenance to reconstruct why it exists.
//
// The audit trail this produces is the point:
//
//     repository -> mechanical enumeration -> candidate population -> ADMISSION -> frozen manifest
//         -> sampling -> inference
//
// Nobody, including future me, gets to quietly choose nicer tasks between those stages. The manifest is
// hashed and committed BEFORE the evaluation sample is drawn.
//
// THREE OUTCOMES ARE KEPT APART, because conflating them would misattribute my apparatus's limits to the
// architecture's:
//
//     ADMITTED           unique anchor, runtime-authoritative source, mutation bites, oracle available
//     APPARATUS_INVALID  MY harness cannot observe this candidate - e.g. a method needing a constructed
//                        receiver my crude probe generator cannot build. NOT a Legasus limitation.
//     r2 REFUSES         frozen r2 says it cannot represent/generate/constrain/verify this operation.
//                        THIS is the coverage result.
//
// A method is classified through r2's EXISTING unknown-operation path. No method support is being added:
// the capability map has no entry for editing a method body, so `assess` returns CANNOT_REPRESENT, which
// is the honest prospective answer rather than a new feature invented to flatter the number.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, existsSync, copyFileSync }
  from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { locate, applyMutation, runtimeAuthority, runProbe, VERDICT } from '../devrepo/admission.mjs';
import { assess, envelopeOfInstance, OPERATION } from '../../legasus/legacore/capability.mjs';
import { makeTally, observed, unobservable, conclude } from '../../legasus/legalabs/nonvacuity.mjs';

const NL = String.fromCharCode(10);
const PKG = 'benchmarks/repoB/pristine/packaging';
const WORK = 'benchmarks/repoB/.admit';
const CANDS = JSON.parse(readFileSync('benchmarks/repoB/candidates.json', 'utf8'));

function freshWork() {
  if (existsSync(WORK)) rmSync(WORK, { recursive: true, force: true });
  mkdirSync(join(WORK, 'packaging'), { recursive: true });
  for (const f of readdirSync(PKG)) {
    if (f.endsWith('.py')) copyFileSync(join(PKG, f), join(WORK, 'packaging', f));
  }
}

// r2's operation classification. A METHOD has no declared capability, so this deliberately returns a name
// the SUPPORTED map does not contain - the unknown-operation path, not a new operation class.
function operationOf(c) {
  if (c.method) return 'METHOD_BODY_EDIT';
  return OPERATION.BOUNDED_FUNCTION_BODY_EDIT;
}

freshWork();
const tally = makeTally('repo B admission');
const manifest = [];
const repoHash = createHash('sha256');
for (const f of readdirSync(PKG).filter((x) => x.endsWith('.py')).sort()) {
  repoHash.update(readFileSync(join(PKG, f)));
}
const repositoryDigest = repoHash.digest('hex').slice(0, 16);

for (const c of CANDS) {
  const modulePath = 'packaging/' + c.file;
  const src = readFileSync(join(PKG, c.file), 'utf8');
  const loc = locate(src, c.anchorLF);
  const operation = operationOf(c);
  const row = {
    repositoryDigest,
    file: c.file, callable: c.fn, kind: c.method ? 'METHOD' : 'FUNCTION', cls: c.cls,
    operator: c.operator, operatorWhy: c.why,
    anchor: c.anchorLF.trim().slice(0, 100), mutation: c.replacement.trim().slice(0, 100),
    anchorUnique: loc.count === 1, newlineConvention: loc.convention,
    runtimeAuthority: null, bites: null, derivedEnvelope: null, capabilityReason: null,
    oracleType: 'RESTORE', admission: null,
  };

  // r2's verdict FIRST, because it costs nothing and is the coverage result.
  const verdict = assess({ operation, runtimeAuthoritative: true });
  row.capabilityReason = verdict.admit ? 'admitted' : verdict.refusal;
  row.derivedEnvelope = envelopeOfInstance({ operation, runtimeAuthoritative: true }).envelope;

  if (!row.anchorUnique) {
    row.admission = 'APPARATUS_INVALID';
    row.why = 'anchor occurs ' + loc.count + ' times';
    unobservable(tally, c.file + '::' + c.fn + ' ambiguous anchor');
    manifest.push(row); continue;
  }

  // A candidate my harness cannot probe is APPARATUS_INVALID, never a capability result.
  if (!c.calls || !c.calls.length) {
    row.admission = 'APPARATUS_INVALID';
    row.why = 'this harness cannot construct a receiver to observe a method; that is MY limitation,'
      + ' recorded separately from what r2 can represent';
    observed(tally);
    manifest.push(row); continue;
  }

  // THE PROBE MUST ACTUALLY EXERCISE THE FUNCTION BEFORE THE CANARY MEANS ANYTHING.
  //
  // A canary that does not surface has two possible causes, and they are not the same finding:
  //   the source is not authoritative                    -> SHADOWED_SOURCE, a real result
  //   my crude arguments raised before reaching the line -> APPARATUS_INVALID, my limitation
  //
  // Reporting the second as the first would have produced "12 shadowed sources in a pure-Python package",
  // which is false. So a probe is only used if it RUNS CLEANLY against pristine first.
  const dottedName = 'packaging.' + c.file.replace(/\.py$/, '');
  let liveCall = null;
  for (const call of c.calls) {
    let out;
    try { out = runProbe('benchmarks/repoB/pristine', dottedName, call); } catch (e) { continue; }
    if (!out.startsWith('RAISED:') && !out.startsWith('HARNESS')) { liveCall = call; break; }
  }
  if (!liveCall) {
    row.admission = 'APPARATUS_INVALID';
    row.why = 'no generated probe calls this function successfully, so nothing can be concluded about'
      + ' whether the source participates in its behaviour';
    observed(tally);
    manifest.push(row); continue;
  }

  // Runtime authority, proven by canary.
  //
  // IMPORTED AS A PACKAGE SUBMODULE, not as a standalone file. The first version pointed sys.path at the
  // package directory and imported `tags`, which fails on every relative import inside it - so the canary
  // never surfaced and all 14 pure-Python functions were reported SHADOWED_SOURCE. Fourteen shadowed
  // sources in a package with no C accelerators is not a finding, it is a broken probe, and checking that
  // before reporting it is the whole discipline.
  const auth = runtimeAuthority({ dir: WORK, moduleName: 'packaging.' + c.file.replace(/\.py$/, ''),
    src, anchorLF: c.anchorLF, callSource: liveCall,
    indent: (c.anchorLF.match(/^\s*/) || [''])[0],
    writePath: join(WORK, 'packaging', c.file), fn: c.fn });
  row.runtimeAuthority = auth.authoritative;
  row.functionEntered = auth.functionEntered;
  if (auth.authoritative !== true) {
    // Three different things, kept apart. Calling a platform branch SHADOWED would be a false finding.
    row.admission = auth.authoritative === null ? 'APPARATUS_INVALID'
      : auth.functionEntered === true ? 'NOT_EXERCISED_IN_THIS_ENVIRONMENT'
        : auth.functionEntered === false ? 'SHADOWED_SOURCE' : 'APPARATUS_INVALID';
    row.why = auth.why;
    observed(tally);
    manifest.push(row); continue;
  }

  // Does the mutation bite?
  const mutated = applyMutation(src, c.anchorLF, c.replacement);
  const target = join(WORK, 'packaging', c.file);
  let differs = 0; let harness = 0;
  try {
    writeFileSync(target, mutated.text, 'utf8');
    for (const call of c.calls) {
      let good; let bad;
      const dotted = 'packaging.' + c.file.replace(/\.py$/, '');
      try {
        good = runProbe('benchmarks/repoB/pristine', dotted, call);
        bad = runProbe(WORK, dotted, call);
      } catch (e) { harness++; continue; }
      if (good !== bad) differs++;
    }
  } finally { writeFileSync(target, src, 'utf8'); }

  row.bites = differs;
  if (harness === c.calls.length) {
    row.admission = 'APPARATUS_INVALID';
    row.why = 'no probe could be evaluated';
  } else if (differs === 0) {
    row.admission = 'VOID_MUTATION';
    row.why = 'the mutation applied to authoritative source and changed nothing observable';
  } else {
    row.admission = 'ADMITTED';
    row.why = differs + ' of ' + c.calls.length + ' probes distinguish pristine from mutant';
  }
  observed(tally);
  manifest.push(row);
}

const payload = { repositoryDigest, generatedFrom: 'packaging', candidates: manifest.length,
  frozenAt: new Date().toISOString().slice(0, 10), rows: manifest };
const digest = createHash('sha256').update(JSON.stringify(payload.rows)).digest('hex').slice(0, 16);
payload.manifestDigest = digest;
writeFileSync('benchmarks/repoB/manifest.json', JSON.stringify(payload, null, 1), 'utf8');

console.log('  REPO B ADMISSION');
console.log('');
console.log(conclude(tally, { clean: 'every candidate was examined.',
  dirty: (n) => n + ' candidate(s) could not be examined.' }).text);
console.log('');
const by = (k) => manifest.reduce((a, r) => { a[r[k]] = (a[r[k]] || 0) + 1; return a; }, {});
console.log('  ADMISSION STATUS');
for (const [k, v] of Object.entries(by('admission'))) console.log('    ' + String(k).padEnd(20) + v);
console.log('');
console.log('  DERIVED ENVELOPE, by frozen r2');
for (const [k, v] of Object.entries(by('derivedEnvelope'))) console.log('    ' + String(k).padEnd(20) + v);
console.log('');
console.log('  CAPABILITY REASON');
for (const [k, v] of Object.entries(by('capabilityReason'))) console.log('    ' + String(k).padEnd(30) + v);
console.log('');
console.log('  BY CALLABLE KIND');
for (const [k, v] of Object.entries(by('kind'))) console.log('    ' + String(k).padEnd(20) + v);
console.log('');
console.log('  repository digest ' + repositoryDigest + '   manifest digest ' + digest);
console.log('  written -> benchmarks/repoB/manifest.json');
