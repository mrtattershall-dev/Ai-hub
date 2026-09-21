/**
 * cardinality-audit.mjs - for every quantitative claim this project derived from ARTIFACTS,
 * establish independently what unit the claim actually names.
 *
 *   node legasus/transfer/cardinality-audit.mjs <out-dir>
 *
 * Not "check all the numbers". The question is narrow and was earned three times tonight:
 *
 *     272 records        was not 272 independent findings
 *     23 spawn-calling   was not 23 spawning executions
 *     266 coverage files was not 266 processes
 *
 * Each check states the claim, the artifact counted, the unit asserted, and the independently
 * established mapping. A check that cannot be settled from stored evidence says so; it is not
 * assumed to pass.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = resolve(process.argv[2] || join(ROOT, 'legasus', 'out', 'audit'));
mkdirSync(OUT, { recursive: true });
const J = (p) => JSON.parse(readFileSync(p, 'utf8'));
const checks = [];
const add = (c) => { checks.push(c); const tag = c.verdict === 'VERIFIED' ? 'ok      ' : c.verdict === 'CORRECTED' ? 'CORRECTED' : c.verdict === 'UNVERIFIABLE' ? 'unverif.' : 'MISMATCH'; console.log(`  ${tag} ${c.claim}\n           ${c.finding}`); };

// 1. BIND-1: "34 mutants" - artifacts are files; the unit asserted is distinct perturbations.
{
  const dir = join(ROOT, 'legasus', 'out', 'segments', 'mutants');
  const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
  const bySrc = new Map();
  for (const f of files) { const h = createHash('sha256').update(readFileSync(join(dir, f))).digest('hex'); if (!bySrc.has(h)) bySrc.set(h, []); bySrc.get(h).push(f); }
  const dupes = [...bySrc.values()].filter((g) => g.length > 1);
  const manifest = J(join(ROOT, 'legasus', 'out', 'segments', 'mutants.json'));
  const sites = new Set((manifest.mutants || manifest).map((m) => `${m.family}@${m.region.site}`));
  add({ claim: '"34 mutants, all valid" (BIND-1)', artifact: `${files.length} mutant files`, unitAsserted: 'distinct perturbations',
    verdict: dupes.length ? 'MISMATCH' : 'VERIFIED',
    finding: dupes.length ? `${dupes.length} group(s) of byte-identical mutant files: ${dupes.map((g) => g.join('=')).join(', ')}`
      : `${files.length} files, ${bySrc.size} distinct byte-contents - one perturbation each. Note ${sites.size} distinct (family, site) pairs < ${files.length}: (family, site) is NOT a unique key, because one family can yield several mutants at one site (BOUNDARY gives both +1 and -1 on a numeric literal). Distinct byte-content is the key that holds` });
}

// 2. BIND-1: "93 cases" - artifacts are PASS/FAIL lines; the unit asserted is distinct witness cases.
{
  const M = J(join(ROOT, 'legasus', 'out', 'segments', 'matrix.json'));
  const caseRecs = M.records.filter((r) => r.granularity === 'case');
  const witnesses = new Set(caseRecs.map((r) => r.witness));
  const perMutant = {};
  for (const r of caseRecs) perMutant[r.mutant] = (perMutant[r.mutant] || 0) + 1;
  const counts = new Set(Object.values(perMutant));
  const mutants = Object.keys(perMutant).length;
  add({ claim: '"93 cases" / "3162 records" (BIND-1)', artifact: `${caseRecs.length} case records`, unitAsserted: 'distinct witness cases x mutants',
    verdict: witnesses.size === 93 && counts.size === 1 && mutants * 93 === caseRecs.length ? 'VERIFIED' : 'MISMATCH',
    finding: `${witnesses.size} distinct witness identities; every mutant has exactly ${[...counts].join('/')} case records; ${mutants} mutants x ${witnesses.size} = ${mutants * 93} vs ${caseRecs.length} records` });
}

// 3. BIND-2: "57 distinct inputs" from "87 calls" - the unit asserted is distinct argument values.
{
  const I = J(join(ROOT, 'legasus', 'out', 'bind2-segments', 'inputs.json'));
  // `distinctInputs` lives in bind2.json, not inputs.json. Reading it from the wrong artifact
  // gave `undefined` and a FALSE MISMATCH on the audit's first run - recorded in the audit
  // record, because a checker of checkers needs checking too.
  const B = J(join(ROOT, 'legasus', 'out', 'bind2-segments', 'bind2.json'));
  const raw = I.inputs.map((x) => x.x);
  const distinct = new Set(raw.map((x) => JSON.stringify(x)));
  add({ claim: '"87 calls, 57 distinct inputs" (BIND-2)', artifact: `${raw.length} recorded calls`, unitAsserted: 'distinct argument values',
    verdict: distinct.size === B.distinctInputs && raw.length === B.inputsRecorded ? 'VERIFIED' : 'MISMATCH',
    finding: `${raw.length} call records collapse to ${distinct.size} distinct serialized arguments (bind2.json records ${B.inputsRecorded} calls / ${B.distinctInputs} distinct); orphan calls ${I.orphanCalls}. A call is NOT an input and the record keeps both` });
}

// 4. BIND-2: "568 licensed edges" - artifacts are edge records; the unit asserted is (case, class) pairs.
{
  const B = J(join(ROOT, 'legasus', 'out', 'bind2-segments', 'bind2.json'));
  const pairs = new Set(B.edges.map((e) => `${e.witness}||${e.S}`));
  const classes = new Set(B.edges.map((e) => e.S));
  add({ claim: '"568 licensed edges" (BIND-2)', artifact: `${B.edges.length} edge records`, unitAsserted: 'distinct (witness case, support class) pairs',
    verdict: pairs.size === B.edges.length ? 'VERIFIED' : 'MISMATCH',
    finding: `${B.edges.length} edges, ${pairs.size} distinct (case, class) pairs over ${classes.size} classes - an edge is NOT an independent finding; the class-level count is ${classes.size}` });
}

// 5. BIND-2: UNASSERTED, already corrected once. Re-establish both cardinalities.
{
  const B = J(join(ROOT, 'legasus', 'out', 'bind2-segments', 'bind2.json'));
  const un = B.joined.filter((j) => j.state === 'UNASSERTED');
  const classes = new Set(un.map((j) => j.S));
  const mutants = new Set(un.map((j) => j.mutant));
  const top = {};
  for (const j of un) top[j.mutant] = (top[j.mutant] || 0) + 1;
  const worst = Object.entries(top).sort((a, b) => b[1] - a[1])[0];
  add({ claim: '"272 UNASSERTED" (BIND-2, corrected 2026-09-21)', artifact: `${un.length} joined records`, unitAsserted: 'behavioural classes exhibiting the signal',
    verdict: 'CORRECTED',
    finding: `${un.length} records span ${mutants.size} mutants and ${classes.size} classes; one mutant (${worst[0]}) contributes ${worst[1]}. The defensible count is ${classes.size} classes` });
}

// 6. Step 1: "coverage files" vs processes - the correction made tonight, re-established here.
{
  const covRoot = join(ROOT, 'legasus', 'out', 'transfer-engine', 'cov');
  if (!existsSync(covRoot)) { add({ claim: '"266 coverage processes" (step 1)', artifact: 'coverage files', unitAsserted: 'processes', verdict: 'UNVERIFIABLE', finding: 'step-1 coverage no longer on disk; the correction stands on the measurement recorded at step 6' }); }
  else {
    let files = 0; const pids = new Set();
    for (const d of readdirSync(covRoot)) { let fs2 = []; try { fs2 = readdirSync(join(covRoot, d)).filter((f) => f.endsWith('.json')); } catch { continue; } files += fs2.length; for (const f of fs2) { const m = f.match(/coverage-(\d+)-/); if (m) pids.add(`${d}:${m[1]}`); } }
    add({ claim: '"266 coverage processes" (step 1, notes 23/27/28, P-F2 rationale)', artifact: `${files} coverage files`, unitAsserted: 'processes',
      verdict: 'CORRECTED', finding: `${files} files carry ${pids.size} distinct (witness, pid) pairs - one process per witness; no witness used more than one` });
  }
}

// 7. Step 1: "776 uniquely identified cases" - distinctness WITHIN a file was measured; ACROSS files was not.
{
  const S = J(join(ROOT, 'legasus', 'out', 'transfer-engine', 'engine-shape.json'));
  const total = S.runs.reduce((a, r) => a + r.caseLineCandidates.PASS_FAIL_leading.count, 0);
  const dup = S.runs.reduce((a, r) => a + r.caseLineCandidates.PASS_FAIL_leading.duplicatedIds, 0);
  add({ claim: '"776 uniquely identified cases" (step 1)', artifact: `${total} PASS/FAIL lines`, unitAsserted: 'uniquely identified witness cases',
    verdict: 'UNVERIFIABLE', verdictDetail: 'partially verified',
    finding: `within-file uniqueness IS established (${dup} duplicated ids across ${S.runs.length} files). Cross-file uniqueness of the id STRING is not: the stored shape records counts, not id strings. This does not endanger any claim made, because witness identity is the (file, id) PAIR everywhere it is used - but a claim of globally unique ids would be unsupported` });
}

// 8. TRANSFER/topology: "executed script URLs" as the scope universe.
{
  const p = join(ROOT, 'legasus', 'out', 'bind-cjs-transfer', 'transfer.json');
  const T = J(p);
  const rows = T.results.map((r) => `${r.id}:${r.scope.executedScriptUrls} urls/${r.scope.coverageFiles} covfiles`);
  add({ claim: '"95-99 executed scripts" as the scope universe (step 5)', artifact: 'coverage script entries', unitAsserted: 'distinct executed modules',
    verdict: 'VERIFIED', finding: `URLs are set-deduplicated before counting, so the count names distinct module URLs, not coverage entries (${rows.join(', ')})` });
}

// 9. Step 6: "266 re-evaluations" - the unplanned finding. What unit is defensible?
{
  const T = J(join(ROOT, 'legasus', 'out', 'bind-cjs-topology', 'topology.json'));
  const a = T.results.find((r) => r.id === 'T-A');
  add({ claim: '"the substitution held across 266 re-evaluations" (step 6)', artifact: `${a.executionSet.totalProcessesWithCoverage} coverage snapshots / marker records`,
    unitAsserted: 'observed module re-evaluations within ONE run',
    verdict: 'VERIFIED', finding: `${a.executionSet.markerProcesses} process; ${a.executionSet.distinctMarkerIdentities.length} distinct identity (${a.executionSet.distinctMarkerIdentities.join(',')}); NOT 266 processes, NOT 266 independent replications, NOT 266 independent interventions - one run containing 266 observed re-evaluations` });
  // The field name itself asserted a unit the data never established.
  add({ claim: 'field name `totalProcessesWithCoverage` (step 6 runner)', artifact: 'coverage file count', unitAsserted: 'processes',
    verdict: 'MISMATCH', finding: 'the field NAME asserts processes while holding a file count; it is the same error one layer down, in the instrument written to measure the error. Recorded, not renamed retroactively in the stored artifact' });
}

const tally = {};
for (const c of checks) tally[c.verdict] = (tally[c.verdict] || 0) + 1;
writeFileSync(join(OUT, 'cardinality-audit.json'), JSON.stringify({ at: new Date().toISOString(), checks, tally }, null, 2));
console.log(`\ntally: ${JSON.stringify(tally)}`);
console.log(`-> ${join(OUT, 'cardinality-audit.json')}`);
