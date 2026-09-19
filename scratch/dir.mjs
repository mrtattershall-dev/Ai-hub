import { readFileSync } from 'node:fs';
const sweep = JSON.parse(readFileSync('benchmarks/repoB/sweep.json','utf8'));
const ident=(q)=>{const i=q.indexOf('|');const h=q.lastIndexOf('#');return {module:q.slice(0,i),qualname:q.slice(i+1,h)};};
const ws = sweep.runs.map(r=>{const mod=r.module.replace(/\.py$/,'');
  const own=(r.enteredq||[]).find(q=>{const p=ident(q);return p.module===mod&&p.qualname===r.owner;});
  return {root: own||(mod+'|<doctest>#00000000'), entered:r.enteredq||[]};});
const roots=new Set(ws.filter(w=>ident(w.root).module==='specifiers').map(w=>w.root));
const inRegion=new Set(roots); let grew=true;
while(grew){grew=false;for(const w of ws){if(!inRegion.has(w.root))continue;for(const e of w.entered)if(!inRegion.has(e)){inRegion.add(e);grew=true;}}}
const reachedBy=new Map();
for(const w of ws) for(const e of w.entered){ if(!reachedBy.has(e))reachedBy.set(e,new Set()); reachedBy.get(e).add(w.root); }
const subjects=[...new Set(sweep.enteredIds)];
let multi=0, single=0, none=0;
for(const s of subjects){ const n=(reachedBy.get(s)||new Set()).size; if(n===0)none++; else if(n===1)single++; else multi++; }
console.log('subjects:',subjects.length,' layer says IN_REGION:',[...inRegion].filter(x=>subjects.includes(x)).length);
console.log('reached by 0 roots:',none,'  by exactly 1:',single,'  by MORE THAN ONE:',multi);
console.log('');
console.log('Under CONJUNCTIVE supports a subject reached by several executions requires ALL of them to be');
console.log('in the region. That is the predicted under-admission, and it should be ~the multi count.');
