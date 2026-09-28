// THREE WITNESSES FOR EVERY BEHAVIOURAL ORACLE.
//
//   reference post-goal implementation  -> MUST PASS   (acceptance: the oracle is not over-strict)
//   no-op / wrong implementation        -> MUST FAIL   (rejection: the oracle can fail)
//   FROZEN canonical post-40 seed       -> MUST FAIL   (delta: the oracle tests the NEW behaviour,
//                                                       not old functionality it already had)
//
// The third witness is the one that makes these oracles worth anything. Without it a probe can pass
// simply by re-verifying behaviour the seed already implements, and a model that changes nothing
// would score a behavioural success.
import { PROBES } from './probes.mjs';
import { runBrowserProbe } from './probeBrowser.mjs';
import { mkdtempSync, writeFileSync, readdirSync, statSync, copyFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HERE = new URL('.', import.meta.url).pathname.replace(/^\//, '');
const SEED = join(HERE, 'seed');

let pass = 0;
let fail = 0;
const t = (name, cond, detail) => {
  if (cond) { pass++; console.log('    ok   ' + name); }
  else { fail++; console.log('    FAIL ' + name + (detail ? '   ' + detail : '')); }
};

// A workspace is always the FROZEN seed, optionally overlaid with a reference or a broken file.
function mkWorkspace(overlayDir, overrides) {
  const ws = mkdtempSync(join(tmpdir(), 'probe-'));
  writeFileSync(join(ws, 'package.json'), JSON.stringify({ name: 'ws', version: '1.0.0', type: 'commonjs' }, null, 2), 'utf8');
  for (const f of readdirSync(SEED)) {
    const p = join(SEED, f);
    if (statSync(p).isFile()) copyFileSync(p, join(ws, f));
  }
  if (overlayDir && existsSync(overlayDir)) {
    for (const f of readdirSync(overlayDir)) copyFileSync(join(overlayDir, f), join(ws, f));
  }
  for (const [f, src] of Object.entries(overrides || {})) writeFileSync(join(ws, f), src, 'utf8');
  return ws;
}

// A no-op witness per lead file: it loads, it exports the right shape, it does nothing new.
const NOOPS = {
  's4_markdown.py': 'def to_html(text):\n    return "<p>" + str(text) + "</p>"\n',
  's5_expr.js': 'function evaluate(expr, vars = {}) { return 0; }\nmodule.exports = { evaluate };\n',
  's9_board.js': '// does nothing\n',
};

const run = async (probe, ws) => (probe.browser ? runBrowserProbe(probe, ws) : probe.run(ws));

console.log('  BEHAVIOURAL ORACLES - three witnesses each\n');
const summary = [];
for (const probe of PROBES) {
  console.log('  ' + probe.id + '   (goal ' + probe.goal + ', ' + probe.lead + ')');
  const refDir = join(HERE, 'ref', 'goal' + probe.goal);

  const good = await run(probe, mkWorkspace(refDir));
  t('reference post-goal implementation PASSES', good.pass === true, good.why);

  const seed = await run(probe, mkWorkspace(null));
  t('FROZEN post-40 seed FAILS (oracle tests the delta)', seed.pass === false, 'it passed - the oracle does not test the new behaviour');
  if (seed.pass === false) console.log('         seed fails because: ' + String(seed.why).slice(0, 96));

  const noop = await run(probe, mkWorkspace(null, { [probe.lead === 's9_board.html' ? 's9_board.js' : probe.lead]: NOOPS[probe.lead === 's9_board.html' ? 's9_board.js' : probe.lead] }));
  t('no-op implementation FAILS', noop.pass === false, 'a do-nothing implementation passed');

  summary.push({ id: probe.id, goal: probe.goal, ref: good.pass, seed: seed.pass, noop: noop.pass });
  console.log('');
}

console.log('  SUMMARY');
console.log('    probe                  goal   reference   seed    no-op');
for (const s of summary) {
  console.log('    ' + s.id.padEnd(22) + ' ' + String(s.goal).padEnd(6)
    + ' ' + (s.ref ? 'PASS' : 'fail').padEnd(11)
    + ' ' + (s.seed ? 'PASS' : 'FAIL').padEnd(7)
    + ' ' + (s.noop ? 'PASS' : 'FAIL'));
}
console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
