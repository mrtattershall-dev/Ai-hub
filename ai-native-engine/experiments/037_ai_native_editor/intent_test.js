'use strict';
// =============================================================================
// 037 — INTENT tests. Pure fixtures, zero deps, protocol_test.js conventions:
// plain asserts via ok(), prints every case, PASS count, non-zero exit on any
// failure. `node experiments/037_ai_native_editor/intent_test.js`
// =============================================================================
const { parse } = require('./intent.js');

let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };

// fixture: 6 crops, varied water/growth/claims/displayNames.
// ripe: Buttercup(110), corn 2(130). dry(<25): Buttercup(12), Daisy(3).
// driest=Daisy, wettest/ripest=corn 2, oldest=Buttercup, youngest=Sprout.
// claims: bob->corn(until 130), grace(you)->Rex(until 140).
function snap() {
  return {
    tick: 100, zone: 'zone-1', tally: 7, you: 'grace',
    crops: [
      { uuid: 'u-old',   name: 'c0',     displayName: 'Buttercup', water: 12,  growth: 110 },
      { uuid: 'u-corn1', name: 'corn',   displayName: 'corn',      water: 60,  growth: 40 },
      { uuid: 'u-corn2', name: 'corn 2', displayName: 'corn 2',    water: 200, growth: 130 },
      { uuid: 'u-daisy', name: 'c3',     displayName: 'Daisy',     water: 3,   growth: 55 },
      { uuid: 'u-rex',   name: 'c4',     displayName: 'Rex',       water: 80,  growth: 99 },
      { uuid: 'u-new',   name: 'c5',     displayName: 'Sprout',    water: 30,  growth: 0 },
    ],
    claims: [
      { uuid: 'u-corn1', holder: 'bob',   until: 130 },
      { uuid: 'u-rex',   holder: 'grace', until: 140 },
    ],
  };
}
function bigSnap(n = 40) {
  return { tick: 0, zone: 'z', tally: 0, you: 'grace', claims: [],
    crops: Array.from({ length: n }, (_, i) => ({ uuid: `b-${i}`, name: `p${i}`, displayName: `p${i}`, water: 10, growth: 0 })) };
}

// ---- purity: parse must not mutate the snapshot -----------------------------
{
  const s0 = snap(); const before = JSON.stringify(s0);
  parse(s0, 'water everything'); parse(s0, 'harvest everything anyway'); parse(s0, 'plant 3 corn');
  ok(JSON.stringify(s0) === before, 'purity: snapshot unchanged after parses');
}

// ---- water -------------------------------------------------------------------
{
  const r = parse(snap(), 'water Buttercup');
  ok(r.kind === 'ops' && r.ops.length === 1, 'water by displayName -> 1 op');
  ok(r.ops[0].kind === 'setfield' && r.ops[0].target === 'u-old' && r.ops[0].field === 'water' && r.ops[0].value === 200, 'water default sets water to 200');
  ok(/Buttercup/.test(r.say) && /12/.test(r.say) && /200/.test(r.say), 'water say names crop + numbers');
  ok(!/u-old/.test(r.say), 'water say contains no bare uuid');
}
{
  const r = parse(snap(), 'water daisy to 150');
  ok(r.kind === 'ops' && r.ops[0].target === 'u-daisy' && r.ops[0].value === 150, "water 'to N' sets absolute value");
}
{
  const r = parse(snap(), 'water rex +30');
  ok(r.kind === 'ops' && r.ops[0].target === 'u-rex' && r.ops[0].value === 110, "water '+N' adds to current (80+30)");
}
{
  const r = parse(snap(), 'water corn 2 +100');
  ok(r.kind === 'ops' && r.ops[0].target === 'u-corn2' && r.ops[0].value === 255, "water '+N' caps at 255");
}
{
  const r = parse(snap(), 'water sprout to 300');
  ok(r.kind === 'ops' && r.ops[0].value === 255, "water 'to 300' clamps to 255");
}
ok(parse(snap(), 'WATER BUTTERCUP').kind === 'ops', 'case-insensitive verb + noun');
ok(parse(snap(), 'irrigate the driest').ops[0].target === 'u-daisy', "synonym 'irrigate' + 'the driest'");
{
  const r = parse(snap(), 'water');
  ok(r.kind === 'clarify' && r.options.length === 6, 'water with no noun -> clarify listing all');
}

// ---- superlative nouns ---------------------------------------------------------
ok(parse(snap(), 'water the thirstiest').ops[0].target === 'u-daisy', "'thirstiest' = min water");
ok(parse(snap(), 'water the wettest crop').ops[0].target === 'u-corn2', "'wettest crop' = max water");
ok(parse(snap(), 'water the youngest').ops[0].target === 'u-new', "'youngest' = last in list");
ok(parse(snap(), 'water the oldest').ops[0].target === 'u-old', "'oldest' = first in list");

// ---- name matching: exact beats prefix; prefix ambiguity -> clarify -----------
ok(parse(snap(), 'water corn').ops[0].target === 'u-corn1', "exact name 'corn' beats prefix over 'corn 2'");
{
  const r = parse(snap(), 'water cor');
  ok(r.kind === 'clarify' && r.options.length === 2 && r.options.includes('u-corn1') && r.options.includes('u-corn2'), "prefix 'cor' ambiguous -> clarify with both uuids");
  ok(/corn/.test(r.say) && /corn 2/.test(r.say), 'ambiguity say lists display names');
}
{
  const r = parse(snap(), 'water c');
  ok(r.kind === 'clarify' && r.options.length === 6, "prefix 'c' matches 6 (names c0..c5 + corns) -> clarify");
}
{
  const r = parse(snap(), 'water zebra');
  ok(r.kind === 'error' && /zebra/.test(r.say) && /Buttercup/.test(r.say), 'unknown noun -> error listing crops');
}

// ---- uuids verbatim ------------------------------------------------------------
ok(parse(snap(), 'water u-daisy').ops[0].target === 'u-daisy', 'uuid noun works verbatim');

// ---- plural fan-out ------------------------------------------------------------
{
  const r = parse(snap(), 'water all dry crops');
  ok(r.kind === 'ops' && r.ops.length === 2, "'all dry crops' (water<25) -> 2 ops");
  const t = r.ops.map((o) => o.target).sort();
  ok(t[0] === 'u-daisy' && t[1] === 'u-old', 'dry fan-out hits Buttercup + Daisy');
}
{
  const r = parse(snap(), 'water everything');
  ok(r.kind === 'ops' && r.ops.length === 6 && r.ops.every((o) => o.kind === 'setfield' && o.value === 200), "'everything' -> 6 setfield ops");
}
{
  const r = parse(snap(), 'harvest all ripe crops');
  ok(r.kind === 'ops' && r.ops.length === 2 && r.ops.every((o) => o.kind === 'delete'), "'all ripe crops' -> 2 deletes");
  ok(!/skip/i.test(r.say), 'all-ripe harvest say mentions no skipping');
}
{
  const r = parse(snap(), 'water mine');
  ok(r.kind === 'ops' && r.ops.length === 1 && r.ops[0].target === 'u-rex', "'mine' = crops claimed by you (grace -> Rex)");
}
{
  const r = parse(snap(), "water bob's crop");
  ok(r.kind === 'ops' && r.ops[0].target === 'u-corn1', "\"bob's crop\" resolves via claims");
}
{
  const r = parse(snap(), 'select the claimed one');
  ok(r.kind === 'clarify' && r.options.length === 2, "'the claimed one' with 2 claimed -> clarify");
}
{
  const r = parse(snap(), 'water the one nobody claimed');
  ok(r.kind === 'clarify' && r.options.length === 4, "'the one nobody claimed' with 4 unclaimed -> clarify");
}

// ---- the 32-op cap --------------------------------------------------------------
{
  const r = parse(bigSnap(40), 'water all crops');
  ok(r.kind === 'clarify' && /32/.test(r.say) && /40/.test(r.say), '40-crop fan-out -> clarify citing the 32-op cap');
}
{
  const r = parse(bigSnap(32), 'water all crops');
  ok(r.kind === 'ops' && r.ops.length === 32, 'exactly 32 crops still fits');
}

// ---- harvest guard + anyway ------------------------------------------------------
{
  const r = parse(snap(), 'harvest rex');
  ok(r.kind === 'clarify' && r.options.length === 1 && r.options[0] === 'u-rex', 'unripe harvest -> clarify with the crop uuid');
  ok(/99/.test(r.say) && /anyway/.test(r.say) && /Rex/.test(r.say), 'unripe say states growth 99 and the anyway escape');
}
{
  const r = parse(snap(), 'harvest rex anyway');
  ok(r.kind === 'ops' && r.ops.length === 1 && r.ops[0].kind === 'delete' && r.ops[0].target === 'u-rex', "'anyway' overrides the ripeness guard");
  ok(/wasted/i.test(r.say), "'anyway' say admits the waste");
}
{
  const r = parse(snap(), 'harvest buttercup');
  ok(r.kind === 'ops' && r.ops[0].kind === 'delete' && r.ops[0].target === 'u-old', 'ripe harvest goes straight to delete');
}
{
  const r = parse(snap(), 'harvest everything');
  ok(r.kind === 'ops' && r.ops.length === 2, "'harvest everything' takes only the 2 ripe");
  ok(/skipping 4/i.test(r.say), 'mixed harvest say reports 4 skipped unripe');
}
{
  const r = parse(snap(), 'harvest everything anyway');
  ok(r.kind === 'ops' && r.ops.length === 6, "'harvest everything anyway' deletes all 6");
}
ok(parse(snap(), 'reap the ripest').ops[0].target === 'u-corn2', "synonym 'reap' + 'the ripest'");

// ---- claim ------------------------------------------------------------------------
{
  const r = parse(snap(), 'claim daisy');
  ok(r.kind === 'ops' && r.ops[0].kind === 'claim' && r.ops[0].target === 'u-daisy' && r.ops[0].ticks === 40, 'claim defaults to 40 ticks');
  ok(/140/.test(r.say) && /Daisy/.test(r.say), 'claim say gives the until-tick (100+40)');
}
{
  const r = parse(snap(), 'claim sprout for 60 ticks');
  ok(r.kind === 'ops' && r.ops[0].ticks === 60, "'for 60 ticks' overrides the default");
}
{
  const r = parse(snap(), 'claim corn');
  ok(r.kind === 'ops' && /bob/.test(r.say) && /130/.test(r.say), 'claiming an already-held crop warns about bob');
}

// ---- release (no such op) -----------------------------------------------------------
{
  const r = parse(snap(), 'release rex');
  ok(r.kind === 'error' && /140/.test(r.say) && /grace/.test(r.say), 'release -> error naming holder + expiry tick from claims[].until');
}
{
  const r = parse(snap(), 'release daisy');
  ok(r.kind === 'error' && /Daisy/.test(r.say), 'release of an unclaimed crop -> error saying so');
}

// ---- rename ---------------------------------------------------------------------------
{
  const r = parse(snap(), 'rename buttercup to Goldie Prime');
  ok(r.kind === 'ops' && r.ops[0].kind === 'setfield' && r.ops[0].field === 'name' && r.ops[0].target === 'u-old', 'rename -> setfield name');
  ok(r.ops[0].value === 'Goldie Prime', 'rename preserves the new name case + spaces');
}
ok(parse(snap(), 'rename all crops to X').kind === 'clarify', 'rename of a plural -> clarify');
ok(parse(snap(), 'rename buttercup').kind === 'error', "rename without 'to' -> usage error");

// ---- select ----------------------------------------------------------------------------
{
  const r = parse(snap(), 'select sprout');
  ok(r.kind === 'info' && r.select === 'u-new', 'select -> info with select uuid');
  ok(/Sprout/.test(r.say) && /30/.test(r.say) && /\b0\b/.test(r.say), 'select say gives water + growth');
}
{
  const r = parse(snap(), 'select the wettest');
  ok(r.kind === 'info' && r.select === 'u-corn2' && /ripe/.test(r.say), 'select superlative; ripe flagged in say');
}

// ---- "it" with and without selected ------------------------------------------------------
ok(parse(snap(), 'water it').kind === 'clarify', "bare 'it' without selection -> clarify");
{
  const r = parse(snap(), 'water it', { selected: 'u-daisy' });
  ok(r.kind === 'ops' && r.ops[0].target === 'u-daisy', "'it' resolves to the selected crop");
}
{
  const r = parse(snap(), 'harvest it anyway', { selected: 'u-rex' });
  ok(r.kind === 'ops' && r.ops[0].kind === 'delete' && r.ops[0].target === 'u-rex', "'harvest it anyway' with selection");
}
ok(parse(snap(), 'water it', { selected: 'u-gone' }).kind === 'error', "'it' pointing at a vanished crop -> error");

// ---- plant --------------------------------------------------------------------------------
{
  const r = parse(snap(), 'plant corn');
  ok(r.kind === 'ops' && r.ops.length === 1, 'plant -> 1 createChild');
  const o = r.ops[0];
  ok(o.kind === 'createChild' && o.type === 'crop' && o.parent === 'zone-1', 'createChild targets the zone');
  ok(o.props.name === 'corn' && o.props.water === 25 && o.props.growth === 0, 'plant defaults water 25 growth 0');
}
{
  const r = parse(snap(), 'plant 3 wheat');
  ok(r.kind === 'ops' && r.ops.length === 3, "'plant 3 wheat' -> 3 ops");
  ok(r.ops[0].props.name === 'wheat' && r.ops[1].props.name === 'wheat 2' && r.ops[2].props.name === 'wheat 3', 'plant xN numbers names wheat, wheat 2, wheat 3');
}
{
  const r = parse(snap(), 'plant wheat x3');
  ok(r.kind === 'ops' && r.ops.length === 3 && r.ops[2].props.name === 'wheat 3', "'plant wheat x3' variant");
}
ok(parse(snap(), 'plant 40 wheat').kind === 'clarify', 'plant beyond the 32-op cap -> clarify');
ok(parse(snap(), 'plant').kind === 'error', 'plant with no name -> error');

// ---- questions -------------------------------------------------------------------------------
{
  const r = parse(snap(), "what's the driest crop?");
  ok(r.kind === 'info' && /Daisy/.test(r.say) && /\b3\b/.test(r.say), 'driest question names Daisy (water 3)');
}
{
  const r = parse(snap(), 'which crop is the ripest?');
  ok(r.kind === 'info' && /corn 2/.test(r.say) && /130/.test(r.say), 'ripest question names corn 2 (growth 130)');
}
{
  const r = parse(snap(), 'who claimed what?');
  ok(r.kind === 'info' && /bob/.test(r.say) && /corn/.test(r.say) && /130/.test(r.say) && /grace/.test(r.say) && /Rex/.test(r.say) && /140/.test(r.say), 'claims question lists both claims by name');
}
{
  const r = parse(snap(), "what's the score?");
  ok(r.kind === 'info' && /\b7\b/.test(r.say), 'score question reports the tally');
}
{
  const r = parse(snap(), 'how many crops are ripe?');
  ok(r.kind === 'info' && /\b2\b/.test(r.say) && /Buttercup/.test(r.say) && /corn 2/.test(r.say), 'how-many-ripe counts 2 and names them');
}
{
  const r = parse(snap(), 'how many crops are there?');
  ok(r.kind === 'info' && /\b6\b/.test(r.say), 'how-many counts 6 crops');
}

// ---- unknown verb / empty ----------------------------------------------------------------------
{
  const r = parse(snap(), 'frobnicate the crops');
  ok(r.kind === 'error' && /frobnicate/.test(r.say) && /water, plant, harvest, claim, release, rename, select/.test(r.say), 'unknown verb -> error listing verbs');
}
ok(parse(snap(), '').kind === 'error', 'empty text -> error');
ok(parse(snap(), '   ').kind === 'error', 'whitespace text -> error');

// ---- says never leak uuids ------------------------------------------------------------------------
{
  const rs = ['water everything', 'harvest everything', 'claim all dry crops', 'select the ripest', 'who claimed what?']
    .map((t) => parse(snap(), t));
  ok(rs.every((r) => !/u-(old|corn1|corn2|daisy|rex|new)/.test(r.say)), 'no say string contains a bare uuid');
}

// ---- WORD-ROLE CONFUSION BATTERY (round-2 user finding: "hard time knowing the
// difference between nouns, verbs, and adjectives"). Expected reading in each name.
// fixture facts: dry(<25)={Buttercup 12, Daisy 3}; wet(>=200)={corn 2};
// ripe={Buttercup 110, corn 2 130}; oldest=Buttercup; newest=Sprout.
{ // 'water' = verb, 'plant' = generic NOUN (6 crops -> clarify, not "can't find 'plant'")
  const r = parse(snap(), 'water the plant');
  ok(r.kind === 'clarify' && r.options.length === 6, "'water the plant' -> plant is a noun -> clarify among all crops");
}
{ // noun 'plant' resolves via selection when one exists
  const r = parse(snap(), 'water the plant', { selected: 'u-daisy' });
  ok(r.kind === 'ops' && r.ops[0].target === 'u-daisy', "'water the plant' with selection -> the selected plant");
}
{ // sentence-initial 'plant' stays a VERB
  const r = parse(snap(), 'plant the corn');
  ok(r.kind === 'ops' && r.ops[0].kind === 'createChild' && r.ops[0].props.name === 'corn', "'plant the corn' -> plant is the verb");
}
{ // 'harvest that plant' -> that+generic noun = the selection
  const r = parse(snap(), 'harvest that plant', { selected: 'u-old' });
  ok(r.kind === 'ops' && r.ops[0].kind === 'delete' && r.ops[0].target === 'u-old', "'harvest that plant' -> selected crop (ripe -> deletes)");
}
{ // singular adjective: two dry crops -> clarify, never a silent guess
  const r = parse(snap(), 'water the dry one');
  ok(r.kind === 'clarify' && r.options.length === 2, "'the dry one' with 2 dry crops -> clarify listing both");
}
{ // singular adjective with unique referent resolves
  const r = parse(snap(), 'select the wet one');
  ok(r.kind === 'info' && r.select === 'u-corn2', "'the wet one' -> unique wet crop (corn 2)");
}
{ // adjective fan-out without 'all'
  const r = parse(snap(), 'water the dry ones');
  ok(r.kind === 'ops' && r.ops.length === 2, "'the dry ones' -> both dry crops");
}
{ // adjective + plural generic noun ('plants' as noun)
  const r = parse(snap(), 'harvest all ripe plants');
  ok(r.kind === 'ops' && r.ops.length === 2 && r.ops.every((o) => o.kind === 'delete'), "'harvest all ripe plants' -> the 2 ripe crops");
}
{ // superlative composed over an adjective filter
  const r = parse(snap(), 'water the ripest dry crop');
  ok(r.kind === 'ops' && r.ops[0].target === 'u-old', "'ripest dry crop' -> ripest among dry = Buttercup");
}
{ // 'watered' as adjective (past participle), not verb
  const r = parse(snap(), 'select the watered one');
  ok(r.kind === 'info' && r.select === 'u-corn2', "'the watered one' -> adjective (water>=200) -> corn 2");
}
{ // 'claim' verb + 'thirsty' adjective
  const r = parse(snap(), 'claim the thirsty crop');
  ok(r.kind === 'clarify' && r.options.length === 2, "'claim the thirsty crop' -> 2 thirsty -> clarify");
}
{ // unripe/green adjectives + the harvest guard still applies to the set
  const r = parse(snap(), 'harvest the green ones');
  ok(r.kind === 'error' && /none of those 4/.test(r.say), "'harvest the green ones' -> guard: none ripe");
}
{ // 'old' reads as oldest; pick = harvest; Buttercup is ripe so it goes through
  const r = parse(snap(), 'pick the old one');
  ok(r.kind === 'ops' && r.ops[0].kind === 'delete' && r.ops[0].target === 'u-old', "'pick the old one' -> oldest (Buttercup, ripe)");
}
{ // claim-state adjectives compose with value adjectives
  const r = parse(snap(), 'water the unclaimed wet ones');
  ok(r.kind === 'ops' && r.ops.length === 1 && r.ops[0].target === 'u-corn2', "'unclaimed wet ones' -> corn 2 only");
}
{ // 'water' as FIELD NOUN in a write: field-first form
  const r = parse(snap(), 'set water to 50 on Rex');
  ok(r.kind === 'ops' && r.ops[0].field === 'water' && r.ops[0].value === 50 && r.ops[0].target === 'u-rex', "'set water to 50 on Rex' -> water is a field");
  ok(/Rex/.test(r.say) && /50/.test(r.say) && /80/.test(r.say), 'set say names crop, new value, and old value');
}
{ // possessive form of the same write
  const r = parse(snap(), "set Rex's water to 50");
  ok(r.kind === 'ops' && r.ops[0].field === 'water' && r.ops[0].value === 50 && r.ops[0].target === 'u-rex', "\"set Rex's water to 50\" -> same op");
}
{ // 'make' synonym + growth field + clamping
  const r = parse(snap(), "make Rex's growth 999");
  ok(r.kind === 'ops' && r.ops[0].field === 'growth' && r.ops[0].value === 255 && /clamped/.test(r.say), "'make Rex's growth 999' -> clamped to 255, say admits it");
}
{ // 'water' as FIELD NOUN in a question
  const r = parse(snap(), "what's the water on the ripest crop?");
  ok(r.kind === 'info' && /corn 2/.test(r.say) && /200/.test(r.say), "'water on the ripest crop' -> field query -> corn 2 has water 200");
}
{ // possessive field question
  const r = parse(snap(), "Rex's growth?");
  ok(r.kind === 'info' && /99/.test(r.say), "\"Rex's growth?\" -> info growth 99");
}
{ // 'check' routes to the read path
  const r = parse(snap(), 'check the water on Daisy');
  ok(r.kind === 'info' && /Daisy/.test(r.say) && /\b3\b/.test(r.say), "'check the water on Daisy' -> info water 3");
}
{ // 'how much X does Y have'
  const r = parse(snap(), 'how much water does Buttercup have');
  ok(r.kind === 'info' && /12/.test(r.say), "'how much water does Buttercup have' -> 12");
}
{ // politeness stripping
  const r = parse(snap(), 'please water the corn');
  ok(r.kind === 'ops' && r.ops[0].target === 'u-corn1', "'please water the corn' -> politeness stripped, corn watered");
  const r2 = parse(snap(), 'can you harvest corn 2');
  ok(r2.kind === 'ops' && r2.ops[0].kind === 'delete' && r2.ops[0].target === 'u-corn2', "'can you harvest corn 2' -> stripped, ripe, deleted");
}
{ // unknown adjective must NOT be eaten by the adjective engine — falls to name match
  const r = parse(snap(), 'water the purple one');
  ok(r.kind === 'error' && /purple/.test(r.say), "'the purple one' -> unknown word -> honest can't-find error");
}
{ // bare role-ambiguous word: 'water' alone asks rather than guesses
  const r = parse(snap(), 'water');
  ok(r.kind === 'clarify', "bare 'water' -> clarify which crop");
}
{ // no dry crops: adjective miss explains the semantics
  const s2 = snap(); s2.crops.forEach((c) => { c.water = 100; });
  const r = parse(s2, 'water the dry one');
  ok(r.kind === 'error' && /dry/.test(r.say), "'the dry one' with none dry -> error explaining dry");
}

console.log(`\n${FAIL ? 'FAIL' : 'ALL PASS'} — ${PASS} passed, ${FAIL} failed`);
process.exit(FAIL ? 1 : 0);
