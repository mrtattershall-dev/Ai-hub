// LEGASCREEN v3 slice 1 — the lineage layer, run against a tree.
//
//     node benchmarks/run-legascreen-v3.mjs [targetDir]
//
// Prints the discovered support matrix, the OBSERVED aggregation, and any mismatch against what an
// operation's own source declares. Nothing here matches a field name to a field name.
import { pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';
import { lineage, aggregationMismatch, AGGREGATION, CASE } from '../legasus/legascreen/lineage.mjs';

const target = resolve(process.argv[2] || '.');
const url = (rel) => pathToFileURL(join(target, rel)).href;
const has = (rel) => existsSync(join(target, rel));
const say = (...a) => console.log(...a);

const cases = [];

if (has('legasus/legaknow/calculus.mjs')) {
  const C = await import(url('legasus/legaknow/calculus.mjs'));
  const O = await import(url('legasus/legaknow/observation.mjs'));
  const obs = () => O.observation({ status: O.OBSERVABILITY.OBSERVED, value: 'v', subject: 's',
    producer: 'p', procedure: 'q', attribution: 'a', context: 'c' });
  const tok = (ctx) => C.observe({ observation: obs(), procedure: 'tracer', context: ctx });
  cases.push({
    name: 'calculus.derive',
    inputs: [tok({ repository: 'S1', criterion: 'K' }), tok({ repository: 'S1', criterion: 'K' })],
    call: (ins) => C.derive({ premises: ins, rule: { name: 'conjunction', requires: [] }, claim: 'c' }),
    // DECLARED BY THE OPERATION'S OWN SOURCE: "The output context is the INTERSECTION."
    declared: { 'context.repository': AGGREGATION.ALL_OF, 'context.criterion': AGGREGATION.ALL_OF },
  });
}

if (has('legasus/legaexternal/adapt.mjs')) {
  const A = await import(url('legasus/legaexternal/adapt.mjs'));
  cases.push({
    name: 'adapt.adaptRecord',
    inputs: [{ identity: { producer: 'CPython doctest', producerVersion: '3.13', document: 'm.f',
      ordinal: 0 } }],
    call: (ins) => A.adaptRecord({ nativeResult: 'PASS', nativeDetails: {}, want: 'x\n',
      source: 'f()', identity: ins[0].identity }),
  });
}

say('LEGASCREEN v3 slice 1 - semantic lineage');
say('  target : ' + target);
say('');
let mismatches = 0;
for (const c of cases) {
  const lin = lineage(c);
  say(c.name + '   [' + lin.state + ']');
  if (lin.state !== CASE.OBSERVED) { say('    ' + lin.why); say(''); continue; }
  say('    SUPPORT EDGES (discovered, not named):');
  const seen = new Set();
  for (const e of lin.edges) {
    const k = e.from + ' -> ' + e.to;
    if (seen.has(k)) continue;
    seen.add(k);
    say('      ' + e.from.padEnd(34) + ' -> ' + e.to.padEnd(22) + ' ' + e.effect);
  }
  if (!seen.size) say('      none');
  say('    OBSERVED AGGREGATION:');
  for (const [k, v] of Object.entries(lin.aggregation)) say('      ' + k.padEnd(24) + v);
  say('    CASES: observed ' + lin.cases[CASE.OBSERVED] + '   vacuous '
    + lin.cases[CASE.VACUOUS_PERTURBATION] + '   unobservable ' + lin.cases[CASE.NO_OBSERVATION]);
  const mm = aggregationMismatch({ lin, declared: c.declared });
  for (const m of mm) {
    mismatches++;
    say('    *** MISMATCH  ' + m.coordinate + '   declared ' + m.declared + '   observed ' + m.observed);
    say('        ' + m.why);
  }
  say('');
}
say('AGGREGATION MISMATCHES: ' + mismatches);
