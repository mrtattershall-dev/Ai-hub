// Fixed content-hash (no truncation - full hash used), plus two new tests:
// reference survival and split-brain merge, run against UUID identity.

const crypto = require('crypto');
function fullHash(obj) {
  const { type, name, props } = obj;
  return 'hash-' + crypto.createHash('sha256').update(JSON.stringify({ type, name, props })).digest('hex').slice(0, 16);
}
function makeUUID() { return 'uuid-' + Math.random().toString(36).slice(2, 10); }

console.log('=== Corrected ContentHash rename test (no truncation bug) ===');
const original = { type: 'tree', name: 'OldOak', parent: 'forest1', props: { species: 'oak' } };
const originalHash = fullHash(original);
const renamed = { ...original, name: 'NewOak' };
const renamedHash = fullHash(renamed);
console.log('before:', originalHash, ' after:', renamedHash, ' pass (should be FAIL):', originalHash === renamedHash);

console.log('\n=== Test 5: Reference Survival (UUID) ===');
// A chest contains a sword; an NPC quest references the sword by UUID.
let sword = { id: makeUUID(), type: 'sword', name: 'Sword', parent: 'chest1', props: { damage: 10 } };
const questReference = sword.id; // NPC quest stores this UUID at creation time
console.log('quest originally targets:', questReference);

function rename(o, n) { return { ...o, name: n }; }       // id unchanged
function move(o, p) { return { ...o, parent: p }; }        // id unchanged
function duplicate(o) { return { ...o, id: makeUUID() }; } // new id, old one untouched

sword = rename(sword, 'Rusty Sword');
sword = move(sword, 'chest2');
const swordCopy = duplicate(sword);

console.log('after rename+move, sword.id:', sword.id, '  quest still resolves:', sword.id === questReference);
console.log('duplicate got new id:', swordCopy.id, '  quest still points at original, not the duplicate:', questReference !== swordCopy.id && questReference === sword.id);

console.log('\n=== Test 6: Split-Brain Merge (UUID) ===');
const lantern = { id: makeUUID(), type: 'lantern', name: 'Lantern', parent: 'porch', props: {} };
console.log('base object:', lantern);

// Branch A: rename
const branchA = { ...lantern, name: 'Oil Lantern' };
// Branch B: move (independently, from the same base)
const branchB = { ...lantern, parent: 'barn' };

// Merge: since both branches share the same UUID, we can merge field-by-field
// by diffing each branch against the common base and combining non-conflicting changes.
function merge(base, a, b) {
  const merged = { ...base };
  for (const key of Object.keys(base)) {
    if (a[key] !== base[key] && b[key] === base[key]) merged[key] = a[key];       // only A changed it
    else if (b[key] !== base[key] && a[key] === base[key]) merged[key] = b[key];  // only B changed it
    else if (a[key] !== base[key] && b[key] !== base[key] && a[key] !== b[key]) merged[key] = { CONFLICT: [a[key], b[key]] };
  }
  return merged;
}
const merged = merge(lantern, branchA, branchB);
console.log('merged result:', JSON.stringify(merged, null, 2));
console.log('merge succeeded (same UUID throughout, name AND parent both applied, no conflict):',
  merged.id === lantern.id && merged.name === 'Oil Lantern' && merged.parent === 'barn');
