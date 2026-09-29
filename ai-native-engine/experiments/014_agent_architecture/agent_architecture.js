'use strict';
// RD-011 — Single vs multi-agent architecture (spine #10).
//
// HONESTY CONSTRAINT (read this first): there is NO real LLM in this file.
// This experiment CANNOT measure LLM quality (whether a critic-LLM "notices"
// mistakes, whether decomposition makes a proposer more accurate). It CAN
// measure something an LLM cannot change: which ARCHITECTURAL LAYER catches
// which FAULT CLASS, deterministically. The proposer here is a deterministic
// stand-in whose output we corrupt with a fault matrix; every catch/escape
// below is a property of the LAYERS, not of any model. Claims about real-LLM
// behavior must be revisited with a live model.
//
// Question: one proposer straight into the RD-002/003 pipeline (A0), vs adding
// an independent critic (A1), vs planner decomposition (A2), vs both (A3) —
// which layer is load-bearing for which fault class?
//
// Method: deterministic fault injection over the SAME correct proposal.
//   F1 syntactic            — malformed IR (missing keys, unknown opcode, wrong JS type)
//   F2 constraint-violating — well-formed but validator-rejectable (cycle-creating
//                             move, set on wrong component type, tombstoned/missing
//                             target, undeclared field)
//   F3 semantic mismatch    — well-formed, validator-PASSING IR that does the WRONG
//                             thing (waters crop-7 when the goal says crop-5, wrong
//                             amount, unrequested side effects)
//   F4 omission             — goal needs N ops, fewer emitted (incl. empty batch)
//
// The critic in A1 is armed with a MACHINE-CHECKABLE GOAL CONTRACT: postconditions
// compiled from the GOAL + pre-state (never from the emitted IR), checked against a
// SIMULATED commit before the real commit, plus a frame condition ("nothing else
// changed"). Two negative controls prove the suite can fail:
//   NC1 — a contract-less critic that merely re-reads the IR (no goal access).
//   NC2 — a TAUTOLOGICAL critic whose "contract" is compiled from the emitted IR
//         itself (the classic test bug from RD-005/RD-007, institutionalized).
// Plus GATE — the same contract check as A1 but run as deterministic code, billed
// at zero extra agent calls: it isolates whether the CONTRACT or the AGENT is the
// load-bearing element.
//
// Measured: escape-to-commit rate per fault class per architecture (deterministic
// counts) + cost as simulated agent-call count. Zero deps. `node agent_architecture.js`.

let failCount = 0;
function check(ok, label, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ' — ' + detail : ''}`);
  if (!ok) failCount++;
}

// --- world fixture (RD-001 tree via parent pointers; RD-004.6 tombstone) -----
function makeWorld() {
  const E = {};
  const add = (id, type, parent, fields = {}) => { E[id] = { id, type, parent, tombstone: false, fields }; };
  add('root', 'root', null);
  add('field-1', 'field', 'root');
  add('field-2', 'field', 'root');
  add('field-3', 'field', 'root');
  add('pond-1', 'field', 'root');
  add('inventory-1', 'inventory', 'root');
  add('crop-2', 'crop', 'field-1', { water: 0, growth: 10, harvested: false, tags: [] });
  add('crop-3', 'crop', 'field-1', { water: 20, growth: 90, harvested: false, tags: [] });
  add('crop-5', 'crop', 'field-1', { water: 0, growth: 40, harvested: false, tags: ['seeded'] });
  add('crop-7', 'crop', 'field-1', { water: 5, growth: 40, harvested: false, tags: [] });
  add('crop-9', 'crop', 'field-1', { water: 0, growth: 55, harvested: false, tags: [] });
  add('sprinkler-1', 'sprinkler', 'field-1', {});
  add('fish-1', 'fish', 'pond-1', { depth: 3 });
  add('crop-666', 'crop', 'field-1', { water: 0, growth: 0, harvested: false, tags: [] });
  E['crop-666'].tombstone = true; // deleted; id never recycled (RD-004.6)
  return E;
}

// --- per-component field declarations (RD-005.1: componentType.fieldName) ----
const META = {
  crop:      { water: 'number', growth: 'number', harvested: 'boolean', tags: 'set' },
  fish:      { depth: 'number' },
  item:      { kind: 'string' },
  sprinkler: {}, field: {}, inventory: {}, root: {},
};

// --- validator + atomic apply (RD-002/003: commit-or-reject; one code path ---
// so the gate's simulation and the real commit CANNOT diverge) ----------------
function validateAndApply(world, batch) {
  if (!Array.isArray(batch)) return { ok: false, reason: 'batch is not an array (malformed IR)' };
  const w = structuredClone(world);
  for (let i = 0; i < batch.length; i++) {
    const op = batch[i];
    const fail = (why) => ({ ok: false, reason: `op[${i}]: ${why}` });
    if (op === null || typeof op !== 'object' || Array.isArray(op)) return fail('op is not an object (malformed IR)');
    if (op.op === 'set') {
      if (typeof op.target !== 'string' || typeof op.component !== 'string' || typeof op.field !== 'string')
        return fail('set: missing/mistyped target|component|field (malformed IR)');
      const e = w[op.target];
      if (!e) return fail(`set: target '${op.target}' MISSING — no such id (RD-004.6 explicit absence)`);
      if (e.tombstone) return fail(`set: target '${op.target}' DELETED — tombstone, type=${e.type} (RD-004.6)`);
      if (e.type !== op.component) return fail(`set: component '${op.component}' not present on entity of type '${e.type}'`);
      const decl = META[e.type][op.field];
      if (!decl) return fail(`set: field '${e.type}.${op.field}' undeclared (RD-005.1: undeclared -> reject)`);
      const typeOk = decl === 'set' ? Array.isArray(op.value) : typeof op.value === decl;
      if (!typeOk) return fail(`set: value ${JSON.stringify(op.value)} is not of declared type '${decl}'`);
      e.fields[op.field] = structuredClone(op.value);
    } else if (op.op === 'move') {
      if (typeof op.target !== 'string' || typeof op.newParent !== 'string')
        return fail('move: missing/mistyped target|newParent (malformed IR)');
      const e = w[op.target], p = w[op.newParent];
      if (!e) return fail(`move: target '${op.target}' MISSING`);
      if (e.tombstone) return fail(`move: target '${op.target}' DELETED (tombstone)`);
      if (!p) return fail(`move: newParent '${op.newParent}' MISSING`);
      if (p.tombstone) return fail(`move: newParent '${op.newParent}' DELETED (tombstone)`);
      for (let cur = op.newParent; cur !== null; cur = w[cur].parent)
        if (cur === op.target) return fail(`move: would create a cycle — '${op.newParent}' is '${op.target}' or its descendant (RD-005.2 acyclicity)`);
      e.parent = op.newParent;
    } else if (op.op === 'create') {
      if (typeof op.id !== 'string' || typeof op.type !== 'string' || typeof op.parent !== 'string')
        return fail('create: missing/mistyped id|type|parent (malformed IR)');
      if (w[op.id]) return fail(`create: id '${op.id}' already exists${w[op.id].tombstone ? ' as a tombstone — ids are never recycled (RD-004.6)' : ''}`);
      if (!META[op.type]) return fail(`create: unknown component type '${op.type}'`);
      const p = w[op.parent];
      if (!p) return fail(`create: parent '${op.parent}' MISSING`);
      if (p.tombstone) return fail(`create: parent '${op.parent}' DELETED (tombstone)`);
      const fields = op.fields || {};
      for (const [f, v] of Object.entries(fields)) {
        const decl = META[op.type][f];
        if (!decl) return fail(`create: field '${op.type}.${f}' undeclared`);
        const typeOk = decl === 'set' ? Array.isArray(v) : typeof v === decl;
        if (!typeOk) return fail(`create: value for '${f}' is not of declared type '${decl}'`);
      }
      w[op.id] = { id: op.id, type: op.type, parent: op.parent, tombstone: false, fields: structuredClone(fields) };
    } else {
      return fail(`unknown opcode '${JSON.stringify(op.op)}' (malformed IR)`);
    }
  }
  return { ok: true, world: w };
}

// --- goals, planner (deterministic stand-in), proposer (deterministic) -------
const GOALS = [
  { id: 'G1', kind: 'water',     target: 'crop-5', amount: 100,                      text: 'water crop-5 by 100' },
  { id: 'G2', kind: 'harvest',   target: 'crop-3', inventory: 'inventory-1', itemKind: 'wheat', text: 'harvest crop-3: set harvested + create a wheat item in inventory-1' },
  { id: 'G3', kind: 'waterMany', targets: ['crop-2', 'crop-5', 'crop-9'], amount: 50, text: 'water crop-2, crop-5, crop-9 by 50 each' },
  { id: 'G4', kind: 'move',      target: 'sprinkler-1', dest: 'field-2',             text: 'move sprinkler-1 under field-2' },
  { id: 'G5', kind: 'tag',       target: 'crop-5', tag: 'watered',                   text: "add tag 'watered' to crop-5" },
];
const goalById = (id) => GOALS.find(g => g.id === id);

function decompose(goal) { // the PLANNER: goal -> atomic subgoals
  switch (goal.kind) {
    case 'waterMany': return goal.targets.map(t => ({ kind: 'water', target: t, amount: goal.amount }));
    case 'harvest': return [
      { kind: 'setHarvested', target: goal.target },
      { kind: 'createItem', inventory: goal.inventory, itemKind: goal.itemKind, seed: goal.target },
    ];
    default: return [goal];
  }
}

function describeSub(sub) {
  switch (sub.kind) {
    case 'water':        return `water ${sub.target} by ${sub.amount}`;
    case 'setHarvested': return `mark ${sub.target} harvested`;
    case 'createItem':   return `create ${sub.itemKind} item in ${sub.inventory}`;
    case 'move':         return `move ${sub.target} under ${sub.dest}`;
    case 'tag':          return `tag ${sub.target} '${sub.tag}'`;
  }
}

function proposeAtomic(sub, world) { // deterministic CORRECT proposal for one subgoal
  switch (sub.kind) {
    case 'water':        return [{ op: 'set', target: sub.target, component: 'crop', field: 'water', value: world[sub.target].fields.water + sub.amount }];
    case 'setHarvested': return [{ op: 'set', target: sub.target, component: 'crop', field: 'harvested', value: true }];
    case 'createItem':   return [{ op: 'create', id: `item-${sub.itemKind}-${sub.seed}`, type: 'item', parent: sub.inventory, fields: { kind: sub.itemKind } }];
    case 'move':         return [{ op: 'move', target: sub.target, newParent: sub.dest }];
    case 'tag':          return [{ op: 'set', target: sub.target, component: 'crop', field: 'tags', value: [...new Set([...world[sub.target].fields.tags, sub.tag])] }];
  }
}
// NOTE: single- and multi-agent proposals are identical BY CONSTRUCTION here.
// This experiment measures CHECKING layers only; whether decomposition improves
// a real proposer's accuracy is explicitly unmeasurable without a live model.
function proposeGoal(goal, world) { return decompose(goal).flatMap(sg => proposeAtomic(sg, world)); }

// --- goal contract: compiled from GOAL + pre-state ONLY (never sees the IR) --
// Postconditions + allow-list (frame). Comparison is semantic (sets canonical),
// per the RD-005 representation-vs-meaning lesson.
function canonVal(v) {
  if (Array.isArray(v)) return JSON.stringify([...v].map(x => JSON.stringify(x)).sort());
  return JSON.stringify(v);
}

function subContract(sub, world, label) {
  switch (sub.kind) {
    case 'water': return {
      posts:  [{ label, cond: { t: 'fieldEquals', id: sub.target, field: 'water', value: world[sub.target].fields.water + sub.amount } }],
      allows: [{ k: 'field', id: sub.target, field: 'water' }],
    };
    case 'setHarvested': return {
      posts:  [{ label, cond: { t: 'fieldEquals', id: sub.target, field: 'harvested', value: true } }],
      allows: [{ k: 'field', id: sub.target, field: 'harvested' }],
    };
    case 'createItem': return {
      posts:  [{ label, cond: { t: 'createdOne', type: 'item', parent: sub.inventory, fields: { kind: sub.itemKind } } }],
      allows: [{ k: 'create', type: 'item', parent: sub.inventory, fields: { kind: sub.itemKind } }],
    };
    case 'move': return {
      posts:  [{ label, cond: { t: 'parentEquals', id: sub.target, parent: sub.dest } }],
      allows: [{ k: 'parent', id: sub.target }],
    };
    case 'tag': return {
      posts:  [{ label, cond: { t: 'fieldEquals', id: sub.target, field: 'tags', value: [...new Set([...world[sub.target].fields.tags, sub.tag])] } }],
      allows: [{ k: 'field', id: sub.target, field: 'tags' }],
    };
  }
}

function compileContract(goal, world, perSubgoal) { // (goal, world) ONLY — no batch parameter, by design
  const posts = [], allows = [];
  decompose(goal).forEach((sub, i) => {
    const label = perSubgoal ? `subgoal[${i}]: ${describeSub(sub)}` : `goal ${goal.id}: ${goal.text}`;
    const c = subContract(sub, world, label);
    posts.push(...c.posts); allows.push(...c.allows);
  });
  return { posts, allows };
}

// NC2's "contract": compiled from the EMITTED IR — satisfied by construction.
// This is the tautology trap (test checks the answer against the answer).
function compileTautological(batch) {
  const posts = [], allows = [];
  if (!Array.isArray(batch)) return { posts, allows };
  for (const op of batch) {
    if (!op || typeof op !== 'object') continue;
    const label = 'tautology (from IR)';
    if (op.op === 'set' && typeof op.target === 'string' && typeof op.field === 'string') {
      posts.push({ label, cond: { t: 'fieldEquals', id: op.target, field: op.field, value: op.value } });
      allows.push({ k: 'field', id: op.target, field: op.field });
    } else if (op.op === 'move' && typeof op.target === 'string') {
      posts.push({ label, cond: { t: 'parentEquals', id: op.target, parent: op.newParent } });
      allows.push({ k: 'parent', id: op.target });
    } else if (op.op === 'create' && typeof op.id === 'string') {
      posts.push({ label, cond: { t: 'createdOne', type: op.type, parent: op.parent, fields: op.fields || {} } });
      allows.push({ k: 'create', type: op.type, parent: op.parent, fields: op.fields || {} });
    }
  }
  return { posts, allows };
}

// --- contract check against a simulated commit -------------------------------
function diffWorlds(before, after) {
  const changes = [];
  for (const id of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const b = before[id], a = after[id];
    if (!b && a) { changes.push({ kind: 'created', id, entity: a }); continue; }
    if (b && !a) { changes.push({ kind: 'vanished', id }); continue; }
    if (b.parent !== a.parent) changes.push({ kind: 'parent', id, from: b.parent, to: a.parent });
    if (b.tombstone !== a.tombstone) changes.push({ kind: 'tombstone', id });
    for (const f of new Set([...Object.keys(b.fields), ...Object.keys(a.fields)]))
      if (canonVal(b.fields[f]) !== canonVal(a.fields[f])) changes.push({ kind: 'field', id, field: f, from: b.fields[f], to: a.fields[f] });
  }
  return changes;
}
function describeChange(ch) {
  if (ch.kind === 'field')   return `${ch.id}.${ch.field}: ${JSON.stringify(ch.from)} -> ${JSON.stringify(ch.to)}`;
  if (ch.kind === 'parent')  return `${ch.id} reparented ${ch.from} -> ${ch.to}`;
  if (ch.kind === 'created') return `new entity ${ch.id} (${ch.entity.type})`;
  return `${ch.id} ${ch.kind}`;
}
function createMatches(matcher, entity) {
  if (entity.type !== matcher.type || entity.parent !== matcher.parent) return false;
  for (const [f, v] of Object.entries(matcher.fields)) if (canonVal(entity.fields[f]) !== canonVal(v)) return false;
  return true;
}

function checkContract(contract, before, after) {
  const failures = [];
  // FRAME: every observed change must be licensed by the goal ("nothing else changed")
  for (const ch of diffWorlds(before, after)) {
    let licensed = false;
    if (ch.kind === 'field')        licensed = contract.allows.some(al => al.k === 'field' && al.id === ch.id && al.field === ch.field);
    else if (ch.kind === 'parent')  licensed = contract.allows.some(al => al.k === 'parent' && al.id === ch.id);
    else if (ch.kind === 'created') licensed = contract.allows.some(al => al.k === 'create' && createMatches(al, ch.entity));
    if (!licensed) failures.push(`FRAME: unlicensed change — ${describeChange(ch)} (the goal did not ask for this)`);
  }
  // POSTCONDITIONS
  for (const p of contract.posts) {
    const c = p.cond;
    let ok, detail;
    if (c.t === 'fieldEquals') {
      const e = after[c.id];
      ok = !!e && !e.tombstone && canonVal(e.fields[c.field]) === canonVal(c.value);
      detail = `${c.id}.${c.field} == ${JSON.stringify(c.value)}, actual ${e ? JSON.stringify(e.fields[c.field]) : 'MISSING'}`;
    } else if (c.t === 'parentEquals') {
      const e = after[c.id];
      ok = !!e && e.parent === c.parent;
      detail = `${c.id}.parent == ${c.parent}, actual ${e ? e.parent : 'MISSING'}`;
    } else if (c.t === 'createdOne') {
      const made = Object.keys(after).filter(id => !before[id]).map(id => after[id]).filter(e => createMatches(c, e));
      ok = made.length === 1;
      detail = `exactly one new ${c.type} ${JSON.stringify(c.fields)} under ${c.parent}, found ${made.length}`;
    }
    if (!ok) failures.push(`POST [${p.label}]: expected ${detail}`);
  }
  return { ok: failures.length === 0, failures };
}

// --- the fault matrix (deterministic transforms of the correct proposal) -----
const clone = structuredClone;
const FAULTS = [
  // F1 — syntactic (malformed IR)
  { id: 'F1-a', cls: 'F1', goal: 'G1', why: "op missing its 'op' key",                          t: (b) => { const c = clone(b); delete c[0].op; return c; } },
  { id: 'F1-b', cls: 'F1', goal: 'G1', why: "unknown opcode 'wattr'",                            t: (b) => { const c = clone(b); c[0].op = 'wattr'; return c; } },
  { id: 'F1-c', cls: 'F1', goal: 'G3', why: 'value is the string "50" where number is declared', t: (b) => { const c = clone(b); c[1].value = String(c[1].value); return c; } },
  { id: 'F1-d', cls: 'F1', goal: 'G2', why: 'an op that is a bare string, not an object',        t: (b) => { const c = clone(b); c[1] = 'create a wheat item'; return c; } },
  { id: 'F1-e', cls: 'F1', goal: 'G4', why: "move op missing 'newParent'",                       t: (b) => { const c = clone(b); delete c[0].newParent; return c; } },
  // F2 — constraint-violating (well-formed, validator-rejectable)
  { id: 'F2-a', cls: 'F2', goal: 'G4', why: 'cycle-creating move: field-1 under its own descendant sprinkler-1', t: () => [{ op: 'move', target: 'field-1', newParent: 'sprinkler-1' }] },
  { id: 'F2-b', cls: 'F2', goal: 'G1', why: 'sets crop.water on fish-1 (wrong component type)',  t: (b) => { const c = clone(b); c[0].target = 'fish-1'; return c; } },
  { id: 'F2-c', cls: 'F2', goal: 'G1', why: 'targets tombstoned crop-666 (deleted)',             t: (b) => { const c = clone(b); c[0].target = 'crop-666'; return c; } },
  { id: 'F2-d', cls: 'F2', goal: 'G1', why: "targets 'crop-404' (no such id)",                   t: (b) => { const c = clone(b); c[0].target = 'crop-404'; return c; } },
  { id: 'F2-e', cls: 'F2', goal: 'G1', why: 'sets undeclared field crop.mana',                   t: (b) => { const c = clone(b); c[0].field = 'mana'; return c; } },
  // F3 — semantic goal-mismatch (validator-PASSING, does the wrong thing)
  { id: 'F3-a', cls: 'F3', goal: 'G1', why: 'waters crop-7 when the goal says crop-5',           t: (b, w) => [{ op: 'set', target: 'crop-7', component: 'crop', field: 'water', value: w['crop-7'].fields.water + 100 }] },
  { id: 'F3-b', cls: 'F3', goal: 'G1', why: 'waters crop-5 by 50 when the goal says 100',        t: (b, w) => [{ op: 'set', target: 'crop-5', component: 'crop', field: 'water', value: w['crop-5'].fields.water + 50 }] },
  { id: 'F3-c', cls: 'F3', goal: 'G1', why: 'does the goal AND sneaks in an unrequested watering of crop-9', t: (b, w) => [...clone(b), { op: 'set', target: 'crop-9', component: 'crop', field: 'water', value: w['crop-9'].fields.water + 100 }] },
  { id: 'F3-d', cls: 'F3', goal: 'G4', why: 'moves sprinkler-1 under field-3 when the goal says field-2', t: (b) => { const c = clone(b); c[0].newParent = 'field-3'; return c; } },
  { id: 'F3-e', cls: 'F3', goal: 'G5', why: "tags crop-5 'harvested' when the goal says 'watered'", t: (b, w) => [{ op: 'set', target: 'crop-5', component: 'crop', field: 'tags', value: [...new Set([...w['crop-5'].fields.tags, 'harvested'])] }] },
  { id: 'F3-f', cls: 'F3', goal: 'G1', why: 'does the goal AND creates an unrequested gold item', t: (b) => [...clone(b), { op: 'create', id: 'item-gold-sneak', type: 'item', parent: 'inventory-1', fields: { kind: 'gold' } }] },
  // F4 — omission (validator-PASSING, incomplete)
  { id: 'F4-a', cls: 'F4', goal: 'G3', why: 'goal needs 3 waterings, emits 2 (crop-9 dropped)',  t: (b) => clone(b).filter(op => op.target !== 'crop-9') },
  { id: 'F4-b', cls: 'F4', goal: 'G2', why: 'harvest flag set but the item-create op dropped',   t: (b) => clone(b).filter(op => op.op !== 'create') },
  { id: 'F4-c', cls: 'F4', goal: 'G1', why: 'empty batch (proposer emitted nothing)',            t: () => [] },
  { id: 'F4-d', cls: 'F4', goal: 'G3', why: 'goal needs 3 waterings, emits 1',                   t: (b) => [clone(b)[0]] },
  // CLEAN — correct proposals; every architecture MUST commit these (false-positive guard)
  ...GOALS.map(g => ({ id: `OK-${g.id}`, cls: 'CLEAN', goal: g.id, why: 'no fault (correct proposal)', t: (b) => b })),
  // representation-vs-meaning guard (RD-005 lesson): same SET, different array
  // order — semantically identical, must commit; a raw-JSON comparator would
  // false-reject it and P1 would catch that.
  { id: 'OK-G5r', cls: 'CLEAN', goal: 'G5', why: 'same tag set, reversed array order (must still commit)', t: (b) => { const c = clone(b); c[0].value = [...c[0].value].reverse(); return c; } },
];
const CLASSES = ['F1', 'F2', 'F3', 'F4', 'CLEAN'];

// --- architectures ------------------------------------------------------------
// calls(n): simulated agent-call count for a goal with n subgoals.
// gates(goal, world): checking layers run BEFORE the real validator+commit.
const ARCH = {
  A0:   { desc: 'proposer -> validator -> commit',
          calls: () => 1,  gates: () => [] },
  GATE: { desc: 'proposer -> deterministic goal-contract gate (code, 0 agent calls) -> validator -> commit',
          calls: () => 1,  gates: (g, w) => [{ label: 'contract-gate(code)', contract: compileContract(g, w, false) }] },
  A1:   { desc: 'proposer -> critic-LLM armed with the goal contract -> validator -> commit',
          calls: () => 2,  gates: (g, w) => [{ label: 'critic+contract', contract: compileContract(g, w, false) }] },
  A2:   { desc: 'planner -> per-subgoal proposers -> per-subgoal contract gates -> validator -> commit',
          calls: (n) => 1 + n, gates: (g, w) => [{ label: 'per-subgoal contracts', contract: compileContract(g, w, true) }] },
  A3:   { desc: 'A2 + whole-goal critic-LLM (planner + critic)',
          calls: (n) => 2 + n, gates: (g, w) => [{ label: 'per-subgoal contracts', contract: compileContract(g, w, true) },
                                                 { label: 'critic+whole-goal contract', contract: compileContract(g, w, false) }] },
  NC1:  { desc: 'NEGATIVE CONTROL: proposer -> contract-less critic (re-reads IR, no goal) -> validator -> commit',
          calls: () => 2,  gates: () => [{ label: 'critic-without-contract', nc: true }] },
  NC2:  { desc: 'NEGATIVE CONTROL: proposer -> critic with TAUTOLOGICAL contract (compiled from the IR) -> validator -> commit',
          calls: () => 2,  gates: () => [{ label: 'critic-tautological', taut: true }] },
};
const ARCH_NAMES = Object.keys(ARCH);

function runPipeline(archName, fault, world) {
  const goal = goalById(fault.goal);
  const n = decompose(goal).length;
  const batch = fault.t(structuredClone(proposeGoal(goal, world)), world);
  const arch = ARCH[archName];
  const agentCalls = arch.calls(n);
  let machineChecks = 0;
  for (const gate of arch.gates(goal, world)) {
    let verdict;
    if (gate.nc) {
      // A critic with no contract has NO grounded basis to reject well-formed IR:
      // deterministically it approves. (A real ungrounded LLM might object
      // stochastically — exactly what we refuse to be load-bearing.)
      verdict = { v: 'approve' };
    } else {
      const contract = gate.taut ? compileTautological(batch) : gate.contract;
      machineChecks++;
      const sim = validateAndApply(world, batch); // SAME code path as the real commit
      if (!sim.ok) verdict = { v: 'no-verdict', why: 'simulation rejected -> defer to validator' };
      else {
        const r = checkContract(contract, world, sim.world);
        verdict = r.ok ? { v: 'approve' } : { v: 'reject', why: r.failures[0], layer: gate.label };
      }
    }
    if (verdict.v === 'reject') return { committed: false, stoppedBy: 'contract', layer: verdict.layer, reason: verdict.why, agentCalls, machineChecks };
  }
  machineChecks++;
  const fin = validateAndApply(world, batch);
  if (!fin.ok) return { committed: false, stoppedBy: 'validator', reason: fin.reason, agentCalls, machineChecks };
  return { committed: true, stoppedBy: null, reason: 'committed', agentCalls, machineChecks };
}

// =============================================================================
console.log('=== RD-011: which ARCHITECTURAL LAYER catches which FAULT CLASS ===');
console.log('HONESTY: no real LLM anywhere in this file. Proposer/planner/critic are');
console.log('deterministic stand-ins; only the LAYER structure is being measured.\n');
for (const a of ARCH_NAMES) console.log(`  ${a.padEnd(5)} ${ARCH[a].desc}`);

const world = makeWorld();

// --- suite integrity 1: the fault taxonomy is what it claims ------------------
// F1/F2 must be validator-rejectable standalone; F3/F4/CLEAN must PASS the bare
// validator (otherwise "the validator catches semantic faults" would be a
// misclassification artifact, inflating single-agent safety).
console.log('\n--- fault-taxonomy integrity (bare validator vs each injected batch) ---');
for (const f of FAULTS) {
  const batch = f.t(structuredClone(proposeGoal(goalById(f.goal), world)), world);
  const r = validateAndApply(world, batch);
  if (f.cls === 'F1' || f.cls === 'F2') check(!r.ok, `${f.id} is validator-rejectable`, r.ok ? 'validator PASSED it — misclassified' : r.reason);
  else check(r.ok, `${f.id} passes the bare validator`, r.ok ? `(${f.cls === 'CLEAN' ? 'clean' : 'fault is invisible to constraints, as designed'})` : `validator rejected: ${r.reason} — misclassified`);
}

// --- suite integrity 2: the contract gate is not vacuous ----------------------
// A poisoned contract (wrong expected amount) must reject the CLEAN G1 batch.
{
  const poisoned = compileContract({ ...goalById('G1'), amount: 999 }, world, false);
  const sim = validateAndApply(world, proposeGoal(goalById('G1'), world));
  const r = checkContract(poisoned, world, sim.world);
  check(!r.ok, 'contract gate is not vacuous (poisoned contract rejects a clean batch)', r.ok ? 'gate approved everything' : r.failures[0]);
}

// --- run the full matrix -------------------------------------------------------
console.log('\n--- run matrix (V = stopped by validator, C = stopped by contract layer, * = COMMITTED) ---');
const results = {}; // results[arch][faultId] = outcome
console.log('  ' + 'fault'.padEnd(7) + ARCH_NAMES.map(a => a.padEnd(6)).join('') + 'injected fault');
for (const f of FAULTS) {
  results[f.id] = {};
  const row = [];
  for (const a of ARCH_NAMES) {
    const r = runPipeline(a, f, world);
    results[f.id][a] = r;
    row.push((r.committed ? '*' : r.stoppedBy === 'validator' ? 'V' : 'C').padEnd(6));
  }
  console.log('  ' + f.id.padEnd(7) + row.join('') + `${f.cls}: ${f.why}`);
}

// --- escape-to-commit rate per class per architecture ---------------------------
console.log('\n--- escape-to-commit rate (faulty batches that reached commit) ---');
const byClass = {};
for (const cls of CLASSES) byClass[cls] = FAULTS.filter(f => f.cls === cls);
console.log('  ' + 'class'.padEnd(7) + ARCH_NAMES.map(a => a.padEnd(8)).join(''));
const escapes = {}; // escapes[arch][cls] = count
for (const a of ARCH_NAMES) { escapes[a] = {}; for (const cls of CLASSES) escapes[a][cls] = byClass[cls].filter(f => results[f.id][a].committed).length; }
for (const cls of CLASSES) {
  const n = byClass[cls].length;
  const cells = ARCH_NAMES.map(a => (cls === 'CLEAN' ? `${escapes[a][cls]}/${n}ok` : `${escapes[a][cls]}/${n}`).padEnd(8));
  console.log('  ' + cls.padEnd(7) + cells.join('') + (cls === 'CLEAN' ? '(committed clean — HIGHER is correct here)' : '(escaped — lower is safer)'));
}

// --- cost: simulated agent calls across the whole matrix ------------------------
console.log('\n--- cost (simulated agent calls summed over all runs; machine checks are code, ~free) ---');
const cost = {};
for (const a of ARCH_NAMES) {
  cost[a] = { agent: 0, machine: 0 };
  for (const f of FAULTS) { cost[a].agent += results[f.id][a].agentCalls; cost[a].machine += results[f.id][a].machineChecks; }
  console.log(`  ${a.padEnd(5)} agent calls: ${String(cost[a].agent).padStart(3)}   machine checks: ${String(cost[a].machine).padStart(3)}`);
}

// --- properties (computed, never asserted in prose only) -------------------------
console.log('\n--- properties ---');
const contractArchs = ['GATE', 'A1', 'A2', 'A3'];

// P1: zero false rejection — every architecture commits every CLEAN batch
{
  const offenders = ARCH_NAMES.filter(a => escapes[a].CLEAN !== byClass.CLEAN.length);
  check(offenders.length === 0, 'P1 zero-false-rejection: all architectures commit all clean batches (incl. reordered-set)', offenders.length ? 'false-rejecting: ' + offenders.join(',') : `${byClass.CLEAN.length}/${byClass.CLEAN.length} clean commits everywhere`);
}
// P2: F1+F2 are stopped 100% by the VALIDATOR in every architecture (added layers contribute nothing)
{
  let allStopped = true, allByValidator = true;
  for (const a of ARCH_NAMES) for (const f of [...byClass.F1, ...byClass.F2]) {
    const r = results[f.id][a];
    if (r.committed) allStopped = false;
    else if (r.stoppedBy !== 'validator') allByValidator = false;
  }
  check(allStopped && allByValidator, 'P2 validator sufficiency: F1/F2 escape rate 0 in ALL architectures, and every stop is the VALIDATOR', 'multi-agent adds zero on syntactic/constraint faults');
}
// P3: A0 is blind to F3/F4 — semantic and omission faults escape 100% without a contract
{
  const f3 = escapes.A0.F3, f4 = escapes.A0.F4;
  check(f3 === byClass.F3.length && f4 === byClass.F4.length, 'P3 A0 blindness: F3/F4 escape the bare pipeline 100%', `F3 ${f3}/${byClass.F3.length}, F4 ${f4}/${byClass.F4.length} — a validator cannot see the goal`);
}
// P4: every architecture WITH a goal-derived contract catches all F3/F4
{
  const offenders = contractArchs.filter(a => escapes[a].F3 !== 0 || escapes[a].F4 !== 0);
  check(offenders.length === 0, 'P4 contract catches: F3/F4 escape rate 0 wherever a goal-derived contract exists', offenders.length ? 'escaping: ' + offenders.join(',') : 'GATE/A1/A2/A3 all at 0');
}
// P5: NC1 — a critic WITHOUT a contract catches nothing beyond A0 (identical escape profile)
{
  const same = CLASSES.every(cls => escapes.NC1[cls] === escapes.A0[cls]);
  check(same, 'P5 negative control NC1: contract-less critic == A0 exactly (an extra agent with no contract adds zero)', CLASSES.map(c => `${c}:${escapes.NC1[c]}=${escapes.A0[c]}`).join(' '));
}
// P6: NC2 — a TAUTOLOGICAL contract (compiled from the IR) catches nothing beyond A0.
// This doubles as the "oracle must be able to fail" proof: NC2 MUST let F3/F4 escape;
// if it caught them, our fault injection or measurement would be broken.
{
  const same = CLASSES.every(cls => escapes.NC2[cls] === escapes.A0[cls]);
  const mustEscape = escapes.NC2.F3 > 0 && escapes.NC2.F4 > 0;
  check(same && mustEscape, 'P6 negative control NC2: tautological contract == A0 exactly (a contract must derive from the GOAL, not the IR)', `F3 escapes ${escapes.NC2.F3}, F4 escapes ${escapes.NC2.F4}`);
}
// P7: the AGENT is not load-bearing — A1 (critic-LLM) catches exactly what GATE (plain code) catches, at +1 call/task
{
  const identical = FAULTS.every(f => results[f.id].A1.committed === results[f.id].GATE.committed);
  check(identical && cost.A1.agent > cost.GATE.agent, 'P7 agent-not-load-bearing: A1 catch profile IDENTICAL to GATE (same contract as plain code)', `marginal catches of billing the critic as an agent: 0; marginal cost: +${cost.A1.agent - cost.GATE.agent} calls`);
}
// P8: planner decomposition adds no CATCHES on this matrix (contracts equal), only cost
{
  const identical = FAULTS.every(f => results[f.id].A2.committed === results[f.id].GATE.committed && results[f.id].A3.committed === results[f.id].A2.committed);
  check(identical && cost.A2.agent > cost.GATE.agent, 'P8 planner adds no catches here: A2 == GATE == A3 on every run; decomposition only relabels WHICH subcontract failed', `A2 cost +${cost.A2.agent - cost.GATE.agent} calls vs GATE; A3 +${cost.A3.agent - cost.GATE.agent}`);
}

// --- computed verdict ------------------------------------------------------------
console.log('\n--- computed verdict ---');
const admissible = ARCH_NAMES.filter(a =>
  escapes[a].CLEAN === byClass.CLEAN.length &&
  ['F1', 'F2', 'F3', 'F4'].every(cls => escapes[a][cls] === 0));
const inadmissible = ARCH_NAMES.filter(a => !admissible.includes(a));
for (const a of ARCH_NAMES) {
  const esc = ['F1', 'F2', 'F3', 'F4'].map(c => `${c}:${escapes[a][c]}`).join(' ');
  console.log(`  ${a.padEnd(5)} ${admissible.includes(a) ? 'ADMISSIBLE  ' : 'INADMISSIBLE'}  escapes[${esc}]  agent calls ${cost[a].agent}`);
}
const winner = admissible.slice().sort((x, y) => cost[x].agent - cost[y].agent)[0];
check(admissible.length > 0, 'verdict: at least one architecture is admissible', admissible.join(','));
check(inadmissible.includes('A0') && inadmissible.includes('NC1') && inadmissible.includes('NC2'),
  'verdict: A0 and both negative controls are inadmissible', 'F3/F4 reach commit without a goal-derived contract');
console.log(`\n  CHEAPEST ADMISSIBLE: ${winner} — ${ARCH[winner].desc}`);
console.log('  Load-bearing element analysis (computed):');
console.log(`    contract (GATE - A0):        +${(escapes.A0.F3 - escapes.GATE.F3) + (escapes.A0.F4 - escapes.GATE.F4)} catches, +0 agent calls`);
console.log(`    critic agent (NC1 - A0):     +${(escapes.A0.F3 - escapes.NC1.F3) + (escapes.A0.F4 - escapes.NC1.F4)} catches, +${cost.NC1.agent - cost.A0.agent} agent calls`);
console.log(`    critic on contract (A1-GATE):+${(escapes.GATE.F3 - escapes.A1.F3) + (escapes.GATE.F4 - escapes.A1.F4)} catches, +${cost.A1.agent - cost.GATE.agent} agent calls`);
console.log(`    planner (A2 - GATE):         +${(escapes.GATE.F3 - escapes.A2.F3) + (escapes.GATE.F4 - escapes.A2.F4)} catches, +${cost.A2.agent - cost.GATE.agent} agent calls`);
console.log('  => the CONTRACT is the load-bearing element; agents are packaging.');
console.log('  UNMEASURED HERE (needs a live model): whether decomposition improves real');
console.log('  proposal quality; whether a critic-LLM helps on goals whose contracts');
console.log('  are NOT machine-checkable. Those are quality claims, not layer claims.');

console.log(`\n${failCount === 0 ? 'ALL PASS' : failCount + ' FAILURE(S)'}`);
if (failCount > 0) process.exitCode = 1;
