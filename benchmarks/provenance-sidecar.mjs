// r4 — PROVENANCE SIDECARS for historical evidence. Required before any retirement.
//
// R3 FAILED. Not one historical evidence artifact can say what produced it:
//
//     repoC/sweep.json       corpus, minedCount, failedSetup, ...   no producer, no semantics, no version
//     repoB/sweep.json       same
//     repoC/calibration.json same
//
// So deleting the replay implementation would leave those records UNATTRIBUTABLE - you could no longer
// tell whether a status came from r3's replay, from r4's isolated witness, or from CPython. THE LEDGER
// WAS NOT PRESERVING EVIDENCE INDEPENDENTLY OF MACHINERY, which is the thing it exists to do.
//
// THE SIDECAR IS AN ANNOTATION WITH ITS OWN EVIDENCE, NOT A RETROACTIVE ASSERTION. The artifacts are NOT
// modified - rewriting recorded evidence to make it tidier is exactly what must never happen. Instead a
// separate record attests provenance, and its evidence is git: the commit that last wrote each artifact,
// and what implementation existed at that commit. Where git cannot say, the sidecar records UNKNOWN
// rather than a guess.
import { writeFileSync, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { bind, ledger } from '../legasus/legaknow/provenance.mjs';

// ENUMERATED, not hand-listed. The first version carried a hand-written list that named five repoB
// artifacts which never existed, and reported R3 as failing because of MY list rather than because of any
// missing provenance. A hand-list is a second source of truth about which artifacts exist.
const ARTIFACTS = (() => {
  const out = [];
  const walk = (d) => {
    for (const f of readdirSync(d)) {
      const p = d + '/' + f;
      if (statSync(p).isDirectory()) { if (f !== 'pristine') walk(p); }
      // the sidecar does not describe itself; a record whose provenance is its own generation
      // adds nothing and its git commit is necessarily absent at generation time
      else if (f.endsWith('.json') && f !== 'PROVENANCE.json') out.push(p);
    }
  };
  walk('benchmarks');
  return out.sort();
})();

// Which implementation produced which artifact. Declared explicitly, because inferring it from a
// filename would be exactly the kind of convenient guess this sidecar exists to prevent.
const PRODUCED_BY = {
  'sweep.json': 'LEGASUS_REPLAY_r3 (legaexercise/witness.mjs observe, shared stdout channel)',
  'classified.json': 'LEGASUS_r3 classification over sweep.json + legacore/capability.mjs',
  'calibration.json': 'COMPARISON of LEGASUS_REPLAY_r3 against CPYTHON_DOCTEST',
  'external.json': 'CPYTHON_DOCTEST (external producer, verdicts only)',
  'attribution.json': 'LEGASUS_r4 per-example attribution probes',
  'admission.json': 'LEGASUS_r3 envelope + witnessed-site intersection',
  'tasks.json': 'LEGASUS_r4 oracle establishment via legalabs/mutate.mjs',
  'arms.json': 'LEGASUS_r3 gate vs RAW arm, local qwen2.5-coder:1.5b, surface-preserving scorer',
  'arms.INVALID-failed-only-scorer.json':
    'LEGASUS_r3 gate vs RAW arm, INVALID: scorer compared `failed` alone and admitted destruction',
  'r4-ab.json': 'A/B of LEGASUS_REPLAY_r3 against LEGASUS_r4 isolated channel',
  'r4-v2.json': 'LEGASUS_r4 SEQUENTIAL_SHARED, execution only, no assertion evaluation',
  'r4-v2b.json': 'LEGASUS_r4 SEQUENTIAL_SHARED_CHECKED, comparison delegated to doctest.OutputChecker',
  'candidates.json': 'LEGASUS_r3 mutation-candidate generation over the repoB corpus',
  'manifest.json': 'LEGASUS_r3 frozen candidate manifest for repoB',
  'region-frontier.json': 'LEGASUS_r3 execution-region derivation from sweep.json',
  'slice-granularity.json': 'LEGASUS_r3 preregistered P-A / P-B slice measurement',
  'repoC_candidates.json': 'LEGASUS_r4 mechanical Repo C eligibility enumeration',
  'IDENTITY.json': 'LEGASUS_r4 Repo C subject pinning (byte-for-byte copy + sha256 manifest)',
  'RESULT.dev1.json':
    'LEGASUS_r3 devrepo benchmark, qwen2.5-coder:1.5b. NOTE: its `code` fields are 400-char PREFIXES'
    + ' (hazard 16), so it is authoritative for the DECISIONS it records and NOT for candidate text.',
  'RESULT.1p5b.json':
    'LEGASUS_r3 devrepo benchmark, earlier run, same 400-char truncation and the same limit on what it'
    + ' is authoritative for.',
};

const gitFacts = (path) => {
  try {
    const raw = execFileSync('git', ['log', '-1', '--format=%H%x09%cI%x09%s', '--', path],
      { encoding: 'utf8' }).trim();
    if (!raw) return { commit: 'UNKNOWN', committed: 'UNKNOWN', subject: 'UNKNOWN' };
    const [commit, committed, subject] = raw.split('\t');
    return { commit, committed, subject };
  } catch (e) {
    return { commit: 'UNKNOWN', committed: 'UNKNOWN', subject: 'UNKNOWN' };
  }
};

const records = [];
for (const a of ARTIFACTS) {
  if (!existsSync(a)) { records.push({ artifact: a, present: false }); continue; }
  const bytes = readFileSync(a);
  const base = a.split('/').pop();
  records.push({
    artifact: a,
    present: true,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.length,
    // DECLARED, with the reason it is declared rather than inferred.
    producedBy: PRODUCED_BY[base] || 'UNKNOWN - no declaration exists for this artifact',
    git: gitFacts(a),
  });
}

const unknown = records.filter((r) => r.present && String(r.producedBy).startsWith('UNKNOWN'));
const missing = records.filter((r) => !r.present);

// BINDING IS BY CONTENT, NOT BY PATH. The first version of this sidecar keyed provenance by pathname,
// which is the `module:line` identity mistake one layer out: rewrite an artifact and the new bytes
// silently inherit the old attribution. The ledger below is digest-keyed and SEALED, so a later edit to
// the sidecar itself is detectable.
const led = ledger(records.filter((r) => r.present).map((r) => bind({
  bytes: readFileSync(r.artifact), producedBy: r.producedBy, git: r.git, path: r.artifact })));
const seal = led.seal();
writeFileSync('benchmarks/PROVENANCE.json', JSON.stringify({
  note: 'ANNOTATION beside the artifacts, never inside them. Evidence for each attribution is the git'
    + ' commit that last wrote the artifact plus an explicit declaration of the implementation that'
    + ' produced it. Artifacts are NOT modified.',
  generated: new Date().toISOString(),
  bindingProperty: 'provenance attaches to immutable artifact identity (content digest), never to'
    + ' storage location. Path is DESCRIPTION.',
  seal,
  records,
}, null, 1), 'utf8');

console.log('PROVENANCE SIDECAR');
console.log('  artifacts declared : ' + records.filter((r) => r.present).length);
console.log('  absent             : ' + missing.length
  + (missing.length ? '  ' + missing.map((r) => r.artifact).join(', ') : ''));
console.log('  UNKNOWN provenance : ' + unknown.length
  + (unknown.length ? '  ' + unknown.map((r) => r.artifact).join(', ') : ''));
console.log('');
for (const r of records.filter((x) => x.present).slice(0, 6)) {
  console.log('  ' + r.artifact);
  console.log('     producedBy : ' + r.producedBy.slice(0, 92));
  console.log('     commit     : ' + r.git.commit.slice(0, 10) + '  ' + r.git.committed);
}
console.log('');
console.log('R3 ' + (unknown.length === 0 && missing.length === 0
  ? 'NOW SATISFIABLE - every historical artifact can say what produced it, independently of whether that'
    + ' implementation still exists'
  : 'STILL FAILING - ' + (unknown.length + missing.length) + ' artifact(s) unattributable'));
