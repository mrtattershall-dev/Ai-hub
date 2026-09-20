// H-DEFAULT — the classification experiment. No production code is changed by this file.
//
//     node benchmarks/run-h-default.mjs
//
// Every corpus entry is pushed through the FROZEN table. An entry naming a seventh role or a new
// completion law makes `classify` throw, which is how "the taxonomy did not grow" becomes a
// measurement rather than a promise.
import { readFileSync } from 'node:fs';
import { classify, VERDICT, ROLE, COMPLETION } from '../legasus/legascreen/roles.mjs';

const corpus = JSON.parse(readFileSync('benchmarks/h-default-corpus.json', 'utf8'));
const say = (...a) => console.log(...a);

let rows;
try { rows = corpus.entries.map(classify); } catch (e) {
  say('TAXONOMY GREW -> H-DEFAULT REFUTED: ' + e.message);
  process.exit(1);
}

const by = (v) => rows.filter((r) => r.verdict === v);
const explained = by(VERDICT.EXPLAINED);
const values = by(VERDICT.VALUE_CONFUSION);
const other = by(VERDICT.NOT_AN_OMISSION);
const confusions = explained.reduce((m, r) => m.set(r.confusion, (m.get(r.confusion) || 0) + 1), new Map());
const disputable = explained.filter((r) => r.disputable);

say('======================================================================');
say('H-DEFAULT   corpus: ' + rows.length + ' defects, enumerated before classification');
say('  rule: ' + corpus.corpus_rule.slice(0, 96));
say('');
say('  THE TAXONOMY DID NOT GROW: every entry validated against the six frozen roles and six');
say('  frozen laws. classify() throws on a seventh, and did not.');
say('');
say('  EXPLAINED by wrong-role completion   ' + String(explained.length).padStart(3)
  + '   ' + Math.round(100 * explained.length / rows.length) + '%');
say('  VALUE_CONFUSION (ANY/STALE/OPAQUE)   ' + String(values.length).padStart(3)
  + '   the VALUE set covers these; the COMPLETION table does not');
say('  NOT_AN_OMISSION                      ' + String(other.length).padStart(3)
  + '   forgery, naming, ordering, identity, kind');
say('');
say('  D-2, DISTINCT CONFUSIONS (the test against one observation wearing a table):');
for (const [c, n] of [...confusions].sort((a, b) => b[1] - a[1])) {
  say('      ' + String(n).padStart(3) + '  ' + c);
}
say('      distinct confusions: ' + confusions.size);
say('');
say('  DISPUTABLE readings among the EXPLAINED: ' + disputable.length + ' / ' + explained.length
  + '   (' + disputable.map((r) => r.id).join(', ') + ')');
say('  EXPLAINED excluding every disputable reading: ' + (explained.length - disputable.length));
say('');
say('  THE SIX LAWS, none added:');
for (const r of Object.values(ROLE)) say('      ' + r.padEnd(10) + '-> ' + COMPLETION[r]);
say('');
say('  NOT_AN_OMISSION entries, which the hypothesis does NOT explain:');
for (const r of other) say('      ' + r.id.padEnd(11) + r.what.slice(0, 78));
say('======================================================================');
