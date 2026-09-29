/**
 * lockedDecoding.test.mjs — the claim is NOT "the lock was set correctly". It is "the lock cannot be
 * unlocked". So every test here is hostile: it tries to override the weld and asserts it loses.
 *
 *   node server/lockedDecoding.test.mjs
 *
 * THE POSITIVE CONTROL RUNS FIRST, and it is the one that matters. A `resolveDecoding` that ignored its
 * profile entirely and returned a fixed blob would pass every hostile test below. So the first thing
 * checked is that the returned values actually come FROM THE NAMED PROFILE, and that two different
 * profiles produce two different answers.
 */
import { resolveDecoding, decodingRecord, PROFILES, LOCKED_KEYS, REFUSED_ENV } from './lockedDecoding.mjs';

let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };
const throws = (fn, m) => { try { fn(); say(false, `${m} - IT WAS ALLOWED`); } catch (e) { say(true, `${m} (${String(e.message).slice(0, 64)})`); } };

// ══ POSITIVE CONTROL ══════════════════════════════════════════════════════════════════════════════
console.log('\npositive control - the values come from the profile, not from nowhere');
{
  const a = resolveDecoding('localized-v1');
  const b = resolveDecoding('whole-file-v1');
  say(a.options.num_predict === PROFILES['localized-v1'].num_predict
    && a.options.temperature === PROFILES['localized-v1'].temperature
    && a.options.seed === PROFILES['localized-v1'].seed,
    `localized-v1 returns its own declared values (${JSON.stringify(a.options)})`);
  say(a.options.num_predict !== b.options.num_predict,
    `and a DIFFERENT profile gives a different answer (${a.options.num_predict} vs ${b.options.num_predict}) - so this is not a function that returns a constant`);
  say(a.ignored.length === 0, 'a call that asks for nothing has nothing refused');
}

// ══ THE CALLER LOSES ══════════════════════════════════════════════════════════════════════════════
console.log('\na caller cannot override a locked key');
{
  const r = resolveDecoding('localized-v1', { requested: { temperature: 0.9, seed: 7, num_predict: 99 } });
  say(r.options.temperature === 0.2 && r.options.seed === 1 && r.options.num_predict === 400,
    `all three locked keys keep their profile values despite being asked for otherwise (${JSON.stringify(r.options)})`);
  say(r.ignored.length === 3, `and all three refusals are REPORTED, not silently dropped (${r.ignored.length})`);
  say(r.ignored.every((i) => i.from === 'caller' && i.wanted !== undefined && i.used !== undefined),
    'each refusal names the key, who asked, what was wanted and what was used');
}

console.log('\nthe environment cannot override a locked key either');
{
  const hostile = { LEGASUS_SEED: '99', OLLAMA_TEMPERATURE: '1.5', LEGASUS_NUM_PREDICT: '8000' };
  const r = resolveDecoding('localized-v1', { env: hostile });
  say(r.options.seed === 1 && r.options.temperature === 0.2 && r.options.num_predict === 400,
    `hostile env values lose (${JSON.stringify(r.options)})`);
  say(r.ignored.length === 3 && r.ignored.every((i) => i.from.startsWith('env ')),
    `and every one is reported with the variable that tried: ${r.ignored.map((i) => i.from).join(', ')}`);
}

console.log('\nboth at once, which is how it would actually happen');
{
  const r = resolveDecoding('whole-file-v1', {
    requested: { temperature: 0.7, top_p: 0.9 },
    env: { OLLAMA_SEED: '42' },
  });
  say(r.options.temperature === 0.2 && r.options.seed === 1, 'the profile still wins on both fronts');
  say(r.options.top_p === 0.9, 'an UNLOCKED key passes through untouched - the weld is narrow on purpose');
  say(r.ignored.length === 2, 'and exactly the two locked attempts are refused');
}

// ══ THE WELD ITSELF CANNOT BE EDITED ══════════════════════════════════════════════════════════════
console.log('\nthe returned values and the profiles are frozen');
{
  const r = resolveDecoding('localized-v1');
  throws(() => { r.options.temperature = 9; }, 'the returned options cannot be mutated after the fact');
  throws(() => { PROFILES['localized-v1'].seed = 9; }, 'a declared profile cannot be mutated at runtime');
  throws(() => { PROFILES['sneaky-v1'] = { temperature: 1 }; }, 'a new profile cannot be added at runtime');
  throws(() => resolveDecoding('whatever-i-like'), 'an undeclared profile is refused - a run may not invent its own decoding');
}

// ══ A LOCKED KEY CANNOT BE SMUGGLED PAST THE FILTER ═══════════════════════════════════════════════
console.log('\nno way around the locked set');
{
  // The pass-through loop runs BEFORE the locked loop for exactly this reason: if it ran after, an
  // unlocked-looking key could overwrite a locked one on the way out.
  const r = resolveDecoding('localized-v1', { requested: { seed: 7, temperature: 0.9 } });
  say(Object.keys(r.options).filter((k) => LOCKED_KEYS.includes(k)).every((k) => r.options[k] === PROFILES['localized-v1'][k]),
    'every locked key in the output equals the profile, whatever order the caller supplied them in');
  say(REFUSED_ENV.length >= 6, `the refused-env list is specific rather than a shrug (${REFUSED_ENV.length} names)`);
}

// ══ THE RECORD CARRIES WHAT SUPPRESSION-1 COULD NOT ═══════════════════════════════════════════════
console.log('\nthe run record carries every locked key, including the boring ones');
{
  const rec = decodingRecord(resolveDecoding('localized-v1', { requested: { seed: 7 } }));
  say(rec.temperature !== undefined && rec.num_predict !== undefined && rec.seed !== undefined,
    'temperature, num_predict and seed are ALL recorded - SUPPRESSION-1 recorded seed and maxTokens and never temperature, so its temperature is unrecoverable from its own records');
  say(rec.profile === 'localized-v1', 'and the profile is named, so a later reader need not infer it');
  say(rec.overridesRefused.length === 1 && rec.overridesRefused[0].key === 'seed',
    'and an attempted override is preserved in the record, not just refused at the door');
}

console.log(`\n  locked decoding: ${passed} passed, ${failed} failed -> ${failed
  ? 'THE LOCK CAN BE UNLOCKED'
  : 'a caller and the environment both lose, loudly, and the profile is what the run actually used'}`);
process.exit(failed ? 1 : 0);
