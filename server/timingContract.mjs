// ══════════════════════════════════════════════════════════════════════════════════════════════════
// timingContract.mjs — TIMING-1 v1.0.0. FROZEN BEFORE ANY NUMBER IS COLLECTED.
//
// The order matters and is the whole reason this file exists separately: the schema is fixed FIRST, a
// baseline is collected SECOND, and treatment behaviour is added THIRD. A contract written after the
// numbers are in can always be shaped to flatter them, and this project has already shipped a scorer
// that printed COMPARABLE without recording the thing that would have made it so.
//
// ══ WHAT THIS MEASURES, NAMED HONESTLY ═══════════════════════════════════════════════════════════
// The PERFORMANCE TAX OF THE GOVERNED PATH ON ONE SEQUENTIAL WORKER. Not a speed advantage. There is
// no coordination yet, so there is nothing that could repay a tax, and any wall-clock win would be an
// artefact rather than a finding.
//
// ══ THE CONFOUND THIS CONTRACT EXISTS TO PREVENT ═════════════════════════════════════════════════
// If the control arm skipped verification, "Legasus tax" would mostly measure THAT THE CONTROL SKIPS
// VERIFICATION. So BOTH ARMS RUN THE SAME BROWSER VERIFICATION AND THE SAME ACCEPTANCE GATE, through
// one implementation called identically. Both arms also resolve decoding through the same weld - the
// weld is the INSTRUMENT that makes the two arms comparable, not part of the treatment.
//
//     the ONLY intended difference is the governed prepare / lease / effect / receipt path.
//
// ══ THREE CLOCKS, SEPARATELY, PLUS THE COMPONENTS THAT EXPLAIN THEM ══════════════════════════════
//   generationMs    request sent           -> final model byte        did the model/backend slow down?
//   verificationMs  candidate ready        -> evaluator verdict       what does checking cost?
//   endToEndMs      run start              -> terminal record         what does a user actually wait for?
//
// `derivationMs` is recorded SEPARATELY and is deliberately not inside verificationMs: observing the
// baseline and deriving the graph happen once per task and before any candidate exists, so folding
// them into per-candidate verification would inflate it. On a local 1.5B, verification is expected to
// dominate both arms - without these columns that cost would be silently attributed to governance.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

export const TIMING_CONTRACT = 'TIMING-1';
export const TIMING_VERSION = '1.0.0';

/** Arms. `direct` is the control. `governed` adds only the prepare/lease/effect/receipt path. */
export const ARMS = Object.freeze(['direct', 'governed']);

/** How a run ended. Every record carries exactly one, and NOT_EVALUATED is a real outcome. */
export const TERMINAL = Object.freeze([
  'RETAINED',        // the change was accepted and kept
  'RESTORED',        // the change was rejected and the baseline was put back
  'REFUSED',         // nothing judgeable was produced (empty, unparseable, wrong slot language, ...)
  'NOT_EVALUATED',   // the run could not be judged at all - apparatus, not model
  'EFFECT_UNVERIFIED', // governed arm only: bytes landed that were not the bytes intended
]);

const NUMERIC_CLOCKS = Object.freeze([
  'generationMs', 'verificationMs', 'endToEndMs', 'derivationMs', 'containmentMs', 'effectMs', 'restorationMs',
]);
const NUMERIC_COUNTS = Object.freeze([
  'calls', 'promptTokens', 'outputTokens', 'acceptedChanges', 'nodesCovered', 'nodesMissing',
]);

/** Every key a TIMING-1 record must carry. Missing or unknown keys are both refused. */
export const REQUIRED = Object.freeze([
  'contract', 'version', 'arm', 'runId', 'at',
  'task', 'page', 'baselineSha', 'model',
  'decodingProfile', 'decoding', 'decodingOverridesRefused',
  'clocks', 'counts', 'terminal', 'outcome', 'candidateSha', 'notes',
]);

/**
 * Validate a record against the frozen contract. Refusing UNKNOWN keys matters as much as refusing
 * missing ones: a column that appears only in the treatment arm is how an incomparable comparison gets
 * published, and it would be invisible to a check that only looked for absences.
 */
export function validateTimingRecord(rec) {
  const problems = [];
  if (!rec || typeof rec !== 'object') return { ok: false, problems: ['not an object'] };
  if (rec.contract !== TIMING_CONTRACT) problems.push(`contract is ${rec.contract}, not ${TIMING_CONTRACT}`);
  if (rec.version !== TIMING_VERSION) problems.push(`version is ${rec.version}, not ${TIMING_VERSION}`);
  if (!ARMS.includes(rec.arm)) problems.push(`arm ${JSON.stringify(rec.arm)} is not one of ${ARMS.join('/')}`);
  if (!TERMINAL.includes(rec.terminal)) problems.push(`terminal ${JSON.stringify(rec.terminal)} is not declared`);

  for (const k of REQUIRED) if (!(k in rec)) problems.push(`missing required key ${k}`);
  for (const k of Object.keys(rec)) if (!REQUIRED.includes(k)) problems.push(`UNKNOWN key ${k} - a column present in one arm and not the other makes the comparison incomparable`);

  const clocks = rec.clocks || {};
  for (const k of NUMERIC_CLOCKS) {
    if (!(k in clocks)) { problems.push(`clocks.${k} missing`); continue; }
    if (clocks[k] !== null && (typeof clocks[k] !== 'number' || clocks[k] < 0)) problems.push(`clocks.${k} is not a non-negative number or null`);
  }
  for (const k of Object.keys(clocks)) if (!NUMERIC_CLOCKS.includes(k)) problems.push(`UNKNOWN clock ${k}`);

  const counts = rec.counts || {};
  for (const k of NUMERIC_COUNTS) if (!(k in counts)) problems.push(`counts.${k} missing`);
  for (const k of Object.keys(counts)) if (!NUMERIC_COUNTS.includes(k)) problems.push(`UNKNOWN count ${k}`);

  // The three clocks must be mutually consistent, or "slow" means nothing. Generation and verification
  // both happen inside the run, so neither can exceed it.
  const { generationMs: g, verificationMs: v, endToEndMs: e } = clocks;
  if (typeof g === 'number' && typeof e === 'number' && g > e) problems.push(`generationMs ${g} exceeds endToEndMs ${e}`);
  if (typeof v === 'number' && typeof e === 'number' && v > e) problems.push(`verificationMs ${v} exceeds endToEndMs ${e}`);

  // A decoding profile that was overridden is not the profile the run used.
  if (!rec.decodingProfile) problems.push('decodingProfile is empty - the run cannot say what it ran under');
  return { ok: problems.length === 0, problems };
}

/** The empty shape, so a runner cannot invent columns by forgetting them. */
export function blankRecord({ arm, runId, at, task, page, baselineSha, model, decodingProfile, decoding, decodingOverridesRefused }) {
  return {
    contract: TIMING_CONTRACT, version: TIMING_VERSION, arm, runId, at,
    task, page, baselineSha, model, decodingProfile, decoding, decodingOverridesRefused,
    clocks: Object.fromEntries(NUMERIC_CLOCKS.map((k) => [k, null])),
    counts: Object.fromEntries(NUMERIC_COUNTS.map((k) => [k, null])),
    terminal: 'NOT_EVALUATED', outcome: null, candidateSha: null, notes: [],
  };
}

export const _keys = { NUMERIC_CLOCKS, NUMERIC_COUNTS };
