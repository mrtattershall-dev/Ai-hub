// Cause D? Example DISCOVERY. My miner reads the source AST; doctest traverses runtime objects reachable
// from the module. Those sets need not be equal - properties, inherited members, __test__, decorated
// objects, class attributes. If doctest reports failures for examples I never mined, no comparison rule
// or execution model could ever have matched them.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const NL = String.fromCharCode(10);
const ROOT = 'benchmarks/repoB/pristine';
const PKG = 'packaging';

const FIND = [
  'import doctest, importlib, json, sys',
  'sys.path.insert(0, sys.argv[1])',
  'out = []',
  'for modname in json.loads(sys.argv[2]):',
  '    mod = importlib.import_module("packaging." + modname)',
  '    for t in doctest.DocTestFinder(exclude_empty=True).find(mod, "packaging." + modname):',
  '        for ex in t.examples:',
  '            out.append({"module": modname, "name": t.name, "source": ex.source.rstrip()})',
  'print(json.dumps(out))',
].join(NL);

const sweep = JSON.parse(readFileSync('benchmarks/repoB/sweep.json', 'utf8'));
const modules = [...new Set(sweep.runs.map((r) => r.module.replace(/\.py$/, '')))];
const found = JSON.parse(execFileSync('python', ['-c', FIND, ROOT, JSON.stringify(modules)],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } }));

const mineKeys = new Set(sweep.runs.map((r) => r.module.replace(/\.py$/, '') + '|' + r.invocation.trim()));
const dtKeys = new Set(found.map((f) => f.module + '|' + f.source.trim()));

const onlyDt = [...dtKeys].filter((k) => !mineKeys.has(k));
const onlyMine = [...mineKeys].filter((k) => !dtKeys.has(k));
console.log('examples doctest discovers : ' + dtKeys.size);
console.log('examples my miner discovers: ' + mineKeys.size);
console.log('');
console.log('ONLY doctest (' + onlyDt.length + '):');
for (const k of onlyDt.slice(0, 12)) console.log('   ' + k.slice(0, 92));
console.log('');
console.log('ONLY my miner (' + onlyMine.length + '):');
for (const k of onlyMine.slice(0, 8)) console.log('   ' + k.slice(0, 92));
console.log('');
// Do the known residual disagreements live in the only-doctest set?
for (const probe of ['Specifier(">= 2.2.3").contains("1.2.3")',
  'list(Specifier(">= 2.2.3").filter(["1.2", "1.3", "1.5a1"]))']) {
  const inMine = [...mineKeys].some((k) => k.endsWith('|' + probe));
  const inDt = [...dtKeys].some((k) => k.endsWith('|' + probe));
  console.log('probe  mine=' + inMine + ' doctest=' + inDt + '   ' + probe.slice(0, 60));
}
