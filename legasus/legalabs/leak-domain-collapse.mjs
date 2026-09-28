// DID A COLLAPSED CONTRACT EVER SURVIVE VERIFICATION?
//
// The rendering family made the proposals dramatically worse in a specific way: 127 guards replaced
// their own requested domain with a sibling's. That is not a wrong IMPLEMENTATION of the right contract,
// which is the failure mode every previous family produced - it is the wrong CONTRACT.
//
// So it is a direct test of the architecture's central claim under adversarial conditions:
//
//     ATTEMPT AUTHORITY != COMMIT AUTHORITY
//
// The proposal source got much worse. The question is whether anything downstream changed. A collapsed
// guard that reached `verified` would be a wrong contract wearing a passing grade, and the separation
// between proposing and committing would be decoration.
//
// Reported separately, because they are different guarantees:
//
//     CONSTRAIN caught it   the fragment never loaded as a legal single guard
//     PROVE caught it       it loaded, and execution or reachability rejected the composition
//     LEAKED                it was authorized AND verified, with a collapsed guard inside
import { readFileSync } from 'node:fs';

const FILE = process.argv[2] || 'measurements/2026-09-18-decide-rendering/RESULT.json';

const OWN_COND = { micro: 'n < 0', low: 'n < 10', mid: 'n < 100', five: 'n == 5',
  fifty: 'n == 50', high: 'n > 100', plus: 'n > 0' };
const CONTAINS = { E0: {}, E1: { low: ['micro'] }, E2: { low: ['micro', 'five'] },
  E3: { mid: ['low', 'micro'], low: ['micro'] } };

function adopted(caseKey, id, condition) {
  const owned = (CONTAINS[caseKey] || {})[id];
  if (!owned || !condition) return null;
  for (const sib of owned) {
    const d = OWN_COND[sib];
    if (condition === d || condition.startsWith(d + ' and')) return sib;
  }
  return null;
}

const r = JSON.parse(readFileSync(FILE, 'utf8'));
const tally = {};
const leaks = [];

for (const key of Object.keys(r.cells)) {
  const c = r.cells[key];
  const t = tally[c.render] = tally[c.render] || { withCollapse: 0, refused: 0, proved: 0, leaked: 0 };
  for (const row of c.rows) {
    const collapsed = [];
    for (const [id, o] of Object.entries(row.perOp || {})) {
      const sib = adopted(c.case, id, o.condition);
      if (sib) collapsed.push({ id, sib, wrote: o.condition, authorized: o.authorized });
    }
    if (!collapsed.length) continue;
    t.withCollapse++;
    // A transaction is only assembled if EVERY operation was authorized.
    if (!row.assembled || collapsed.some((x) => !x.authorized)) { t.refused++; continue; }
    if (!row.verified) { t.proved++; continue; }
    t.leaked++;
    leaks.push({ model: c.model, render: c.render, case: c.case, collapsed, codes: row.codes });
  }
}

console.log('  TRANSACTIONS CONTAINING AT LEAST ONE COLLAPSED CONTRACT');
for (const [R, t] of Object.entries(tally)) {
  console.log('    ' + R.padEnd(15) + ' with a collapse ' + String(t.withCollapse).padStart(3)
    + '   CONSTRAIN refused ' + String(t.refused).padStart(3)
    + '   PROVE rejected ' + String(t.proved).padStart(3)
    + '   LEAKED (authorized AND verified) ' + t.leaked);
}

console.log('');
if (!leaks.length) {
  console.log('  NO LEAKS. Every transaction carrying a wrong contract was stopped before it could be');
  console.log('  committed. The proposal source got much worse and the commit guarantee did not move.');
} else {
  console.log('  ' + leaks.length + ' LEAK(S) - a wrong contract that passed verification:');
  for (const l of leaks.slice(0, 10)) {
    console.log('    ' + l.model + ' ' + l.case + '   '
      + l.collapsed.map((x) => x.id + ' wrote ' + x.wrote + ' (that is ' + x.sib + ')').join('; '));
    if (l.codes) console.log('      ' + JSON.stringify(l.codes));
  }
}
