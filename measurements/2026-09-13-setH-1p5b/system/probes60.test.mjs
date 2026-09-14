// THREE WITNESSES for the 61-80 behavioural oracles, same discipline as probes.test.mjs.
//   confinement reference   -> PASS
//   frozen post-60 seed     -> FAIL, for a reason specific to the delta
//   no-op implementation    -> FAIL
import { PROBES60 } from './probes60.mjs';
import { freshPost60, spliceOneSpan } from './confine.mjs';
import { BODIES } from './confineBodies.mjs';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

let pass = 0;
let fail = 0;
const t = (n, c, d) => { if (c) { pass++; console.log('    ok   ' + n); } else { fail++; console.log('    FAIL ' + n + (d ? '   ' + d : '')); } };


for (const probe of PROBES60) {
  console.log('  ' + probe.id + '   (goal ' + probe.goal + ')');

  const wsRef = freshPost60();
  const spliced = spliceOneSpan(wsRef, probe.lead, 'py', 'to_html', BODIES['goal' + probe.goal]);
  writeFileSync(join(wsRef, probe.lead), spliced.candidate, 'utf8');
  const good = probe.run(wsRef);
  t('confinement reference PASSES', good.pass === true, good.why);

  const wsSeed = freshPost60();
  const seed = probe.run(wsSeed);
  t('FROZEN post-60 seed FAILS (the oracle tests the delta)', seed.pass === false, 'it passed');
  if (!seed.pass) console.log('         seed fails because: ' + String(seed.why).slice(0, 92));

  const wsNoop = freshPost60();
  writeFileSync(join(wsNoop, probe.lead), 'def to_html(text):\n    return "<p>" + str(text) + "</p>"\n', 'utf8');
  const noop = probe.run(wsNoop);
  t('no-op implementation FAILS', noop.pass === false, 'it passed');
  console.log('');
}
console.log('  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
