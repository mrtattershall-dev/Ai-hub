// AUTO-CF-1 — perturb a RECORDED witness and re-run the construction through production.
//
//     node benchmarks/run-auto-cf.mjs [existing-test-file ...]
//
// THERE IS NO COUNTERFACTUAL DRIVER IN THIS FILE. It names a module to instrument and test files to
// run. Which facts exist, how a premise is built and what the operation is are all recorded from the
// real execution; the only thing chosen here is to leave one recorded fact out.
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const CONFIG = {
  targets: [{
    name: 'calculus', match: 'legasus/legaknow/calculus.mjs',
    exports: ['observe', 'derive', 'delegate'],
    brands: ['isAuthority'],
  }],
};

const SUBJECTS = process.argv.slice(2).length ? process.argv.slice(2)
  : ['legasus/legaknow/calculus.test.mjs', 'legasus/legaknow/calculus-attack.test.mjs'];

if (!process.env.LGS_WITNESS) {
  const self = fileURLToPath(import.meta.url);
  const reg = resolve(fileURLToPath(new URL('../legasus/legascreen/witness-register.mjs', import.meta.url)));
  const r = spawnSync(process.execPath, ['--import', pathToFileURL(reg).href, self, ...SUBJECTS],
    { stdio: 'inherit', env: { ...process.env, LGS_WITNESS: '1',
      LGS_WITNESS_CONFIG: JSON.stringify(CONFIG), PYTHONDONTWRITEBYTECODE: '1' } });
  process.exit(r.status === null ? 1 : r.status);
}

const { REC } = await import('../legasus/legascreen/witness-store.mjs');
const { interveneAll } = await import('../legasus/legascreen/intervene.mjs');
const { STATE } = await import('../legasus/legascreen/outcome.mjs');

const say = (...a) => console.log(...a);
for (const s of SUBJECTS) await import(pathToFileURL(resolve(s)).href);

process.on('exit', () => {
  const DRIVER = /(^|[^A-Za-z])(facts|construct|operate)\s*[:(]/;
  const path = ['benchmarks/run-auto-cf.mjs', 'legasus/legascreen/intervene.mjs',
    'legasus/legascreen/witness.mjs', 'legasus/legascreen/outcome.mjs'];
  const dirty = path.filter((f) => readFileSync(f, 'utf8').split(/\r?\n/)
    .filter((l) => !l.trim().startsWith('//')).some((l) => DRIVER.test(l)));

  say('');
  say('======================================================================');
  say('AUTO-CF-1   ran: ' + SUBJECTS.join(', '));
  say('  NO-DRIVER CHECK: ' + (dirty.length ? 'DRIVER FOUND in ' + dirty.join(', ')
    : 'none of ' + path.length + ' files supplies facts/construct/operate'));
  say('');

  const src = ['legasus/legascreen/intervene.mjs', 'benchmarks/run-auto-cf.mjs'];
  let carriers = 0;

  const ops = CONFIG.targets.flatMap((t) => t.exports.map((e) => t.name + '.' + e));
  const totals = { N: 0, M: 0, K: 0, leaves: 0 };
  const stages = {};
  const perOp = [];
  const examples = [];

  for (const op of ops) {
    const ws = REC.witnesses(op);
    let m = 0, k = 0, lv = 0;
    for (const w of ws) {
      if (!REC.replay(w).ok) continue;
      m++;
      const r = interveneAll(REC, w);
      carriers += r.results.filter((x) => Object.hasOwn(x, 'verdict')).length;
      lv += r.results.length;
      k += r.scored;
      for (const [s, n] of Object.entries(r.stages)) stages[s] = (stages[s] || 0) + n;
      if (r.scored && examples.length < 3 && op === 'calculus.derive') examples.push(r);
    }
    perOp.push([op, ws.length, m, k, lv]);
    totals.N += ws.length; totals.M += m; totals.K += k; totals.leaves += lv;
  }

  say('  THE NUMBER THIS SLICE IS FOR');
  say('    hand-authored counterfactual drivers  : 0');
  say('    authority transforms WITNESSED    (N) : ' + totals.N);
  say('    authority transforms REPLAYED     (M) : ' + totals.M);
  say('    authority transforms PERTURBED    (K) : ' + totals.K
    + '   (counterfactuals that reached OBSERVED, out of ' + totals.leaves + ' leaf facts tried)');
  say('');
  say('  ' + 'op'.padEnd(20) + '   N    M    K   leaves');
  for (const [op, n, m, k, lv] of perOp) {
    say('  ' + op.padEnd(20) + String(n).padStart(4) + String(m).padStart(5)
      + String(k).padStart(5) + String(lv).padStart(9));
  }
  say('');
  say('  OUTCOMES over every counterfactual attempted:');
  for (const [s, n] of Object.entries(stages).sort((a, b) => b[1] - a[1])) {
    say('      ' + s.padEnd(30) + String(n).padStart(5)
      + (s === STATE.OBSERVED ? '   <- the only scorable one' : ''));
  }
  say('');

  for (const ex of examples) {
    say('  ' + ex.subject);
    for (const r of ex.results) {
      if (r.outcome !== STATE.OBSERVED) continue;
      const d = r.delta.length ? r.delta.map((x) => x.coordinate + ' ' + x.effect).join(', ')
        : 'NO DELTA (input changed, authority coordinates did not)';
      say('      #' + String(r.leaf.node).padEnd(3) + r.leaf.path.padEnd(38) + d);
    }
    const vac = ex.results.filter((r) => r.outcome === STATE.PERTURBATION_NO_EFFECT).length;
    say('      ...' + vac + ' leaf(s) were PERTURBATION_NO_EFFECT and scored nothing');
    say('');
  }

  // C-6: this slice issues no judgment. The first version of this check asked each journey FOR a
  // verdict and demanded UNKNOWN, which is not the claim at all - a completed journey is SUPPOSED to
  // be able to judge, and 254 of them correctly could. The claim is that nothing here asks.
  // AND IT MUST NOT MATCH ITSELF. The first version reported SCOPE EXCEEDED because the line that
  // PRINTS this result mentions the method names inside a string. A checker that convicts on its own
  // report text is the smallest possible instance of reading your own output back as evidence.
  const judged = src.some((f) => readFileSync(f, 'utf8').split(/\r?\n/)
    .filter((l) => !l.trim().startsWith('//')).map((l) => l.replace(/'[^']*'/g, "''"))
    .some((l) => /\.(held|violated)\s*\(/.test(l)));
  say('  C-6 NO JUDGMENT ISSUED');
  say('      intervene/runner call .held() or .violated() : ' + (judged ? 'YES - SCOPE EXCEEDED' : 'no'));
  say('      result records carrying a verdict field      : ' + carriers);
  say('  NO COVERAGE FRACTION. The authority surface is still undiscovered.');
  say('======================================================================');
});
