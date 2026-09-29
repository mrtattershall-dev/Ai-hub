'use strict';
// =============================================================================
// RD-035 — the UNCONDITIONAL-WRITE smell (author-time advisory) + the deftype
// FIELD-COUNT cap (from the RD-034 gate audit). Both born from the user's live
// session: (1) "a branchless conditional write is still an unconditional write"
// silently defeated "move left paddle down"; (2) the deftype audit found field
// count was an unbounded allocation. The gate now NAMES the first at author time
// and BOUNDS the second — neither is a rejection of a safe rule, both are the
// gate teaching instead of a raw deferral / an unbounded alloc.
//
//   node experiments/045_write_smell/write_smell_test.js
// =============================================================================
const path = require('path');
const CORE = (f) => require(path.join(__dirname, '..', '..', 'core', f));
const { Engine } = CORE('engine.js');
const { installRule, uninstallRule, writeSmells } = CORE('behavior.js');
const P = CORE('persistence.js');

let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };
const has = (warns, code) => (warns || []).some((w) => w.code === code);
const clamp = (e, lo, hi) => ({ min: [{ max: [e, lo] }, hi] });
const F = (f) => ({ field: f });

// a world with a non-fold position field (y), a signed driver, and a FOLD field.
function moverWorld() {
  const g = new Engine(256, { schemaDefs: [] });
  const d = g.defineType({ name: 'mover', spatial: { x: 'x', y: 'y' }, fields: {
    x: { range: [0, 255], init: 0 }, y: { range: [0, 255], init: 128 },
    input_dir: { range: [-1, 1], init: 0 },
    score: { range: [0, 255], init: 0, fold: 'additive' },   // FOLDABLE
  } });
  if (!d.ok) throw new Error('mover: ' + JSON.stringify(d.errors));
  return g;
}

// ---- 1) the buggy pattern: unguarded self-write to a non-fold field ----------
{
  const g = moverWorld();
  const buggy = { name: 'drive', match: { type: 'mover' },
    effects: [{ set: 'y', to: clamp({ add: [F('y'), { mul: [F('input_dir'), 4] }] }, 0, 255) }] };
  const r = installRule(g, buggy);
  ok(r.ok, 'the buggy rule still INSTALLS — the advisory never blocks a valid, safe rule');
  ok(has(r.warnings, 'unconditional_write'), 'unguarded self-write to non-fold y -> unconditional_write warning');
  const w = r.warnings.find((x) => x.code === 'unconditional_write');
  ok(/no where-guard/.test(w.detail) && /y/.test(w.detail) && /mover/.test(w.detail), 'warning names the field, the type, and the missing guard');
  ok(/DEFER/.test(w.detail), 'warning explains the consequence (concurrent writers DEFER)');
}

// ---- 2) the FIX: adding a where-guard clears the warning ----------------------
{
  const g = moverWorld();
  const fixed = { name: 'drive', match: { type: 'mover', where: { field: 'input_dir', cmp: '!=', value: 0 } },
    effects: [{ set: 'y', to: clamp({ add: [F('y'), { mul: [F('input_dir'), 4] }] }, 0, 255) }] };
  const r = installRule(g, fixed);
  ok(r.ok && !has(r.warnings, 'unconditional_write'), 'the SAME effect WITH a where-guard -> no unconditional_write (the guard is the fix)');
}

// ---- 3) a FOLDABLE field is exempt: concurrent writes merge, no silent stall --
{
  const g = moverWorld();
  const r = installRule(g, { name: 'tally', match: { type: 'mover' },
    effects: [{ set: 'score', to: { min: [{ add: [F('score'), 1] }, 255] } }] });
  ok(r.ok && !has(r.warnings, 'unconditional_write') && !has(r.warnings, 'contended_field'),
    'unguarded self-write to a FOLDABLE field (score, additive) -> NO warning (contention merges)');
}

// ---- 4) contended_field: two unguarded rules writing the same non-fold field --
{
  const g = moverWorld();
  const a = installRule(g, { name: 'pin_a', match: { type: 'mover' }, effects: [{ set: 'y', to: 100 }] });
  ok(a.ok && !has(a.warnings, 'contended_field'), 'first unguarded constant writer alone -> no contention warning yet');
  const b = installRule(g, { name: 'pin_b', match: { type: 'mover' }, effects: [{ set: 'y', to: 50 }] });
  ok(b.ok && has(b.warnings, 'contended_field'), 'a SECOND unguarded writer of the same non-fold field -> contended_field');
  ok(/pin_a/.test(b.warnings.find((w) => w.code === 'contended_field').detail), 'contended_field names the other writer (pin_a)');
}

// ---- 5) the REAL Pong ruleset: precise, low-noise -----------------------------
{
  const V2 = require(path.join(__dirname, '..', '042_pong', 'pong_rules_v2.js'));
  const { g } = V2.buildWorld();
  const flagged = [];
  for (const rule of V2.RULE_SET) {
    const r = installRule(g, rule);
    ok(r.ok, `pong rule '${rule.name}' installs`);
    if (has(r.warnings, 'unconditional_write')) flagged.push(rule.name);
  }
  ok(JSON.stringify(flagged) === JSON.stringify(['ball_move_y']),
    `unconditional_write fires on EXACTLY ball_move_y in the fixed ruleset (got: [${flagged.join(', ')}])`);
  ok(!flagged.includes('paddle_move'), 'the FIXED, guarded paddle_move is NOT flagged (its where-guard is the fix the user needed)');
}

// ---- 6) the buggy paddle_move (as it was in live play) WOULD have been flagged -
{
  const V2 = require(path.join(__dirname, '..', '042_pong', 'pong_rules_v2.js'));
  const { g } = V2.buildWorld();
  const buggyPaddle = { name: 'paddle_move', match: { type: 'paddle' },   // no where — the pre-fix shape
    effects: [{ set: 'y', to: clamp({ add: [F('y'), { mul: [F('input_dir'), 4] }] }, 0, 255) }] };
  const r = installRule(g, buggyPaddle);
  ok(r.ok && has(r.warnings, 'unconditional_write'),
    'the ORIGINAL unguarded paddle_move would have been flagged at author time — the bug caught before a human ever plays');
}

// ---- 7) deftype FIELD-COUNT cap (from the audit's resource SMELL) -------------
{
  const g = new Engine(64, { schemaDefs: [] });
  const before = JSON.stringify(P.save(g));
  const big = {}; for (let i = 0; i < 65; i++) big['f' + i] = { range: [0, 10], init: 0 };
  const rb = g.defineType({ name: 'big', fields: big });
  ok(!rb.ok && rb.errors.some((e) => e.code === 'field_budget'), '65 fields -> rejected with field_budget');
  ok(JSON.stringify(P.save(g)) === before, 'the over-budget rejection leaves the world byte-identical (validate-before-execute holds)');
  const ok64 = {}; for (let i = 0; i < 64; i++) ok64['f' + i] = { range: [0, 10], init: 0 };
  ok(g.defineType({ name: 'okk', fields: ok64 }).ok, '64 fields -> accepted (generous cap, far above any real entity)');
}

// ---- 8) writeSmells is a pure function (no engine mutation) --------------------
{
  const g = moverWorld();
  const before = JSON.stringify(P.save(g));
  writeSmells(g, { name: 'probe', match: { type: 'mover' }, effects: [{ set: 'y', to: F('y') }] });
  ok(JSON.stringify(P.save(g)) === before, 'writeSmells never mutates the engine');
}

console.log(`\n${FAIL ? 'FAIL' : 'ALL PASS'} — ${PASS} passed, ${FAIL} failed`);
process.exit(FAIL ? 1 : 0);
