// FIXTURES FOR MULTI_MEMBER_LOCALIZED_INSERTION.
//
// FIM is injected, so these run deterministically with no model. That matters: the properties under
// test are about ORDERING, BASELINING and ROLLBACK, and a stochastic generator would make failures
// ambiguous.
//
// The load-bearing case is the DESIGN TRAP: insertion 2 must be audited against source_1, not
// source_0. A stale baseline makes the second insertion look like it deleted the first.
import { insertMembers } from './multiInsert.mjs';
import { deriveContract } from './contract.mjs';
import { checkContract } from './contractCheck.mjs';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HERE = new URL('.', import.meta.url).pathname.replace(/^\//, '');
const SEED = join(HERE, 'seed');
const GOALS = JSON.parse(readFileSync('C:/Users/tatte/Projects/ai-coding-hub-indent/measurements/2026-09-12-setH/goals-H.json', 'utf8'));

let pass = 0;
let fail = 0;
const t = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '   ' + detail : '')); }
};

const mkws = () => {
  const ws = mkdtempSync(join(tmpdir(), 'multi-'));
  writeFileSync(join(ws, 'package.json'), JSON.stringify({ name: 'ws', version: '1.0.0', type: 'commonjs' }, null, 2), 'utf8');
  for (const f of readdirSync(SEED)) {
    const p = join(SEED, f);
    if (statSync(p).isFile()) copyFileSync(p, join(ws, f));
  }
  return ws;
};

// A scripted FIM: returns the body for whichever member the prefix is currently opening.
const scripted = (bodies) => async (prefix) => {
  const m = String(prefix).match(/\n  ([A-Za-z_$][\w$]*)\($/);
  const name = m ? m[1] : null;
  if (!name || !(name in bodies)) return '';
  return bodies[name];
};

console.log('  GOAL 41 - the real v2 failure: Library.dueDay + Library.overdue\n');
{
  const ws = mkws();
  const c = deriveContract(GOALS[40]);   // goal 41
  const before = readFileSync(join(ws, c.lead), 'utf8');
  const r = await insertMembers({
    ws, contract: c, owner: 'Library', members: ['dueDay', 'overdue'],
    fimFn: scripted({
      dueDay: 'isbn, member) {\n    return 14;\n  }',
      overdue: 'day = 0) {\n    return [];\n  }',
    }),
  });
  t('both members inserted', r.ok === true && r.members_inserted === 2, r.why);
  t('two sequential steps recorded', r.steps.length === 2 && r.steps.every((s) => s.ok));
  t('NOTHING was deleted at either step', r.steps.every((s) => s.deleted_bytes === 0),
    JSON.stringify(r.steps.map((s) => s.deleted_bytes)));
  t('insertion 2 was baselined on the POST-INSERTION-1 source',
    r.steps[1].baseline_bytes > r.steps[0].baseline_bytes,
    'baselines ' + JSON.stringify(r.steps.map((s) => s.baseline_bytes)));
  const src = readFileSync(join(ws, c.lead), 'utf8');
  t('both members are present in the final artifact',
    /\n  dueDay\(/.test(src) && /\n  overdue\(/.test(src));
  t('the goal-41 contract now passes', checkContract(ws, c.lead, c).ok === true);
  // every prior goal on this file must still hold
  for (const g of [1, 11, 21, 31]) {
    const cc = deriveContract(GOALS[g - 1]);
    t('goal ' + g + ' still passes after the two insertions', checkContract(ws, cc.lead, cc).ok === true);
  }
}

console.log('\n  GOAL 51 - the other real v2 failure: Library.fines + Library.pay\n');
{
  const ws = mkws();
  const c = deriveContract(GOALS[50]);
  const r = await insertMembers({
    ws, contract: c, owner: 'Library', members: ['fines', 'pay'],
    fimFn: scripted({
      fines: 'member) {\n    return 0;\n  }',
      pay: 'member, cents) {\n    if (cents <= 0) throw new Error("bad amount");\n    return 0;\n  }',
    }),
  });
  t('both members inserted', r.ok === true, r.why);
  t('the goal-51 contract now passes', checkContract(ws, c.lead, c).ok === true);
}

console.log('\n  THREE members, to prove the loop is not hard-wired for two\n');
{
  const ws = mkws();
  const c = deriveContract(GOALS[40]);
  const r = await insertMembers({
    ws, contract: { ...c, members: ['a1', 'a2', 'a3'].map((n) => ({ owner: 'Library', kind: 'instance_method', name: n })) },
    owner: 'Library', members: ['a1', 'a2', 'a3'],
    fimFn: scripted({ a1: ') { return 1; }', a2: ') { return 2; }', a3: ') { return 3; }' }),
  });
  t('three members inserted in order', r.ok === true && r.steps.length === 3, r.why);
  t('each baseline grew monotonically',
    r.steps[0].baseline_bytes < r.steps[1].baseline_bytes && r.steps[1].baseline_bytes < r.steps[2].baseline_bytes,
    JSON.stringify(r.steps.map((s) => s.baseline_bytes)));
  const src = readFileSync(join(ws, c.lead), 'utf8');
  t('all three survive together', /\n  a1\(/.test(src) && /\n  a2\(/.test(src) && /\n  a3\(/.test(src));
}

console.log('\n  ROLLBACK - a later failure must not leave a partial artifact\n');
{
  const ws = mkws();
  const c = deriveContract(GOALS[40]);
  const original = readFileSync(join(ws, c.lead), 'utf8');
  const r = await insertMembers({
    ws, contract: c, owner: 'Library', members: ['dueDay', 'overdue'],
    fimFn: scripted({ dueDay: 'isbn) {\n    return 14;\n  }' }),   // 'overdue' returns ''
  });
  t('the goal FAILS when insertion 2 produces nothing', r.ok === false, 'it reported success');
  t('it reports rolled_back', r.rolled_back === true);
  const after = readFileSync(join(ws, c.lead), 'utf8');
  t('the artifact is byte-identical to the original', after === original,
    'file was left modified, ' + after.length + ' vs ' + original.length);
  t('the FIRST insertion was also undone', !/\n  dueDay\(/.test(after));
  for (const g of [1, 11, 21, 31]) {
    const cc = deriveContract(GOALS[g - 1]);
    t('goal ' + g + ' unaffected by the rolled-back attempt', checkContract(ws, cc.lead, cc).ok === true);
  }
}
{
  const ws = mkws();
  const c = deriveContract(GOALS[40]);
  const original = readFileSync(join(ws, c.lead), 'utf8');
  const r = await insertMembers({
    ws, contract: c, owner: 'Library', members: ['m1', 'm2', 'm3'],
    fimFn: scripted({ m1: ') { return 1; }', m2: ') { return 2; }' }),   // third fails
  });
  t('a THIRD-step failure also rolls the whole goal back', r.ok === false && r.rolled_back === true);
  t('two successful insertions are still undone', readFileSync(join(ws, c.lead), 'utf8') === original);
}
{
  // A syntactically broken insertion must be caught by the intermediate load check.
  const ws = mkws();
  const c = deriveContract(GOALS[40]);
  const original = readFileSync(join(ws, c.lead), 'utf8');
  const r = await insertMembers({
    ws, contract: c, owner: 'Library', members: ['dueDay', 'overdue'],
    fimFn: scripted({ dueDay: 'isbn) {\n    return 14;\n  }', overdue: 'x) { return [ ;;; }' }),
  });
  t('an insertion that breaks the file is rejected', r.ok === false, r.why);
  t('and the whole goal rolls back', readFileSync(join(ws, c.lead), 'utf8') === original);
  console.log('       why: ' + String(r.why).slice(0, 96));
}

console.log('\n  REFUSALS\n');
{
  const ws = mkws();
  const c = deriveContract(GOALS[40]);
  const r = await insertMembers({
    ws, contract: c, owner: 'Library', members: ['copies'],   // already exists in the seed
    fimFn: scripted({ copies: 'isbn) { return 0; }' }),
  });
  t('REFUSES to insert a member that already exists', r.ok === false, 'it inserted a duplicate');
  console.log('       why: ' + String(r.why).slice(0, 96));
}
{
  const ws = mkws();
  const c = deriveContract(GOALS[40]);
  const original = readFileSync(join(ws, c.lead), 'utf8');
  writeFileSync(join(ws, c.lead), original + '\nclass Library {}\n', 'utf8');
  const r = await insertMembers({
    ws, contract: c, owner: 'Library', members: ['dueDay'],
    fimFn: scripted({ dueDay: 'isbn) { return 14; }' }),
  });
  t('REFUSES an ambiguous (duplicated) owner', r.ok === false, 'it picked one');
  console.log('       why: ' + String(r.why).slice(0, 96));
}
{
  const ws = mkws();
  const c = deriveContract(GOALS[40]);
  const r = await insertMembers({
    ws, contract: c, owner: 'Nonexistent', members: ['x'],
    fimFn: scripted({ x: ') { return 1; }' }),
  });
  t('REFUSES an owner that is not present', r.ok === false);
}

console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
