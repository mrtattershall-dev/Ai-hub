// LEGASCREEN v3 slice 2 — lawful counterfactual replay, run against a tree.
//
//     node benchmarks/run-legascreen-cf.mjs [targetDir]
//
// The DRIVER supplies FACTS and a CONSTRUCT that calls the target's own production constructors.
// It fabricates no authority object and imports nothing privileged - `observe` and `derive` are the
// same exports production uses.
import { pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';
import { counterfactual, mismatches, OUTCOME, AGGREGATION } from '../legasus/legascreen/counterfactual.mjs';

const target = resolve(process.argv[2] || '.');
const url = (rel) => pathToFileURL(join(target, rel)).href;
const say = (...a) => console.log(...a);

if (!existsSync(join(target, 'legasus/legaknow/calculus.mjs'))) {
  say('calculus.mjs absent in this tree'); process.exit(0);
}
const C = await import(url('legasus/legaknow/calculus.mjs'));
const O = await import(url('legasus/legaknow/observation.mjs'));

const observation = () => O.observation({ status: O.OBSERVABILITY.OBSERVED, value: 'v', subject: 's',
  producer: 'p', procedure: 'q', attribution: 'a', context: 'c' });

// FACTS are pre-authority: plain context data. CONSTRUCT mints through the production constructor.
const cases = [{
  name: 'calculus.derive',
  facts: [{ repository: 'S1', criterion: 'K' }, { repository: 'S1', criterion: 'K' }],
  construct: (facts) => facts.map((ctx) => C.observe({ observation: observation(),
    procedure: 'tracer', context: ctx })),
  operate: (ins) => C.derive({ premises: ins, rule: { name: 'conjunction', requires: [] },
    claim: 'both' }),
  declared: {
    'context.repository': { value: AGGREGATION.ALL_OF,
      authority: 'calculus.mjs, DERIVE: "The output context is the INTERSECTION"' },
    'context.criterion': { value: AGGREGATION.ALL_OF,
      authority: 'calculus.mjs, DERIVE: "The output context is the INTERSECTION"' },
  },
}];

// CF-4, asserted rather than intended: the substrate exports no mint, and the driver constructs only
// through the target's own exports.
const cf = await import('../legasus/legascreen/counterfactual.mjs');
const forbidden = Object.keys(cf).filter((k) => /forge|mint|token|unsafe|test/i.test(k));

say('LEGASCREEN v3 slice 2 - lawful counterfactual replay');
say('  target : ' + target);
say('  NO-BACKDOOR CHECK: substrate exports ' + JSON.stringify(Object.keys(cf))
  + ' -> forbidden: ' + (forbidden.length ? forbidden.join(', ') : 'none'));
say('');

let found = 0;
for (const c of cases) {
  const r = counterfactual(c);
  say(c.name + '   [' + r.outcome + ']');
  if (r.outcome !== OUTCOME.OBSERVED) { say('    ' + r.why); say(''); continue; }
  say('    SUPPORT EDGES (facts -> output, via real constructors):');
  const seen = new Set();
  for (const e of r.edges) {
    const k = e.from + '->' + e.to;
    if (seen.has(k)) continue; seen.add(k);
    say('      ' + e.from.padEnd(24) + ' -> ' + e.to.padEnd(22) + e.effect);
  }
  if (!seen.size) say('      none');
  say('    OBSERVED AGGREGATION:');
  for (const [k, v] of Object.entries(r.aggregation)) say('      ' + k.padEnd(24) + v);
  say('    STAGES: ' + Object.entries(r.stages).filter(([, n]) => n > 0)
    .map(([s, n]) => s + '=' + n).join('  '));
  for (const m of mismatches(r)) {
    if (m.verdict === 'MISMATCH') found++;
    say('    *** ' + m.verdict + '  ' + m.coordinate
      + (m.declared ? '   declared ' + m.declared + '   observed ' + m.observed : ''));
    say('        ' + m.why);
  }
  say('');
}
say('MISMATCHES: ' + found);
