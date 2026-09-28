// AUTO-WITNESS-1 — capture the construction history of an authority transformation from a test that
// was going to run anyway.
//
//     node benchmarks/run-auto-witness.mjs [existing-test-file ...]
//
// THERE IS NO DRIVER IN THIS FILE. It names a module to instrument and a test file to run. It does
// not say what the facts are, how to build a premise, or what the operation means - all of that is
// recorded from the real execution. Compare with run-legascreen-cf.mjs, which hand-authors `facts`,
// `construct` and `operate` for exactly one transformation.
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const CONFIG = {
  targets: [{
    name: 'calculus', match: 'legasus/legaknow/calculus.mjs',
    exports: ['observe', 'derive', 'delegate'],
    brands: ['isAuthority'],            // THE SUBJECT'S OWN predicate. The recorder writes none.
  }],
};

const SUBJECTS = process.argv.slice(2).length ? process.argv.slice(2)
  : ['legasus/legaknow/calculus.test.mjs', 'legasus/legaknow/calculus-attack.test.mjs'];

if (!process.env.LGS_WITNESS) {
  // Re-exec with the loader registered. --import must be on the command line; nothing after startup
  // can instrument a module the test already imported.
  const self = fileURLToPath(import.meta.url);
  const reg = resolve(fileURLToPath(new URL('../legasus/legascreen/witness-register.mjs', import.meta.url)));
  const r = spawnSync(process.execPath, ['--import', pathToFileURL(reg).href, self, ...SUBJECTS],
    { stdio: 'inherit', env: { ...process.env, LGS_WITNESS: '1',
      LGS_WITNESS_CONFIG: JSON.stringify(CONFIG), PYTHONDONTWRITEBYTECODE: '1' } });
  process.exit(r.status === null ? 1 : r.status);
}

const { REC } = await import('../legasus/legascreen/witness-store.mjs');
const { describe } = await import('../legasus/legascreen/witness.mjs');
const { journey, STATE } = await import('../legasus/legascreen/outcome.mjs');

// W-3's instrument: the subject's OWN brand predicate, asked of the REPLAYED object. If recording
// cloned anything it touched, a rebuilt premise would not be in the module-private WeakSet and this
// number would be zero - which is exactly how slice 1 died, one layer down.
const { isAuthority } = await import(pathToFileURL(resolve('legasus/legaknow/calculus.mjs')).href);

const say = (...a) => console.log(...a);

for (const s of SUBJECTS) await import(pathToFileURL(resolve(s)).href);

// Reported at exit so every test in the imported files has finished running.
process.on('exit', () => {
  const all = REC.nodes();
  say('');
  say('======================================================================');
  say('AUTO-WITNESS-1');
  say('  instrumented : ' + CONFIG.targets.map((t) => t.name + ' [' + t.exports.join(', ') + ']').join('; '));
  say('  ran          : ' + SUBJECTS.join(', '));
  say('  calls recorded: ' + all.length + '   by op: '
    + [...all.reduce((m, n) => m.set(n.op, (m.get(n.op) || 0) + 1), new Map())]
      .map(([o, n]) => o + '=' + n).join('  '));

  // W-1, asserted rather than asserted-about. The falsifier named in the preregistration is the
  // PRESENCE of a driver, so the check is for the absence of one: no facts, no construct, no operate,
  // anywhere on the path from this file to the recorded call.
  const DRIVER = /(^|[^A-Za-z])(facts|construct|operate)\s*[:(]/;
  const path = ['benchmarks/run-auto-witness.mjs', 'legasus/legascreen/witness.mjs',
    'legasus/legascreen/witness-store.mjs', 'legasus/legascreen/witness-loader.mjs',
    'legasus/legascreen/witness-register.mjs'];
  const dirty = path.filter((f) => readFileSync(f, 'utf8').split(/\r?\n/)
    .filter((l) => !l.trim().startsWith('//')).some((l) => DRIVER.test(l)));
  say('  NO-DRIVER CHECK: ' + path.length + ' files on the capture path -> '
    + (dirty.length ? 'DRIVER FOUND in ' + dirty.join(', ') : 'none supplies facts/construct/operate'));

  // EVERY instrumented op, not just the one the previous slice hand-drove. If the mechanism only
  // works for derive, it is a driver with extra steps.
  say('  PER TRANSFORMATION');
  say('      ' + 'op'.padEnd(20) + 'ROOT  UPSTREAM  REPLAYED');
  for (const op of CONFIG.targets.flatMap((t) => t.exports.map((e) => t.name + '.' + e))) {
    const all_w = REC.witnesses(op);
    // Replay is measured over ALL root witnesses. A call whose inputs are entirely raw facts has no
    // upstream history and is still perfectly replayable; scoring it as 0 would read as a failure of
    // the mechanism where it is a property of the transformation.
    const hist = all_w.filter((w) => w.ids.length > 1).length;
    const ok = all_w.filter((w) => REC.replay(w).ok).length;
    say('      ' + op.padEnd(20) + String(all_w.length).padStart(4)
      + String(hist).padStart(10) + String(ok).padStart(10));
  }

  const ws = REC.witnesses('calculus.derive');
  const withHistory = ws.filter((w) => w.ids.length > 1);
  say('');

  let replayed = 0;
  const show = withHistory.slice(0, 3);
  for (const w of show) {
    const j = journey('calculus.derive#' + w.root.id).mark(STATE.DISCOVERED,
      'recorded during ' + SUBJECTS[0]);
    say('  WITNESS #' + w.root.id + '  (nodes ' + w.ids.join(',') + ')');
    for (const line of describe(w)) say('      ' + line);
    say('      LEAF FACTS (the only mutable surface): ' + w.leaves.length);
    for (const l of w.leaves.slice(0, 8)) say('          #' + l.node + ' ' + l.path);
    if (w.leaves.length > 8) say('          ... and ' + (w.leaves.length - 8) + ' more');
    say('      FOREIGN authority inputs (unrecorded, unrebuildable): ' + w.foreign.length);
    const r = REC.replay(w);
    if (r.ok) { replayed++; j.mark(STATE.BASELINE_REPLAYED, 'semantically identical'); }
    else j.mark(STATE.BASELINE_UNREPLAYABLE, r.why);
    say('      REPLAY: ' + j.state() + (r.ok ? '' : '   ' + r.reason + ' - ' + r.why));
    say('      VERDICT WITHOUT AN EXPERIMENT: ' + j.held('nothing went wrong').verdict
      + '  (missing ' + j.missing().join(', ') + ')');
    say('');
  }

  // W-3. A replay that merely reproduces a REFUSAL proves nothing about branding, so the minted
  // cases are counted separately and are the only ones that can carry the claim.
  const minted = withHistory.filter((w) => isAuthority(w.root.result));
  const mintedOk = minted.filter((w) => { const r = REC.replay(w); return r.ok && isAuthority(r.result); });
  say('  W-3 BRANDING SURVIVES RECORDING');
  say('    witnesses whose ORIGINAL result was a minted token : ' + minted.length + ' / ' + withHistory.length);
  say('    of those, REPLAYED to a token the subject accepts  : ' + mintedOk.length + ' / ' + minted.length);
  say('    (the rest replayed a refusal, which proves nothing about branding and is not counted)');
  say('');

  const all_r = withHistory.map((w) => REC.replay(w));
  say('  REPLAYED semantically identical: ' + all_r.filter((r) => r.ok).length + ' / ' + all_r.length);
  const bad = all_r.filter((r) => !r.ok);
  if (bad.length) {
    say('  UNREPLAYABLE, by reason:');
    for (const [k, n] of bad.reduce((m, r) => m.set(r.reason, (m.get(r.reason) || 0) + 1), new Map())) {
      say('      ' + k + ' = ' + n);
    }
  }
  say('');
  say('  NO COVERAGE FRACTION IS REPORTED. The authority surface has not been discovered, so there');
  say('  is no denominator this run is entitled to divide by.');
  say('======================================================================');
  void replayed;
});
