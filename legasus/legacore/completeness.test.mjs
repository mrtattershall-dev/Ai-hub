// WITNESS: revision 3 must report h07 as INCOMPLETE even though it derives the correct region.
//
// This is the whole point of the revision. Revision 2 reached the right answer on h07 while silently
// dropping `math`, and nothing in its output said so. Sufficiency and completeness are different
// properties, and an artifact that only records the first cannot be audited for the second.
//
// h07 and h08 are the same program apart from how the provider arrives, so a difference between them
// here is attributable to exactly one thing.
import { readFileSync } from 'node:fs';
import { constrain } from './constraints3.mjs';
import { operationFacts } from './opfacts.mjs';
import { reconstruct, baseFor } from '../legalabs/substrate/narrowability.mjs';

const SUB = 'C:/Users/tatte/Projects/ai-coding-hub-indent/legasus/legalabs/substrate/requirements';
const NL = String.fromCharCode(10);
const ind = (l) => (l.match(/^[ \t]*/) || [''])[0].length;
const GT = JSON.parse(readFileSync(SUB + '/GROUNDTRUTH.json', 'utf8'));

const expected = {
  h07: { complete: false, unresolved: ['math'], resolved: ['_round2'] },
  h08: { complete: true, unresolved: [], resolved: ['_round2', 'PI'] },
};

let fail = 0;
for (const id of ['h07', 'h08']) {
  const t = GT.find((x) => x.task === id);
  const recon = reconstruct(SUB + '/' + id);
  const k = 1;
  const row = t.rows[k];
  const base = baseFor(recon, k);
  const code = recon.full[k].code;
  const facts = operationFacts(code);
  const indent = ind(code.split(NL).find((l) => l.trim()) || '');
  const res = constrain({ src: base, origin: recon.src, code, indent, provides: facts.provides,
    siblingKind: null, parentRange: { lo: 0, hi: base.split(NL).length - 1 } },
  row.candidate_positions);

  const e = expected[id];
  const rr = res.requirement_resolution;
  const gotUnresolved = rr.unresolved.map((u) => u.symbol).sort();
  const gotResolved = rr.resolved.map((r) => r.symbol).sort();
  const ok = res.constraint_status.requirement_complete === e.complete
    && JSON.stringify(gotUnresolved) === JSON.stringify([...e.unresolved].sort())
    && JSON.stringify(gotResolved) === JSON.stringify([...e.resolved].sort())
    && res.constrained === row.passing;                 // the REGION must still be right
  if (!ok) fail++;
  console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + id
    + '   region ' + res.constrained + '/' + row.passing
    + '   complete=' + res.constraint_status.requirement_complete
    + '   resolved ' + JSON.stringify(rr.resolved.map((r) => r.symbol + ':' + r.provider))
    + '   unresolved ' + JSON.stringify(gotUnresolved));
}

console.log('');
console.log('  ' + (fail ? fail + ' WITNESS FAILURE(S)' : 'both witnesses pass'));
console.log('  h07 derives the CORRECT region and still reports requirement_complete=false, which is');
console.log('  the property revision 2 could not express. h08, identical apart from how its provider');
console.log('  arrives, reports complete=true - so the difference is attributable to one thing.');
if (fail) process.exitCode = 1;
