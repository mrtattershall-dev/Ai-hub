// THE FRONTIER OF A REAL PROJECT, DERIVED FROM EVIDENCE TOPOLOGY ALONE.
//
// No plan is read. No feature list exists. No model is consulted. PURPOSE declares one domain
// (`specifiers`) and nothing else, and everything below is a property of the execution graph:
//
//     PURPOSE ROOTS -> WITNESSES -> REGION (at site granularity) -> BOUNDARY -> OBJECTIVES
//
// If this produces a sane, specific, non-arbitrary list of places the project's evidence stops, then
// "what should the system do next" has stopped being a question for a planner and become a measurement.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { buildRegion, boundaryOf, regionDensity, BOUNDARY } from '../../legasus/legaprogress/region.mjs';

const NL = String.fromCharCode(10);
const ROOT = 'benchmarks/repoB/pristine';
const PKG = 'packaging';

const SITEMAP = [
  'import json, os, sys, types',
  'root = sys.argv[1]',
  'out = {}',
  'def walk(code, qual, mod):',
  '    if qual:',
  '        lines = sorted({ln for (_s, _e, ln) in code.co_lines() if ln is not None})',
  '        if lines:',
  '            out[mod + "|" + qual] = {"module": mod, "lines": lines}',
  '    for c in code.co_consts:',
  '        if isinstance(c, types.CodeType):',
  '            walk(c, getattr(c, "co_qualname", c.co_name), mod)',
  'for f in sorted(os.listdir(root)):',
  '    if not f.endswith(".py"):',
  '        continue',
  '    src = open(os.path.join(root, f), encoding="utf-8").read()',
  '    walk(compile(src, f, "exec"), "", f[:-3])',
  'print(json.dumps(out))',
].join(NL);

const siteMap = JSON.parse(execFileSync('python', ['-c', SITEMAP, ROOT + '/' + PKG],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } }));

const sweep = JSON.parse(readFileSync('benchmarks/repoB/sweep.json', 'utf8'));
const lastSeg = (s) => String(s).split('.').filter(Boolean).pop() || '<module>';

const witnesses = sweep.runs.map((r, i) => {
  const mod = r.module.replace(/\.py$/, '');
  return { id: 'w' + i, rootSubject: mod + '.' + lastSeg(r.owner),
    entered: r.entered || [], lines: r.lines || [] };
});
// PURPOSE: one declared domain. The roots are the subjects its own documentation executes.
const roots = [...new Set(witnesses
  .filter((w) => w.rootSubject.startsWith('specifiers.')).map((w) => w.rootSubject))];

const region = buildRegion({ witnesses, roots, siteMap });
const density = regionDensity(region);
const boundary = boundaryOf(region);

console.log('PURPOSE declares one domain: specifiers. Roots derived from its own documentation: '
  + roots.length);
console.log('');
console.log('THE REGION');
console.log('  subjects reached            : ' + region.subjects.size);
console.log('  sites established           : ' + region.sites.size);
console.log('  contributing witnesses      : ' + region.witnesses.length + ' of ' + witnesses.length);
console.log('  functions fully established : ' + density.full);
console.log('  functions partially only    : ' + density.partial);
console.log('  region density              : ' + density.established + '/' + density.total
  + ' = ' + (100 * density.density).toFixed(1) + '%');
console.log('');

const branches = boundary.filter((b) => b.kind === BOUNDARY.UNEXERCISED_BRANCH);
console.log('THE BOUNDARY: ' + boundary.length + ' derived edges, ' + branches.length
  + ' of them unexercised branches inside functions the region genuinely runs.');
console.log('');
// The boundary items nearest to being interior are the cheapest real objectives: the region already
// executes almost all of these functions, and a handful of sites have never been established.
const nearest = branches
  .map((b) => ({ ...b, frac: b.established / b.total }))
  .filter((b) => b.total >= 4)
  .sort((a, b) => b.frac - a.frac)
  .slice(0, 12);
console.log('  NEAREST EDGES — the region already holds most of these, and stops just short:');
for (const b of nearest) {
  console.log('    ' + b.subject.replace('|', ' ').padEnd(42)
    + String(b.established).padStart(4) + '/' + String(b.total).padEnd(5)
    + (100 * b.frac).toFixed(0).padStart(4) + '%   missing sites ' + b.missing.slice(0, 5).join(','));
}
console.log('');
const deepest = branches.filter((b) => b.total >= 8).sort((a, b) =>
  (a.established / a.total) - (b.established / b.total)).slice(0, 8);
console.log('  DEEPEST EDGES — large behaviour the region barely touches:');
for (const b of deepest) {
  console.log('    ' + b.subject.replace('|', ' ').padEnd(42)
    + String(b.established).padStart(4) + '/' + String(b.total).padEnd(5)
    + (100 * b.established / b.total).toFixed(0).padStart(4) + '%');
}

writeFileSync('benchmarks/repoB/region-frontier.json', JSON.stringify({
  roots: roots.length, subjects: region.subjects.size, sites: region.sites.size, density,
  boundaryCount: boundary.length, boundary: boundary.slice(0, 400),
}, null, 1), 'utf8');
console.log('');
console.log('wrote benchmarks/repoB/region-frontier.json');
