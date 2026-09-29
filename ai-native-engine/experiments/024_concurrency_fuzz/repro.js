'use strict';
// Minimal reproducer for a fuzz failure. Usage: node repro.js <worldSeed> <batchSeed>
const { Engine, TYPE, TYPE_NAME } = require('../../core/engine.js');

function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
const pick=(r,a)=>a[Math.floor(r()*a.length)];
function buildWorld(rnd){const g=new Engine(512);const ids=[];const n=8+Math.floor(rnd()*12);for(let i=0;i<n;i++){const t=pick(rnd,[TYPE.ZONE,TYPE.CROP,TYPE.CROP,TYPE.ENEMY]);const parent=(i>0&&rnd()<0.6)?pick(rnd,ids):null;const refs=(i>0&&rnd()<0.3)?[pick(rnd,ids)]:[];ids.push(g.spawn(t,{name:'e'+i,parent,refs,growth:Math.floor(rnd()*100),water:Math.floor(rnd()*50),hp:100,tally:Math.floor(rnd()*10)}).uuid);}return{g,ids};}
function randOp(g,ids,rnd){const live=ids.filter(u=>g.w.liveEntity(u)>=0);if(!live.length)return{kind:'setfield',target:ids[0],field:'water',value:1};const target=pick(rnd,live);const k=rnd();if(k<0.35){const f=pick(rnd,[['water',255],['growth',255],['tally',1000],['hp',500],['name',null]]);const value=f[0]==='name'?'n'+Math.floor(rnd()*50):Math.floor(rnd()*(f[1]+1));return{kind:'setfield',target,field:f[0],value};}if(k<0.50)return{kind:'delete',target};if(k<0.65)return{kind:'reparent',target,parent:pick(rnd,live)};if(k<0.80)return{kind:'move',target,after:rnd()<0.5?null:pick(rnd,live)};if(k<0.90)return{kind:'createChild',type:pick(rnd,[TYPE.CROP,TYPE.ENEMY]),parent:target,props:{name:'c'+Math.floor(rnd()*50)}};return{kind:'claim',target,ticks:2};}
function randBatch(g,ids,rnd){const m=2+Math.floor(rnd()*4);const txs=[];for(let i=0;i<m;i++){const actor='A'+i;const nops=1+Math.floor(rnd()*2);const ops=[];for(let j=0;j<nops;j++)ops.push(randOp(g,ids,rnd));txs.push({actor,ops});}return txs;}
function trow(w,e){const r=w.componentIndex[e],t=w.type[e];return [w.uuid[e],TYPE_NAME[t],w.parent[e]>=0?w.uuid[w.parent[e]]:'-',w.name[e],t===TYPE.CROP?w.crop_water[r]:'-',t===TYPE.CROP?w.crop_growth[r]:'-',t===TYPE.ENEMY?w.enemy_hp[r]:'-',t===TYPE.ZONE?w.zone_tally[r]:'-',w.orderKey[e].toFixed(6)].join(':');}

const ws=parseInt(process.argv[2],10), bs=parseInt(process.argv[3],10);
const {g,ids}=buildWorld(mulberry32(ws));
const batch=randBatch(g,ids,mulberry32(bs));

console.log('--- BATCH ---');
for(const tx of batch) console.log(`  ${tx.actor}: ${tx.ops.map(o=>o.kind+'('+(o.field||o.type||'')+(o.target?' '+o.target:'')+(o.parent?'->'+o.parent:'')+(o.after!==undefined?' after '+o.after:'')+')').join(', ')}`);

const r=g.submit(batch);
console.log('\n--- RESULTS ---');
r.results.forEach((x,i)=>console.log(`  tx${i} ${x.actor}: ${x.status}  ${x.reasons.join(' | ')}`));

console.log('\n--- INDEX CHECK ---');
const t=g.w.rebuildIndexes();
const dump=(m)=>[...m.entries()].map(([k,s])=>`${k}:{${[...s].sort((a,b)=>a-b)}}`).sort().join('  ');
for(const name of ['byType','childrenOf','referrersOf']){
  const live=dump(g.w[name]), oracle=dump(t[name]);
  console.log(`  ${name}: ${live===oracle?'OK':'DESYNC'}`);
  if(live!==oracle){ console.log(`    live  : ${live}`); console.log(`    oracle: ${oracle}`); }
}
console.log('\nindexesConsistent():', g.indexesConsistent());

// --- UNDO round-trip on a fresh history-enabled rebuild ---------------------
function sig(gg){const w=gg.w,rows=[];for(let e=0;e<w.count;e++){if(!w.destroyed[e])rows.push(trow(w,e));}rows.sort();return `${rows.join('|')}`;}
const {g:gh}=buildWorld(mulberry32(ws)); gh.enableHistory();
const before=sig(gh); gh.submit(batch); const after=sig(gh); gh.undo(); const undone=sig(gh);
console.log('\n--- UNDO CHECK ---');
console.log('  undo restores pre-batch:', undone===before);
if(undone!==before){
  const bl=before.split('|'), ul=undone.split('|');
  const bset=new Set(bl), uset=new Set(ul);
  console.log('   only in BEFORE  :', bl.filter(x=>!uset.has(x)).join('  '));
  console.log('   only in UNDONE  :', ul.filter(x=>!bset.has(x)).join('  '));
}
