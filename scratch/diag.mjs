import { readFileSync } from 'node:fs';
import { describe, authorizeStructural, signatureOf } from '../legasus/legagate/structural.mjs';
import { TASKS } from '../benchmarks/devrepo/tasks.mjs';
const R = JSON.parse(readFileSync('benchmarks/devrepo/RESULT.dev1.json','utf8'));
const byId = Object.fromEntries(TASKS.map(t=>[t.id,t]));
for (const id of ['T01','T03','T08']) {
  const L = R.tasks[id].legasus; const t = byId[id];
  const d = describe(L.code);
  console.log('=== '+id+'  fn='+t.fn+'  module='+t.module);
  console.log('  parses:', d.parses, ' harnessError:', d.harnessError||'none');
  console.log('  top:', JSON.stringify((d.top||[]).map(x=>x.kind)));
  console.log('  functions:', JSON.stringify(d.functions));
  console.log('  code first 120:', JSON.stringify(String(L.code).slice(0,120)));
}
