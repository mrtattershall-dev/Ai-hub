// CLASSIFY THE FROZEN 56 BY EXECUTION EVIDENCE — Attempt 0's undifferentiated APPARATUS_INVALID mass,
// resolved into categories that mean different things and demand different responses.
//
//   SITE_REACHED            the repository's own authored evidence makes this exact line execute.
//                           An authority experiment here is VALID. These are admissible.
//   SITE_NOT_REACHED        the function runs, this line does not. The path is not exercised by any
//                           authored example. NOT a defect of r2 and NOT a defect of the source.
//   FUNCTION_NOT_ENTERED    no authored example runs this function at all. The repository documents
//                           itself incompletely - a fact about the corpus, not about Legasus.
//   NO_ANCHOR               apparatus failure: the mutation site cannot even be located. Mine to fix.
//
// The frozen candidate manifest is INPUT ONLY. Nothing here regenerates, filters or re-samples it.
import { readFileSync, writeFileSync } from 'node:fs';
import { establish } from '../../legasus/legaexercise/bank.mjs';
import { WITNESS } from '../../legasus/legaexercise/witness.mjs';
import { envelopeOf } from '../../legasus/legacore/capability.mjs';

const ROOT = 'benchmarks/repoB/pristine';
const PKG = 'packaging';

const candidates = JSON.parse(readFileSync('benchmarks/repoB/candidates.json', 'utf8'));
const sweep = JSON.parse(readFileSync('benchmarks/repoB/sweep.json', 'utf8'));
const reached = new Set(sweep.reachedLines);
const entered = new Set(sweep.enteredFns);

// Line lookup must respect the corpus's own line endings. The corpus is byte-for-byte upstream and is
// CRLF; normalizing it would have been modifying the artifact before the experiment.
const lineOfAnchor = (file, anchorLF) => {
  const lines = readFileSync(ROOT + '/' + PKG + '/' + file, 'utf8').split(/\r?\n/);
  const hits = [];
  for (let i = 0; i < lines.length; i++) if (lines[i].replace(/\r$/, '') === anchorLF) hits.push(i + 1);
  return hits;
};

const rows = [];
for (const c of candidates) {
  const mod = c.file.replace(/\.py$/, '');
  const fnKey = mod + '.' + c.fn;
  const hits = lineOfAnchor(c.file, c.anchorLF);
  const row = { file: c.file, fn: c.fn, cls: c.cls || null, method: !!c.method,
    operator: c.operator, anchorHits: hits.length };

  if (hits.length !== 1) {
    row.category = 'NO_ANCHOR';
    row.why = hits.length === 0 ? 'the mutation anchor is not present in the corpus'
      : 'the anchor occurs ' + hits.length + ' times and does not identify a site';
    rows.push(row); continue;
  }
  const line = hits[0];
  row.line = line;
  const siteKey = mod + ':' + line;

  if (reached.has(siteKey)) {
    row.category = 'SITE_REACHED';
    // The cheapest authored example that reaches this line becomes the banked witness.
    const reaching = sweep.runs.filter((r) => r.lines.includes(siteKey))
      .sort((a, b) => a.setup.length - b.setup.length || a.invocation.length - b.invocation.length);
    row.witnessCount = reaching.length;
    row.witness = { invocation: reaching[0].invocation, setup: reaching[0].setup,
      namespaceModule: reaching[0].dotted, owner: reaching[0].owner };
  } else if (entered.has(fnKey)) {
    row.category = 'SITE_NOT_REACHED';
    row.why = 'the function executes under authored evidence but this line never does';
  } else {
    row.category = 'FUNCTION_NOT_ENTERED';
    row.why = 'no authored example in the repository runs this function';
  }

  // The capability envelope is a SEPARATE axis from observability. A site can be perfectly witnessable
  // and still be outside what r2 may attempt; conflating the two is how Attempt 0 produced one
  // undifferentiated mass.
  const env = envelopeOf(c.method ? 'MULTI_FILE_CHANGE' : 'BOUNDED_FUNCTION_BODY_EDIT');
  row.envelope = c.method ? 'OUT_METHOD_UNSUPPORTED' : (env.verdict || env.status || 'IN');
  rows.push(row);
}

const tally = {};
for (const r of rows) tally[r.category] = (tally[r.category] || 0) + 1;
const both = rows.filter((r) => r.category === 'SITE_REACHED' && !r.method).length;

console.log('FROZEN CANDIDATES: ' + candidates.length + '   (no regeneration, no re-sampling)');
console.log('');
console.log('OBSERVABILITY — can the repository be made to execute the site?');
for (const k of ['SITE_REACHED', 'SITE_NOT_REACHED', 'FUNCTION_NOT_ENTERED', 'NO_ANCHOR']) {
  console.log('  ' + k.padEnd(22) + String(tally[k] || 0).padStart(3));
}
console.log('');
console.log('CAPABILITY — may r2 attempt it? (independent axis)');
const methods = rows.filter((r) => r.method).length;
console.log('  method (out of envelope) ' + String(methods).padStart(3));
console.log('  function (in envelope)   ' + String(rows.length - methods).padStart(3));
console.log('');
console.log('ADMISSIBLE = witnessable AND inside the envelope: ' + both + ' / ' + candidates.length);

writeFileSync('benchmarks/repoB/classified.json', JSON.stringify({ tally, rows }, null, 1), 'utf8');
console.log('wrote benchmarks/repoB/classified.json');
void WITNESS; void establish;
