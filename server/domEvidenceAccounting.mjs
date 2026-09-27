/**
 * The accounting the comparison must be read on: every starting candidate in the denominator,
 * declines and model calls apart, all time and cost including probes and failed attempts, and the
 * old-spec verdict beside the stricter post-run one.
 */
import { readFileSync, existsSync } from 'node:fs';
const W = process.argv[2];
const S = 'C:/Users/tatte/Projects/ai-coding-hub-phase1/legasus/screen/';

const arms = { E0: [], E2: [] };
for (const arm of ['E0', 'E2']) {
  for (const seed of [2, 3, 4, 5]) {
    const f = `${S}DOM-EVIDENCE-1_${arm}_seed${seed}.json`;
    if (existsSync(f)) {
      const r = JSON.parse(readFileSync(f, 'utf8'));
      const rounds = r.rounds.filter((x) => x.round > 0);
      arms[arm].push({
        seed,
        modelCalls: rounds.filter((x) => x.kind === 'repair attempt' && x.outcome !== 'DIAGNOSIS_DECLINED').length,
        policyDeclines: rounds.filter((x) => x.outcome === 'DIAGNOSIS_DECLINED').length,
        noNewInfoStops: r.rounds.filter((x) => x.outcome === 'NO_NEW_INFORMATION' || x.kind === 'stopped').length,
        producedBlocks: rounds.filter((x) => (x.blocks || 0) > 0).length,
        appliedEdits: rounds.filter((x) => ['STILL_FAILING', 'ACCEPTED'].includes(x.outcome)).length,
        acceptedOldSpec: r.accepted === true,
        postCheckPassing: r.postCheck?.passing ?? [],
        postCheckErrors: r.postCheck?.errorsRaised ?? null,
        postCheckRequested: r.postCheck?.requested ?? null,
        genSeconds: r.totals.generationSeconds, tokens: r.totals.outputTokens,
        wallSeconds: r.totals.wallClockSeconds,
        reconstructed: false,
      });
    } else {
      const r = JSON.parse(readFileSync(`${S}DOM-EVIDENCE-1_E2_seed5_reconstructed.json`, 'utf8'));
      arms[arm].push({
        seed, modelCalls: 1, policyDeclines: 0, noNewInfoStops: 1, producedBlocks: 0, appliedEdits: 0,
        acceptedOldSpec: false, postCheckPassing: r.postCheck.passing, postCheckErrors: r.postCheck.errors,
        postCheckRequested: r.postCheck.requested, genSeconds: 2.9, tokens: 150, wallSeconds: null, reconstructed: true,
      });
    }
  }
}

const sum = (a, k) => a.reduce((x, y) => x + (y[k] || 0), 0);
console.log('EVERY STARTING CANDIDATE IN THE DENOMINATOR - 4 per arm, declines included\n');
console.log('arm  accepted (old spec)  error-free (post-run)  model calls  policy declines  no-new-info stops  applied edits  gen s  tokens');
for (const arm of ['E0', 'E2']) {
  const a = arms[arm];
  const errorFree = a.filter((x) => x.postCheckErrors === 0).length;
  console.log(`${arm}   ${a.filter((x) => x.acceptedOldSpec).length} of 4               ${errorFree} of 4                  ${String(sum(a, 'modelCalls')).padEnd(11)}  ${String(sum(a, 'policyDeclines')).padEnd(15)}  ${String(sum(a, 'noNewInfoStops')).padEnd(17)}  ${String(sum(a, 'appliedEdits')).padEnd(13)}  ${sum(a, 'genSeconds').toFixed(1)}  ${sum(a, 'tokens')}`);
}

console.log('\nper candidate, both verdicts side by side:');
console.log('arm  seed  old-spec accepted  post-run passing      errors  attempted?  note');
for (const arm of ['E0', 'E2']) {
  for (const x of arms[arm]) {
    const attempted = x.appliedEdits > 0 ? 'edit applied' : x.producedBlocks > 0 ? 'block refused' : 'no block';
    console.log(`${arm}   ${x.seed}     ${x.acceptedOldSpec ? 'YES' : 'no '}                [${String(x.postCheckPassing).replace(/[\[\]]/g, '')}]${' '.repeat(Math.max(1, 18 - String(x.postCheckPassing).length))}${String(x.postCheckErrors).padEnd(6)}  ${attempted.padEnd(13)} ${x.reconstructed ? 'reconstructed' : ''}`);
  }
}

// THE TRAP, stated numerically: success among attempted candidates only.
console.log('\nTHE MISLEADING DENOMINATOR, shown so it cannot be used by accident:');
for (const arm of ['E0', 'E2']) {
  const a = arms[arm];
  const attempted = a.filter((x) => x.appliedEdits > 0);
  console.log(`  ${arm}: accepted among candidates whose edits APPLIED = ${attempted.filter((x) => x.acceptedOldSpec).length} of ${attempted.length}` +
    `   <- do not use: it would let a narrower attempt rate look like better repair`);
}
