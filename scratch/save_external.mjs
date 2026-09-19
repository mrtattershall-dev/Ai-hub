import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const sweep = JSON.parse(readFileSync('benchmarks/repoC/sweep.json','utf8'));
const modules = [...new Set(sweep.runs.map(r=>r.dotted))];
const DOCTEST = [
  'import doctest, importlib, json, sys, io, contextlib',
  'sys.path.insert(0, sys.argv[1])',
  'out = []',
  'sink = io.StringIO()',
  'with contextlib.redirect_stdout(sink), contextlib.redirect_stderr(sink):',
  '    finder = doctest.DocTestFinder(exclude_empty=True)',
  '    for modname in json.loads(sys.argv[2]):',
  '        try:',
  '            mod = importlib.import_module(modname)',
  '        except BaseException:',
  '            continue',
  '        for t in finder.find(mod, modname):',
  '            class R(doctest.DocTestRunner):',
  '                def report_failure(self, o, test, example, got):',
  '                    out.append({"module": modname, "source": example.source.rstrip(), "outcome": "OUTPUT_MISMATCH"})',
  '                def report_unexpected_exception(self, o, test, example, exc_info):',
  '                    out.append({"module": modname, "source": example.source.rstrip(), "outcome": "UNEXPECTED_EXCEPTION"})',
  '                def report_success(self, o, test, example, got):',
  '                    out.append({"module": modname, "source": example.source.rstrip(), "outcome": "PASS"})',
  '            R(verbose=False, optionflags=0).run(t, out=sink.write, clear_globs=False)',
  'sys.stderr.write(json.dumps(out))',
].join(NL);
const s = spawnSync('python',['-c',DOCTEST,'benchmarks/repoC/pristine',JSON.stringify(modules)],
  {encoding:'utf8',maxBuffer:64*1024*1024,timeout:300000,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
const j = JSON.parse(s.stderr);
writeFileSync('benchmarks/repoC/external.json', JSON.stringify(j,null,1),'utf8');
console.log('external verdicts saved:', j.length);
