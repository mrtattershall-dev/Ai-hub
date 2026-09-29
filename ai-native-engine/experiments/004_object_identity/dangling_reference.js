'use strict';
// RD-004.6 — Dangling-reference lifetime (closes an RD-004 open thread).
//
// A quest holds a sword's UUID. The sword is deleted. Later a NEW sword is
// created. What does the quest's reference resolve to?
//
// RD-004's design intent: explicit absence or a migration layer are acceptable;
// SILENT REASSIGNMENT (the old reference quietly resolving to some other live
// object) is a bug. We make that testable by running candidate store designs
// against the properties, same as the identity and policy suites. Zero deps.

let SEQ = 0;
function makeUUID() { return 'uuid-' + (SEQ++).toString(36); }

// --- Candidate A: UUID-keyed map, HARD delete (key removed) ----------------
function HardDeleteStore() {
  const objs = new Map(); // uuid -> object
  return {
    name: 'HardDelete',
    create(props) { const id = makeUUID(); const o = { id, ...props }; objs.set(id, o); return o; },
    delete(id) { objs.delete(id); },
    // resolve MUST distinguish "no such id" from a real stored null.
    resolve(id) { return objs.has(id) ? { found: true, object: objs.get(id) } : { found: false, reason: 'missing' }; },
    danglingRefs(refs) { return refs.filter(id => !objs.has(id)); },
  };
}

// --- Candidate B: UUID-keyed map, TOMBSTONE on delete ----------------------
function TombstoneStore() {
  const objs = new Map();
  return {
    name: 'Tombstone',
    create(props) { const id = makeUUID(); const o = { id, ...props }; objs.set(id, o); return o; },
    delete(id) { const o = objs.get(id); if (o) objs.set(id, { id, __deleted__: true, type: o.type, lastKnownName: o.name }); },
    resolve(id) {
      const o = objs.get(id);
      if (!o) return { found: false, reason: 'missing' };
      if (o.__deleted__) return { found: false, reason: 'deleted', tombstone: o };
      return { found: true, object: o };
    },
    danglingRefs(refs) { return refs.filter(id => { const o = objs.get(id); return !o || o.__deleted__; }); },
  };
}

// --- Candidate C: id FREELIST — recycles deleted ids (the suspected bug) ----
function FreelistStore() {
  const objs = new Map();
  const freed = [];
  return {
    name: 'Freelist',
    create(props) {
      const id = freed.length ? freed.pop() : makeUUID(); // REUSES a dead id
      const o = { id, ...props }; objs.set(id, o); return o;
    },
    delete(id) { if (objs.delete(id)) freed.push(id); },
    resolve(id) { return objs.has(id) ? { found: true, object: objs.get(id) } : { found: false, reason: 'missing' }; },
    danglingRefs(refs) { return refs.filter(id => !objs.has(id)); },
  };
}

// --- property suite ---------------------------------------------------------
function runSuite(makeStore) {
  const store = makeStore();
  const results = [];

  // Setup: sword created, quest captures its id, sword deleted, NEW sword made.
  const sword = store.create({ type: 'sword', name: 'Excalibur', damage: 10 });
  const questRef = sword.id;
  store.delete(sword.id);
  const newSword = store.create({ type: 'sword', name: 'Excalibur', damage: 10 }); // identical content
  const r = store.resolve(questRef);

  // 1. No silent reassignment: the old ref must NOT resolve to the new sword.
  const reassigned = r.found && r.object && r.object.id === questRef && r.object !== sword && newSword.id === questRef;
  results.push(['no silent reassignment (deleted ref never resolves to a new object)', !reassigned,
    `newSword.id=${newSword.id} questRef=${questRef} resolved.found=${r.found}`]);

  // 2. Explicit absence: resolving a deleted ref yields a detectable signal,
  //    not an ambiguous undefined that reads like a value.
  const explicit = r.found === false && typeof r.reason === 'string';
  results.push(['explicit absence (detectable "not here", with a reason)', explicit, `reason=${r.reason || 'none'}`]);

  // 3. Recreate does not resurrect (RD-004 consistency): new object has a new id.
  results.push(['recreate gets a fresh identity, old ref stays dangling', newSword.id !== questRef,
    `old=${questRef} new=${newSword.id}`]);

  // 4. Integrity detectable: the store can enumerate dangling refs for a
  //    migration/cleanup pass.
  const dangling = store.danglingRefs([questRef, newSword.id]);
  results.push(['dangling refs are enumerable (migration hook exists)', dangling.length === 1 && dangling[0] === questRef,
    `dangling=${JSON.stringify(dangling)}`]);

  return results;
}

for (const make of [HardDeleteStore, TombstoneStore, FreelistStore]) {
  const store = make();
  console.log(`\n=== Store: ${store.name} ===`);
  for (const [name, pass, detail] of runSuite(make)) {
    console.log(`${pass ? 'PASS' : 'FAIL'} - ${name}  (${detail})`);
  }
}

console.log('\n=== verdict ===');
console.log('A store is ADMISSIBLE iff it satisfies "no silent reassignment" AND "explicit absence".');
for (const make of [HardDeleteStore, TombstoneStore, FreelistStore]) {
  const rs = runSuite(make);
  const noReassign = rs[0][1], explicit = rs[1][1];
  const store = make();
  console.log(`  ${store.name.padEnd(10)} ${noReassign && explicit ? 'ADMISSIBLE' : 'INADMISSIBLE'}` +
    `${!noReassign ? ' — SILENT REASSIGNMENT' : ''}${!explicit ? ' — absence not explicit' : ''}`);
}
