// THREE WITNESSES for the isolated-runnable checker. The third is the one that matters: it proves the
// checker tests PREDECESSOR SUFFICIENCY rather than blacklisting cross-goal references. Without it, a
// checker that simply refused every goal appearing in the ownership table would pass witnesses 1 and 2.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { runnableFrom } from './substrate.mjs';

const HERE = new URL('.', import.meta.url).pathname.replace(/^\//, '');
const parts = [];
for (const d of ['seed', 'seed60']) {
  for (const f of readdirSync(join(HERE, d))) {
    const p = join(HERE, d, f);
    if (statSync(p).isFile()) parts.push(readFileSync(p, 'utf8'));
  }
}
const postSeed = parts.join('\n');
// A predecessor that DOES contain goal 71's deliverables.
const withGoal71 = postSeed + '\n  toJSON() { return {}; }\n  static fromJSON(d) { return new Library(); }\n';

const cases = [
  { name: 'SELF-OWNED MISSING   goal 71 introduces toJSON/fromJSON, absent from seed',
    goal: 71, text: postSeed, expect: true },
  { name: 'CROSS-GOAL MISSING   goal 80 requires toJSON/fromJSON, owned by 71, absent',
    goal: 80, text: postSeed, expect: false },
  { name: 'CROSS-GOAL PRESENT   goal 80 on a predecessor that DOES contain them',
    goal: 80, text: withGoal71, expect: true },
  { name: 'SELF-OWNED OPTION    goal 67 introduces onEvict, an options key',
    goal: 67, text: postSeed, expect: true },
];

let fail = 0;
for (const c of cases) {
  const r = runnableFrom(c.goal, c.text);
  const pass = r.ok === c.expect;
  if (!pass) fail++;
  console.log('  ' + (pass ? 'ok  ' : 'FAIL') + '  ' + c.name);
  console.log('        runnable=' + r.ok + '  expected=' + c.expect
    + (r.missing.length ? '  missing: ' + r.missing.join(', ') : ''));
}
console.log('\n  ' + (fail ? fail + ' WITNESS FAILURE(S)' : 'all four witnesses pass'));
console.log('  The CROSS-GOAL PRESENT case is the non-vacuity guard: a checker that refused every goal');
console.log('  in the ownership table would pass the first two and fail this one.');
