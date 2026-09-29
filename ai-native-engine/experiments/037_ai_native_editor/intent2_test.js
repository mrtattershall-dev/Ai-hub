'use strict';
// =============================================================================
// 037 — INTENT2 tests. Pure fixtures, zero deps, intent_test.js conventions:
// plain asserts via ok(), prints every case, PASS count, non-zero exit on any
// failure. `node experiments/037_ai_native_editor/intent2_test.js`
//
// Two fixtures with DELIBERATELY different type/field names than the real
// games (slider/orb with px/py/dx/dy; hero/mob/bolt/lair with hx/hy/hp/life/
// brood) — the parser must derive everything from schemaDefs, and a source
// audit below asserts intent2.js itself contains no game nouns.
// =============================================================================
const fs = require('fs');
const path = require('path');
const { parse } = require('./intent2.js');

let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };

// Pong-like: 2 spatial types; orb has SIGNED field ranges dx/dy [-8,8].
// The entity literally named 'left paddle' reproduces the live-play failure.
function pongSnap() {
  return {
    tick: 10, you: 'grace',
    schemaDefs: [
      { name: 'slider', spatial: { x: 'px', y: 'py' },
        fields: { px: { range: [0, 255], init: 0 }, py: { range: [0, 240], init: 120 }, side: { range: [0, 1], init: 0 } } },
      { name: 'orb', spatial: { x: 'px', y: 'py' },
        fields: { px: { range: [0, 255] }, py: { range: [0, 240] }, dx: { range: [-8, 8] }, dy: { range: [-8, 8] } } },
    ],
    entities: [
      { uuid: 'u-left',  type: 'slider', name: 'left paddle',  parent: null, fields: { px: 8,   py: 128, side: 0 } },
      { uuid: 'u-right', type: 'slider', name: 'right paddle', parent: null, fields: { px: 247, py: 128, side: 1 } },
      { uuid: 'u-orb',   type: 'orb',    name: 'zippy',        parent: null, fields: { px: 128, py: 4, dx: -8, dy: 1 } },
    ],
    claims: [],
  };
}

// Shooter-like: 4 types, one of them ('lair') NON-spatial.
function shooterSnap() {
  return {
    tick: 99, you: 'grace',
    schemaDefs: [
      { name: 'hero', spatial: { x: 'hx', y: 'hy' },
        fields: { hx: { range: [0, 255] }, hy: { range: [0, 255] }, hp: { range: [0, 100] } } },
      { name: 'mob', spatial: { x: 'hx', y: 'hy' },
        fields: { hx: { range: [0, 255] }, hy: { range: [0, 255] }, hp: { range: [0, 100] } } },
      { name: 'bolt', spatial: { x: 'hx', y: 'hy' },
        fields: { hx: { range: [0, 255] }, hy: { range: [0, 255] }, life: { range: [0, 60] } } },
      { name: 'lair', fields: { brood: { range: [0, 10] } } },
    ],
    entities: [
      { uuid: 's-hero', type: 'hero', name: 'ace',   parent: null, fields: { hx: 128, hy: 128, hp: 50 } },
      { uuid: 's-m1',   type: 'mob',  name: 'mob 1', parent: null, fields: { hx: 40,  hy: 40,  hp: 90 } },
      { uuid: 's-m2',   type: 'mob',  name: 'mob 2', parent: null, fields: { hx: 210, hy: 60,  hp: 30 } },
      { uuid: 's-m3',   type: 'mob',  name: 'mob 3', parent: null, fields: { hx: 60,  hy: 200, hp: 60 } },
      { uuid: 's-pit',  type: 'lair', name: 'pit',   parent: null, fields: { brood: 3 } },
      { uuid: 's-b1',   type: 'bolt', name: 'bolt 1', parent: null, fields: { hx: 0, hy: 0, life: 0 } },
    ],
    claims: [],
  };
}

// ---- purity: parse must not mutate the snapshot -------------------------------
{
  const s0 = pongSnap(); const before = JSON.stringify(s0);
  parse(s0, 'move left paddle down'); parse(s0, "set zippy's dx to 99"); parse(s0, 'delete zippy');
  parse(s0, 'select the orb'); parse(s0, 'what types are there'); parse(s0, 'rename zippy to Q');
  ok(JSON.stringify(s0) === before, 'purity: pong snapshot unchanged after parses');
  const s1 = shooterSnap(); const b1 = JSON.stringify(s1);
  parse(s1, 'move pit up'); parse(s1, 'spawn a mob named g at 4,5'); parse(s1, 'who has the most hp');
  ok(JSON.stringify(s1) === b1, 'purity: shooter snapshot unchanged after parses');
}

// ---- move: THE live-play failure case, verbatim --------------------------------
{
  const r = parse(pongSnap(), 'move left paddle down');
  ok(r.kind === 'ops' && r.ops.length === 1, "'move left paddle down' -> 1 op (the 2026-07-16 live failure)");
  ok(r.ops[0].kind === 'setfield' && r.ops[0].target === 'u-left' && r.ops[0].field === 'py' && r.ops[0].value === 136,
    'down -> +8 on the spatial y field (py 128 -> 136)');
  ok(/left paddle/.test(r.say) && /128/.test(r.say) && /136/.test(r.say), 'move say shows the name and old -> new');
  ok(!/u-left/.test(r.say), 'move say contains no bare uuid');
}
{
  const r = parse(pongSnap(), 'move left paddle up');
  ok(r.kind === 'ops' && r.ops[0].field === 'py' && r.ops[0].value === 120, 'up DECREASES y (screen convention)');
}
{
  const r = parse(pongSnap(), 'move zippy left');
  ok(r.kind === 'ops' && r.ops[0].field === 'px' && r.ops[0].value === 120, 'left decreases x (px 128 -> 120)');
}
{
  const r = parse(pongSnap(), 'move zippy right by 20');
  ok(r.kind === 'ops' && r.ops[0].field === 'px' && r.ops[0].value === 148, "'by 20' overrides the default step of 8");
}
{
  const r = parse(pongSnap(), 'move left paddle down by 999');
  ok(r.kind === 'ops' && r.ops[0].value === 240, 'move clamps at the range TOP (py hi = 240)');
  ok(/clamp/i.test(r.say), 'top-clamp is admitted in say');
}
{
  const r = parse(pongSnap(), 'move zippy up by 100');
  ok(r.kind === 'ops' && r.ops[0].field === 'py' && r.ops[0].value === 0, 'move clamps at the range BOTTOM (py 4 - 100 -> 0)');
}
{
  const r = parse(shooterSnap(), 'move pit up');
  ok(r.kind === 'error' && /lair/.test(r.say) && /coordinat/i.test(r.say),
    'moving a non-spatial type -> error naming the type and the missing coordinates');
}
ok(parse(pongSnap(), 'MOVE LEFT PADDLE DOWN').kind === 'ops', 'case-insensitive verb + noun');
ok(parse(pongSnap(), 'please move left paddle down').kind === 'ops', 'politeness prefix stripped');
ok(parse(shooterSnap(), 'move mob 2 down').ops[0].target === 's-m2', 'numbers inside names resolve exactly');

// ---- noun resolution: bare type unique vs ambiguous ------------------------------
{
  const r = parse(shooterSnap(), 'move the mob down');
  ok(r.kind === 'clarify' && r.options.length === 3, 'bare type with 3 instances -> clarify');
  ok(r.options.includes('s-m1') && r.options.includes('s-m2') && r.options.includes('s-m3'), 'clarify options carry all 3 uuids');
  ok(/mob 1/.test(r.say) && /mob 3/.test(r.say), 'clarify say lists the candidates by name');
}
{
  const r = parse(shooterSnap(), 'move the hero up');
  ok(r.kind === 'ops' && r.ops[0].target === 's-hero' && r.ops[0].field === 'hy' && r.ops[0].value === 120,
    "bare type 'hero' with one instance -> resolves to ace");
}
{
  const r = parse(pongSnap(), 'select the orb');
  ok(r.kind === 'info' && r.select === 'u-orb' && /zippy/.test(r.say), "bare type 'the orb' -> its single entity, named in say");
}
{
  const r = parse(pongSnap(), 'select right');
  ok(r.kind === 'info' && r.select === 'u-right', "name prefix 'right' -> right paddle");
}
ok(parse(pongSnap(), 'select u-orb').select === 'u-orb', 'raw uuid noun works verbatim');

// ---- "it"/"that" with and without a selection -------------------------------------
ok(parse(pongSnap(), 'move it down').kind === 'clarify', "'it' without a selection -> clarify");
{
  const r = parse(pongSnap(), 'move it down', { selected: 'u-left' });
  ok(r.kind === 'ops' && r.ops[0].target === 'u-left', "'it' resolves to the selection");
}
{
  const r = parse(pongSnap(), 'delete that', { selected: 'u-orb' });
  ok(r.kind === 'ops' && r.ops[0].kind === 'delete' && r.ops[0].target === 'u-orb', "'that' resolves to the selection for delete");
}
ok(parse(pongSnap(), 'move it up', { selected: 'u-gone' }).kind === 'error', "'it' pointing at a vanished entity -> error");

// ---- set: all three surface forms ---------------------------------------------------
{
  const r = parse(pongSnap(), "set left paddle's py to 40");
  ok(r.kind === 'ops' && r.ops[0].field === 'py' && r.ops[0].value === 40 && r.ops[0].target === 'u-left', 'possessive set form');
  ok(/128/.test(r.say) && /40/.test(r.say), 'set say shows old and new values');
}
{
  const r = parse(pongSnap(), 'set py to 40 on left paddle');
  ok(r.kind === 'ops' && r.ops[0].field === 'py' && r.ops[0].value === 40 && r.ops[0].target === 'u-left', 'field-first set form');
}
{
  const r = parse(pongSnap(), "left paddle's py = 40");
  ok(r.kind === 'ops' && r.ops[0].field === 'py' && r.ops[0].value === 40, 'bare possessive-assignment form');
}
{
  const r = parse(pongSnap(), 'set left paddle py to 40');
  ok(r.kind === 'ops' && r.ops[0].target === 'u-left' && r.ops[0].field === 'py',
    'multi-word noun without apostrophe still splits (longest name wins)');
}
{
  const r = parse(pongSnap(), "set zippy's dx to 99");
  ok(r.kind === 'ops' && r.ops[0].value === 8 && /clamp/i.test(r.say), 'SIGNED range clamps high (99 -> 8)');
}
{
  const r = parse(pongSnap(), "set zippy's dx to -99");
  ok(r.kind === 'ops' && r.ops[0].value === -8 && /clamp/i.test(r.say), 'SIGNED range clamps low (-99 -> -8)');
}
{
  const r = parse(pongSnap(), "set left paddle's py to -5");
  ok(r.kind === 'ops' && r.ops[0].value === 0 && /clamp/i.test(r.say), 'unsigned range clamps at its 0 floor');
}
{
  const r = parse(pongSnap(), "set left paddle's speed to 3");
  ok(r.kind === 'error' && /speed/.test(r.say) && /px/.test(r.say) && /py/.test(r.say) && /side/.test(r.say),
    "unknown field error names the type's REAL fields");
}
{
  const r = parse(shooterSnap(), "set pit's brood to 7");
  ok(r.kind === 'ops' && r.ops[0].field === 'brood' && r.ops[0].value === 7 && r.ops[0].target === 's-pit',
    'set works on a non-spatial type');
}
ok(parse(pongSnap(), "set left paddle's py to fast").kind === 'error', 'non-numeric value -> error');
ok(parse(pongSnap(), "set ghost's py to 4").kind === 'error', 'unknown noun in set -> error');

// ---- select ---------------------------------------------------------------------------
{
  const r = parse(pongSnap(), 'select left paddle');
  ok(r.kind === 'info' && r.select === 'u-left', 'select -> info with select uuid');
  ok(/left paddle/.test(r.say) && /slider/.test(r.say), 'select say gives name + type');
  ok(/px 8/.test(r.say) && /py 128/.test(r.say) && /side 0/.test(r.say), 'select say lists ALL fields with values');
}

// ---- create -----------------------------------------------------------------------------
{
  const r = parse(shooterSnap(), 'create a mob');
  ok(r.kind === 'ops' && r.ops.length === 1 && r.ops[0].kind === 'createChild' && r.ops[0].type === 'mob' && r.ops[0].parent === null,
    'create -> createChild with the validated type, parent null');
}
{
  const r = parse(shooterSnap(), 'spawn a mob named grunt at 40,60');
  ok(r.kind === 'ops' && r.ops[0].props.name === 'grunt', 'create carries the given name');
  ok(r.ops[0].props.hx === 40 && r.ops[0].props.hy === 60, "coords land on THIS type's declared spatial fields (hx/hy)");
  ok(/grunt/.test(r.say) && /40/.test(r.say), 'create say echoes name and coords');
}
{
  const r = parse(pongSnap(), 'spawn an orb at 10,20');
  ok(r.kind === 'ops' && r.ops[0].type === 'orb' && r.ops[0].props.px === 10 && r.ops[0].props.py === 20,
    "a different world's spatial fields are used (px/py) — nothing hardcoded");
}
{
  const r = parse(shooterSnap(), 'add a lair named den');
  ok(r.kind === 'ops' && r.ops[0].type === 'lair' && r.ops[0].props.name === 'den' && !('hx' in r.ops[0].props),
    'non-spatial create carries no coord props');
}
{
  const r = parse(shooterSnap(), 'create a dragon');
  ok(r.kind === 'error' && /dragon/.test(r.say) && /hero/.test(r.say) && /lair/.test(r.say),
    "unknown type -> error listing the world's types");
}
ok(parse(shooterSnap(), 'create a lair at 5,5').kind === 'error', 'coords on a non-spatial type -> error');

// ---- delete ------------------------------------------------------------------------------
{
  const r = parse(pongSnap(), 'delete zippy');
  ok(r.kind === 'ops' && r.ops.length === 1 && r.ops[0].kind === 'delete' && r.ops[0].target === 'u-orb', 'delete -> delete op');
  ok(/permanent/i.test(r.say), 'delete say warns it is permanent');
}
ok(parse(shooterSnap(), 'destroy mob 3').ops[0].target === 's-m3', "synonym 'destroy'");

// ---- rename ------------------------------------------------------------------------------
{
  const r = parse(pongSnap(), 'rename left paddle to Lefty McSlide');
  ok(r.kind === 'ops' && r.ops[0].kind === 'setfield' && r.ops[0].field === 'name' && r.ops[0].target === 'u-left', 'rename -> setfield name');
  ok(r.ops[0].value === 'Lefty McSlide', 'rename preserves the new name case + spaces');
}
ok(parse(pongSnap(), 'rename zippy').kind === 'error', "rename without 'to' -> usage error");

// ---- questions ----------------------------------------------------------------------------
{
  const r = parse(pongSnap(), "what is left paddle's py?");
  ok(r.kind === 'info' && /128/.test(r.say), "field question 'what is X's f' answers the value");
}
{
  const r = parse(pongSnap(), "what is zippy's dx");
  ok(r.kind === 'info' && /-8/.test(r.say), 'field question on a signed field');
}
{
  const r = parse(shooterSnap(), "what is pit's brood?");
  ok(r.kind === 'info' && /\b3\b/.test(r.say), 'field question on a non-spatial type');
}
{
  const r = parse(shooterSnap(), "what is pit's px?");
  ok(r.kind === 'error' && /brood/.test(r.say), "field question on a missing field -> error listing the type's fields");
}
{
  const r = parse(shooterSnap(), 'how many mobs are there?');
  ok(r.kind === 'info' && /\b3\b/.test(r.say), 'how-many counts by type (3 mobs)');
}
{
  const r = parse(pongSnap(), 'how many sliders');
  ok(r.kind === 'info' && /\b2\b/.test(r.say), "how-many works without 'are there'");
}
ok(parse(shooterSnap(), 'how many dragons are there?').kind === 'error', 'how-many of an unknown type -> error');
{
  const r = parse(shooterSnap(), 'who has the most hp');
  ok(r.kind === 'info' && /mob 1/.test(r.say) && /90/.test(r.say), 'most-field scan names the winner and value (mob 1, 90)');
}
{
  const r = parse(shooterSnap(), 'who has the least hp');
  ok(r.kind === 'info' && /mob 2/.test(r.say) && /30/.test(r.say), 'least-field scan (mob 2, 30)');
}
ok(parse(shooterSnap(), 'who has the most sparkle').kind === 'error', 'most of a field no type owns -> error');
{
  const r = parse(pongSnap(), 'what types are there?');
  ok(r.kind === 'info' && /slider/.test(r.say) && /orb/.test(r.say), 'types question lists the type names');
  ok(/px/.test(r.say) && /dx/.test(r.say), 'types question lists their fields too');
}
{
  const r = parse(shooterSnap(), 'what can I make?');
  ok(r.kind === 'info' && /hero/.test(r.say) && /mob/.test(r.say) && /bolt/.test(r.say) && /lair/.test(r.say),
    "'what can I make' lists all four types");
}

// ---- unknown verb / degenerate input ----------------------------------------------------------
{
  const r = parse(pongSnap(), 'frobnicate zippy');
  ok(r.kind === 'error' && /frobnicate/.test(r.say) && /move/.test(r.say) && /create/.test(r.say), 'unknown verb -> error listing the verbs');
}
ok(parse(pongSnap(), '').kind === 'error', 'empty text -> error');
ok(parse(pongSnap(), '   ').kind === 'error', 'whitespace text -> error');
ok(parse(null, 'move x up').kind === 'error', 'null snapshot does not throw');

// ---- says never leak uuids when a name exists ---------------------------------------------------
{
  const cmds = ['move left paddle down', "set zippy's dy to 3", 'select right paddle', 'delete zippy',
    "what is left paddle's px", 'who has the most dx', 'move the mob down'];
  const rs = cmds.map((c) => parse(c === 'move the mob down' ? shooterSnap() : pongSnap(), c));
  ok(rs.every((r) => !/\b(?:u-(?:left|right|orb)|s-(?:hero|m1|m2|m3|pit|b1))\b/.test(r.say)),
    'no say string contains a bare uuid when a name exists');
}

// ---- source audit: NOTHING game-specific may appear in intent2.js (outside comments) -----------
{
  const src = fs.readFileSync(path.join(__dirname, 'intent2.js'), 'utf8');
  const code = src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  ok(!/crop|water|growth|paddle|ball|enemy/i.test(code),
    'source audit: intent2.js contains no game nouns outside comments');
}

console.log(`\n${FAIL ? 'FAIL' : 'ALL PASS'} — ${PASS} passed, ${FAIL} failed`);
process.exit(FAIL ? 1 : 0);
