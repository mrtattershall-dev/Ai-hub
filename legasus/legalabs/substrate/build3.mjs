// Authoring driver for the HOLDOUT family. Separate from build.mjs so that re-running the holdout
// build can never overwrite the sealed development family in ./family.
import { TASKS3 } from './tasks3.mjs';
import { authorTask } from './author.mjs';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2] || './holdout';
mkdirSync(OUT, { recursive: true });
let bad = 0;
for (const def of TASKS3) {
  const r = authorTask(def, OUT);
  if (r.ok) console.log('  ' + def.id + '  AUTHORED  ' + r.analogy_class + '  ops=' + r.operation_count);
  else { bad++; console.log('  ' + def.id + '  REFUSED'); for (const p of r.problems) console.log('      ' + p.kind + ': ' + p.detail); }
}
console.log('');
console.log('  ' + (bad ? bad + ' task(s) refused' : TASKS3.length + ' task(s) authored'));
