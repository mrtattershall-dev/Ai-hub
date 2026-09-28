// Authoring driver for the REQUIREMENT-RESOLUTION family.
import { TASKS6 } from './tasks6.mjs';
import { authorTask } from './author.mjs';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2] || './requirements';
mkdirSync(OUT, { recursive: true });
let bad = 0;
for (const def of TASKS6) {
  const r = authorTask(def, OUT);
  if (r.ok) console.log('  ' + def.id + '  AUTHORED  ops=' + r.operation_count);
  else { bad++; console.log('  ' + def.id + '  REFUSED'); for (const p of r.problems) console.log('      ' + p.kind + ': ' + p.detail); }
}
console.log('');
console.log('  ' + (bad ? bad + ' task(s) refused' : TASKS6.length + ' task(s) authored'));
