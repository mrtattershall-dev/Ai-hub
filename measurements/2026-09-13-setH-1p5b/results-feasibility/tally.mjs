import { readFileSync } from 'node:fs';
const rows = JSON.parse(readFileSync(process.argv[2] + '/rows.json', 'utf8'));
const A = rows.filter((r) => r.condition === 'A_instruction_only');
const B = rows.filter((r) => r.condition === 'B_oracle_localized_insertion');

console.log('=== A  instruction_only (VALID condition) ===');
console.log('  trials ' + A.length + '   verified ' + A.filter((r) => r.verified).length
  + '   loads ' + A.filter((r) => r.final_loads).length
  + '   OLD KEPT ' + A.filter((r) => r.final_old_regression).length);
let joinLost = 0;
for (const r of A) if (/wanted '<p>a b<\/p>'/.test(String(r.final_old_regression_why || ''))) joinLost++;
console.log('  lost paragraph line-joining (goal 4, the OLDEST behaviour in the file): ' + joinLost + '/' + A.length);
const toks = A.map((r) => r.steps[0] && r.steps[0].eval_count).filter((x) => x);
console.log('  output tokens min/median/max: ' + Math.min(...toks) + ' / '
  + toks.slice().sort((a, b) => a - b)[Math.floor(toks.length / 2)] + ' / ' + Math.max(...toks));
console.log('  hit the 1800 cap: ' + A.filter((r) => r.steps[0] && r.steps[0].hit_cap).length + '/' + A.length);

console.log('\n=== B0  oracle_localized_insertion (QUARANTINED apparatus-invalid) ===');
console.log('  sites completed: ' + B.map((r) => r.steps_completed + '/' + r.sites_total).join('  '));
console.log('  reached the end of the plan: ' + B.filter((r) => r.aborted_at === null).length + '/' + B.length);
console.log('  OLD KEPT where reached: ' + B.filter((r) => r.final_old_regression === true).length
  + '   (A, which always reached the end: ' + A.filter((r) => r.final_old_regression).length + '/' + A.length + ')');
const abort = new Map();
for (const r of B) {
  const k = String(r.why).replace(/\(.*/, '').replace(/load_error.*/, 'load_error').slice(0, 46);
  abort.set(k, (abort.get(k) || 0) + 1);
}
console.log('  abort reasons:');
for (const [k, v] of [...abort].sort((a, b) => b[1] - a[1])) console.log('    ' + v + 'x  ' + k);
let empties = 0, steps = 0;
for (const r of B) for (const s of r.steps) { steps++; if (s.generated_bytes === 0 || (s.why === 'empty snippet')) empties++; }
console.log('  per-STEP empty snippets: ' + empties + '/' + steps + ' steps attempted');

console.log('\n=== integrity ===');
const rb = rows.filter((r) => r.rollback);
console.log('  rollbacks: ' + rb.length + '   byte-exact: ' + rb.filter((r) => r.restored_byte_exact).length);
const R = rows.filter((r) => r.condition === 'R_reference_control');
console.log('  reference control verified: ' + R.filter((r) => r.verified).length + '/' + R.length);
