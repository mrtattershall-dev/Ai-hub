// r4 — THE QUIESCE CHECK. Law 7 applied to the system's own open questions.
//
//     SAFE AUTONOMY IS NOT ONLY "DO NOT DO UNJUSTIFIED THINGS". IT IS ALSO "KNOW WHEN THERE IS NO
//     JUSTIFIED THING TO DO."
//
// Entry 8 ended with "QUIESCE check - is there a justified operation whose outcome could change
// entitlement?" and that question must be answered by running the architecture's own stopping law on the
// architecture's own ledger, not by deciding and then writing prose that agrees.
//
// WHAT THIS ARTIFACT IS AND IS NOT. The four conditions are booleans, and a boolean I assert is my
// judgment wearing a machine's clothes. So each one below is tagged:
//
//     MEASURED   established by executing something in this file, printed with its evidence
//     DECLARED   my judgment, stated so it can be disputed
//
// The value of the check is NOT that it computes the answer. It is that the fourth condition -
// canChangeEntitlement - becomes unskippable, and that a DECLARED condition is visibly declared. A
// system that quiesces because nobody asked has not quiesced; it has stalled.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { evidenceFrontier, contestState, investigationJustified, objectivesFromContest }
  from '../legasus/legaknow/stopping.mjs';
import { CONTEXT_DIMENSIONS, SUBJECT_DIMENSIONS } from '../legasus/legaknow/justification.mjs';
import { pinnedArtifact } from '../legasus/legaknow/pin.mjs';

const say = (...a) => console.log(...a);
const evidence = [];
const note = (tag, what, detail) => { evidence.push({ tag, what, detail }); return detail; };

// ---------------------------------------------------------------- MEASUREMENT 1: can fork be attacked?
const forkProbe = spawnSync('python',
  ['-c', 'import os,sys; sys.stdout.write("1" if hasattr(os,"fork") else "0")'],
  { encoding: 'utf8', timeout: 20000 });
const forkAvailable = forkProbe.status === 0 && forkProbe.stdout.trim() === '1';
note('MEASURED', 'python hasattr(os, "fork")', String(forkAvailable)
  + '  (platform ' + process.platform + ')');

// ------------------------------------------- MEASUREMENT 2: is the repoC attribution collision joinable?
// The ambiguity is three external keys carrying CONFLICTING outcomes under a last-wins map. Resolving it
// requires a coordinate in the PRESERVED record that distinguishes the colliding observations. If the
// record has no such coordinate, the distinction was destroyed at COLLECTION time and no later analysis
// recovers it - a fresh run yields observations that cannot be JOINED to the ambiguous old one, because
// the old one has nothing to join on. Law 1, exactly: authority cannot be created by destroying
// information.
//
// MEASURED ON THE BYTES THE VERDICT IS ABOUT, NOT ON WHATEVER OCCUPIES THE PATH. The first version read
// external.json by path. Regenerated with richer records under the same name, it would have flipped
// this TERMINAL entry to JUSTIFIED and the fresh run would have silently REPLACED the old evidence
// rather than resolved it - the exact thing the paragraph above says cannot happen (composition attack
// C9-b). The read is pinned to the digest PROVENANCE.json recorded for the artifact; any other bytes are
// reported as REPLACED, re-measure nothing, and leave the entry not executable.
const PROVENANCE = JSON.parse(readFileSync('benchmarks/PROVENANCE.json', 'utf8'));
const EXT_PATH = 'benchmarks/repoC/external.json';
const extRecord = PROVENANCE.records.find((r) => r.artifact === EXT_PATH);
const pinned = pinnedArtifact({ path: EXT_PATH, expectedDigest: extRecord && extRecord.sha256 });
note('MEASURED', 'external.json identity', pinned.state + '  (digest '
  + String(pinned.digest || pinned.actualDigest || '-').slice(0, 12) + ', recorded '
  + String(extRecord && extRecord.sha256).slice(0, 12) + ')');
let hasDiscriminator = false;
if (pinned.ok) {
  const ext = JSON.parse(pinned.bytes.toString('utf8'));
  const fields = [...new Set(ext.flatMap((x) => Object.keys(x)))].sort();
  const byKey = new Map();
  for (const x of ext) {
    const k = x.module.split('.').pop() + '|' + String(x.source).trim();
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(x.outcome);
  }
  const conflicting = [...byKey.entries()].filter(([, v]) => new Set(v).size > 1);
  const DISCRIMINATORS = ['document', 'ordinal', 'lineno', 'name', 'docstring', 'index'];
  hasDiscriminator = DISCRIMINATORS.some((d) => fields.includes(d));
  note('MEASURED', 'external.json record fields', JSON.stringify(fields));
  note('MEASURED', 'keys with CONFLICTING outcomes', String(conflicting.length));
  note('MEASURED', 'any coordinate that could disambiguate', String(hasDiscriminator));
} else {
  note('MEASURED', 'external.json', pinned.state + ' - ' + pinned.why
    + '. The TERMINAL verdict is about the recorded bytes and stands; nothing here re-classifies it.');
}

// ------------------------------------------- MEASUREMENT 3: is the scope vocabulary closed, and how big?
//
// APPARATUS CORRECTION, recorded rather than quietly fixed. The first version of this measurement looked
// for SCOPE_DIMENSIONS in admissibility.mjs and printed "NOT FOUND", which was true and useless - the
// dimensions live in justification.mjs and admissibility.mjs holds the GATE that decides whether a new
// one may exist. Re-pointed, and the corrected measurement is sharper than the hypothesis it was written
// to support.
const dims = [...CONTEXT_DIMENSIONS, ...SUBJECT_DIMENSIONS];
note('MEASURED', 'declared scope dimensions',
  dims.join(', ') + '  (' + dims.length + ', a CLOSED set)');

// And the decisive one: is the admission GATE wired to the structure it admits into? scope(), covers()
// and joinConflicts() all iterate the module constant DIMENSIONS. If nothing feeds admitDimension's
// output into that constant, the gate is ADVISORY and the closed set is closed in practice however the
// gate rules.
const importers = [];
for (const f of ['legasus/legaknow/justification.mjs', 'legasus/legaknow/observation.mjs',
  'legasus/legaknow/ledger.mjs', 'legasus/legaknow/calculus.mjs', 'legasus/legaknow/conflict.mjs',
  'legasus/legaexternal/adapt.mjs', 'legasus/legaknow/monotonicity.mjs']) {
  try { if (readFileSync(f, 'utf8').includes('admitDimension')) importers.push(f); } catch (e) { /* */ }
}
note('MEASURED', 'production modules using admitDimension',
  importers.length ? importers.join(', ') : 'NONE - the gate is imported only by its own test');

say('EVIDENCE');
for (const e of evidence) say('  [' + e.tag + '] ' + e.what.padEnd(38) + e.detail);
say('');

// BLOCKED IS NOT ONE THING, AND CONFLATING ITS KINDS IS HOW AN AGENT WASTES DAYS.
//
// A question blocked by the PLATFORM unblocks on a different host. One blocked by SEQUENCING unblocks
// when the sequence advances. One blocked by OWNER authority unblocks when the owner decides. But a
// question blocked because the distinguishing information WAS NEVER RECORDED unblocks NEVER - no amount
// of later intelligence recovers information that does not exist - and it is not a task waiting for a
// sufficiently clever agent. It is the MAXIMALLY JUSTIFIED TERMINAL STATE OF THAT EVIDENCE, which is a
// successful epistemic outcome rather than unfinished bookkeeping.
//
// The class is carried on every entry so a future run cannot rediscover a terminal question as an
// opportunity.
const BLOCK = {
  PLATFORM: 'PLATFORM      - unblocks on a different host',
  TERMINAL: 'TERMINAL      - UNBLOCKS NEVER. Do not re-attempt.',
  SEQUENCING: 'SEQUENCING    - unblocks when the sequence advances',
  EPISTEMIC: 'EPISTEMIC     - no outcome would change entitlement',
  OWNER: 'OWNER         - unblocks only by owner decision',
  RESOLVED: 'RESOLVED      - already answered',
  // Added 2026-09-20 (Entry 15). A question that cannot yet be classified as BLOCKED (no identified
  // condition would unblock it) or TERMINAL (no evidence that the information is gone) is UNKNOWN, and
  // saying so is the honest state. Forcing it into either of the others is the conversion the entry
  // was written to refuse: UNKNOWN -> TERMINAL retires a question on no evidence; UNKNOWN -> BLOCKED
  // invents a condition. An UNKNOWN entry generates no work by itself.
  UNKNOWN: 'UNKNOWN       - neither an unblocking condition nor terminality is established',
};

// ---------------------------------------------------------------------------- THE OPEN QUESTIONS
const OPEN = [
  {
    name: 'POSIX_FORK_INHERITANCE',
    blockClass: BLOCK.PLATFORM,
    question: 'does a forked child inherit the observation channel descriptor and corrupt attribution?',
    authorized: true,                     // DECLARED - within the r4 development surface
    executable: forkAvailable,            // MEASURED
    targetsDistinction: true,             // DECLARED
    canChangeEntitlement: true,           // DECLARED - it would widen or puncture the concurrency envelope
    ifNotJustified: 'stays UNTESTED and the envelope keeps EXCLUDING it. "Cannot be tested" was never'
      + ' recorded as "is safe" and still is not.',
  },
  {
    name: 'REPOC_UNRESOLVED_ATTRIBUTION',
    blockClass: BLOCK.TERMINAL,
    question: 'was the one ambiguous cohort member a supported agreement or a supported disagreement?',
    authorized: true,                     // DECLARED
    executable: hasDiscriminator,         // MEASURED - and it is false
    targetsDistinction: true,             // DECLARED
    canChangeEntitlement: true,           // DECLARED - 49 / 7 / 1 would become 50 / 7 or 49 / 8
    ifNotJustified: 'the distinguishing coordinate was destroyed at COLLECTION time, before the last-wins'
      + ' map. A fresh run yields observations with NOTHING TO JOIN ON, so it would not resolve the old'
      + ' case - it would silently replace it. Stays 49 / 7 / 1 UNRESOLVED ATTRIBUTION, permanently.',
  },
  {
    name: 'REPO_D_PROSPECTIVE_VALIDATION',
    blockClass: BLOCK.SEQUENCING,
    question: 'does r4 actually do the job on an unseen repository?',
    authorized: true,                     // DECLARED
    executable: false,                    // DECLARED - sequencing, per the frozen burn rule
    targetsDistinction: true,             // DECLARED
    canChangeEntitlement: true,           // DECLARED - decisively; the biggest open question here
    ifNotJustified: 'blocked by SEQUENCING, not by authority. Selecting Repo D while r4 is still changing'
      + ' burns it, and the burn rule is frozen in REPO_C_SELECTION.md. The block lifts when r4 stops'
      + ' changing - which is a decision about r4, not about Repo D.',
  },
  {
    // RESOLVED at 8b694ad / d2cda02. Kept in the list rather than deleted, because a question that
    // disappears from the ledger cannot be audited against what it actually returned.
    name: 'PRODUCER_3_SCOPE_VOCABULARY  [RESOLVED]',
    blockClass: BLOCK.RESOLVED,
    question: 'is scope construction now producer-agnostic, or merely doctest-UNION-git shaped?',
    authorized: true,                     // DECLARED
    executable: true,                     // DECLARED
    targetsDistinction: false,            // RESOLVED - the distinction it targeted no longer stands open
    canChangeEntitlement: false,          // RESOLVED - it already changed it; re-running changes nothing
    ifNotJustified: 'ANSWERED: merely doctest-UNION-git shaped. pytest carried a coordinate none of the'
      + ' six names, the set reported a CONTRADICTION AS AGREEMENT, and the repair made the admission'
      + ' gate the only door. Re-running it now would re-measure a question already settled.',
    whyItCanChangeEntitlement: 'the producer #2 repair asserts a GENERAL property - "a coordinate the'
      + ' producer cannot establish is ABSENT rather than invented" - from exactly ONE counterexample.'
      + ' And the repair may only have MOVED the failure: scope has a closed set of 6 dimension names,'
      + ' and admitDimension - the gate built to adjudicate a new one - has NO PRODUCTION CONSUMER, so a'
      + ' producer whose coordinate is none of the six has nowhere to put it and no path to earn one.'
      + ' Some outcome of a third producer FALSIFIES a claim currently being relied on.',
  },
  {
    // THE TREADMILL QUESTION, and law 7 is what refuses it. Everything about producer #4 is available:
    // trace and timeit were runners-up in the very selection that chose pytest, and building one would
    // take an hour. The FOURTH condition is the only thing standing between this system and spending the
    // rest of the night confirming what it already knows.
    name: 'PRODUCER_4',
    blockClass: BLOCK.EPISTEMIC,
    question: 'would a fourth producer bend the boundary again?',
    authorized: true,                     // DECLARED
    executable: true,                     // DECLARED - trace and timeit are the runners-up, both present
    targetsDistinction: true,             // DECLARED
    canChangeEntitlement: false,          // DECLARED - and this is the whole entry
    ifNotJustified: 'the producer #3 repair is GENERIC IN MECHANISM rather than per-coordinate: scope()'
      + ' carries EVERY unmapped coordinate without naming any of them, so a fourth producer takes the'
      + " same path pytest's took, by construction. The two questions a fourth producer could have"
      + ' raised were both asked DIRECTLY and more cheaply - name-collision aliasing (L7, which found a'
      + ' real L2 violation in the repair) and registry leakage (L5, which found a real one too).'
      + ' Running it anyway is epistemically pointless however cheap it is, and this is exactly the loop'
      + ' the stopping law was written to stop.',
  },
  {
    // RESOLVED 2026-09-20 (Entry 15). Opened by a finding beside composition attack W2-g: pytest had no
    // declared mapping, so no scoped claim had ever derived from pytest evidence. Preregistered in
    // PYTEST_MAPPING_PREREG.md, six predictions held, mapping registered. Kept in the list, as Entry 12
    // requires, so the question can be audited against what it returned.
    name: 'PYTEST_MAPPING  [RESOLVED]',
    blockClass: BLOCK.RESOLVED,
    question: 'can pytest evidence DERIVE a scoped claim, or only be stored?',
    authorized: true,                     // DECLARED
    executable: true,                     // MEASURED at the time: pytest 9.1.1 present
    targetsDistinction: false,            // RESOLVED
    canChangeEntitlement: false,          // RESOLVED - it already did
    ifNotJustified: 'ANSWERED: it derives. PASSED -> OBSERVED/HELD, FAILED -> OBSERVED/REFUTED, with'
      + " FAILED's collapse forced by the producer; the cohort's two verdicts read as contradictory"
      + ' before admission and incomparable after. E6 now holds for producer #3.',
  },
  {
    // UNKNOWN, and left so. instruments.mjs can say whether one instrument subsumes another only when
    // each instrument's failure classes are enumerated with executed witnesses. Two instruments have
    // that enumeration for free - the freeze gate and the composition suite, each from its own
    // refusals - and neither subsumes the other (instruments-applied.test.mjs). The shadow-graph rigs
    // and the conformance audit have no such enumeration, and producing one means naming what they
    // could fail to see from a source independent of any discrepancy they have shown. Whether such a
    // source exists is not established either way. Not TERMINAL (nothing was destroyed), not BLOCKED
    // (no identified condition unblocks it), not manufactured into work.
    name: 'INSTRUMENT_CLASSES_FOR_THE_RIGS',
    blockClass: BLOCK.UNKNOWN,
    question: 'can the shadow-graph rigs and the conformance audit be described as instruments with'
      + ' independently argued failure classes, so their nulls can be related?',
    authorized: true,                     // DECLARED
    executable: false,                    // DECLARED - no independent source for the classes is known
    targetsDistinction: true,             // DECLARED
    canChangeEntitlement: true,           // DECLARED - it would say whose null stands in for whose
    ifNotJustified: 'UNKNOWN. An enumeration argued from the rigs\' own past disagreements would be the'
      + ' forbidden route of admissibility.mjs applied to instruments. Nothing here says such an'
      + ' enumeration is impossible, and nothing here says how to get one.',
  },
  {
    name: 'FREEZE_R4_AND_SELECT_REPO_D',
    blockClass: BLOCK.OWNER,
    question: 'declare r4 finished and burn a fourth repository on its prospective test',
    authorized: false,                    // OWNER_REQUIRED - see below
    executable: true,                     // DECLARED - candidates could be enumerated tonight
    targetsDistinction: true,             // DECLARED
    canChangeEntitlement: true,           // DECLARED - decisively, and it is the only thing that can
    ifNotJustified: 'OWNER_REQUIRED. Selecting Repo D BURNS it: once r4 has been exposed to a repository'
      + ' that repository can never again serve as its prospective test, and no later work undoes that.'
      + ' It is also a declaration that r4 is FINISHED, which tonight repeatedly showed it is not - two'
      + ' defects were found inside a repair written hours ago. That is outside ordinary reversible'
      + ' repository work, so it is recorded and left rather than guessed at.',
  },
];

say('THE FOUR CONDITIONS, PER OPEN QUESTION');
say('');
const results = OPEN.map((o) => ({ o, r: investigationJustified(o) }));
for (const { o, r } of results) {
  say('  ' + (r.ok ? 'JUSTIFIED    ' : 'not justified') + '  ' + o.name);
  say('      ' + o.question);
  say('      authorized=' + o.authorized + '  executable=' + o.executable
    + '  targets=' + o.targetsDistinction + '  canChangeEntitlement=' + o.canChangeEntitlement);
  if (!r.ok) {
    say('      CLASS     : ' + o.blockClass);
    say('      BLOCKED BY: ' + r.failed.join('; '));
    say('      ' + o.ifNotJustified);
  } else {
    say('      ' + o.whyItCanChangeEntitlement);
  }
  say('');
}

// ---------------------------------------------------------------------------- THE VERDICT
const frontier = evidenceFrontier({
  requiredProducers: ['CPython doctest', 'git', 'pytest'],
  attempted: ['CPython doctest', 'git', 'pytest'],
  pending: [],
});
const contest = contestState({ frontier, investigations: OPEN });
const objectives = objectivesFromContest(contest);

say('FRONTIER : ' + frontier.state + ' - ' + frontier.why);
say('CONTEST  : ' + contest.state);
say('           ' + contest.why);
say('');
// THE BOUND, PRINTED BESIDE THE VERDICT AND NOT ONLY IN THE MODULE. A reader who quotes
// "QUIESCENT_CONTEST, zero objectives" without this is quoting an unbounded claim.
say('WHAT THIS ESTABLISHES      : ' + contest.establishes);
say('WHAT IT DOES NOT ESTABLISH : ' + contest.doesNotEstablish);
say('  This project is its own evidence that the gap is real: on 2026-09-20 this check said QUIESCENT');
say('  with zero objectives, and three successive preregistered attack waves then found 21 authority');
say('  defects in deciding paths, each wave after the previous one had gone green. The verdict was');
say('  correct every time over the questions it HELD. It was silent about the ones not yet written.');
say('');
say('OBJECTIVES GENERATED: ' + objectives.objectives.length);
for (const ob of objectives.objectives) say('  ' + ob.kind + '  ' + ob.target);
say('  ' + objectives.why);
say('');
if (contest.state === 'QUIESCENT_CONTEST') {
  say('QUIESCE. There is no justified next action, and that is a POSITIVE finding about entitlement.');
} else {
  say('DO NOT QUIESCE. ' + objectives.objectives.length + ' justified investigation(s) remain, so'
    + ' stopping here would be STALLING rather than quiescing.');
  say('');
  say('AND NOTE WHAT THE THREE BLOCKED ONES HAVE IN COMMON: none is blocked by lack of authority.');
  say('One is blocked by the PLATFORM, one by INFORMATION DESTROYED IN THE PAST, one by SEQUENCING.');
  say('Only the last can ever be unblocked by further work, and not by further work on IT.');
}
