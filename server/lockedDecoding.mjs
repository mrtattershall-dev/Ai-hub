// ══════════════════════════════════════════════════════════════════════════════════════════════════
// lockedDecoding.mjs — decoding parameters that a caller CANNOT override, and that say so when tried.
//
// WHY. Every runner in this project takes its decoding from a command-line option -
// `opt('temperature','0.2')`, `opt('seed','1')`, `opt('max-tokens',…)`. None reads an environment
// variable, so there was never an env hole; the hole is larger. Any invocation can pass
// `--seed 7 --temperature 0.9`. Each record then describes ITSELF perfectly honestly, while the
// COMPARISON ACROSS CELLS is silently broken - because a record only ever describes itself.
//
// That is not hypothetical here. SUPPRESSION-1's frozen definition claims "same token budget" twice,
// once inside the question itself. The arms actually ran at 3000 / 3000 / 400 / unrecorded, and the two
// small-budget arms are the two that hit their cap: 7 of 48 attempts ended `doneReason=length`, none of
// the 24 attempts at 3000 did. See SUPPRESSION-1_BUDGET-CORRECTION.md. A recorded parameter and an
// enforced one are not the same thing, and every comparison in this project rested on the first.
//
// THE MECHANISM comes from an outside precedent: a test that patches hostile values INTO THE ENVIRONMENT
// and asserts the locked values win anyway - "welded sampling cannot be overridden". The claim being
// tested is not "the lock was set correctly" but "the lock cannot be unlocked". See PRECEDENT-1.
//
// IT REFUSES LOUDLY, NOT SILENTLY. A weld that quietly discards an override is its own trap: a caller
// would believe the run used what it asked for. `resolveDecoding` returns `ignored` naming every key it
// refused, and the caller is expected to record that alongside the run.
//
// ══ HONESTY ABOUT REACH ═══════════════════════════════════════════════════════════════════════════
// THIS MODULE HAS NO LIVE CONSUMER YET. Every existing runner belongs to a frozen experiment
// (AUDIT-2, SUPPRESSION-1, PRESENTATION-1), and retrofitting the weld into one would change the
// behaviour of code whose results are already recorded. So this is the required path for the NEXT
// model-calling runner and for nothing currently running.
//
// That is precisely the "a policy nobody calls" shape criticised in INTEGRATION-1_DEFINITION.md, and it
// is named here rather than left for an audit to find. What DOES reach the existing data is
// `decodingConsistencyCheck.mjs`, which asks of the preserved records the question nothing asked at the
// time. Enforcement forward, verification backward.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** The locked keys. Anything outside this set is passed through untouched - the weld is narrow on purpose. */
export const LOCKED_KEYS = Object.freeze(['temperature', 'num_predict', 'seed']);

/**
 * Named profiles for NEW runs. These are not a description of what past experiments used: history is a
 * fact to be read from its records, never a profile to be asserted after the event.
 */
export const PROFILES = Object.freeze({
  // Deterministic single-shot generation, short localized output.
  'localized-v1': Object.freeze({ temperature: 0.2, num_predict: 400, seed: 1 }),
  // Deterministic single-shot generation, whole-file output needs an order of magnitude more room.
  'whole-file-v1': Object.freeze({ temperature: 0.2, num_predict: 3000, seed: 1 }),
});

/** Environment names that will be REFUSED if present. Listed so the refusal is specific, not a shrug. */
export const REFUSED_ENV = Object.freeze([
  'LEGASUS_TEMPERATURE', 'LEGASUS_SEED', 'LEGASUS_NUM_PREDICT',
  'OLLAMA_TEMPERATURE', 'OLLAMA_SEED', 'OLLAMA_NUM_PREDICT',
]);

/**
 * Resolve the options for one model call.
 *
 *   resolveDecoding('localized-v1', { requested: { temperature: 0.9 } })
 *     -> { profile: 'localized-v1', options: {temperature:0.2, num_predict:400, seed:1},
 *          ignored: [{ key:'temperature', from:'caller', wanted:0.9, used:0.2 }] }
 *
 * `requested` may carry unlocked keys (`top_p`, `stop`, …) and they pass through. A locked key is taken
 * from the profile, never from the caller and never from the environment.
 */
export function resolveDecoding(profileName, { requested = {}, env = process.env } = {}) {
  const profile = PROFILES[profileName];
  if (!profile) {
    throw new Error(`lockedDecoding: unknown profile ${JSON.stringify(profileName)}. `
      + `Declared profiles are ${Object.keys(PROFILES).join(', ')}. A run may not invent its own decoding.`);
  }
  const ignored = [];
  const options = {};

  // Unlocked keys pass through first, so a locked key can never be shadowed by one of them.
  for (const [k, v] of Object.entries(requested)) {
    if (!LOCKED_KEYS.includes(k)) options[k] = v;
  }
  for (const k of LOCKED_KEYS) {
    options[k] = profile[k];
    if (Object.prototype.hasOwnProperty.call(requested, k) && requested[k] !== profile[k]) {
      ignored.push({ key: k, from: 'caller', wanted: requested[k], used: profile[k] });
    }
  }
  for (const name of REFUSED_ENV) {
    if (env && env[name] !== undefined) {
      const k = name.replace(/^(LEGASUS|OLLAMA)_/, '').toLowerCase();
      ignored.push({ key: k, from: `env ${name}`, wanted: env[name], used: profile[k] });
    }
  }
  return Object.freeze({ profile: profileName, options: Object.freeze(options), ignored: Object.freeze(ignored) });
}

/**
 * What a run record must carry so the question can be asked later without the code. Built from a
 * resolution, never from a caller's own idea of what it asked for.
 */
export function decodingRecord(resolved) {
  return Object.freeze({
    profile: resolved.profile,
    temperature: resolved.options.temperature,
    num_predict: resolved.options.num_predict,
    seed: resolved.options.seed,
    // SUPPRESSION-1 recorded seed and maxTokens and NEVER temperature, so its temperature is
    // unrecoverable from its own records. Every locked key is written here, always, including the ones
    // that happen to equal the default - an unrecorded parameter is not a matching one.
    overridesRefused: resolved.ignored,
  });
}
