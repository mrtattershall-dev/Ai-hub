/**
 * timingContract.test.mjs — the contract is frozen before any number exists, so it gets its tests first.
 *
 *   node server/timingContract.test.mjs
 *
 * The validator's job is to make an INCOMPARABLE comparison impossible to publish by accident. The
 * failure it guards against is not a missing field - that is loud - but an EXTRA one that appears in
 * only one arm, which is silent and is how a scorer once printed COMPARABLE over runs that were not.
 */
import { validateTimingRecord, blankRecord, TIMING_CONTRACT, TIMING_VERSION, ARMS, TERMINAL } from './timingContract.mjs';

let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };

const good = () => {
  const r = blankRecord({
    arm: 'direct', runId: 'r1', at: '2026-09-29T00:00:00Z', task: 't', page: 'p',
    baselineSha: 'abc', model: 'qwen2.5-coder:1.5b', decodingProfile: 'localized-v1',
    decoding: { temperature: 0.2, num_predict: 400, seed: 1 }, decodingOverridesRefused: [],
  });
  r.clocks = { generationMs: 100, verificationMs: 900, endToEndMs: 1200, derivationMs: 300, containmentMs: 2, effectMs: 1, restorationMs: null };
  r.counts = { calls: 1, promptTokens: 300, outputTokens: 120, acceptedChanges: 1, nodesCovered: 7, nodesMissing: 0 };
  r.terminal = 'RETAINED'; r.outcome = 'ACCEPTED'; r.candidateSha = 'def';
  return r;
};

console.log('\npositive control - a well-formed record validates');
{
  const v = validateTimingRecord(good());
  say(v.ok, `a complete record passes${v.ok ? '' : ': ' + v.problems.join('; ')}`);
  say(TIMING_CONTRACT === 'TIMING-1' && TIMING_VERSION === '1.0.0', `the contract names itself (${TIMING_CONTRACT} v${TIMING_VERSION})`);
}

console.log('\nmissing things are refused');
{
  const r = good(); delete r.baselineSha;
  say(!validateTimingRecord(r).ok, 'a missing required key');
  const c = good(); delete c.clocks.verificationMs;
  say(!validateTimingRecord(c).ok, 'a missing clock');
  const n = good(); delete n.counts.outputTokens;
  say(!validateTimingRecord(n).ok, 'a missing count');
  const p = good(); p.decodingProfile = '';
  say(!validateTimingRecord(p).ok, 'an empty decoding profile - the run could not say what it ran under');
}

console.log('\nEXTRA things are refused too, which is the one that would otherwise be silent');
{
  const r = good(); r.governedExtra = 'only the treatment arm has this';
  const v = validateTimingRecord(r);
  say(!v.ok && v.problems.some((p) => /UNKNOWN key/.test(p)),
    'a column present in one arm and not the other is refused, not tolerated');
  const c = good(); c.clocks.leaseMs = 5;
  say(!validateTimingRecord(c).ok, 'and so is an extra clock, however reasonable it looks');
}

console.log('\nthe clocks must be mutually consistent or "slow" means nothing');
{
  const g = good(); g.clocks.generationMs = 5000;
  say(!validateTimingRecord(g).ok, 'generation cannot exceed end-to-end');
  const v = good(); v.clocks.verificationMs = 5000;
  say(!validateTimingRecord(v).ok, 'nor can verification');
  const ok = good(); ok.clocks.generationMs = 1200; ok.clocks.verificationMs = 0;
  say(validateTimingRecord(ok).ok, 'but equalling it is allowed - a run can be almost entirely generation');
}

console.log('\narms and terminals are closed sets');
{
  const a = good(); a.arm = 'hybrid';
  say(!validateTimingRecord(a).ok, `arm must be one of ${ARMS.join('/')}`);
  const t = good(); t.terminal = 'MOSTLY_FINE';
  say(!validateTimingRecord(t).ok, `terminal must be one of ${TERMINAL.join(', ')}`);
  const ne = good(); ne.terminal = 'NOT_EVALUATED';
  say(validateTimingRecord(ne).ok, 'and NOT_EVALUATED is a real outcome, not a gap');
}

console.log('\nthe blank shape carries every column, so none can be invented by forgetting it');
{
  const b = blankRecord({ arm: 'governed', runId: 'r', at: 'now', task: 't', page: 'p', baselineSha: 's', model: 'm', decodingProfile: 'localized-v1', decoding: {}, decodingOverridesRefused: [] });
  const v = validateTimingRecord(b);
  say(v.problems.every((p) => !/UNKNOWN/.test(p)), 'a blank record has no unknown keys');
  say(Object.values(b.clocks).every((x) => x === null), 'and every clock starts null rather than 0 - unmeasured is not instant');
}

console.log(`\n  timing contract: ${passed} passed, ${failed} failed -> ${failed
  ? 'THE CONTRACT DOES NOT CONSTRAIN WHAT IT IS MEANT TO'
  : 'frozen at v1.0.0, and an incomparable record cannot be published by accident'}`);
process.exit(failed ? 1 : 0);
