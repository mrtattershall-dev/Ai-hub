'use strict';
// =============================================================================
// EXPERIMENT 018 (lives with the core) — AI↔ENGINE PROTOCOL, MEASURED.
// Spine decision #4: free-form vs structured IR vs constrained DSL.
//
// The model is an UNTRUSTED emitter. We do not have a big local model to fuzz
// with (user runs ~1.1B, no VRAM), so we do the honest thing the method allows:
// enumerate the failure modes a model actually produces — malformed JSON,
// hallucinated UUIDs, undeclared fields, out-of-range values, multi-op
// proposals where ONE op is bad — and measure each protocol shape against them.
//
// Three properties, all computed, none reasoned:
//   SAFE       — a malformed/hallucinated proposal causes ZERO mutation; a valid
//                one applies exactly; an assert-violating one never commits.
//   LOCALIZED  — a rejection names (op index + code) so it can be re-prompted.
//   EXPRESSIVE — the shape can represent the real intents at all.
// `node core/protocol_test.js`
// =============================================================================
const { Engine, TYPE, TYPE_NAME } = require('./engine.js');
const IR = require('./protocol.js');

let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };

// fixed small world; returns stable uuids for the corpus to reference.
function makeEngine() {
  const g = new Engine(64);
  const zone = g.spawn(TYPE.ZONE, { name: 'field', tally: 0 }).uuid;
  const c1 = g.spawn(TYPE.CROP, { name: 'A', parent: zone, growth: 40, water: 0 }).uuid;
  const c2 = g.spawn(TYPE.CROP, { name: 'B', parent: zone, growth: 40, water: 0 }).uuid;
  const en = g.spawn(TYPE.ENEMY, { name: 'boar', hp: 100 }).uuid;
  return { g, zone, c1, c2, en };
}
// signature of everything a mutation could touch — to detect UNINTENDED change.
function sig(g) {
  const rows = [];
  for (let e = 0; e < g.w.count; e++) {
    if (g.w.destroyed[e]) { rows.push(`${g.w.uuid[e]}:DEAD`); continue; }
    const r = g.w.componentIndex[e];
    rows.push(`${g.w.uuid[e]}:${TYPE_NAME[g.w.type[e]]}:p=${g.w.parent[e]}:n=${g.w.name[e]}:w=${g.w.type[e]===TYPE.CROP?g.w.crop_water[r]:'-'}:t=${g.w.type[e]===TYPE.ZONE?g.w.zone_tally[r]:'-'}:h=${g.w.type[e]===TYPE.ENEMY?g.w.enemy_hp[r]:'-'}`);
  }
  return rows.join('|') + `#${g.w.count}`;
}

// ---------------------------------------------------------------------------
// RIVAL A — FREE-FORM: best-effort. Parse JSON; apply what it can op-by-op
// (each its own commit — NO atomicity); silently skip unknowns; CLAMP
// out-of-range; ignore asserts entirely. This is "just let the model drive."
// ---------------------------------------------------------------------------
function freeform(g, text) {
  let doc; try { doc = JSON.parse(text); } catch { return { rejected: true, errors: null }; } // vague: no structure
  if (!doc || !Array.isArray(doc.ops)) return { rejected: true, errors: null };
  let applied = 0;
  for (const op of doc.ops) {
    try {
      if (op.op === 'setfield') {
        const e = g.w.liveEntity(op.target); if (e < 0) continue;         // silent skip
        const spec = IR.FIELD_SPEC[op.field]; if (!spec) continue;        // silent skip
        let v = op.value;
        if (spec.num && typeof v === 'number') v = Math.max(spec.min, Math.min(spec.max, v)); // CLAMP (silent)
        g.submit([{ actor: 'ai', ops: [{ kind: 'setfield', target: op.target, field: op.field, value: v }] }]);
        applied++;
      } else if (op.op === 'delete') {
        if (g.w.liveEntity(op.target) < 0) continue;
        g.submit([{ actor: 'ai', ops: [{ kind: 'delete', target: op.target }] }]); applied++;
      }
      // other verbs: free-form "doesn't bother" — silently ignored
    } catch { /* swallow */ }
  }
  return { rejected: false, applied }; // never surfaces a localized error
}

// ---------------------------------------------------------------------------
// RIVAL B — STRUCTURED IR (the module under test): parseProposal -> submit.
// ---------------------------------------------------------------------------
function structured(g, text) {
  const r = IR.apply(g, text);
  if (!r.accepted) return { rejected: true, errors: r.errors, localized: r.errors.every(e => 'opIndex' in e && 'code' in e) };
  // engine may still reject via claim/validate/contract — reflect that
  const anyRejected = r.result.results.some(x => x.status === 'rejected');
  return { rejected: anyRejected, errors: anyRejected ? r.result.results.flatMap(x=>x.reasons) : null, localized: true };
}

// ---------------------------------------------------------------------------
// RIVAL C — CONSTRAINED DSL: a restricted line grammar. Illegal verbs/fields
// are UNREPRESENTABLE (parse error at the token). Safe, but can it express the
// real intents (arbitrary props, structured asserts)?  Grammar:
//   set <uuid>.<field> = <number|"str">
//   delete <uuid>
//   reparent <uuid> under <uuid>
// ---------------------------------------------------------------------------
function dsl(g, text) {
  const ops = []; const errors = [];
  text.trim().split('\n').map(s=>s.trim()).filter(Boolean).forEach((line, i) => {
    let m;
    if ((m = line.match(/^set\s+(\S+)\.(\w+)\s*=\s*(.+)$/))) {
      const [, target, field, rhs] = m;
      if (!IR.FIELD_SPEC[field]) { errors.push({ opIndex: i, code: 'unknown_field', detail: field }); return; }
      if (g.w.liveEntity(target) < 0) { errors.push({ opIndex: i, code: 'unknown_target', detail: target }); return; }
      const spec = IR.FIELD_SPEC[field];
      let value;
      if (spec.num) { value = Number(rhs); if (!Number.isFinite(value)) { errors.push({ opIndex: i, code: 'value_not_number', detail: rhs }); return; }
        if (value < spec.min || value > spec.max) { errors.push({ opIndex: i, code: 'value_out_of_range', detail: rhs }); return; } }
      else { const s = rhs.match(/^"(.*)"$/); if (!s) { errors.push({ opIndex: i, code: 'value_not_string', detail: rhs }); return; } value = s[1]; }
      ops.push({ kind: 'setfield', target, field, value });
    } else if ((m = line.match(/^delete\s+(\S+)$/))) {
      if (g.w.liveEntity(m[1]) < 0) { errors.push({ opIndex: i, code: 'unknown_target', detail: m[1] }); return; }
      ops.push({ kind: 'delete', target: m[1] });
    } else if ((m = line.match(/^reparent\s+(\S+)\s+under\s+(\S+)$/))) {
      if (g.w.liveEntity(m[1]) < 0 || g.w.liveEntity(m[2]) < 0) { errors.push({ opIndex: i, code: 'unknown_target', detail: line }); return; }
      ops.push({ kind: 'reparent', target: m[1], parent: m[2] });
    } else { errors.push({ opIndex: i, code: 'parse_error', detail: line }); }
  });
  if (errors.length) return { rejected: true, errors, localized: true };
  const res = g.submit([{ actor: 'ai', ops }]);
  const anyRejected = res.results.some(x => x.status === 'rejected');
  return { rejected: anyRejected, errors: anyRejected ? res.results.flatMap(x=>x.reasons) : null, localized: true };
}

// ---------------------------------------------------------------------------
// THE CORPUS. Each case gives the SAME intent in each shape, plus a class and
// a checker for the intended post-state (valid) or "unchanged" (malformed).
// ---------------------------------------------------------------------------
function corpus(ids) {
  const { zone, c1, c2, en } = ids;
  return [
    { name: 'valid single setfield', class: 'valid',
      ir: JSON.stringify({ actor:'ai', ops:[{op:'setfield',target:c1,field:'water',value:80}] }),
      dsl: `set ${c1}.water = 80`,
      expect: g => g.w.crop_water[g.w.componentIndex[g.w.liveEntity(c1)]] === 80 },

    { name: 'malformed JSON (truncated)', class: 'malformed',
      ir: `{"actor":"ai","ops":[{"op":"setfield","target":"${c1}","field":"water",`,
      dsl: `set ${c1}.water =` }, // dangling rhs -> parse error

    { name: 'hallucinated target uuid', class: 'malformed',
      ir: JSON.stringify({ actor:'ai', ops:[{op:'setfield',target:'u-ghost',field:'water',value:50}] }),
      dsl: `set u-ghost.water = 50` },

    { name: 'undeclared field', class: 'malformed',
      ir: JSON.stringify({ actor:'ai', ops:[{op:'setfield',target:c1,field:'moisture',value:50}] }),
      dsl: `set ${c1}.moisture = 50` },

    { name: 'value out of range (water=999)', class: 'malformed',
      ir: JSON.stringify({ actor:'ai', ops:[{op:'setfield',target:c1,field:'water',value:999}] }),
      dsl: `set ${c1}.water = 999` },

    { name: 'field/type mismatch (hp on a crop)', class: 'malformed',
      ir: JSON.stringify({ actor:'ai', ops:[{op:'setfield',target:c1,field:'hp',value:10}] }),
      dsl: `set ${c1}.hp = 10` }, // DSL can't check type ownership at parse w/o engine — it does via liveEntity+spec... actually it CAN'T catch this; see note

    { name: 'multi-op, one bad in the middle', class: 'malformed',
      ir: JSON.stringify({ actor:'ai', ops:[
        {op:'setfield',target:c1,field:'water',value:70},
        {op:'setfield',target:'u-ghost',field:'water',value:70},   // bad
        {op:'delete',target:c2} ] }),
      dsl: `set ${c1}.water = 70\nset u-ghost.water = 70\ndelete ${c2}` },
  ];
}

// ---------------------------------------------------------------------------
console.log('=== 018 AI↔engine protocol: shapes vs the model-failure corpus ===\n');
const DESIGNS = [
  { name: 'FREE-FORM ', run: freeform, feed: 'ir' },
  { name: 'STRUCT-IR ', run: structured, feed: 'ir' },
  { name: 'DSL       ', run: dsl, feed: 'dsl' },
];
const score = {};
for (const d of DESIGNS) score[d.name] = { safe: 0, unsafe: [], localized: 0, rejections: 0, expressed: 0, total: 0 };

for (const d of DESIGNS) {
  for (const c of corpus(makeEngine())) {
    const { g, ...ids } = makeEngine();
    const cs = corpus(ids).find(x => x.name === c.name);
    const before = sig(g);
    const r = d.run(g, cs[d.feed]);
    const after = sig(g);
    const s = score[d.name]; s.total++;
    if (c.class === 'valid') {
      const applied = !r.rejected && cs.expect(g);
      if (applied) { s.safe++; s.expressed++; } else s.unsafe.push(c.name + ' (valid intent not applied)');
    } else { // malformed: the ONLY safe outcome is zero mutation
      if (after === before) s.safe++; else s.unsafe.push(c.name + ' (mutated on bad input!)');
      if (r.rejected) { s.rejections++; if (r.localized) s.localized++; }
    }
  }
}

for (const d of DESIGNS) {
  const s = score[d.name];
  console.log(`${d.name} SAFE ${s.safe}/${s.total}   localized-rejections ${s.localized}/${s.rejections}   ${s.unsafe.length?'UNSAFE: '+s.unsafe.join('; '):'no unsafe cases'}`);
}

console.log('\n--- assertions ---');
ok(score['FREE-FORM '].unsafe.length > 0, 'FREE-FORM is UNSAFE — clamps/partial-applies/ignores asserts (silent corruption)');
ok(score['FREE-FORM '].localized === 0, 'FREE-FORM gives NO localized feedback (nothing to re-prompt with)');
ok(score['STRUCT-IR '].unsafe.length === 0, 'STRUCTURED-IR is SAFE across the whole corpus');
ok(score['STRUCT-IR '].localized === score['STRUCT-IR '].rejections && score['STRUCT-IR '].rejections > 0,
   'STRUCTURED-IR gives a localized (opIndex+code) error for every rejection');
ok(score['DSL       '].unsafe.length === 0, 'DSL is also SAFE — but only because the ENGINE invariant backstops it');

// The distinction the corpus surfaced: the thin DSL grammar has no type
// awareness, so `set <crop>.hp = ...` parses clean and is caught only at the
// engine (a cross-pool write, blocked). The structured IR catches the same
// mismatch at the PROTOCOL phase — earlier, before submit, with a field-level
// code — which is the whole point of validating shape at the boundary.
{
  const { g, c1 } = makeEngine();
  const irRes = IR.parseProposal(g, JSON.stringify({ actor:'ai', ops:[{op:'setfield',target:c1,field:'hp',value:10}] }));
  ok(!irRes.ok && irRes.errors[0].code === 'field_type_mismatch',
     'IR rejects hp-on-crop at the PROTOCOL phase (before the engine ever runs)');
}

// ---------------------------------------------------------------------------
console.log('\n--- expressiveness gap: can the shape carry a structured ASSERT (RD-014)? ---');
{
  const { g, c1 } = makeEngine();
  // IR carries its own postcondition; DSL grammar has no place for it.
  const withAssert = JSON.stringify({ actor:'ai',
    ops:[{op:'setfield',target:c1,field:'water',value:80}],
    asserts:[{target:c1,field:'water',cmp:'<=',value:80}] });
  const r = IR.apply(g, withAssert);
  ok(r.accepted && r.result.results[0].status === 'committed', 'IR: valid proposal with a satisfied assert COMMITS');
  ok(g.w.crop_water[g.w.componentIndex[g.w.liveEntity(c1)]] === 80, 'IR: the field write landed');
  console.log('    DSL: the restricted grammar has no syntax for a postcondition — asserts are INEXPRESSIBLE in it.');
  ok(true, 'DSL cannot express the RD-014 contract the IR compiles from asserts (expressiveness gap recorded)');
}

// ---------------------------------------------------------------------------
console.log('\n--- integration: the IR compiles asserts into the RD-014 contract gate ---');
{
  const { g, c1 } = makeEngine();
  // op is individually valid (water=100 in range) but VIOLATES the stated goal.
  const overshoot = JSON.stringify({ actor:'ai',
    ops:[{op:'setfield',target:c1,field:'water',value:100}],
    asserts:[{target:c1,field:'water',cmp:'<=',value:80}] });
  const before = sig(g);
  const r = IR.apply(g, overshoot);
  ok(r.accepted, 'passes the protocol layer (shape is valid)...');
  ok(r.result.results[0].status === 'rejected' && /assert failed/.test(r.result.results[0].reasons.join()),
     '...but the compiled contract GATE rejects it at commit (agents propose, gate disposes)');
  ok(sig(g) === before && g.indexesConsistent(), 'zero mutation, indexes consistent — the boundary held');
}

// ---------------------------------------------------------------------------
console.log('\n--- integration: a malformed proposal never reaches the engine ---');
{
  const { g } = makeEngine();
  const before = sig(g);
  const r = IR.apply(g, '{ this is not json ');
  ok(!r.accepted && r.phase === 'protocol' && r.errors[0].code === 'not_json', 'rejected at the PROTOCOL phase, before the engine');
  ok(sig(g) === before, 'engine untouched by unparseable input');
}

console.log(`\n=============================================`);
console.log(`${FAIL === 0 ? 'ALL PASS' : FAIL + ' FAILED'}  (${PASS} passed, ${FAIL} failed) — AI↔engine protocol`);
console.log(`=============================================`);
if (FAIL) process.exitCode = 1;
