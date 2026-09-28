#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// rebuildAccepted.mjs — reconstruct the accepted page from the ledger and PROVE it is the file judged.
//
//   node server/rebuildAccepted.mjs --ledger <f.jsonl> --out <page.html>
//
// The ledger stores the assistance, the transformed candidate and the candidate's sha256, but not the
// assembled file. Rebuilding it from the recorded parts and checking the sha against `candidateSha` is
// the difference between "here is a page that probably passed" and "here is the exact page that did".
// If the hashes disagree the rebuild is wrong and nothing is written.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i > -1 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const LEDGER = opt('ledger', 'legasus/screen/ASSISTED-1_LEDGER.jsonl');
const OUT = opt('out', null);
const sha = (t) => createHash('sha256').update(t).digest('hex');
const NL = String.fromCharCode(10);

const { cutRegion } = await import('./localEdit.mjs');

const rows = readFileSync(LEDGER, 'utf8').trim().split(NL).map((l) => JSON.parse(l));
const accepted = rows.filter((r) => r.outcome === 'ACCEPTED');
if (!accepted.length) { console.log('no ACCEPTED row in the ledger'); process.exit(0); }
console.log(`${accepted.length} accepted row(s) of ${rows.length} attempts`);

for (const r of accepted) {
  const startFile = readFileSync(r.baseline, 'utf8');
  if (sha(startFile) !== r.baselineSha) { console.log(`  the baseline on disk is not the one used (${sha(startFile).slice(0, 16)} vs ${r.baselineSha.slice(0, 16)})`); continue; }
  const lines = startFile.split(NL);
  const a = r.assistance;
  const scaffolded = [...lines.slice(0, a.anchorLine + 1), ...a.scaffoldSuppliedByMe.split(NL), ...lines.slice(a.anchorLine + 1)].join(NL);
  const FILL = a.scaffoldSuppliedByMe.split(NL).find((l) => l.includes('// FILL IN'));
  const cut = cutRegion(scaffolded, FILL, FILL);
  const rebuilt = cut.prefix + (a.contextSuppliedByMe ? a.contextSuppliedByMe + NL : '') + a.instructionSuppliedByMe + NL + r.transformedCandidate.text + cut.suffix;
  const match = sha(rebuilt) === r.candidateSha;
  console.log(`  seed ${r.seed}: rebuilt sha ${sha(rebuilt).slice(0, 16)} vs judged ${String(r.candidateSha).slice(0, 16)}  ${match ? 'MATCH' : 'MISMATCH'}`);
  if (match && OUT) {
    writeFileSync(OUT, rebuilt.endsWith(NL) ? rebuilt : rebuilt + NL, 'utf8');
    console.log(`  written to ${OUT} (${rebuilt.length} chars)`);
  }
  if (!match) console.log('  NOT WRITTEN - a rebuild that does not hash to the judged candidate is not the judged candidate');
}
