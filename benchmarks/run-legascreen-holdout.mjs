// LEGASCREEN HOLDOUT — the POINTED reading. Rule frozen in 040d95e; holdout selected mechanically
// as C2, whose live commit is b11e51f and whose repair is a39dafd.
//
//     node benchmarks/run-legascreen-holdout.mjs <targetDir>
//
// THE PROBES ARE NOT TOUCHED. `probeErasureOver` is imported from legascreen/probes.mjs exactly as it
// stands. The only thing written here is a DRIVER that composes calculus.mjs the way an ordinary
// caller would - observe, derive, delegate - and it is reproduced in the result so the claim can be
// judged rather than taken. The driver contains no premise pair shaped like C2 and no reference to
// `context`, to absence, or to any dimension.
import { pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
import { probeErasureOver, probeAlias } from '../legasus/legascreen/probes.mjs';

const target = resolve(process.argv[2] || '.');
const say = (...a) => console.log(...a);
const url = (rel) => pathToFileURL(join(target, rel)).href;

const C = await import(url('legasus/legaknow/calculus.mjs'));
const O = await import(url('legasus/legaknow/observation.mjs'));

// THE OBVIOUS COMPOSITION of this module: make an observation, observe it, derive from two
// entitlements, delegate from the root. Nothing here is shaped by the holdout.
const obs = O.observation({ status: O.OBSERVABILITY.OBSERVED, value: 'v', subject: 's',
  producer: 'p', procedure: 'q', attribution: 'a', context: 'c' });
const epistemic = C.observe({ observation: obs, procedure: 'tracer', context: { repository: 'S1' } });
const derived = C.derive({ premises: [epistemic, epistemic], rule: { name: 'conjunction', requires: [] },
  claim: 'both' });
const normative = C.delegate({ from: 'OWNER', grant: ['edit'], to: 'A' });

const seeds = {};
const put = (n, v) => { if (v && typeof v === 'object') seeds[n] = () => v; };
put('observation', obs);
put('token.epistemic', epistemic);
put('token.derived', derived);
put('token.normative', normative);

const erasure = probeErasureOver({ exports: C, seeds, moduleName: 'calculus' });
const alias = probeAlias({ target });

say('LEGASCREEN HOLDOUT - POINTED reading');
say('  target  : ' + target);
say('  holdout : C2 - derive() output context gains a dimension no premise established');
say('');
say('P-ERASURE over calculus.mjs');
say('  positives : ' + erasure.positives.length + '   examined : ' + erasure.examined
  + '   unscreened : ' + erasure.unscreened.length);
for (const p of erasure.positives) say('    * ' + p.subject + '   lost: ' + p.lost.join(', '));
for (const u of erasure.unscreened) say('    UNSCREENED  ' + u.fn);
say('');
say('P-ALIAS over the tree');
say('  positives : ' + alias.positives.length);
for (const p of alias.positives) say('    * ' + p.subject + '   owners: ' + p.owners.join(', '));
say('');
// THE QUESTION THE OUTCOME VOCABULARY ASKS: would a reader of these positives alone investigate
// calculus.derive's handling of a dimension no premise established?
const namesDerive = [...erasure.positives, ...alias.positives]
  .filter((p) => /derive/i.test(p.subject || ''));
say('POSITIVES NAMING derive: ' + namesDerive.length);
say('');
say('AND THE DEFECT ITSELF, evaluated directly so the run cannot be read as the defect being absent:');
const bad = C.derive({ premises: [C.observe({ observation: obs, procedure: 't', context: {} }),
  C.observe({ observation: obs, procedure: 't', context: { repository: 'S1' } })],
rule: { name: 'conjunction', requires: [] }, claim: 'C' });
say('  derive({}, {repository:S1}).context = ' + JSON.stringify(bad.context || null)
  + '   minted=' + (bad.minted !== false));
say('  C2 IS ' + (bad.context && bad.context.repository === 'S1' ? 'LIVE' : 'REPAIRED') + ' in this tree.');
