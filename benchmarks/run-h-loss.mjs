// H-LOSS — the classification experiment. Changes no production code and no frozen mechanism.
//
//     node benchmarks/run-h-loss.mjs
import { readFileSync } from 'node:fs';
import { classify, compareWith, VERDICT, CRITERION } from '../legasus/legascreen/loss.mjs';

const loss = JSON.parse(readFileSync('benchmarks/h-loss-corpus.json', 'utf8'));
const dflt = JSON.parse(readFileSync('benchmarks/h-default-corpus.json', 'utf8'));
const say = (...a) => console.log(...a);

let rows;
try { rows = loss.entries.map(classify); } catch (e) {
  say('A CRITERION WAS NOT NAMEABLE -> the entry is not a near miss: ' + e.message);
  process.exit(1);
}

const qual = rows.filter((r) => r.verdict === VERDICT.H_LOSS);
const not = rows.filter((r) => r.verdict === VERDICT.NOT_H_LOSS);
const disputable = qual.filter((r) => r.disputable);
const cmp = compareWith(rows, dflt.entries);
const fails = not.reduce((m, r) => m.set(r.fails, (m.get(r.fails) || 0) + 1), new Map());

say('======================================================================');
say('H-LOSS   corpus: ' + rows.length + ' defects, enumerated before classification');
say('  criteria enforced: ' + Object.values(CRITERION).join(', ')
  + '   (an entry that cannot name all three is NOT_H_LOSS, not a near miss)');
say('');
say('  H_LOSS        ' + String(qual.length).padStart(3) + '   '
  + Math.round(100 * qual.length / rows.length) + '%');
say('  NOT_H_LOSS    ' + String(not.length).padStart(3)
  + '   by failing criterion: ' + [...fails].map(([k, n]) => k + '=' + n).join(', '));
say('  disputable among the qualifying: ' + disputable.length
  + ' (' + disputable.map((r) => r.id).join(', ') + ')');
say('');
say('  L-2, IS THIS A DIFFERENT HYPOTHESIS OR A BIGGER WORD?');
say('      H-DEFAULT explained, also H-LOSS      ' + String(cmp.both.length).padStart(3));
say('      H-LOSS only (H-DEFAULT said NOT)      ' + String(cmp.lossOnly.length).padStart(3)
  + '   ' + cmp.lossOnly.slice(0, 8).join(', '));
say('      H-DEFAULT only (H-LOSS says NOT)      ' + String(cmp.defaultOnly.length).padStart(3)
  + '   ' + cmp.defaultOnly.join(', '));
say('      the two sets coincide: ' + cmp.coincide);
say('');
say('  THE ENTRIES THAT DO NOT QUALIFY, and which criterion each fails:');
for (const r of not) {
  say('      ' + r.id.padEnd(11) + 'fails ' + r.fails.toUpperCase());
  say('          ' + r.why.slice(0, 104));
}
say('');
say('  A FRAME THAT EXPLAINS ALMOST EVERYTHING RETROSPECTIVELY IS NOT THEREBY TRUE.');
say('  ' + qual.length + ' of ' + rows.length + ' qualify. The discriminating set is ' + not.length
  + '. That ratio is the warning, not the result.');
say('======================================================================');
