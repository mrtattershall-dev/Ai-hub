// Cause B: mine reports a failure CPython does not. Two hypotheses, and they are distinguishable.
//   B1  KEY COLLISION - the same example text appears in more than one docstring, so module|source
//       merges distinct examples and the comparison is comparing the wrong pair.
//   B2  EXECUTION CONTEXT - doctest runs a whole docstring with SHARED globals and continues after a
//       failure; my harness rebuilds a fresh namespace per example from the preceding examples only.
import { readFileSync } from 'node:fs';

const sweep = JSON.parse(readFileSync('benchmarks/repoB/sweep.json', 'utf8'));
const counts = new Map();
for (const r of sweep.runs) {
  const k = r.module.replace(/\.py$/, '') + '|' + r.invocation.trim();
  counts.set(k, (counts.get(k) || 0) + 1);
}
const dupes = [...counts.entries()].filter(([, n]) => n > 1);
console.log('B1  example keys that are NOT unique: ' + dupes.length + ' of ' + counts.size);
for (const [k, n] of dupes.slice(0, 10)) console.log('      x' + n + '  ' + k.slice(0, 78));

const target = [...counts.keys()].find((k) => k.includes('is_unsatisfiable()') && k.includes('SpecifierSet("")'));
console.log('');
console.log('the only-mine example: ' + target);
console.log('  occurrences: ' + (counts.get(target) || 0));
const owners = sweep.runs.filter((r) => (r.module.replace(/\.py$/, '') + '|' + r.invocation.trim()) === target)
  .map((r) => r.owner + '  setup=' + JSON.stringify(r.setup).slice(0, 60));
for (const o of owners) console.log('    owner: ' + o);
