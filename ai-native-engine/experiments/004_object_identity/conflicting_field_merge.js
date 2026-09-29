// RD-004.5: Conflicting field merge.
// Question: can the merge logic DETECT that two branches modified the SAME
// field on the SAME UUID-identified object, and surface that as a visible
// conflict, rather than silently picking a winner?

function merge(base, a, b) {
  const merged = { ...base };
  const conflicts = [];
  for (const key of Object.keys(base)) {
    const aChanged = a[key] !== base[key];
    const bChanged = b[key] !== base[key];
    if (aChanged && !bChanged) {
      merged[key] = a[key]; // only A changed it - no conflict
    } else if (bChanged && !aChanged) {
      merged[key] = b[key]; // only B changed it - no conflict
    } else if (aChanged && bChanged && a[key] !== b[key]) {
      // BOTH changed it, to DIFFERENT values - this must be surfaced, not resolved
      conflicts.push({ object: base.id, field: key, branchA: a[key], branchB: b[key] });
      merged[key] = { __CONFLICT__: true, branchA: a[key], branchB: b[key] };
    }
    // if both changed it to the SAME value, no conflict - merged[key] already correct via base spread + either branch
  }
  return { merged, conflicts };
}

const base = { id: 'uuid-L1', type: 'lantern', name: 'Lantern', parent: 'House', props: {} };
const branchA = { ...base, name: 'Oil Lantern' };
const branchB = { ...base, name: 'Brass Lantern' };

const { merged, conflicts } = merge(base, branchA, branchB);

console.log('Base:', JSON.stringify(base));
console.log('Branch A:', JSON.stringify(branchA));
console.log('Branch B:', JSON.stringify(branchB));
console.log('\nMerge result:', JSON.stringify(merged, null, 2));
console.log('\nConflicts detected:', JSON.stringify(conflicts, null, 2));

console.log('\n--- Verdict ---');
console.log('Did it silently pick a winner? ', merged.name === 'Oil Lantern' || merged.name === 'Brass Lantern');
console.log('Did it surface the conflict explicitly?', conflicts.length === 1 && conflicts[0].field === 'name' && conflicts[0].object === base.id);
