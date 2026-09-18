// DESCRIPTIVE application of Narrowability V2's structural channel to the disputed position.
//
// THIS IS NOT A RESCORE. Gate 7's recorded result stands: one over-constraint on `scopecont` under
// Narrowability V1. V2 exists for families authored after it. This run answers one question and
// publishes it as a supersession notice:
//
//     under the later structural oracle, is the disputed position independently classified as invalid?
//
// "Independently" is load-bearing. The structural channel does not consult ownership_boundary or any
// of its arithmetic; it compares observed parent chains and reachability before and after insertion.
import { readFileSync } from 'node:fs';
import { structurePreserved } from './structure.mjs';
import { reconstruct, baseFor } from './substrate/narrowability.mjs';

const NL = String.fromCharCode(10);
const SUB = 'C:/Users/tatte/Projects/ai-coding-hub-indent/legasus/legalabs/substrate/scopecont';
const GT = JSON.parse(readFileSync(SUB + '/GROUNDTRUTH.json', 'utf8'));

const task = 'j01';
const k = 2;                                   // op3, the disputed one
const t = GT.find((x) => x.task === task);
const row = t.rows[k];
const recon = reconstruct(SUB + '/' + task);
const base = baseFor(recon, k);
const code = recon.full[k].code;

const insertAfter = (text, pos, block) => {
  const lines = text.split(NL);
  return lines.slice(0, pos + 1).join(NL) + NL + block.replace(/\n$/, '') + NL
    + lines.slice(pos + 1).join(NL);
};

console.log('  DESCRIPTIVE - Narrowability V2 structural channel on ' + task + ':' + row.op);
console.log('  NOT a rescore. Gate 7 stands at one over-constraint under V1.');
console.log('');
console.log('  V1 behavioural channel says these positions PASS: ' + JSON.stringify(row.passing_positions));
console.log('');
let disagree = 0;
for (const p of row.passing_positions) {
  const after = insertAfter(base, p, code);
  const blockLines = (code.endsWith(NL) ? code.slice(0, -1) : code).split(NL).length;
  const r = structurePreserved(base, after, { pos: p, count: blockLines });
  if (!r.preserved) {
    disagree++;
    console.log('  position ' + String(p).padStart(3) + '  V1 PASS  /  V2 STRUCTURAL VIOLATION');
    for (const v of r.violations.slice(0, 2)) {
      console.log('        ' + v.kind + '  ' + JSON.stringify(v.statement).slice(0, 56));
      if (v.was) console.log('           was under ' + JSON.stringify(v.was)
        + NL + '           now under ' + JSON.stringify(v.now));
    }
  }
}
console.log('');
console.log('  ' + disagree + ' of ' + row.passing_positions.length
  + ' behaviourally-passing positions violate structural preservation.');
console.log('');
console.log('  The disputed boundary ownership_boundary removed is among them, so under the later');
console.log('  oracle it is independently classified as invalid - by a mechanism that never consulted');
console.log('  ownership_boundary. The V1 score is unchanged and remains the historical record.');
