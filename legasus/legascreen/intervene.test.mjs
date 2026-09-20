// CONTROLS FOR AUTO-CF-1 — predictions C-1..C-6 in benchmarks/AUTO_CF_1_PREREG.md.
//
// Each control is written to FIRE: the fixture is built so the named outcome is the only correct one,
// and a substrate that collapsed the cases would fail here rather than in a run nobody reads. The
// runs against the real trees are in benchmarks/RESULT.auto-cf.md.
import test from 'node:test';
import assert from 'node:assert';
import * as substrate from './intervene.mjs';
import { recorder } from './witness.mjs';
import { intervene, interveneAll } from './intervene.mjs';
import { STATE } from './outcome.mjs';

// A miniature authority system with a real brand, and a `derive` whose output context is the
// intersection - the same shape as the subject, written here so nothing depends on the repository.
function rig({ observe, derive } = {}) {
  const MINTED = new WeakSet();
  const mint = (o) => { const t = Object.freeze(o); MINTED.add(t); return t; };
  const isAuthority = (t) => !!(t && typeof t === 'object' && MINTED.has(t));
  const OBS = observe || (({ context }) => mint({ context: Object.freeze({ ...context }) }));
  const DER = derive || (({ premises }) => {
    if (!premises.every(isAuthority)) return { refused: true };
    const ctx = {};
    for (const d of ['repo', 'crit']) {
      if (premises.every((p) => p.context[d] !== undefined)) ctx[d] = premises[0].context[d];
    }
    return mint({ context: Object.freeze(ctx) });
  });
  const R = recorder().brand(isAuthority);
  const o = R.instrument('t.observe', OBS);
  const d = R.instrument('t.derive', DER);
  return { R, o, d, isAuthority };
}

const leafAt = (w, path) => w.leaves.find((l) => l.path === path);

test('C-1 — a counterfactual runs end to end from a recorded witness, with no driver', () => {
  const { R, o, d } = rig();
  d({ premises: [o({ context: { repo: 'S1', crit: 'K' } }), o({ context: { repo: 'S1', crit: 'K' } })] });
  const w = R.witnesses('t.derive')[0];
  const r = intervene(R, w, leafAt(w, 'arg[0].context.repo'));
  assert.equal(r.outcome, STATE.OBSERVED);
  assert.deepEqual(r.journey.path(),
    [STATE.DISCOVERED, STATE.BASELINE_REPLAYED, STATE.PERTURBATION_APPLIED, STATE.OBSERVED]);
  assert.deepEqual(r.delta, [{ coordinate: 'context.repo', was: 'S1', now: undefined, effect: 'REMOVED' }]);
});

test('C-3b MUST FIRE — a leaf the subject IGNORES is OBSERVED with no delta, never NO_EFFECT', () => {
  // The distinction slice 1 collapsed. `note` really is removed from the rebuilt world; the output
  // really does not move. That is an observation about the subject, not a failed intervention.
  const { R, o, d } = rig();
  d({ premises: [o({ context: { repo: 'S1', note: 'ignored' } }), o({ context: { repo: 'S1', note: 'ignored' } })] });
  const w = R.witnesses('t.derive')[0];
  const r = intervene(R, w, leafAt(w, 'arg[0].context.note'));
  assert.equal(r.outcome, STATE.OBSERVED, 'the intervention HAPPENED');
  assert.deepEqual(r.delta, [], 'and the output did not move');
  assert.match(r.why, /the observed reading did not/);
});

test('C-2b DID NOT FIRE, AND THE PREDICTION WAS WRONG — under removal, NO_EFFECT is unreachable', () => {
  // The preregistration said a constructor re-supplying a default would make the intervention
  // vacuous. It does not: a default lands in the constructor's OUTPUT, while the proof is taken on
  // the rebuilt ARGUMENT, which always differs once a key is gone. So the correct classification is
  // "applied, and absorbed" - PERTURBATION_APPLIED then OBSERVED with no delta.
  //
  // The state is kept because the proof is the right one and a future value-substitution
  // perturbation can reach it. It is recorded as NEVER SHOWN TO FIRE, which is not the same as safe.
  const g = rig();
  const fill = g.R.instrument('t.fill', (cfg) => Object.freeze({ context: { repo: 'S1', ...cfg } }));
  fill({ repo: 'S1', extra: 'x' });
  const w = g.R.witnesses('t.fill')[0];
  const r = intervene(g.R, w, leafAt(w, 'arg[0].repo'));
  assert.equal(r.outcome, STATE.OBSERVED);
  assert.deepEqual(r.delta, [], 'the default absorbed it - that is a finding, not a failed intervention');
  assert.notEqual(r.outcome, STATE.PERTURBATION_NO_EFFECT);
});

test('A WORLD THAT CANNOT BE BUILT IS NOT A WORLD IN WHICH NOTHING CHANGED', () => {
  // The first version returned PERTURBATION_NO_EFFECT when reconstruction threw - could-not-measure
  // collapsing into a measured absence, in the layer built to prevent exactly that.
  const g = rig();
  const strict = g.R.instrument('t.strict', (cfg) => {
    if (cfg.repo === undefined) throw new Error('needs repo');
    return Object.freeze({ context: { repo: cfg.repo } });
  });
  strict({ repo: 'S1', crit: 'K' });
  const w = g.R.witnesses('t.strict')[0];
  const r = intervene(g.R, w, leafAt(w, 'arg[0].repo'));
  assert.notEqual(r.outcome, STATE.PERTURBATION_NO_EFFECT);
  assert.equal(r.outcome, STATE.AUTHORITY_REFUSED, 'the TARGET itself threw, so the target refused');
});

test('C-4b MUST FIRE — a premise constructor that refuses the perturbed facts is RECONSTRUCTION_FAILED', () => {
  const g = rig();
  const strict = g.R.instrument('t.observe2', ({ context }) => (context.repo === undefined
    ? { refused: true } : g.o({ context })));
  g.d({ premises: [strict({ context: { repo: 'S1', crit: 'K' } }),
    strict({ context: { repo: 'S1', crit: 'K' } })] });
  const w = g.R.witnesses('t.derive')[0];
  const r = intervene(g.R, w, leafAt(w, 'arg[0].context.repo'));
  assert.equal(r.outcome, STATE.RECONSTRUCTION_FAILED);
  assert.match(r.why, /CONSTRUCTOR and not evidence about the target/);
  assert.equal(r.delta, undefined);
});

test('C-4c MUST FIRE — a target that refuses a LEGITIMATE rebuilt premise is AUTHORITY_REFUSED', () => {
  const picky = rig({ derive: undefined });
  const gate = picky.R.instrument('t.gate', ({ premises }) => (
    premises.every((p) => p.context.crit !== undefined)
      ? Object.freeze({ context: { ok: 'yes' } }) : { refused: true, why: 'I want crit' }));
  gate({ premises: [picky.o({ context: { repo: 'S1', crit: 'K' } }),
    picky.o({ context: { repo: 'S1', crit: 'K' } })] });
  const w = picky.R.witnesses('t.gate')[0];
  // The premises are DERIVED refs, so the crit leaves live on the observe nodes, one each. Note the
  // gate's own output is NOT branded - it carries coordinates but no mint - which is the case the
  // branded-only refusal test used to miss.
  const crits = w.leaves.filter((l) => l.path === 'arg[0].context.crit');
  assert.equal(crits.length, 2, 'one per premise, distinguished by node');
  for (const c of crits) {
    const r = intervene(picky.R, w, c);
    assert.equal(r.outcome, STATE.AUTHORITY_REFUSED);
    assert.match(r.why, /a refusal is not a/);
    assert.equal(r.delta, undefined, 'and a refusal never becomes a dependency edge');
  }
});

test('BOTH SIDES UNREADABLE IS NOT A MEASUREMENT', () => {
  // The defect the first real run exposed: a witness whose BASELINE was already a refusal scored six
  // counterfactuals as OBSERVED-with-no-delta, manufacturing confidence out of an absence.
  const g = rig();
  const raw = { context: { repo: 'S1' } };              // a plain object, not a token
  g.d({ premises: [raw, raw] });
  const w = g.R.witnesses('t.derive')[0];
  const r = intervene(g.R, w, leafAt(w, 'arg[0].premises[0].context.repo'));
  assert.equal(r.outcome, STATE.OUTPUT_UNOBSERVABLE);
  assert.match(r.why, /neither side carries anything this observer can read/);
});

test('A BASELINE REFUSAL WHOSE COUNTERFACTUAL SUCCEEDS IS STILL A MEASUREMENT', () => {
  // And this is why the repair is not "the baseline must be observable". Removing one fact turns a
  // conflict refusal into a conclusion; that is the most informative case in the real run.
  // Modelled on the real semantics: CONFLICT refuses, ABSENCE drops. An earlier fixture treated an
  // absent value as one more conflicting value, so removing the fact kept the refusal and the
  // control tested nothing.
  const g = rig({ derive: ({ premises }) => {
    const vals = [...new Set(premises.map((p) => p.context.crit).filter((v) => v !== undefined))];
    const everyone = premises.every((p) => p.context.crit !== undefined);
    if (everyone && vals.length > 1) return { refused: true, why: 'different worlds' };
    return Object.freeze({ context: { repo: premises[0].context.repo } });
  } });
  g.d({ premises: [g.o({ context: { repo: 'S1', crit: 'K1' } }), g.o({ context: { repo: 'S1', crit: 'K2' } })] });
  const w = g.R.witnesses('t.derive')[0];
  const r = intervene(g.R, w, leafAt(w, 'arg[0].context.crit'));
  assert.equal(r.outcome, STATE.OBSERVED);
  assert.deepEqual(r.delta, [{ coordinate: 'context.repo', was: undefined, now: 'S1', effect: 'ADDED' }]);
});

test('C-6 — no result carries a verdict, and nothing here asks for one', () => {
  const { R, o, d } = rig();
  d({ premises: [o({ context: { repo: 'S1', crit: 'K' } }), o({ context: { repo: 'S1', crit: 'K' } })] });
  const all = interveneAll(R, R.witnesses('t.derive')[0]);
  assert.ok(all.results.length > 0);
  for (const r of all.results) assert.equal(Object.hasOwn(r, 'verdict'), false);
});

test('C-5b — THE INTERVENTION SUBSTRATE OFFERS NO BACKDOOR', () => {
  const names = Object.keys(substrate).sort();
  assert.deepEqual(names.filter((k) => /forge|mint|fabricat|unsafe|bypass|testonly/i.test(k)), []);
  assert.deepEqual(names, ['OBSERVER', 'coordinates', 'intervene', 'interveneAll']);
});
