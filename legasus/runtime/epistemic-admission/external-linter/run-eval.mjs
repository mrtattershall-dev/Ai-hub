import { evaluate } from './adapter-eslint.mjs';
const rows = [];
for (const f of process.argv.slice(2)) {
  try { rows.push(await evaluate(f)); }
  catch (e) { rows.push({ file: f.split(/[\/]/).pop(), error: e.message.slice(0, 90) }); }
}
const agree = (r) => r.error ? 'ERROR'
  : (r.linter.decision === 'ACCEPT' ? (r.legasus.decision === 'ESTABLISHED' ? 'agree' : 'MISMATCH')
    : (r.legasus.decision === 'ESTABLISHED' ? 'MISMATCH' : 'agree'));
console.log('file'.padEnd(38) + 'linter'.padEnd(9) + 'legasus'.padEnd(16) + 'verdict');
console.log('-'.repeat(78));
for (const r of rows) {
  console.log((r.file || '?').slice(0, 37).padEnd(38)
    + (r.error ? '-' : r.linter.decision).padEnd(9)
    + (r.error ? r.error : r.legasus.decision).padEnd(16) + agree(r));
}
console.log('');
for (const r of rows) {
  if (r.error) continue;
  console.log(r.file + ':');
  console.log('   linter  : ' + (r.linter.reasons[0] || 'no finding'));
  console.log('   legasus : ' + r.legasus.why.slice(0, 150));
}
