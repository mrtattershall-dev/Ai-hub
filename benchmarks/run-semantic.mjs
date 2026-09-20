// SEMANTIC-1 — two tracks over one experiment, kept apart.
//
//     node benchmarks/run-semantic.mjs [test-file ...]
//
// TRACK P  producers and transducers: what support formula justifies the output authority, and does
//          it match a contract that carries its own provenance and validity?
// TRACK C  consumers: does a legitimately weakened authority input change the DECISION?
//
// Roles are established from what a call DID, never from what it is called. No driver anywhere.
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { discover, instrumentationFor } from '../legasus/legascreen/surface.mjs';

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
const { roleOf, supportFormula, decisionProfile, observedCoordinates, ROLE, SPEC_VOCABULARY }
  = await import('../legasus/legascreen/semantic.mjs');
const { contract, resolve: resolveContract, digestOf, RESOLUTION, STATUS }
  = await import('../legasus/legascreen/contract.mjs');
const { VERDICT } = await import('../legasus/legascreen/outcome.mjs');

const say = (...a) => console.log(...a);
for (const s of SUBJECTS) await import(pathToFileURL(resolve(s)).href);

// Contracts are loaded from disk as evidence objects. A contract missing any of source, provenance
// or validAgainst is REFUSED at construction - the screen would rather have none than one that could
// have been edited alongside the implementation it judges.
const CONTRACTS = [];
const cdir = 'legasus/legascreen/contracts';
if (existsSync(cdir)) {
  for (const f of readdirSync(cdir)) {
    if (!f.endsWith('.json')) continue;
    CONTRACTS.push(contract(JSON.parse(readFileSync(join(cdir, f), 'utf8'))));
  }
}
const contractFor = (subject, coord) => CONTRACTS.find((c) => c.subject === subject
  && (c.coordinate === coord || (c.coordinate.endsWith('.*')
    && coord.startsWith(c.coordinate.slice(0, -1)))));

process.on('exit', () => {
  const SAMPLE = 4;
  const roles = new Map();
  const byOp = new Map();
  for (const t of inst.targets) {
    for (const fn of t.exports) {
      const ws = REC.witnesses(t.name + '.' + fn).filter((w) => REC.replay(w).ok);
      if (ws.length) byOp.set(t.match + '::' + fn, ws);
    }
  }
  for (const [k, ws] of byOp) {
    const r = ws.map((w) => roleOf(REC, w));
    roles.set(k, r.reduce((m, x) => m.set(x, (m.get(x) || 0) + 1), new Map()));
  }

  say('');
  say('======================================================================');
  say('SEMANTIC-1   test files run: ' + SUBJECTS.length + '   contracts loaded: ' + CONTRACTS.length);
  say('');
  say('  ROLES, established from what each call DID:');
  say('  ' + 'transform'.padEnd(42) + 'PRODUCER TRANSDUCER CONSUMER NEITHER');
  for (const [k, m] of roles) {
    say('  ' + k.padEnd(42) + String(m.get(ROLE.PRODUCER) || 0).padStart(8)
      + String(m.get(ROLE.TRANSDUCER) || 0).padStart(11) + String(m.get(ROLE.CONSUMER) || 0).padStart(9)
      + String(m.get(ROLE.NEITHER) || 0).padStart(8));
  }
  say('');

  // ---------------------------------------------------------------- TRACK P
  say('  TRACK P - SUPPORT FORMULAS AND CONTRACT RESOLUTION');
  const resolutions = [];
  for (const [k, ws] of byOp) {
    const pick = ws.filter((w) => [ROLE.PRODUCER, ROLE.TRANSDUCER].includes(roleOf(REC, w)))
      .slice(0, SAMPLE);
    for (const w of pick) {
      for (const coord of observedCoordinates(REC, w)) {
        const f = supportFormula(REC, w, coord);
        const c = contractFor(k, coord);
        const ev = { replayed: true, applied: f.cells.some((x) => x.outcome !== 'PERTURBATION_NO_EFFECT'),
          observed: f.cells.some((x) => x.outcome === 'OBSERVED') };
        const res = resolveContract({ observed: f.formula, contract: c,
          digest: c ? digestOf(c.authority.source) : undefined,
          vocabulary: SPEC_VOCABULARY, evidence: ev });
        resolutions.push({ k, w, coord, f, res });
      }
    }
  }
  const shown = new Set();
  for (const r of resolutions) {
    const key = r.k + '|' + r.coord + '|' + r.f.formula + '|' + r.res.resolution + '|' + (r.res.verdict || '');
    if (shown.has(key)) continue;
    shown.add(key);
    say('      ' + (r.k.split('::')[1] + ' ' + r.coord).padEnd(34) + 'observed ' + r.f.formula.padEnd(12)
      + r.res.resolution + (r.res.verdict ? ' / ' + r.res.verdict : '')
      + (r.res.status === STATUS.STALE ? ' (STALE)' : ''));
  }
  const screened = resolutions.filter((r) => r.res.resolution === RESOLUTION.SCREENED);
  const held = screened.filter((r) => r.res.verdict === VERDICT.INVARIANT_HELD);
  const violated = screened.filter((r) => r.res.verdict === VERDICT.INVARIANT_VIOLATED);
  const unmappable = resolutions.filter((r) => r.res.resolution === RESOLUTION.UNMAPPABLE);
  say('');
  say('      coordinates measured        ' + String(resolutions.length).padStart(4));
  say('      SCREENED (contract current) ' + String(screened.length).padStart(4)
    + '   held ' + held.length + '   violated ' + violated.length);
  say('      CHARACTERIZED               '
    + String(resolutions.filter((r) => r.res.resolution === RESOLUTION.CHARACTERIZED).length).padStart(4));
  say('      UNMAPPABLE                  ' + String(unmappable.length).padStart(4)
    + (unmappable.length ? '   <- a gap in the SPECIFICATION, not evidence against the subject' : ''));
  for (const u of unmappable.slice(0, 2)) say('          ' + u.coord + ' observed ' + u.f.formula);
  say('');

  // ---------------------------------------------------------------- TRACK C
  say('  TRACK C - CONSUMER DECISIONS');
  say('  ' + 'transform'.padEnd(42) + 'cells  measured  REQUIRED  IRRELEVANT');
  let anyIrrelevant = 0, anyRequired = 0, consumerOps = 0;
  for (const [k, ws] of byOp) {
    const pick = ws.filter((w) => roleOf(REC, w) === ROLE.CONSUMER).slice(0, SAMPLE);
    if (!pick.length) continue;
    consumerOps++;
    let cells = 0, measured = 0, req = 0, irr = 0;
    for (const w of pick) {
      const p = decisionProfile(REC, w);
      cells += p.cells.length; measured += p.measured; req += p.required; irr += p.irrelevant;
    }
    anyIrrelevant += irr; anyRequired += req;
    say('  ' + k.padEnd(42) + String(cells).padStart(5) + String(measured).padStart(10)
      + String(req).padStart(10) + String(irr).padStart(12));
  }
  say('');
  say('      C-2 POSITIVE CONTROL: at least one weakened input must leave the decision UNCHANGED');
  say('          decisions UNCHANGED under a real perturbation : ' + anyIrrelevant
    + (anyIrrelevant ? '   CONTROL FIRED' : '   FAILED - "always refuse" would win'));
  say('          decisions CHANGED                             : ' + anyRequired);
  say('');

  // ---------------------------------------------------------------- P-5
  const milestone = screened.length > 0;
  say('  P-5 MILESTONE - a MECHANICALLY DISCOVERED transform all the way to SCREENED:');
  if (milestone) {
    const e = screened[0];
    say('      ' + e.k);
    say('      DISCOVERED    by the brand-shape surface scan (no name supplied)');
    say('      WITNESSED     from an existing test, no hand-written driver');
    say('      COUNTERFACTUALIZED  ' + e.f.cells.length + ' cells through production constructors');
    say('      CONTRACT-RESOLVED   against ' + e.res.authority.source + ' @ '
      + e.res.authority.validAgainst);
    say('      SCREENED      ' + e.res.verdict);
    say('      the CONTRACT is still human testimony. What left the pipeline is the DRIVER.');
  } else say('      NOT REACHED');
  say('');
  say('  previously unknown repository defects discovered: ' + violated.length
    + (violated.length ? '   <- INSPECT: a finding against an ESTABLISHED contract' : ''));
  say('======================================================================');
});
