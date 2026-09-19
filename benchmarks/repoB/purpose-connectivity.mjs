// THE SUPPORTED REGION, ON REAL EXECUTION DATA.
//
// The four-way control proves the mechanism is coherent on constructed frontiers. It does not prove it
// works on a real execution graph, so this runs it against the 163 traced doctests of `packaging`.
//
// PREREGISTERED PREDICTION, stated before the run:
//
//   PURPOSE declares exactly ONE domain: `specifiers`. Nothing else is named anywhere.
//
//   P1  specifiers.* subjects that the entry executions reach are admitted IN_DOMAIN.
//   P2  version.* subjects are admitted CONNECTED, despite `version` appearing nowhere in the
//       constitution - because a Specifier's own execution enters Version. This is the B case on real
//       code: unanticipated, unnamed, admitted by execution alone.
//   P3  tags.* and _manylinux.* subjects are NOT admitted. Real, working, witnessed code in the same
//       repository that the declared region's execution never reaches. This is the D case on real code.
//
//   FALSIFICATION: if P3 fails, the region is not a region - it is everything, and the mechanism is
//   permissiveness wearing a fixpoint. If P2 fails, it is a checklist over module names.
import { readFileSync } from 'node:fs';
import { connectivity, supportedRegion, ROUTE } from '../../legasus/legaprogress/frontier.mjs';

const sweep = JSON.parse(readFileSync('benchmarks/repoB/sweep.json', 'utf8'));

// A doctest execution is attributed to the subject whose documentation it is - when that subject is
// actually a frame the execution entered. Attribution by EXECUTION, not by the docstring's position.
const lastSeg = (s) => String(s).split('.').filter(Boolean).pop() || '';
const witnesses = [];
const entryRoots = new Set();
for (const r of sweep.runs) {
  const mod = r.module.replace(/\.py$/, '');
  const own = mod + '.' + lastSeg(r.owner);
  const root = (r.entered || []).includes(own) ? own : mod + '.<doctest>';
  witnesses.push({ rootSubject: root, entered: r.entered || [] });
  if (mod === 'specifiers') entryRoots.add(root);
}
// The project's entry points are the executions its own declared-domain documentation performs.
const PURPOSE = { identity: 'the specifier subsystem', domains: ['specifiers'],
  entryPoints: [...entryRoots], prohibitions: [] };

const conn = connectivity(witnesses);
const subjects = [...new Set(sweep.enteredFns)];
const { supported } = supportedRegion({ purpose: PURPOSE, subjects, conn });

const byModule = {};
for (const s of subjects) {
  const m = s.split('.')[0];
  byModule[m] = byModule[m] || { total: 0, IN_DOMAIN: 0, CONNECTED: 0, OUT: 0 };
  byModule[m].total++;
  const route = supported.get(s);
  byModule[m][route === ROUTE.IN_DOMAIN ? 'IN_DOMAIN' : route === ROUTE.CONNECTED ? 'CONNECTED' : 'OUT']++;
}

console.log('PURPOSE declares exactly one domain: specifiers. ' + subjects.length
  + ' witnessed subjects across ' + Object.keys(byModule).length + ' modules.');
console.log('');
console.log('  module          total  IN_DOMAIN  CONNECTED   OUT');
for (const [m, c] of Object.entries(byModule).sort((a, b) => b[1].total - a[1].total)) {
  console.log('  ' + m.padEnd(14) + String(c.total).padStart(5) + String(c.IN_DOMAIN).padStart(11)
    + String(c.CONNECTED).padStart(11) + String(c.OUT).padStart(6));
}

const inMod = (m) => subjects.filter((s) => s.startsWith(m + '.'));
const routeCount = (m, want) => inMod(m).filter((s) => supported.get(s) === want).length;
const outCount = (m) => inMod(m).filter((s) => !supported.has(s)).length;

console.log('');
const P1 = routeCount('specifiers', ROUTE.IN_DOMAIN) > 0;
const P2 = routeCount('version', ROUTE.CONNECTED) > 0 && routeCount('version', ROUTE.IN_DOMAIN) === 0;
const P3 = inMod('tags').length > 0 && outCount('tags') === inMod('tags').length;
console.log('P1  specifiers admitted IN_DOMAIN              : ' + (P1 ? 'HELD' : 'FAILED')
  + '  (' + routeCount('specifiers', ROUTE.IN_DOMAIN) + '/' + inMod('specifiers').length + ')');
console.log('P2  version admitted CONNECTED, never named    : ' + (P2 ? 'HELD' : 'FAILED')
  + '  (' + routeCount('version', ROUTE.CONNECTED) + '/' + inMod('version').length + ')');
console.log('P3  tags NOT admitted (the region has an edge) : ' + (P3 ? 'HELD' : 'FAILED')
  + '  (' + outCount('tags') + '/' + inMod('tags').length + ' out)');
console.log('');
console.log(P1 && P2 && P3
  ? 'ALL THREE HELD: on real execution data the region admits the unnamed and excludes the unreached.'
  : 'A PREDICTION FAILED - the result stands as recorded, and the mechanism is what needs examining.');
