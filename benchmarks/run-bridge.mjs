// BRIDGE-1 — production behaviour compared to the calculus as a specification.
//
//     node benchmarks/run-bridge.mjs [test-file ...]
//
// Production (justification.covers) is WITNESSED from existing tests. For each observed call the
// same facts are put to the specification through ITS OWN constructors, and the two answers are
// compared across a bridge that carries its own provenance and pins both endpoints.
//
// Production does not import the calculus. Nothing here edits production to make the comparison
// easier, and the relation a bridge declares governs what may be concluded at all.
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
import { readdirSync, statSync } from 'node:fs';

const CONFIG = { targets: [{ name: 'just', match: 'legasus/legaknow/justification.mjs',
  exports: ['covers'], brands: [] }] };

const ROOT = resolve(fileURLToPath(new URL('../legasus', import.meta.url)));
const testFiles = (dir, out = []) => {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) testFiles(p, out);
    else if (p.endsWith('.test.mjs')) out.push(p);
  }
  return out;
};
const SUBJECTS = process.argv.slice(2).length ? process.argv.slice(2) : testFiles(ROOT);

if (!process.env.LGS_WITNESS) {
  const self = fileURLToPath(import.meta.url);
  const reg = resolve(fileURLToPath(new URL('../legasus/legascreen/witness-register.mjs', import.meta.url)));
  const r = spawnSync(process.execPath, ['--import', pathToFileURL(reg).href, self, ...SUBJECTS],
    { stdio: 'inherit', env: { ...process.env, LGS_WITNESS: '1',
      LGS_WITNESS_CONFIG: JSON.stringify(CONFIG), PYTHONDONTWRITEBYTECODE: '1' } });
  process.exit(r.status === null ? 1 : r.status);
}

const { REC } = await import('../legasus/legascreen/witness-store.mjs');
const { bridge, compare, digestOf, COMPARISON } = await import('../legasus/legascreen/bridge.mjs');
const B = await import('../legasus/legascreen/bridges/covers-delegate.mjs');
const C = await import(pathToFileURL(resolve('legasus/legaknow/calculus.mjs')).href);

const say = (...a) => console.log(...a);
for (const s of SUBJECTS) await import(pathToFileURL(resolve(s)).href);

process.on('exit', () => {
  const digests = { production: digestOf(B.ENDPOINTS.production),
    specification: digestOf(B.ENDPOINTS.specification) };
  const mk = (spec) => bridge({ ...spec, valid_against: { ...digests } });
  const WIDE = mk(B.WIDE);
  const RESTRICTED = mk(B.RESTRICTED);

  const calls = REC.witnesses('just.covers');
  const tally = (rows) => rows.reduce((m, r) => m.set(r.comparison, (m.get(r.comparison) || 0) + 1),
    new Map());

  const gaps = new Map();
  const wide = [], restricted = [];
  let outside = 0;
  for (const w of calls) {
    const a = REC.argsOf(w.root, w.root.args);
    if (!a.ok || a.args.length < 2) continue;
    const [granted, required] = a.args;
    // REPRESENTABILITY IS DECIDED ON THE INPUTS, BEFORE THE ANSWERS ARE COMPARED. A production
    // concept the specification has no vocabulary for makes the comparison UNMAPPABLE; comparing
    // anyway is how the first run of this bridge manufactured 965 findings against production.
    const gap = B.unrepresentable(granted, required);
    if (gap) gaps.set(gap.slice(0, 60), (gaps.get(gap.slice(0, 60)) || 0) + 1);
    const production = gap ? { result: null } : B.readProduction(w.root.result);
    let specification;
    if (gap) specification = { result: null };
    else {
      try { specification = B.readSpecification(B.toSpecification(C, granted, required)); }
      catch { specification = { result: null }; }
    }

    wide.push(compare({ production, specification, bridge: WIDE, digests }));
    if (B.inDomain(granted, required)) {
      const c = compare({ production, specification, bridge: RESTRICTED, digests });
      if (c.comparison === 'RESULT_DISAGREEMENT') {
        const show = (o) => JSON.stringify(Object.fromEntries(Object.entries(o)
          .map(([k, v]) => [k, typeof v === 'symbol' ? '<ANY>' : v])));
        c.evidence = 'granted=' + show(granted) + ' required=' + show(required)
          + ' rawProduction=' + JSON.stringify(w.root.result);
      }
      restricted.push(c);
    } else outside++;
  }

  say('');
  say('======================================================================');
  say('BRIDGE-1   production: justification.covers   specification: calculus.delegate');
  say('  production imports the calculus: ' + (/calculus/.test(
    String(REC.nodes().length)) ? '?' : 'NO - the two are independent implementations'));
  say('  endpoints pinned at  production ' + digests.production
    + '   specification ' + digests.specification);
  say('  witnessed production calls: ' + calls.length);
  say('');
  say('  WIDE BRIDGE   relation PARTIAL');
  for (const [k, n] of tally(wide)) say('      ' + k.padEnd(22) + String(n).padStart(5));
  if (wide.length) say('      ' + wide[0].why.slice(0, 96));
  say('');
  say('  RESTRICTED BRIDGE   relation EQUIVALENT, domain: ' + B.RESTRICTED.domain);
  say('      in domain ' + restricted.length + ' / ' + calls.length
    + '   (outside the declared domain: ' + outside + ', not compared)');
  for (const [k, n] of tally(restricted)) say('      ' + k.padEnd(22) + String(n).padStart(5));
  const dis = restricted.filter((r) => r.comparison === COMPARISON.RESULT_DISAGREEMENT);
  const rdis = restricted.filter((r) => r.comparison === COMPARISON.REASON_DISAGREEMENT);
  for (const d of [...dis, ...rdis].slice(0, 6)) { say('      *** ' + d.comparison + '  ' + d.why); if (d.evidence) say('          ' + d.evidence); }
  say('');
  say('  VOCABULARY GAPS (production concepts the specification cannot represent):');
  for (const [k, n] of [...gaps].sort((a,b)=>b[1]-a[1]).slice(0,3)) say('      ' + String(n).padStart(5) + '  ' + k);
  say('  RESULT_DISAGREEMENT on the restricted domain: ' + dis.length);
  say('  REASON_DISAGREEMENT on the restricted domain: ' + rdis.length);
  say('  A large UNMAPPABLE count is the EXPECTED honest result: production does not consume the');
  say('  calculus, and a bridge that cannot license a verdict must not produce one.');
  say('======================================================================');
});
