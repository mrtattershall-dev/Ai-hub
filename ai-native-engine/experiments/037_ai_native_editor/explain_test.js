'use strict';
// =============================================================================
// 037 — explain.js under test. Style of core/protocol_test.js: plain asserts,
// zero deps, non-zero exit on failure. `node explain_test.js`.
// explain.js is PURE; only this test requires core modules — the deliberately
// bad rules go through the REAL gate (installRule) so the error-shape
// assumption {rule,where,code,detail} is pinned to reality, and the reason
// strings come from the REAL pipeline where possible.
// =============================================================================
const path = require('node:path');
const { explainRule, explainErrors, explainReason } = require('./explain.js');
const CORE = (f) => require(path.join(__dirname, '..', '..', 'core', f));
const { Engine, TYPE } = CORE('engine.js');
const { installRule } = CORE('behavior.js');
const { oracleRules } = require(path.join(__dirname, '..', '034_homestead_game', 'homestead.js'));

let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };

console.log('=== 037 explain: rules and rejections in plain English ===\n');

// ---- 1. all five oracle rules render as brace-free sentences ----------------
console.log('--- oracle rules ---');
const rendered = {};
for (const r of oracleRules()) {
  const s = explainRule(r);
  rendered[r.name] = s;
  console.log(`  ${s}`);
  ok(typeof s === 'string' && s.length > 0, `${r.name}: renders a string`);
  ok(s.includes(r.name), `${r.name}: names itself`);
  ok(!/[{}]/.test(s), `${r.name}: contains no raw JSON braces`);
  ok(/\.$/.test(s.trim()), `${r.name}: reads as a sentence (ends with '.')`);
}

// register spot-checks: the idioms, not just any prose
ok(/gains 5 growth/.test(rendered.grow), 'grow: add renders as "gains"');
ok(/water above 0/.test(rendered.grow), 'grow: where > renders as "above"');
ok(/loses 1 water/.test(rendered.drain), 'drain: sub renders as "loses"');
ok(/harvested/.test(rendered.reap), 'reap: delete renders as harvested/removed');
ok(/growth at least 100/.test(rendered.reap), 'reap: where >= renders as "at least"');
ok(/the number of crops with growth at least 100/.test(rendered.score), 'score: count renders as "the number of ..."');
ok(/every 3 ticks/.test(rendered.reseed), 'reseed: every renders as "every 3 ticks"');
ok(/plants a new crop named 'seed'/.test(rendered.reseed), 'reseed: spawn renders as "plants a new crop named ..."');
ok(/at most 1 per tick/.test(rendered.reseed), 'reseed: spawn cap renders as "at most 1 per tick"');

// ---- 2. clamps: mentioned when present, absent when not ---------------------
console.log('\n--- clamps ---');
ok(/capped at 255/.test(rendered.grow), 'grow (min-clamped): mentions the cap');
ok(/never below 0/.test(rendered.drain), 'drain (max-clamped): mentions the floor');
const unclamped = { name: 'grow2', match: { type: 'crop' },
  effects: [{ set: 'growth', to: { add: [{ field: 'growth' }, 5] } }] };
const su = explainRule(unclamped);
ok(!/capped|never below/.test(su), 'same rule without the clamp does not mention a cap');
ok(/gains 5 growth/.test(su), 'unclamped rule still renders the gain idiomatically');

// ---- 3. the REAL gate: bad rules -> real error objects -> sentences ---------
console.log('\n--- gate rejections (real installRule errors) ---');
const engine = new Engine(64);
engine.spawn(TYPE.ZONE, { name: 'field', tally: 0 });

function rejectAndExplain(rule, label, mustMatch) {
  const res = installRule(engine, rule);
  ok(!res.ok && Array.isArray(res.errors), `${label}: the real gate rejects it`);
  const msg = explainErrors(res.errors);
  console.log(`  ${label} -> ${msg.split('\n')[0]}`);
  ok(typeof msg === 'string' && !/[{}]/.test(msg), `${label}: explanation is brace-free`);
  ok(/\./.test(msg), `${label}: explanation reads as sentence(s)`);
  ok(mustMatch.test(msg), `${label}: explanation says why (${mustMatch})`);
  return res;
}

rejectAndExplain(
  { name: 'cheat', match: { type: 'crop' }, effects: [{ set: 'growth', to: { add: [{ field: 'growth' }, 5] } }] },
  'unclamped growth (range_unprovable)', /clamp/);
rejectAndExplain(
  { name: 'flood', match: { type: 'zone' }, effects: [{ spawn: { type: 'crop', props: { name: 'x' } } }] },
  'spawn with no cap (spawn_cap_required)', /cap/);
rejectAndExplain(
  { name: 'dragonize', match: { type: 'dragon' }, effects: [{ delete: true }] },
  'unknown entity type (unknown_type)', /dragon/);
rejectAndExplain(
  { name: 'squint', match: { type: 'crop', where: { field: 'water', cmp: '~', value: 1 } }, effects: [{ delete: true }] },
  'unknown comparison (bad_cmp)', /comparison/);
rejectAndExplain(
  { name: 'confused', match: { type: 'crop' }, effects: [{ set: 'hp', to: 5 }] },
  'field of another type (field_not_owned)', /different kind/);
rejectAndExplain(
  { match: { type: 'crop' } },
  'nameless, effectless rule (missing_name + no_effects)', /no name/);

// duplicate_name: its gate detail contains literal braces ("{replace:true}") —
// the explainer must still emit brace-free prose.
ok(installRule(engine, oracleRules()[0]).ok, 'a good rule installs (fixture sanity)');
const dup = installRule(engine, oracleRules()[0]);
ok(!dup.ok && dup.errors[0].code === 'duplicate_name', 'installing it again is a duplicate_name rejection');
const dupMsg = explainErrors(dup.errors);
ok(!/[{}]/.test(dupMsg) && /already installed/.test(dupMsg), 'duplicate_name explanation is brace-free prose');

// unknown code: verbatim fallback, exactly as specified
ok(explainErrors([{ where: 'x', code: 'weird_code', detail: 'd' }]) === '[x] weird_code: d',
  'unknown error code falls back to "[where] code: detail" verbatim');
ok(typeof explainErrors([]) === 'string' && typeof explainErrors(null) === 'string',
  'explainErrors never returns undefined, even on empty/absent input');

// ---- 4. pipeline reasons: real families + passthrough ------------------------
console.log('\n--- pipeline reasons ---');
const g2 = new Engine(4);
const c = g2.spawn(TYPE.CROP, { name: 'a', water: 1, growth: 0 }).uuid;

// real family 1: validate: target ... (hallucinated uuid)
let r = g2.submit([{ actor: 't', ops: [{ kind: 'setfield', target: 'u-ghost', field: 'water', value: 1 }] }]);
const reason1 = r.results[0].reasons[0];
ok(/^validate: target/.test(reason1), `real engine emitted: "${reason1}"`);
const e1 = explainReason(reason1);
ok(e1 !== reason1 && !/^validate:/.test(e1) && /u-ghost/.test(e1),
  `missing-target reason rewritten: "${e1}"`);

// real family 2: validate: cannot write ... of a destroyed object
// (delete schedules before setfield within one batch)
r = g2.submit([
  { actor: 'a', ops: [{ kind: 'delete', target: c }] },
  { actor: 'b', ops: [{ kind: 'setfield', target: c, field: 'water', value: 2 }] }]);
const reason2 = r.results[1].reasons[0];
ok(/destroyed object/.test(reason2), `real engine emitted: "${reason2}"`);
const e2 = explainReason(reason2);
ok(e2 !== reason2 && /already gone/.test(e2), `destroyed-write reason rewritten: "${e2}"`);

// real family 3: range: ... outside integer range
const c2 = g2.spawn(TYPE.CROP, { name: 'b', water: 1, growth: 0 }).uuid;
r = g2.submit([{ actor: 't', ops: [{ kind: 'setfield', target: c2, field: 'water', value: 999 }] }]);
const reason3 = r.results[0].reasons[0];
ok(/^range:/.test(reason3), `real engine emitted: "${reason3}"`);
const e3 = explainReason(reason3);
ok(e3 !== reason3 && /999/.test(e3) && /255/.test(e3), `range reason rewritten: "${e3}"`);

// real family 4: validate: world full (capacity N)
const g3 = new Engine(1);
const z3 = g3.spawn(TYPE.ZONE, { name: 'z', tally: 0 }).uuid;
r = g3.submit([{ actor: 't', ops: [{ kind: 'createChild', type: TYPE.CROP, parent: z3, props: {} }] }]);
const reason4 = r.results[0].reasons[0];
ok(/world full/.test(reason4), `real engine emitted: "${reason4}"`);
const e4 = explainReason(reason4);
ok(e4 !== reason4 && /full/.test(e4) && /1/.test(e4), `world-full reason rewritten: "${e4}"`);

// further families via literal strings taken from engine.js templates
const claim = explainReason('claim: u7 held by ai:pest until tick 12');
ok(/ai:pest/.test(claim) && !/^claim:/.test(claim), 'claim-held reason rewritten in plain words');
const budget = explainReason('budget: 40 ops exceeds per-tx budget 16 — rejected whole, not truncated');
ok(/40/.test(budget) && !/^budget:/.test(budget), 'per-tx budget reason rewritten');
const contract = explainReason('contract: assert failed: water <= 80');
ok(/goal/.test(contract) && !/^contract:/.test(contract), 'contract reason rewritten');
const deferred = explainReason('deferred: name of u3 contested (label) — held for author resolution, not auto-picked');
ok(/at the same time/.test(deferred), 'deferred-conflict reason rewritten');

// passthrough: unknown strings come back unchanged
const novel = 'something the engine has never said before';
ok(explainReason(novel) === novel, 'unknown reason passes through unchanged');
ok(typeof explainReason(undefined) === 'string', 'non-string reason still yields a string');

// ---- 5. weird-but-valid nested expression ------------------------------------
console.log('\n--- weird expressions ---');
const weird = { name: 'weird', match: { type: 'crop' }, effects: [{ set: 'water',
  to: { min: [{ max: [{ add: [{ field: 'water' }, { sub: [3, { field: 'growth' }] }] }, 0] }, 255] } }] };
const sw = explainRule(weird);
console.log(`  ${sw}`);
ok(typeof sw === 'string' && sw.includes('weird'), 'weird nested rule renders without throwing');
ok(!/[{}]/.test(sw) && /\.$/.test(sw.trim()), 'weird render is a brace-free sentence');
ok(/capped at 255/.test(sw) && /never below 0/.test(sw), 'both clamps of the nested expr are surfaced');
ok(installRule(engine, weird).ok, 'the weird rule is genuinely valid (the real gate installs it)');

// alien expression: compositional fallback, never a throw, never raw JSON
const alien = { name: 'alien', match: { type: 'crop' }, effects: [{ set: 'water', to: { frobnicate: [1, 2] } }] };
const sa = explainRule(alien);
console.log(`  ${sa}`);
ok(typeof sa === 'string' && sa.includes('alien') && !/[{}]/.test(sa), 'unknown expr falls back to readable, brace-free text');

// bare/degenerate inputs: always SOMETHING for any object with a name
const bare = explainRule({ name: 'bare' });
ok(typeof bare === 'string' && bare.includes('bare') && /\.$/.test(bare.trim()), 'effectless object still explains itself');
ok(typeof explainRule(null) === 'string' && typeof explainRule('not json {') === 'string',
  'null and malformed-JSON inputs still yield strings');

// name-set + uuid targeting render idiomatically
const label = explainRule({ name: 'label', match: { type: 'crop', uuid: 'u-c1' }, effects: [{ set: 'name', to: 'prize' }] });
ok(/renamed to 'prize'/.test(label) && /the crop 'u-c1'/.test(label), 'rename + uuid-scoped match render in plain words');

// RD-B7 scoped sum aggregation (the hard score rule's shape)
const hard = explainRule({ name: 'scorehard', match: { type: 'zone' },
  effects: [{ set: 'tally', to: { min: [{ add: [{ field: 'tally' },
    { sum: { field: 'growth', type: 'crop', where: { field: 'growth', cmp: '>=', value: 100 }, of: 'children' } }] }, 4294967295] } }] });
console.log(`  ${hard}`);
ok(/the total growth of crops/.test(hard) && /among its children/.test(hard) && !/[{}]/.test(hard),
  'RD-B7 scoped sum renders as "the total growth of crops ... among its children"');

console.log(`\n=============================================`);
console.log(`${FAIL === 0 ? 'ALL PASS' : FAIL + ' FAILED'}  (${PASS} passed, ${FAIL} failed) — rule -> English explainer`);
console.log(`=============================================`);
if (FAIL) process.exitCode = 1;
