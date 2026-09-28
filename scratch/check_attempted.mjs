import { readFileSync, mkdtempSync, mkdirSync, rmSync, readdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const NL=String.fromCharCode(10), ROOT='benchmarks/repoC/pristine', PKG='pyparsing';
const sweep=JSON.parse(readFileSync('benchmarks/repoC/sweep.json','utf8'));
const modules=[...new Set(sweep.runs.map(r=>r.dotted))];
const DOCTEST=['import doctest, importlib, json, sys, io, contextlib','sys.path.insert(0, sys.argv[1])',
 'failed=0; attempted=0','sink=io.StringIO()',
 'with contextlib.redirect_stdout(sink), contextlib.redirect_stderr(sink):',
 '    finder=doctest.DocTestFinder(exclude_empty=True)','    runner=doctest.DocTestRunner(verbose=False, optionflags=0)',
 '    for m in json.loads(sys.argv[2]):','        try:','            mod=importlib.import_module(m)',
 '        except BaseException:','            continue','        for t in finder.find(mod, m):',
 '            runner.run(t, out=sink.write, clear_globs=False)','    r=runner.summarize(verbose=False)',
 '    failed, attempted = r.failed, r.attempted','sys.stderr.write(json.dumps({"failed":failed,"attempted":attempted}))'].join(NL);
const v=(d)=>{const s=spawnSync('python',['-c',DOCTEST,d,JSON.stringify(modules)],{encoding:'utf8',maxBuffer:64e6,timeout:300000,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});try{return JSON.parse(s.stderr);}catch(e){return null;}};
console.log('pristine :', JSON.stringify(v(ROOT)));
// simulate a destructive candidate: truncate core.py after its imports
const dir=mkdtempSync(join(tmpdir(),'destr-'));
mkdirSync(join(dir,PKG),{recursive:true});
for(const f of readdirSync(join(ROOT,PKG))) if(f.endsWith('.py')) copyFileSync(join(ROOT,PKG,f),join(dir,PKG,f));
const p=join(dir,PKG,'core.py');
const src=readFileSync(p,'utf8');
writeFileSync(p, src.split(NL).slice(0,60).join(NL)+NL, 'utf8');
console.log('core.py truncated:', JSON.stringify(v(dir)));
rmSync(dir,{recursive:true,force:true});
