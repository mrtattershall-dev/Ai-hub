// H-DISTINCTION — classification under the locating rule. Changes nothing.
//
//     node benchmarks/run-h-distinction.mjs
import { readFileSync } from 'node:fs';

const DIRECTION = { COLLAPSE: 'COLLAPSE', SEPARATION: 'SEPARATION', NEITHER: 'NEITHER' };
const c = JSON.parse(readFileSync('benchmarks/h-distinction-corpus.json', 'utf8'));
const say = (...a) => console.log(...a);

// THE LOCATING RULE, ENFORCED. A collapse or separation must name the PROJECTION it happened in.
// An entry that cannot is NEITHER, and a NEITHER must say why no projection did it.
const rows = c.entries.map((e) => {
  if (!Object.values(DIRECTION).includes(e.direction)) throw new Error(e.id + ': bad direction');
  if (e.direction === DIRECTION.NEITHER) {
    if (!e.why || e.why.length < 40) throw new Error(e.id + ': NEITHER must argue the absence');
    if (e.projection) throw new Error(e.id + ': NEITHER cannot name a projection');
    return e;
  }
  if (typeof e.projection !== 'string' || e.projection.length < 10) {
    throw new Error(e.id + ': ' + e.direction + ' must name the PROJECTION step. A collapse located'
      + ' in a consumer decision is NEITHER under the locating rule.');
  }
  return e;
});

const by = (d) => rows.filter((r) => r.direction === d);
const col = by(DIRECTION.COLLAPSE); const sep = by(DIRECTION.SEPARATION); const nei = by(DIRECTION.NEITHER);

say('======================================================================');
say('H-DISTINCTION   corpus: ' + rows.length + '   locating rule ENFORCED');
say('');
say('  COLLAPSE     ' + String(col.length).padStart(3) + '   a required distinction merged by a projection');
say('  SEPARATION   ' + String(sep.length).padStart(3) + '   an irrelevant distinction invented by a projection');
say('  NEITHER      ' + String(nei.length).padStart(3) + '   the distinction survived; a consumer did not use it');
say('');
say('  DX-3, both directions populated: ' + (col.length > 0 && sep.length > 0));
for (const r of sep) say('      SEPARATION  ' + r.id.padEnd(10) + r.projection);
say('');
say('  DX-2, THE BREAKING PREDICTION - entries the frame does NOT cover:');
for (const r of nei) { say('      ' + r.id); say('          ' + r.why.slice(0, 150)); }
if (!nei.length) {
  say('      NONE. 36 of 36 covered. THAT IS THE UNFALSIFIABILITY WARNING, NOT A SUCCESS.');
}
say('');
say('  the discriminating set is ' + nei.length + ' of ' + rows.length
  + '.  H-LOSS discriminated 6; this frame discriminates ' + nei.length + '.');
say('  A FRAME THAT COVERS MORE IS NOT THEREBY MORE TRUE. It is harder to refute, which is the');
say('  opposite of what a level deeper should buy.');
say('======================================================================');
