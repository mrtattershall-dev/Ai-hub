// SURFACE-1 — discover the authority surface, then confirm it by execution.
//
//     node benchmarks/run-surface.mjs [test-file ...]
//
// STATIC  candidates come from the repository's own SHAPE (an identity brand), propagated through
//         the import and call graph. No list of authority function names exists anywhere here.
// DYNAMIC confirmation comes from running EXISTING tests with the discovered set instrumented.
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { discover, instrumentationFor, isInstrument, REASON, CAVEAT }
  from '../legasus/legascreen/surface.mjs';

const ROOT = resolve(fileURLToPath(new URL('../legasus', import.meta.url)));
const surface = discover(ROOT);
const inst = instrumentationFor(surface);

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
      LGS_WITNESS_CONFIG: JSON.stringify({ targets: inst.targets }), PYTHONDONTWRITEBYTECODE: '1' } });
  process.exit(r.status === null ? 1 : r.status);
}

const { REC } = await import('../legasus/legascreen/witness-store.mjs');
const { interveneAll } = await import('../legasus/legascreen/intervene.mjs');
const { STATE } = await import('../legasus/legascreen/outcome.mjs');

const say = (...a) => console.log(...a);
let passed = 0, failed = 0;
for (const s of SUBJECTS) {
  try { await import(pathToFileURL(resolve(s)).href); passed++; } catch { failed++; }
}

process.on('exit', () => {
  // S-1, asserted: no list of authority function names on the discovery path.
  const NAMEY = /\b(observe|derive|delegate|token|isAuthority|entitled|commit)\b\s*[,'"\]]/;
  const dirty = ['legasus/legascreen/surface.mjs'].filter((f) => readFileSync(f, 'utf8')
    .split(/\r?\n/).filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
    .some((l) => NAMEY.test(l)));

  const subject = surface.candidates.filter((c) => !isInstrument(c));
  const instrument = surface.candidates.filter(isInstrument);

  const ops = new Map();     // 'module::fn' -> stats
  for (const c of surface.candidates) {
    ops.set(c.module + '::' + c.fn, { c, observed: 0, produced: 0, consumed: 0 });
  }
  const opName = (t, fn) => t.name + '.' + fn;
  const nameToKey = new Map();
  for (const t of inst.targets) for (const fn of t.exports) nameToKey.set(opName(t, fn), t.match + '::' + fn);

  for (const n of REC.nodes()) {
    const k = nameToKey.get(n.op);
    if (!k || !ops.has(k)) continue;
    const s = ops.get(k);
    s.observed++;
    if (REC.isAuthorityObject(n.result)) s.produced++;
    const refs = JSON.stringify(n.args).match(/"__(ref|foreign)":\d+/g) || [];
    for (const r of refs) {
      if (r.startsWith('"__foreign')) { s.consumed++; break; }
      const id = Number(r.split(':')[1]);
      if (REC.isAuthorityObject(REC.node(id) && REC.node(id).result)) { s.consumed++; break; }
    }
  }

  // SCREENABLE: a witness that replays AND yields at least one counterfactual that reached OBSERVED.
  const SAMPLE = 5;
  const screenable = new Map();
  for (const [k, s] of ops) {
    if (!s.observed || !(s.produced || s.consumed)) continue;
    const t = inst.targets.find((x) => k.startsWith(x.match + '::'));
    if (!t) continue;
    const ws = REC.witnesses(opName(t, k.split('::')[1]));
    let replayable = 0, scored = 0;
    for (const w of ws.slice(0, SAMPLE)) {
      if (!REC.replay(w).ok) continue;
      replayable++;
      scored += interveneAll(REC, w).scored;
    }
    screenable.set(k, { replayable, scored, witnesses: ws.length });
  }

  const confirmed = [...ops].filter(([, s]) => s.observed && (s.produced || s.consumed));
  const observedOnly = [...ops].filter(([, s]) => s.observed);
  const screened = confirmed.filter(([k]) => (screenable.get(k) || {}).scored > 0);

  const reasons = new Map();
  const bump = (r) => reasons.set(r, (reasons.get(r) || 0) + 1);
  for (const [k, s] of ops) {
    if (screened.some(([x]) => x === k)) continue;
    if (!s.c.exported) bump(REASON.PRIVATE);
    else if (!s.observed) bump(REASON.NOT_OBSERVED);
    else if (!(s.produced || s.consumed)) bump(REASON.NO_AUTHORITY);
    else if (!(screenable.get(k) || {}).replayable) bump(REASON.NOT_REPLAYABLE);
    else bump(REASON.NO_EXPERIMENT);
  }

  say('');
  say('======================================================================');
  say('SURFACE-1   modules parsed: ' + surface.modules + '   test files run: ' + SUBJECTS.length
    + '   (imported ok ' + passed + ', failed ' + failed + ')');
  say('  brand sites found BY SHAPE: ' + surface.brandSites.join(', '));
  say('  S-1 NO-NAME-LIST CHECK: ' + (dirty.length ? 'LIST FOUND in ' + dirty.join(',')
    : 'surface.mjs contains no list of authority function names'));
  say('');
  say('  STATIC AUTHORITY CANDIDATES      ' + String(surface.candidates.length).padStart(4));
  say('  DYNAMICALLY OBSERVED             ' + String(observedOnly.length).padStart(4));
  say('  CONFIRMED AUTHORITY TRANSFORMS   ' + String(confirmed.length).padStart(4));
  say('  SCREENABLE                       ' + String(screened.length).padStart(4));
  say('  UNSCREENABLE                     ' + String(surface.candidates.length - screened.length).padStart(4));
  say('');
  say('  of the static candidates: ' + subject.length + ' in the SUBJECT, ' + instrument.length
    + ' in LEGASCREEN ITSELF (the instrument does not count itself as surface)');
  say('  by discovery level: ' + [...surface.candidates.reduce((m, c) =>
    m.set(c.level, (m.get(c.level) || 0) + 1), new Map())].map(([l, n]) => 'L' + l + '=' + n).join('  '));
  say('');
  say('  UNSCREENABLE, by reason:');
  for (const [r, n] of [...reasons].sort((a, b) => b[1] - a[1])) say('      ' + String(n).padStart(3) + '  ' + r);
  say('');
  say('  EVERY CANDIDATE, WITH WHAT HAPPENED TO IT:');
  say('      ' + 'transform'.padEnd(40) + 'L  vis      calls  auth  status');
  for (const [k, s] of ops) {
    const sc = screenable.get(k);
    const status = screened.some(([x]) => x === k) ? 'SCREENABLE  cf OBSERVED ' + sc.scored
      : !s.c.exported ? 'UNSCREENABLE  private'
        : !s.observed ? 'UNSCREENABLE  not observed'
          : !(s.produced || s.consumed) ? 'UNSCREENABLE  no authority moved'
            : !(sc && sc.replayable) ? 'UNSCREENABLE  not replayable'
              : 'UNSCREENABLE  no perturbation scored';
    say('      ' + k.padEnd(40) + s.c.level + '  ' + (s.c.exported ? 'export ' : 'PRIVATE')
      + String(s.observed).padStart(7) + String(s.produced + s.consumed).padStart(6) + '  ' + status);
  }
  say('');
  say('  CAVEAT: ' + CAVEAT);
  say('  SCREENABLE IS NOT SCREENED. Nothing here compares an observation to a declaration, so the');
  say('  count of transforms actually SCREENED is still 1 (hand-driven) and previously unknown');
  say('  repository defects discovered is still 0.');
  say('======================================================================');
  void STATE;
});
