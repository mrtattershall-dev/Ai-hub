import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const src = readFileSync('benchmarks/repoB/external-doctest.mjs','utf8');
const m = /const MINE = \[([\s\S]*?)\]\.join\(NL\);/.exec(src);
const NL = String.fromCharCode(10);
const MINE = m[1].split(NL).map(l=>l.trim()).filter(l=>l.startsWith("'")).map(l=>l.replace(/^'/,'').replace(/',?$/,'')).join(NL);
const sweep = JSON.parse(readFileSync('benchmarks/repoB/sweep.json','utf8'));
const rows = sweep.runs.map(r=>({module:r.module.replace(/\.py$/,''),dotted:r.dotted,setup:r.setup,invocation:r.invocation,wants:r.wants}));
const f = join(tmpdir(),'rows-check.json'); writeFileSync(f, JSON.stringify(rows),'utf8');
try {
  const out = execFileSync('python',['-c',MINE,'benchmarks/repoB/pristine','packaging',f],
    {encoding:'utf8',maxBuffer:64*1024*1024,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
  const j = JSON.parse(out);
  const t={}; for(const x of j) t[x.outcome]=(t[x.outcome]||0)+1;
  console.log('MINE ran OK. rows:',j.length, JSON.stringify(t));
} catch(e) {
  console.log('MINE THREW:');
  console.log((e.stderr||e.message||'').toString().split('\n').slice(0,10).join('\n'));
}
