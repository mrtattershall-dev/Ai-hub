import { readFileSync } from 'node:fs';
import { observeSequentialChecked } from '../legasus/legaexercise/observe-r4.mjs';
const ROOT='benchmarks/repoC/pristine', PKG='pyparsing';
const sweep=JSON.parse(readFileSync('benchmarks/repoC/sweep.json','utf8'));
const ext=JSON.parse(readFileSync('benchmarks/repoC/external.json','utf8'));
const extBy=new Map(); for(const x of ext) if(x.source) extBy.set(x.module.split('.').pop()+'|'+String(x.source).trim(), x.outcome);
const key=r=>r.module.replace(/\.py$/,'')+'|'+r.invocation.trim();
const w1=sweep.runs.filter(r=>String(r.status).startsWith('SETUP_FAILED')&&extBy.get(key(r))==='PASS');
const groups=new Map();
for(const r of sweep.runs){const g=r.dotted+'|'+String(r.owner); if(!groups.has(g))groups.set(g,{dotted:r.dotted,rows:[]}); groups.get(g).rows.push(r);}
for(const r of w1){
  const g=groups.get(r.dotted+'|'+String(r.owner));
  const out=observeSequentialChecked({rootDir:ROOT,packageName:PKG,dotted:g.dotted,
    examples:g.rows.map(x=>({invocation:x.invocation,wants:x.wants}))});
  const i=g.rows.findIndex(x=>key(x)===key(r));
  const res=out.results&&out.results[i];
  if(res && res.outcome!=='PASS'){
    console.log('MINE='+res.outcome+'  EXTERNAL=PASS');
    console.log('  invocation : '+JSON.stringify(r.invocation.slice(0,80)));
    console.log('  wants      : '+JSON.stringify(String(r.wants).slice(0,120)));
    console.log('  got        : '+JSON.stringify(String(res.got).slice(0,120)));
    console.log('  raised     : '+res.raised);
    console.log('');
  }
}
