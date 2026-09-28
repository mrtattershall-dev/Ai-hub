import { readFileSync } from 'node:fs';
import { graph, add, node, invalidate, entitled, scope, NODE, EDGE } from '../legasus/legaknow/justification.mjs';
const sweep = JSON.parse(readFileSync('benchmarks/repoB/sweep.json','utf8'));
const ident=(q)=>{const i=q.indexOf('|');const h=q.lastIndexOf('#');return {module:q.slice(0,i),qualname:q.slice(i+1,h)};};
const ws = sweep.runs.map(r=>{const mod=r.module.replace(/\.py$/,'');
  const own=(r.enteredq||[]).find(q=>{const p=ident(q);return p.module===mod&&p.qualname===r.owner;});
  return {root: own||(mod+'|<doctest>#00000000'), entered:r.enteredq||[]};});
const roots=new Set(ws.filter(w=>ident(w.root).module==='specifiers').map(w=>w.root));
const inRegion=new Set(roots); let grew=true;
while(grew){grew=false;for(const w of ws){if(!inRegion.has(w.root))continue;for(const e of w.entered)if(!inRegion.has(e)){inRegion.add(e);grew=true;}}}
const subjects=[...new Set(sweep.enteredIds)];
console.log('subjects', subjects.length, 'roots', roots.size, 'synthetic roots', [...new Set(ws.map(w=>w.root))].filter(r=>r.includes('<doctest>')).length);
console.log('roots that are NOT in subjects:', [...roots].filter(r=>!subjects.includes(r)).length);
console.log('layer IN_REGION (restricted to subjects):', subjects.filter(s=>inRegion.has(s)).length);
const reachedBy=new Map();
for(const w of ws) for(const e of w.entered){ if(!reachedBy.has(e))reachedBy.set(e,new Set()); reachedBy.get(e).add(w.root); }
// rebuild exactly as shadow-graph does
const g2=graph(); const idsFor=new Map();
for(const s of subjects){const sc=scope({repository:'R',environment:'E',invocation:'m',implementation:s});
  const n=node({kind:NODE.CLAIM,proposition:'in region: '+s,scope:sc,basis:'C'}); add(g2,n); idsFor.set(s,n.id);}
let noParents=0;
for(const s of subjects){ if(roots.has(s)) continue;
  const parents=[...(reachedBy.get(s)||[])].filter(p=>idsFor.has(p)&&p!==s);
  if(!parents.length){ invalidate(g2,idsFor.get(s),'none'); noParents++; continue; }
  const sc=scope({repository:'R',environment:'E',invocation:'m',implementation:s});
  const n=node({kind:NODE.CLAIM,proposition:'in region: '+s,scope:sc,basis:'C',
    supports:parents.map(p=>({id:idsFor.get(p),edge:EDGE.ANY_OF}))});
  g2.nodes[idsFor.get(s)]={...n,id:idsFor.get(s)};
  for(const p of parents)(g2.dependents[idsFor.get(p)]=g2.dependents[idsFor.get(p)]||[]).push(idsFor.get(s));
}
console.log('subjects with NO graph parents (invalidated):', noParents);
let admits=0, agree=0;
for(const s of subjects){const sc=scope({repository:'R',environment:'E',invocation:'m'});
  const ok=entitled(g2,idsFor.get(s),sc).ok; if(ok)admits++; if(ok===inRegion.has(s))agree++;}
console.log('graph admits', admits, ' agreement', agree+'/'+subjects.length);
