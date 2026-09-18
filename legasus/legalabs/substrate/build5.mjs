// Authoring driver for the CONSTRAINT-GENERALIZATION family. Its own driver so a rebuild cannot touch
// the three sealed families already on disk.
import { TASKS5 } from './tasks5.mjs';
import { authorTask } from './author.mjs';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2] || './generalization';
mkdirSync(OUT, { recursive: true });
let bad = 0;
for (const def of TASKS5) {
  const r = authorTask(def, OUT);
  if (r.ok) console.log('  ' + def.id + '  AUTHORED  ops=' + r.operation_count);
  else { bad++; console.log('  ' + def.id + '  REFUSED'); for (const p of r.problems) console.log('      ' + p.kind + ': ' + p.detail); }
}
console.log('');
console.log('  ' + (bad ? bad + ' task(s) refused' : TASKS5.length + ' task(s) authored'));
