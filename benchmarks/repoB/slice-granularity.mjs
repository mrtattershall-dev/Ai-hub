// IS THE FUNCTION THE RIGHT UNIT FOR A PURPOSE REGION? — preregistered, frozen before the run.
//
// The 25/18 split through `version` showed the region cutting through SOURCE ORGANISATION at function
// granularity. But EXERCISE already taught this lesson once, one level down:
//
//     FUNCTION ENTERED != TARGET SITE REACHED
//
// and reporting a region in units of functions repeats that mistake one level up. A function can contain
// both purpose-relevant and purpose-irrelevant behaviour - a branch the region takes and a branch it
// never does - and calling the whole function "in region" grants authority the evidence did not give.
//
// PREDICTIONS, STATED BEFORE LOOKING:
//
//   P-A  For at least some functions admitted into the region, the purpose-connected witnesses establish
//        only a PROPER SUBSET of that function's traceable sites. The function is a container the region
//        intersects, not a unit the region is made of.
//
//   P-B  (the stronger one) Different purpose-supported witnesses produce OVERLAPPING BUT NON-IDENTICAL
//        slices through the SAME function: non-empty intersection, non-empty symmetric difference. If
//        this holds, the useful unit is not the function at all - it is the evidence-backed behavioural
//        region, and functions are merely containers those regions cut through.
//
// FALSIFICATION, AND IT IS A REAL POSSIBILITY:
//   If every admitted function is FULLY covered by the purpose-connected witness set, then FUNCTION is
//   the correct granularity, the finer abstraction is unnecessary machinery, and P-A is refuted. If P-A
//   holds but every witness produces the IDENTICAL slice, then slices are a property of the function and
//   not of the witness, and P-B is refuted - the region would still be function-shaped, just smaller.
//
// This consumes only artifacts that already exist: the frozen sweep and the corpus. Nothing is generated.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const NL = String.fromCharCode(10);
const ROOT = 'benchmarks/repoB/pristine';
const PKG = 'packaging';

// Map every traceable line in a module to the code object that owns it. The denominator is Python's own
// co_lines(), for the same reason the coverage denominator had to be: it is what the tracer can emit.
const SITEMAP = [
  'import json, os, sys, types',
  'path = sys.argv[1]',
  'src = open(path, encoding="utf-8").read()',
  'out = {}',
  'def walk(code, qual):',
  '    name = qual',
  '    lines = sorted({ln for (_s, _e, ln) in code.co_lines() if ln is not None})',
  '    if name:',
  '        out.setdefault(name, [])',
  '        out[name].extend(lines)',
  '    for c in code.co_consts:',
  '        if isinstance(c, types.CodeType):',
  '            walk(c, getattr(c, "co_qualname", c.co_name))',
  'top = compile(src, path, "exec")',
  'walk(top, "")',
  'print(json.dumps({k: sorted(set(v)) for k, v in out.items()}))',
].join(NL);

const siteMapFor = (module) => JSON.parse(execFileSync('python',
  ['-c', SITEMAP, ROOT + '/' + PKG + '/' + module],
  { encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } }));

const sweep = JSON.parse(readFileSync('benchmarks/repoB/sweep.json', 'utf8'));

// The purpose region, defined EXACTLY as in purpose-connectivity.mjs: PURPOSE declares one domain,
// `specifiers`, and the entry executions are the ones its own documentation performs.
const purposeRuns = sweep.runs.filter((r) => r.module.replace(/\.py$/, '') === 'specifiers');
console.log('purpose-connected executions: ' + purposeRuns.length + ' of ' + sweep.runs.length);

const TARGET = 'version';
const sites = siteMapFor(TARGET + '.py');
// A function's traceable sites, keyed by the qualname Python itself assigns.
const fnSites = Object.fromEntries(Object.entries(sites).filter(([k, v]) => k && v.length));

// The slice each purpose-connected execution cuts through each function.
const slices = new Map();          // fn -> [{run, lines:Set}]
for (const r of purposeRuns) {
  const hit = new Set((r.lines || [])
    .filter((l) => l.startsWith(TARGET + ':')).map((l) => Number(l.split(':')[1])));
  if (!hit.size) continue;
  for (const [fn, fl] of Object.entries(fnSites)) {
    const inFn = fl.filter((l) => hit.has(l));
    if (!inFn.length) continue;
    const arr = slices.get(fn) || [];
    arr.push({ invocation: r.invocation.slice(0, 48), lines: new Set(inFn) });
    slices.set(fn, arr);
  }
}

let partial = 0; let full = 0;
const partials = [];
for (const [fn, runs] of slices) {
  const union = new Set();
  for (const s of runs) for (const l of s.lines) union.add(l);
  const total = fnSites[fn].length;
  if (union.size < total) { partial++; partials.push({ fn, covered: union.size, total, runs: runs.length }); }
  else full++;
}

// P-B: within one function, do two purpose-connected witnesses disagree about which sites they touch,
// while still overlapping?
const divergent = [];
for (const [fn, runs] of slices) {
  if (runs.length < 2) continue;
  for (let i = 0; i < runs.length && divergent.length < 400; i++) {
    for (let j = i + 1; j < runs.length; j++) {
      const A = runs[i].lines; const B = runs[j].lines;
      const inter = [...A].filter((l) => B.has(l));
      const diff = [...A].filter((l) => !B.has(l)).concat([...B].filter((l) => !A.has(l)));
      if (inter.length && diff.length) {
        divergent.push({ fn, a: runs[i].invocation, b: runs[j].invocation,
          shared: inter.length, differing: diff.length, aOnly: [...A].filter((l) => !B.has(l)).length });
        break;
      }
    }
    if (divergent.some((d) => d.fn === fn)) break;
  }
}

console.log('');
console.log('functions in `' + TARGET + '` touched by purpose-connected execution: ' + slices.size);
console.log('  FULLY covered by the region      : ' + full);
console.log('  only PARTIALLY covered           : ' + partial);
console.log('');
partials.sort((a, b) => (a.covered / a.total) - (b.covered / b.total));
console.log('  the ten most partial:');
for (const p of partials.slice(0, 10)) {
  console.log('    ' + p.fn.padEnd(34) + String(p.covered).padStart(4) + '/'
    + String(p.total).padEnd(5) + (100 * p.covered / p.total).toFixed(0).padStart(4) + '%   '
    + p.runs + ' witnesses');
}

console.log('');
const P_A = partial > 0;
const P_B = divergent.length > 0;
console.log('P-A  region covers only a PROPER SUBSET of some admitted functions : '
  + (P_A ? 'HELD' : 'REFUTED') + '   (' + partial + ' partial / ' + (partial + full) + ')');
console.log('P-B  two purpose witnesses OVERLAP but DIFFER inside one function  : '
  + (P_B ? 'HELD' : 'REFUTED') + '   (' + divergent.length + ' function(s))');
if (P_B) {
  console.log('');
  console.log('  witnessed divergence inside a single function:');
  for (const d of divergent.slice(0, 6)) {
    console.log('    ' + d.fn);
    console.log('      ' + d.a);
    console.log('      ' + d.b);
    console.log('      share ' + d.shared + ' sites, differ on ' + d.differing);
  }
}
console.log('');
console.log(P_A && P_B
  ? 'THE FUNCTION IS A CONTAINER THE REGION INTERSECTS, NOT A UNIT THE REGION IS MADE OF.'
  : P_A ? 'P-A only: the region is smaller than the function, but slices do not vary by witness.'
    : 'REFUTED: function granularity is sufficient here, and the finer abstraction is not yet earned.');

writeFileSync('benchmarks/repoB/slice-granularity.json',
  JSON.stringify({ partial, full, partials, divergent: divergent.slice(0, 50) }, null, 1), 'utf8');
