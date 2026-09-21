/**
 * cjs-interception-probe.mjs - TRANSFER-BIND step 3: ask BIND's EXISTING mechanism whether it
 * can substitute a module in a CommonJS require. One question, four arms, no new transport.
 *
 *   node legasus/transfer/cjs-interception-probe.mjs <out-dir>
 *
 *   C  no mutant requested          -> must load SUBJECT   (the probe can see a load at all)
 *   A  identity copy requested      -> loads BASELINE if interception works   (T2 control)
 *   B  mutant requested             -> loads MUTANT if interception works     (T1)
 *   D  ESM subject + ESM mutant     -> must load ESM_MUTANT; separates "CJS bypasses the
 *                                      hook" from "the hook was never armed"
 *
 * The witness PASSES in arm B when interception silently fails, because it then ran against
 * the original module. That is the contract's R11 trap, so the verdict is read from the
 * served file's own load-time self-identification, NEVER from the witness outcome.
 *
 * The preload is used UNMODIFIED. No Module._load patch, no require hook, no transpilation
 * (contract prohibition 2). If the answer is no, the answer is no.
 */
import { writeFileSync, readFileSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const FIX = join(HERE, 'cjs-probe');
const PRELOAD = join(ROOT, 'legasus', 'preload.mjs');
const outDir = resolve(process.argv[2] || join(ROOT, 'legasus', 'out', 'transfer-engine'));
mkdirSync(outDir, { recursive: true });

const SUBJECT = join(FIX, 'subject.js');
const ESM_SUBJECT = join(FIX, 'esm-subject.mjs');
const arms = [
  { arm: 'C', witness: 'witness.js', subject: SUBJECT, requested: null, expectIfIntercepts: 'SUBJECT', why: 'no mutant requested; proves the marker is observable at all' },
  { arm: 'A', witness: 'witness.js', subject: SUBJECT, requested: join(FIX, 'baseline.js'), expectIfIntercepts: 'BASELINE', why: 'T2 control: identity copy; distinguishes substitution from its absence' },
  { arm: 'B', witness: 'witness.js', subject: SUBJECT, requested: join(FIX, 'mutant.js'), expectIfIntercepts: 'MUTANT', why: 'T1: the perturbation BIND would need to serve' },
  // Without this arm, "the hook did not substitute" is indistinguishable from "the hook was
  // never armed", and the CJS arms would say nothing about CJS. A control that cannot fire
  // is not a control (HAZARDS.md 3).
  { arm: 'D', witness: 'esm-witness.mjs', subject: ESM_SUBJECT, requested: join(FIX, 'esm-mutant.mjs'), expectIfIntercepts: 'ESM_MUTANT', why: 'probe control: the SAME mechanism on an ESM import, where it is known to work' },
];

const results = [];
for (const a of arms) {
  const trace = join(outDir, `cjs-probe.${a.arm}.jsonl`);
  rmSync(trace, { force: true });
  const env = { ...process.env, LEGASUS_PROBE_TRACE: trace, LEGASUS_SUBJECT: a.subject, ...(a.requested ? { LEGASUS_MUTANT: a.requested } : {}) };
  const r = spawnSync(process.execPath, ['--import', pathToFileURL(PRELOAD).href, join(FIX, a.witness)],
    { cwd: FIX, env, encoding: 'utf8', timeout: 30_000 });
  let marks = [];
  try { marks = readFileSync(trace, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { /* no marker arrived */ }
  const loaded = marks.length ? marks[marks.length - 1].loaded : null;
  const caseLines = ((r.stdout || '').match(/^(PASS|FAIL) /gm) || []);
  results.push({
    arm: a.arm, why: a.why,
    requestedIdentity: a.requested ? a.expectIfIntercepts : null,
    executedIdentity: loaded,                       // null = SUBSTITUTION_UNOBSERVED
    interceptionObserved: a.requested ? (loaded === a.expectIfIntercepts) : null,
    witnessExit: r.status, witnessCases: caseLines.length,
    witnessOutcomes: caseLines.map((s) => s.trim()),
    markerLines: marks.length, spawnError: r.error ? r.error.message : null,
    stdoutTail: (r.stdout || '').trim().split('\n').slice(-2).join(' | '),
    stderrTail: (r.stderr || '').trim().split('\n').slice(-2).join(' | ').slice(0, 300),
  });
}

const C = results.find((x) => x.arm === 'C');
const A = results.find((x) => x.arm === 'A');
const B = results.find((x) => x.arm === 'B');
const D = results.find((x) => x.arm === 'D');

let verdict;
if (C.executedIdentity !== 'SUBJECT' || C.witnessCases !== 2) {
  verdict = { status: 'APPARATUS_FAILURE', reason: `arm C did not observe a plain load (executedIdentity=${C.executedIdentity}, cases=${C.witnessCases}); the probe cannot see what it is asking about - burn` };
} else if (!D.interceptionObserved) {
  verdict = { status: 'APPARATUS_FAILURE', reason: `arm D (ESM, the mechanism's home ground) did not substitute either: executed ${D.executedIdentity}, requested ESM_MUTANT. The hook was never armed in this probe, so the CJS arms are evidence about the probe, not about CommonJS - burn` };
} else if (A.interceptionObserved && B.interceptionObserved) {
  verdict = { status: 'INTERCEPTS', reason: 'both requested identities were the ones executed; T1 FALSIFIED - BIND\'s existing mechanism substitutes a CommonJS require on this Node' };
} else if (!A.interceptionObserved && !B.interceptionObserved) {
  verdict = { status: 'CANNOT_ATTACH: UNSUPPORTED_MODULE_INTERCEPTION',
    reason: `the ESM resolve hook DID substitute an ESM import in the same probe (arm D executed ${D.executedIdentity}, witness exit ${D.witnessExit}) and did NOT answer a CommonJS require: arm A executed ${A.executedIdentity} (requested BASELINE), arm B executed ${B.executedIdentity} (requested MUTANT). Arm B's witness exited ${B.witnessExit} with ${B.witnessOutcomes.filter((o) => o === 'PASS').length} PASS - the false success R11 exists to catch, caught by the marker and not by the outcome.` };
} else {
  verdict = { status: 'AMBIGUOUS', reason: `arms disagree: A intercepted=${A.interceptionObserved}, B intercepted=${B.interceptionObserved}; no evidential conclusion` };
}

const out = { at: new Date().toISOString(), node: process.version, platform: process.platform,
  mechanism: 'module.register + ESM resolve hook (legasus/preload.mjs, unmodified)',
  fixture: { root: FIX, moduleSystem: 'commonjs (nested package.json type:commonjs; foreign subject has no package.json at all - stated difference)' },
  arms: results, verdict };
writeFileSync(join(outDir, 'cjs-interception-probe.json'), JSON.stringify(out, null, 2));

for (const r of results) console.log(`  arm ${r.arm}  requested=${String(r.requestedIdentity).padEnd(8)} executed=${String(r.executedIdentity).padEnd(8)} intercepted=${String(r.interceptionObserved).padEnd(5)} witness exit=${r.witnessExit} cases=${r.witnessCases} [${r.witnessOutcomes.join(',')}]`);
console.log(`VERDICT: ${verdict.status}`);
console.log(`         ${verdict.reason}`);
console.log(`-> ${join(outDir, 'cjs-interception-probe.json')}`);
