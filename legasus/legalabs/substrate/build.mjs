// Authoring driver. Refuses to emit any task whose witnesses are not proven by execution.
import { TASKS } from './tasks.mjs';
import { authorTask } from './author.mjs';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2] || './family';
mkdirSync(OUT, { recursive: true });
let bad = 0;
for (const def of TASKS) {
  const r = authorTask(def, OUT);
  if (r.ok) console.log('  ' + def.id + '  AUTHORED  ' + r.analogy_class + '  ops=' + r.operation_count);
  else { bad++; console.log('  ' + def.id + '  REFUSED'); for (const p of r.problems) console.log('      ' + p.kind + ': ' + p.detail); }
}
console.log('\n  ' + (bad ? bad + ' task(s) refused' : TASKS.length + ' task(s) authored'));
