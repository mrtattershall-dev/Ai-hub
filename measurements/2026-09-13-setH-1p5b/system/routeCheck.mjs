// ROUTING DRY RUN. Does the v3 SYSTEM choose the route the preregistered strata expect, deciding
// only from the contract and the frozen source? No model calls.
//
// This matters because the strata must not drive the system at runtime - that would make the
// mechanism analysis circular. If the system's independent decision matches the frozen labels, the
// labels describe the system rather than steering it.
import { deriveContract } from './contract.mjs';
import { planOperation } from './operation.mjs';
import { regressionFor } from './regression.mjs';
import { checkContract } from './contractCheck.mjs';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HERE = new URL('.', import.meta.url).pathname.replace(/^\//, '');
const GOALS = JSON.parse(readFileSync('C:/Users/tatte/Projects/ai-coding-hub-indent/measurements/2026-09-12-setH/goals-H.json', 'utf8'));
const strata = JSON.parse(readFileSync(join(HERE, 'goal-strata-61-80.json'), 'utf8'));
const S = new Map(strata.goals.map((g) => [g.goal, g]));

const ws = mkdtempSync(join(tmpdir(), 'route-'));
writeFileSync(join(ws, 'package.json'), JSON.stringify({ name: 'ws', version: '1.0.0', type: 'commonjs' }, null, 2), 'utf8');
for (const d of ['seed', 'seed60']) {
  for (const f of readdirSync(join(HERE, d))) {
    const p = join(HERE, d, f);
    if (statSync(p).isFile()) copyFileSync(p, join(ws, f));
  }
}

// Exactly the decision arm3.mjs makes.
function systemRoute(goal) {
  const c = deriveContract(GOALS[goal - 1]);
  const plan = planOperation(c, ws, GOALS[goal - 1]);
  if (plan.op === 'add_method' && plan.members && plan.members.length > 1) return 'multi_member_insertion';
  if (plan.op === 'content_edit' && plan.fallbackReason === 'MULTI_NAME_ABSENT') {
    const src = readFileSync(join(ws, c.lead), 'utf8');
    const missing = c.moduleExports.filter((n) => {
      const decl = c.lang === 'py' ? new RegExp('^def\\s+' + n + '\\s*\\(', 'm')
        : new RegExp('^function\\s+' + n + '\\s*\\(', 'm');
      return !decl.test(src);
    });
    if (missing.length > 1) return 'multi_member_insertion';
  }
  if (plan.op === 'content_edit' && plan.fallbackReason === 'BEHAVIORAL_DELTA_UNPROVEN'
      && regressionFor(c.lead) && c.moduleExports.length === 1
      && checkContract(ws, c.lead, c).ok) {
    const name = c.moduleExports[0];
    const src = readFileSync(join(ws, c.lead), 'utf8');
    const decl = c.lang === 'py'
      ? new RegExp('^def\\s+' + name + '\\s*\\(', 'm')
      : new RegExp('^function\\s+' + name + '\\s*\\(', 'm');
    if (decl.test(src)) return 'safe_behavioural_replacement';
  }
  return 'delegated_to_v2';
}

let match = 0;
const mismatch = [];
for (let g = 61; g <= 80; g++) {
  const route = systemRoute(g);
  const s = S.get(g);
  const expect = (s.v3_route === 'multi_member_insertion' || s.v3_route === 'safe_behavioural_replacement')
    ? s.v3_route : 'delegated_to_v2';
  if (route === expect) match++; else mismatch.push('[' + g + '] system=' + route + '  strata=' + expect);
  if (s.stratum !== 'V2_ALREADY_HANDLES') {
    console.log('  [' + g + '] ' + s.stratum.padEnd(34) + ' -> ' + route);
  }
}
console.log('');
console.log('  system route agrees with the preregistered label on ' + match + '/20 goals');
mismatch.forEach((m) => console.log('    MISMATCH ' + m));
process.exit(mismatch.length ? 1 : 0);
