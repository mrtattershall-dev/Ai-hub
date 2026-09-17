// Authoring driver for the PROVENANCE family. Its own driver so a rebuild can never overwrite the
// sealed development family in ./family or the sealed v4 holdout in ./holdout.
import { TASKS4 } from './tasks4.mjs';
import { TASKS4B } from './tasks4b.mjs';
import { authorTask } from './author.mjs';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2] || './provenance';
mkdirSync(OUT, { recursive: true });
const all = [...TASKS4, ...TASKS4B].sort((a, b) => a.id.localeCompare(b.id));
let bad = 0;
for (const def of all) {
  const r = authorTask(def, OUT);
  if (r.ok) console.log('  ' + def.id + '  AUTHORED  ' + r.analogy_class + '  ops=' + r.operation_count);
  else { bad++; console.log('  ' + def.id + '  REFUSED'); for (const p of r.problems) console.log('      ' + p.kind + ': ' + p.detail); }
}
console.log('');
console.log('  ' + (bad ? bad + ' task(s) refused' : all.length + ' task(s) authored'));
