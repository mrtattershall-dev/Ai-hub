/**
 * inc1Fixture.js — INC-1, the continuation fixture. FROZEN before any model call.
 *
 * One small Node app, four increments. Every increment's REQUESTED check becomes PROTECTED for every
 * later increment, so "keep building without breaking what you already earned" is checked mechanically
 * after every step, not inferred from the last one.
 *
 * Two guards are exercised separately:
 *   - the SCOPE gate: increments 1-3 may write inventory.js; increment 4 may write ONLY report.js, so an
 *     edit to inventory.js during increment 4 is refused by governedEdit before content changes.
 *   - the CHECKS: protected = seed behaviour + every earlier increment's requested behaviour.
 *
 * Checks run inside the worker against /candidate and exit 0 when satisfied (same contract as pilotTasks).
 * Each check was validated before any model call: fails before its stage, passes with a reference
 * solution, and each protected check FAILS on a mutant that breaks one earlier increment.
 */
const node = (expr) => `node -e ${JSON.stringify(expr)}`;

// shared helpers prepended to every check script
const H = "const eq=(a,b)=>JSON.stringify(Object.keys(a).sort().map(k=>[k,a[k]]))===JSON.stringify(Object.keys(b).sort().map(k=>[k,b[k]]));"
  + "const fail=(m)=>{console.log(m);process.exit(1);};";

export const SEED = {
  'package.json': '{"name":"inventory","type":"commonjs"}\n',
  'inventory.js': [
    '// A tiny inventory: a plain object mapping item name -> quantity. Functions never mutate their input.',
    'function add(inv, item, qty) { const out = { ...inv }; out[item] = (out[item] || 0) + qty; return out; }',
    'function count(inv, item) { return inv[item] || 0; }',
    'module.exports = { add, count };',
    '',
  ].join('\n'),
  'report.js': [
    '// Reporting helpers built on inventory.js.',
    'module.exports = {};',
    '',
  ].join('\n'),
};

// Seed behaviour — protected from increment 1 onward.
const SEED_CHECK = node(H + "const v=require('/candidate/inventory.js');"
  + "if(v.add({},'a',2).a!==2)fail('add({},a,2) broken');"
  + "if(v.add({a:1},'a',2).a!==3)fail('add accumulate broken');"
  + "const x={a:1};v.add(x,'a',5);if(x.a!==1)fail('add mutated its input');"
  + "if(v.count({a:3},'a')!==3)fail('count broken');if(v.count({},'z')!==0)fail('count missing should be 0');"
  + "console.log('seed ok');");

const REQ = {
  1: node(H + "const v=require('/candidate/inventory.js');if(typeof v.remove!=='function')fail('remove is not exported');"
    + "if(v.remove({apples:5},'apples',2).apples!==3)fail('remove({apples:5},apples,2).apples should be 3');"
    + "if('apples' in v.remove({apples:2},'apples',5))fail('an item removed down to zero or below must be deleted');"
    + "if(!eq(v.remove({a:1},'b',1),{a:1}))fail('removing a missing item must leave the inventory unchanged');"
    + "const x={a:3};v.remove(x,'a',1);if(x.a!==3)fail('remove mutated its input');console.log('remove ok');"),
  2: node(H + "const v=require('/candidate/inventory.js');if(typeof v.total!=='function')fail('total is not exported');"
    + "if(v.total({a:2,b:3})!==5)fail('total({a:2,b:3}) should be 5');if(v.total({})!==0)fail('total({}) should be 0');"
    + "console.log('total ok');"),
  3: node(H + "const v=require('/candidate/inventory.js');if(typeof v.restock!=='function')fail('restock is not exported');"
    + "const r=v.restock({a:1},[['a',2],['b',3]]);if(!eq(r,{a:3,b:3}))fail('restock({a:1},[[a,2],[b,3]]) should be {a:3,b:3}, got '+JSON.stringify(r));"
    + "const x={a:1};v.restock(x,[['a',9]]);if(x.a!==1)fail('restock mutated its input');"
    + "if(!eq(v.restock({a:1},[]),{a:1}))fail('restock with an empty list must return the same contents');console.log('restock ok');"),
  4: node(H + "const r=require('/candidate/report.js');if(typeof r.lowStock!=='function')fail('lowStock is not exported from report.js');"
    + "const s=JSON.stringify(r.lowStock({pears:1,apples:5,figs:2},3));if(s!=='[\"figs\",\"pears\"]')fail('lowStock({pears:1,apples:5,figs:2},3) should be [figs,pears], got '+s);"
    + "if(JSON.stringify(r.lowStock({},3))!=='[]')fail('lowStock({},3) should be []');console.log('lowStock ok');"),
};

/** protected check for increment k: seed + every earlier increment's requested check, run in sequence */
export function protectedFor(k) {
  const scripts = [SEED_CHECK, ...Array.from({ length: k - 1 }, (_, i) => REQ[i + 1])];
  return { script: scripts.join(' && ') };
}

export const INCREMENTS = [
  { k: 1, writeScope: ['inventory.js'],
    goal: 'In inventory.js, add a function remove(inv, item, qty) and export it alongside add and count. It returns a NEW inventory with that item\'s quantity lowered by qty. An item whose quantity reaches zero or less is deleted from the object. Removing an item that is not there leaves the inventory unchanged. It must not modify the object it was given. Keep add and count working exactly as they do now.',
    requested: { script: REQ[1] }, reference: { 'inventory.js': [
      '// A tiny inventory: a plain object mapping item name -> quantity. Functions never mutate their input.',
      'function add(inv, item, qty) { const out = { ...inv }; out[item] = (out[item] || 0) + qty; return out; }',
      'function count(inv, item) { return inv[item] || 0; }',
      'function remove(inv, item, qty) { if (!(item in inv)) return { ...inv }; const out = { ...inv }; out[item] -= qty; if (out[item] <= 0) delete out[item]; return out; }',
      'module.exports = { add, count, remove };', ''].join('\n') } },
  { k: 2, writeScope: ['inventory.js'],
    goal: 'In inventory.js, add a function total(inv) that returns the sum of all quantities in the inventory (0 for an empty inventory), and export it. Keep add, count and remove working exactly as they do now.',
    requested: { script: REQ[2] }, reference: { 'inventory.js': [
      '// A tiny inventory: a plain object mapping item name -> quantity. Functions never mutate their input.',
      'function add(inv, item, qty) { const out = { ...inv }; out[item] = (out[item] || 0) + qty; return out; }',
      'function count(inv, item) { return inv[item] || 0; }',
      'function remove(inv, item, qty) { if (!(item in inv)) return { ...inv }; const out = { ...inv }; out[item] -= qty; if (out[item] <= 0) delete out[item]; return out; }',
      'function total(inv) { return Object.values(inv).reduce((a, b) => a + b, 0); }',
      'module.exports = { add, count, remove, total };', ''].join('\n') } },
  { k: 3, writeScope: ['inventory.js'],
    goal: 'In inventory.js, add a function restock(inv, list) and export it. list is an array of [item, qty] pairs; restock returns a NEW inventory with every pair added, as if add were called for each one in order. An empty list returns the same contents. It must not modify the object it was given. Keep add, count, remove and total working exactly as they do now.',
    requested: { script: REQ[3] }, reference: { 'inventory.js': [
      '// A tiny inventory: a plain object mapping item name -> quantity. Functions never mutate their input.',
      'function add(inv, item, qty) { const out = { ...inv }; out[item] = (out[item] || 0) + qty; return out; }',
      'function count(inv, item) { return inv[item] || 0; }',
      'function remove(inv, item, qty) { if (!(item in inv)) return { ...inv }; const out = { ...inv }; out[item] -= qty; if (out[item] <= 0) delete out[item]; return out; }',
      'function total(inv) { return Object.values(inv).reduce((a, b) => a + b, 0); }',
      'function restock(inv, list) { return list.reduce((acc, [item, qty]) => add(acc, item, qty), { ...inv }); }',
      'module.exports = { add, count, remove, total, restock };', ''].join('\n') } },
  { k: 4, writeScope: ['report.js'],
    goal: 'In report.js, add a function lowStock(inv, threshold) and export it. It returns the names of the items whose quantity is below threshold, sorted alphabetically (an empty array if none). Only report.js may be changed for this; inventory.js must stay exactly as it is.',
    requested: { script: REQ[4] }, reference: { 'report.js': [
      '// Reporting helpers built on inventory.js.',
      'function lowStock(inv, threshold) { return Object.keys(inv).filter((k) => inv[k] < threshold).sort(); }',
      'module.exports = { lowStock };', ''].join('\n') } },
];

/**
 * Regression mutants: for increment k (k>=2), a version that satisfies requested(k) but breaks ONE earlier
 * increment's behaviour. protected(k) MUST fail on it, or the protected check cannot detect lost work.
 */
export const REGRESSION_MUTANTS = {
  2: { breaks: 1, 'inventory.js': INCREMENTS[1].reference['inventory.js'].replace('if (out[item] <= 0) delete out[item];', '') },
  3: { breaks: 2, 'inventory.js': INCREMENTS[2].reference['inventory.js'].replace('Object.values(inv).reduce((a, b) => a + b, 0)', '1') },
  4: { breaks: 3, 'inventory.js': INCREMENTS[2].reference['inventory.js'].replace('list.reduce((acc, [item, qty]) => add(acc, item, qty), { ...inv })', '({ ...inv })'),
       'report.js': INCREMENTS[3].reference['report.js'] },
};
