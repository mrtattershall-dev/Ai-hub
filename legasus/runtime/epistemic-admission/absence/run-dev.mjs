// DEVELOPMENT CASE ONLY. The one preserved false report, and nothing else (prereg, step 1).
// No evaluation claim is selected or run here.
//
// THE CASE. On 2026-09-22 I wrote, of the Dust & Harvest build:
//   "_foreclosureFired (19344) and _bondForeclosureFired (32705) are module-level lets that are
//    never saved and never restored - session-scoped by construction"
// _bondForeclosureFired is saved at 32763 and restored at 32778. The claim was false.
//
// TWO frozen generators reproduce the two halves of how it happened (Amendment 3.2):
//   G1  longest alphabetic run, original case -> "bondForeclosureFired", searched only in a window
//       around the anchor I was reading (the main loader). Reproduces the REGION defect.
//   G2  subject minus its leading camelCase segment, leading letter lowercased -> "foreclosureFired",
//       which is the query I actually used. Over the WHOLE file it returns 6 hits, every one of
//       them the unrelated _foreclosureFired and none of them the bond flag. Reproduces the
//       SPELLING defect - a whole-file search that is still blind.
// G2's first draft kept the capital F ("ForeclosureFired"), which matches _bondForeclosureFired
// and so reproduced nothing; I asserted it reproduced the defect without checking, which is the
// same species of error as the one under study. Corrected and verified against the corpus.

import { loadCorpus, naiveRecord, naiveRecordG2, Ledger, MEANING, DECISION } from './harness.mjs';
import { gather, baselineDecide, legasusDecide } from './arms.mjs';
import { checkerDecide } from './checker.mjs';

const CORPUS = 'C:/Users/tatte/Projects/dust-harvest-repair/game.original.html';

const devClaim = {
  id: 'DEV-1',
  corpus: CORPUS,
  form: 'B',
  subject: '_bondForeclosureFired',
  // What I actually asserted: no literal persistence of this binding, anywhere in the file.
  text: '_bondForeclosureFired is never saved and never restored, anywhere in the build',
  meaning: MEANING.LITERAL,
  predicate: 'no line persists or restores _bondForeclosureFired',
  domain: 'PERSISTENCE_SITES_OF__bondForeclosureFired_IN_GAME_HTML',
  anchor: 25730,           // the main loader - where I was reading when I wrote it
  asserted_scope: { from: 1, to: Infinity },   // "anywhere in the build"
};

const corpus = loadCorpus(CORPUS);
devClaim.asserted_scope.to = corpus.lines.length;

const RECORDS = [['G1 region-narrow', naiveRecord(corpus, devClaim)], ['G2 spelling-mismatch', naiveRecordG2(corpus, devClaim)]];

const allResults = {};
for (const [label, initial] of RECORDS) {
  const results = {};
  console.log('\n########## initial record: ' + label + ' ##########');
  console.log('=== DEVELOPMENT CASE: ' + devClaim.id + ' ===');
  console.log('claim   :', devClaim.text);
  console.log('meaning :', devClaim.meaning, '| asserted scope: 1 -', devClaim.asserted_scope.to);
  console.log('\n--- initial record (frozen naive searcher) ---');
  console.log('query   :', JSON.stringify(initial.query), '(case-sensitive)');
  console.log('scope   :', initial.from + '-' + initial.to, '(anchor ' + devClaim.anchor + ' +/- 170)');
  console.log('hits    :', initial.hit_count, initial.hit_lines.length ? 'at ' + initial.hit_lines.join(', ') : '');
  console.log('=> read naively: no hits in the window, so "never saved and never restored".');


  for (const [name, decide] of [['BASELINE', baselineDecide], ['LEGASUS', legasusDecide], ['checker (NON-ARM)', checkerDecide]]) {
    const ledger = new Ledger();
    const ev = name === 'checker (NON-ARM)' ? null : gather(devClaim, corpus, ledger, initial);
    const out = ev ? decide(devClaim, ev) : decide(devClaim, corpus, ledger, initial);
    results[name] = { ...out, cost: ledger.cost, spent: ledger.log.join(',') };
    console.log('\n--- ' + name + ' ---');
    console.log('decision:', out.decision);
    console.log('why     :', out.why);
    if (ev) console.log('hits    :', ev.hits.join(', ') || '(none)');
    if (ev && ev.spelling_risk.length) console.log('spelling:', ev.spelling_risk.join(', '));
    if (out.state) console.log('admit   :', out.state, '| coverage', out.coverage, '| filed', out.coverageFiled);
    console.log('cost    :', JSON.stringify(ledger.cost), '[' + ledger.log.join(', ') + ']');
  }

  // The development case has ONE correct answer, and it is not in dispute: the claim is false.
  allResults[label] = results;
}

const CORRECT = DECISION.REFUSE;
console.log('\n=== development-case check (correct answer: ' + CORRECT + ') ===');
for (const [label, results] of Object.entries(allResults))
  for (const [name, r] of Object.entries(results)) {
  console.log((r.decision === CORRECT ? 'PASS  ' : 'FAIL  ') + label.padEnd(22) + name.padEnd(18), r.decision, '| cost', r.cost.total);
}
console.log('\nNOTE: passing the development case is what the arms were BUILT to do. It carries no');
console.log('evidence about the comparison. Evaluation cases are selected and sealed after this.');
