'use strict';
// =============================================================================
// RD-B3 (part 1, deterministic): BEHAVIOR CONFLICT FALLS OUT OF RD-005.
// An installed rule is just another actor. A rule contesting a field with a
// player — or with another rule — resolves by the SAME fold/defer policy as
// two players, with NO new machinery. Crop #142 with one side authored by AI.
// `node experiments/027_behavior_live/behavior_conflict.js`
// =============================================================================
const path = require('node:path');
const CORE = (f) => require(path.join(__dirname, '..', '..', 'core', f));
const { Engine, TYPE } = CORE('engine.js');
const { installRule } = CORE('behavior.js');

let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function build() {
  const g = new Engine(64);
  const zone = g.spawn(TYPE.ZONE, { name: 'field' }).uuid;
  const crop = g.spawn(TYPE.CROP, { name: 'Crop142', parent: zone, water: 10, growth: 20 }).uuid;
  return { g, zone, crop };
}

console.log('=== RD-B3: rule-vs-player conflict inherits RD-005 (no new machinery) ===\n');

// --- C1 FOLD: an irrigator RULE and a PLAYER water the same crop, same tick --
{
  const S = build();
  ok(installRule(S.g, { name: 'irrigate', match: { type: 'crop', where: { field: 'water', cmp: '<', value: 50 } },
    effects: [{ set: 'water', to: 40 }] }).ok, 'C1 irrigator rule installs');
  const rs = S.g.stepTick([{ actor: 'playerB', ops: [{ kind: 'setfield', target: S.crop, field: 'water', value: 25 }] }]);
  const P2 = build();
  const rp = P2.g.submit([
    { actor: 'playerA', ops: [{ kind: 'setfield', target: P2.crop, field: 'water', value: 40 }] },
    { actor: 'playerB', ops: [{ kind: 'setfield', target: P2.crop, field: 'water', value: 25 }] },
  ]);
  const sv = S.g._field(S.g.w.liveEntity(S.crop), 'water');
  const pv = P2.g._field(P2.g.w.liveEntity(P2.crop), 'water');
  ok(rs.results.every(x => x.status === 'committed'), 'C1 rule tx AND player tx both committed (lossless)');
  ok(sv === 40 && sv === pv, `C1 rule-vs-player folds to max=40, IDENTICAL to player-vs-player (${sv}===${pv})`);
}

// --- C2 DEFER: a labeler RULE and a PLAYER contest `name` (label semantics) --
{
  const S = build();
  const before = S.g.w.name[S.g.w.liveEntity(S.crop)];
  ok(installRule(S.g, { name: 'labeler', match: { type: 'crop' },
    effects: [{ set: 'name', to: 'rule-label' }] }).ok, 'C2 labeler rule installs (name = string constant)');
  const rs = S.g.stepTick([{ actor: 'playerB', ops: [{ kind: 'setfield', target: S.crop, field: 'name', value: 'player-label' }] }]);
  ok(rs.deferrals.length === 1 && rs.deferrals[0].field === 'name',
    'C2 rule-vs-player name clash DEFERRED — surfaced for the author, no arbitration');
  ok(S.g.w.name[S.g.w.liveEntity(S.crop)] === before, 'C2 written by NEITHER side (no LWW between AI and human)');
}

// --- C3 DEFER rule-vs-RULE: two AI-authored rules contest one label ----------
{
  const S = build();
  installRule(S.g, { name: 'labelA', match: { type: 'crop' }, effects: [{ set: 'name', to: 'A' }] });
  installRule(S.g, { name: 'labelB', match: { type: 'crop' }, effects: [{ set: 'name', to: 'B' }] });
  const rs = S.g.stepTick();
  ok(rs.deferrals.length === 1 && rs.deferrals[0].competing.length === 2,
    'C3 two RULES contesting a label defer exactly like two players — AI-vs-AI conflict needs no special case');
}

// --- C4 UNDO: a mixed tick (rule + player) reverses as ONE step --------------
{
  const S = build();
  S.g.enableHistory();
  installRule(S.g, { name: 'grow', match: { type: 'crop', where: { field: 'water', cmp: '>', value: 0 } },
    effects: [{ set: 'growth', to: { min: [{ add: [{ field: 'growth' }, 5] }, 255] } }] });
  const w0 = S.g._field(S.g.w.liveEntity(S.crop), 'water'), g0 = S.g._field(S.g.w.liveEntity(S.crop), 'growth');
  S.g.stepTick([{ actor: 'player', ops: [{ kind: 'setfield', target: S.crop, field: 'water', value: 99 }] }]);
  ok(S.g._field(S.g.w.liveEntity(S.crop), 'growth') === g0 + 5, 'C4 tick applied rule + player edits');
  S.g.undo();
  ok(S.g._field(S.g.w.liveEntity(S.crop), 'water') === w0 && S.g._field(S.g.w.liveEntity(S.crop), 'growth') === g0,
    'C4 ONE undo reverses the whole mixed tick (AI behavior + human edit together)');
}

console.log(`\n${FAIL === 0 ? 'ALL PASS' : 'FAILURES'} — ${PASS} passed, ${FAIL} failed`);
process.exit(FAIL ? 1 : 0);
