// One-shot verification of a fixed historical failure set, yielding to inference between seeds.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { acquireLease, unloadLocalModel, resourceStatus } from './resourceLease.mjs';
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const OUT = resolve(process.env.FUZZ_RECHECK_OUT || join(REPO, 'data/inspector/fuzz-repair-20261021'));
mkdirSync(OUT, { recursive: true });
// Mock-only replays may run alongside inference inside a separately bounded test cgroup.
const isolated = process.env.FUZZ_RECHECK_ISOLATED === '1';
if (isolated) {
  const group = readFileSync('/proc/self/cgroup', 'utf8').split('\n').find(l=>l.startsWith('0::'))?.slice(3);
  if (!group) throw new Error('Isolated recheck requires cgroup v2');
  const root = '/sys/fs/cgroup' + group;
  const ram = Number(readFileSync(root + '/memory.max', 'utf8').trim());
  const swap = Number(readFileSync(root + '/memory.swap.max', 'utf8').trim());
  const [quota, period] = readFileSync(root + '/cpu.max', 'utf8').trim().split(/\s+/).map(Number);
  if (!(ram > 0 && ram <= 768*1048576 && swap <= 1073741824 && quota > 0 && quota/period <= 1)) {
    throw new Error('Isolated recheck requires <=768 MiB RAM, <=1 GiB swap and <=100% CPU');
  }
}
const lease = () => isolated ? Promise.resolve(() => {}) : acquireLease('fuzz-recheck');
const unload = () => isolated ? Promise.resolve() : unloadLocalModel();

const requested = new Set([100102,100131,100142,100181,100184,100212,100216,100217,100220,100221,100240,100242,100253,100256,100262,100277,100296,100300,100301,100371,100400,100408,100410,100412,100414]);
const records = readFileSync(join(REPO,'fuzz-out/results.jsonl'),'utf8').trim().split('\n').map(l=>JSON.parse(l)).filter(r=>requested.has(r.seed));
const plan = [...new Map(records.map(r=>[r.seed,{seed:r.seed,per:r.per,hostile:r.hostile,originalViolations:r.violations.filter(v=>!v.startsWith('ESM'))}])).values()];
if(plan.length!==25) throw new Error(`Expected 25 historical failed seeds, found ${plan.length}`);
writeFileSync(join(OUT,'plan.json'),JSON.stringify(plan,null,2)+'\n');
async function run(args, env = {}, allowFuzzExit = false) {
  await new Promise((ok,fail)=>{
    const child=spawn(process.execPath,args,{cwd:REPO,env:{...process.env,AGENT_SOURCE_SYNTAX:'1',AGENT_FINISH_EVIDENCE:'1',WATCHERS:'',...env},stdio:'inherit'});
    const timer=setTimeout(()=>child.kill('SIGTERM'),15*60000);
    child.on('error',e=>{clearTimeout(timer);fail(e);});
    child.on('exit',(code,signal)=>{clearTimeout(timer);(code===0 || (allowFuzzExit && code===1))?ok():fail(new Error(`${args[0]} exited ${code}/${signal}`));});
  });
}
const tests=['sourceSyntax.test.mjs','appendFragment.test.mjs','appendFile.test.mjs','appendSyntax.test.mjs','finishEvidence.test.mjs','fuzzInvariants.test.mjs','editTruth.test.mjs'];
let failed=0;
let testsRelease;
try {
for(const test of tests) {
 const marker=join(OUT,test+'.passed');
 if(existsSync(marker))continue;
 testsRelease ||= await lease();
 await unload();await run([join(HERE,test)]);writeFileSync(marker,new Date().toISOString());
}
} finally { testsRelease?.(); }
await sleep(2000);
let burstRelease, burst = 0;
try {
for(const p of plan) {
 const out=join(OUT,`seed-${p.seed}.jsonl`);
 if(existsSync(join(OUT,`seed-${p.seed}.passed`)))continue;
 // fuzzLoop exits 1 even for the separately classified legacy ESM corpus artifacts.
 // Reconcile a completed row after a coordinator restart; never ignore missing results or real damage.
 if (existsSync(out)) {
   try {
     const prior=readFileSync(out,'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l));
     const policy=prior[0]?.detail?.safeguards;
     if(prior.length===1 && policy?.sourceSyntax && policy?.finishEvidence && !prior[0].violations.some(v=>!v.startsWith('ESM'))) {
       writeFileSync(join(OUT,`seed-${p.seed}.passed`),new Date().toISOString());
       appendFileSync(join(OUT,'summary.jsonl'),JSON.stringify({at:new Date().toISOString(),seed:p.seed,rows:1,violations:[],reconciled:true})+'\n');
       console.log(`PASS seed ${p.seed} (reconciled completed replay)`);continue;
     }
   } catch {}
 }

 burstRelease ||= await lease();
 try {
  await unload();
  writeFileSync(out,'');
  console.log(`RECHECK seed ${p.seed} (${p.per} goals${p.hostile?', hostile':''})`);
  await run([join(HERE,'fuzzLoop.mjs'),'1',String(p.per),String(p.seed),...(p.hostile?['--mode=hostile']:[])],{FUZZ_OUT:out,FUZZ_EVIDENCE:join(OUT,'evidence'),FUZZ_RAW:join(OUT,'raw')}, true);
  const results=readFileSync(out,'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l));
  const violations=results.flatMap(r=>(r.violations||[]).filter(v=>!v.startsWith('ESM')));
  if(results.length!==1||violations.length){failed++;console.error(`FAIL seed ${p.seed}: ${JSON.stringify(violations)}`);}
  else {writeFileSync(join(OUT,`seed-${p.seed}.passed`),new Date().toISOString());console.log(`PASS seed ${p.seed}`);}
  appendFileSync(join(OUT,'summary.jsonl'),JSON.stringify({at:new Date().toISOString(),seed:p.seed,rows:results.length,violations})+'\n');
 } finally {
   // Short batches avoid paying for a model reload after every tiny replay while still yielding.
   if (++burst >= 5) { burstRelease(); burstRelease = null; burst = 0; await sleep(2000); }
 }
}
} finally { burstRelease?.(); }
resourceStatus('fuzz-recheck',failed?'verification failed':'complete',{failed});
console.log(`RECHECK COMPLETE: ${25-failed}/25 clean, ${tests.length} regression suites passed`);
process.exitCode=failed?1:0;
