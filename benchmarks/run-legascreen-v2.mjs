// LEGASCREEN v2 — the minting probes over every legaknow module that carries an authority map.
//
//     node benchmarks/run-legascreen-v2.mjs [targetDir]
//
// The DRIVER below supplies legitimate calls. It is written to exercise each transformation the way
// an ordinary caller would, and it is the hand-authored part - the probes, the perturbations and the
// invariants are in legascreen/minting.mjs and are not touched per target.
import { pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';
import { screenAll } from '../legasus/legascreen/minting.mjs';

const target = resolve(process.argv[2] || '.');
const url = (rel) => pathToFileURL(join(target, rel)).href;
const has = (rel) => existsSync(join(target, rel));
const say = (...a) => console.log(...a);

const transforms = [];
const skipped = [];

// ---- calculus.mjs : OBSERVE / DERIVE / DELEGATE / NARROW
if (has('legasus/legaknow/calculus.mjs')) {
  const C = await import(url('legasus/legaknow/calculus.mjs'));
  const O = await import(url('legasus/legaknow/observation.mjs'));
  const obs = () => O.observation({ status: O.OBSERVABILITY.OBSERVED, value: 'v', subject: 's',
    producer: 'p', procedure: 'q', attribution: 'a', context: 'c' });
  const tok = (ctx) => C.observe({ observation: obs(), procedure: 'tracer', context: ctx });

  // A LEGITIMATE derive: both premises establish the same world. This is the shape a caller uses,
  // and it is also the POSITIVE CONTROL - retaining repository here must NOT be flagged.
  transforms.push({ name: 'calculus.derive',
    inputs: [tok({ repository: 'S1', criterion: 'K' }), tok({ repository: 'S1', criterion: 'K' })],
    conjunctive: 'its own source: "The output context is the INTERSECTION"',
    call: (ins) => C.derive({ premises: ins, rule: { name: 'conjunction', requires: [] },
      claim: 'both' }) });

  transforms.push({ name: 'calculus.delegate',
    inputs: [C.delegate({ from: 'OWNER', grant: ['edit'], to: 'A', context: { repository: 'S1' } })],
    call: (ins) => C.delegate({ from: ins[0], grant: ['edit'], to: 'B' }) });

  transforms.push({ name: 'calculus.narrow',
    inputs: [tok({ repository: 'S1' })],
    call: (ins) => C.narrow(ins[0], 'criterion', 'K') });
} else skipped.push('calculus.mjs');

// ---- justification.mjs : node() building a claim from a scope, and widen()
if (has('legasus/legaknow/justification.mjs')) {
  const J = await import(url('legasus/legaknow/justification.mjs'));
  transforms.push({ name: 'justification.scope',
    inputs: [{ scope: { repository: 'S1', criterion: 'K' } }],
    call: (ins) => ({ scope: J.scope(ins[0].scope) }) });

  transforms.push({ name: 'justification.node',
    inputs: [{ scope: J.scope({ repository: 'S1', criterion: 'K' }) }],
    call: (ins) => J.node({ kind: J.NODE.CLAIM, proposition: 'P', scope: ins[0].scope, basis: 'X' }) });
} else skipped.push('justification.mjs');

// ---- adapt.mjs : a producer record adapted into a scoped claim
if (has('legasus/legaexternal/adapt.mjs')) {
  const A = await import(url('legasus/legaexternal/adapt.mjs'));
  transforms.push({ name: 'adapt.adaptRecord',
    inputs: [{ scope: { producer: 'CPython doctest', producerVersion: '3.13', document: 'm.f',
      ordinal: 0 } }],
    call: (ins) => A.adaptRecord({ nativeResult: 'PASS', nativeDetails: {}, want: 'x\n',
      source: 'f()', identity: ins[0].scope }) });
} else skipped.push('adapt.mjs');

// ---- referent.mjs : reinterpreting a claim across a bridge
if (has('legasus/legaknow/referent.mjs')) {
  const R = await import(url('legasus/legaknow/referent.mjs'));
  const claim = R.scopedClaim({ proposition: 'P',
    referent: { subject: 'x', criterion: 'K', observer: 'o', scope: 'S1' } });
  transforms.push({ name: 'referent.reinterpret',
    inputs: [{ context: { subject: 'x', criterion: 'K', observer: 'o', scope: 'S1' } }],
    call: (ins) => {
      const r = R.reinterpret({ ...claim, referent: ins[0].context },
        { ...ins[0].context }, { criterion: R.BRIDGE.PRESERVED });
      return r.ok ? { context: r.claim.referent } : { context: {} };
    } });
} else skipped.push('referent.mjs');

const result = screenAll(transforms);

say('LEGASCREEN v2 - minting (witness -> perturbation -> invariant)');
say('  target : ' + target);
say('');
say('POSITIVES: ' + result.positives.length);
for (const p of result.positives) {
  say('  [' + p.probe + '] ' + p.subject + '   dimension: ' + p.dimension + ' = ' + p.value
    + (p.input !== undefined ? '   (input ' + p.input + ')' : ''));
  say('      ' + p.why);
}
if (!result.positives.length) say('  none');
say('');
say('COVERAGE  transforms ' + result.coverage.transforms + '   witnessed '
  + result.coverage.witnessed + '   perturbations ' + result.coverage.perturbations);
for (const u of result.unscreened) say('  UNSCREENED  ' + u.subject + ' - ' + u.why);
if (skipped.length) say('  MODULE ABSENT IN THIS TREE: ' + skipped.join(', '));
