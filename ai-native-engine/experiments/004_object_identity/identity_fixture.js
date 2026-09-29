// RD-004: Object identity invariant tests, run against three candidate schemes.
// Each scheme implements the same operations: create, rename, move, duplicate,
// delete, recreate, and a simple content hash for comparison.
// We check each invariant from the design doc and report pass/fail per scheme.

function makeUUID() {
  return 'uuid-' + Math.random().toString(36).slice(2, 10);
}

function contentHash(obj) {
  // naive stand-in for a real hash: stringify the semantically meaningful fields
  const { type, name, props } = obj;
  return 'hash-' + Buffer.from(JSON.stringify({ type, name, props })).toString('base64').slice(0, 16);
}

// --- Scheme A: UUID identity (assigned once at creation, never recomputed) ---
const UUIDScheme = {
  name: 'UUID',
  create(obj) { return { ...obj, id: makeUUID() }; },
  rename(o, newName) { return { ...o, name: newName }; }, // id unchanged
  move(o, newParent) { return { ...o, parent: newParent }; }, // id unchanged
  duplicate(o) { return { ...o, id: makeUUID() }; }, // new id
  delete(o) { return null; },
  recreate(template) { return { ...template, id: makeUUID() }; }, // fresh id, never reused
};

// --- Scheme B: Content-hash identity (id derived from current content) ---
const ContentHashScheme = {
  name: 'ContentHash',
  create(obj) { const o = { ...obj }; o.id = contentHash(o); return o; },
  rename(o, newName) { const n = { ...o, name: newName }; n.id = contentHash(n); return n; }, // id CHANGES
  move(o, newParent) { const n = { ...o, parent: newParent }; n.id = contentHash(n); return n; }, // id changes if parent is in hash
  duplicate(o) { const n = { ...o }; n.id = contentHash(n); return n; }, // SAME id as original if content identical
  delete(o) { return null; },
  recreate(template) { const n = { ...template }; n.id = contentHash(n); return n; }, // same id if same content
};

// --- Scheme C: Path-derived identity (id = its location in the tree) ---
const PathScheme = {
  name: 'PathDerived',
  create(obj) { return { ...obj, id: obj.parent ? `${obj.parent}/${obj.name}` : obj.name }; },
  rename(o, newName) { const parent = o.id.includes('/') ? o.id.slice(0, o.id.lastIndexOf('/')) : null; return { ...o, name: newName, id: parent ? `${parent}/${newName}` : newName }; },
  move(o, newParent) { return { ...o, parent: newParent, id: `${newParent}/${o.name}` }; },
  duplicate(o) { return { ...o, id: o.id + '_copy' }; }, // must be renamed to avoid path collision
  delete(o) { return null; },
  recreate(template) { return { ...template, id: template.parent ? `${template.parent}/${template.name}` : template.name }; }, // SAME id as whatever existed at that path before
};

const schemes = [UUIDScheme, ContentHashScheme, PathScheme];

function runInvariantSuite(scheme) {
  const results = [];

  // 1. Rename does not change identity
  let obj = scheme.create({ type: 'tree', name: 'OldOak', parent: 'forest1', props: { species: 'oak' } });
  const idBeforeRename = obj.id;
  const renamed = scheme.rename(obj, 'NewOak');
  results.push({ invariant: 'rename preserves identity', pass: renamed.id === idBeforeRename, before: idBeforeRename, after: renamed.id });

  // 2. Move does not change identity
  obj = scheme.create({ type: 'tree', name: 'Pine', parent: 'forest1', props: { species: 'pine' } });
  const idBeforeMove = obj.id;
  const moved = scheme.move(obj, 'forest2');
  results.push({ invariant: 'move preserves identity', pass: moved.id === idBeforeMove, before: idBeforeMove, after: moved.id });

  // 3. Duplicate creates a NEW identity
  obj = scheme.create({ type: 'rock', name: 'Boulder', parent: 'field1', props: { size: 'large' } });
  const dup = scheme.duplicate(obj);
  results.push({ invariant: 'duplicate creates new identity', pass: dup.id !== obj.id, original: obj.id, duplicate: dup.id });

  // 4. Delete-then-recreate does NOT resurrect the old identity
  obj = scheme.create({ type: 'barn', name: 'RedBarn', parent: 'farm1', props: { color: 'red' } });
  const originalId = obj.id;
  scheme.delete(obj);
  const recreated = scheme.recreate({ type: 'barn', name: 'RedBarn', parent: 'farm1', props: { color: 'red' } });
  results.push({ invariant: 'delete-then-recreate gets a new identity', pass: recreated.id !== originalId, original: originalId, recreated: recreated.id });

  return results;
}

for (const scheme of schemes) {
  console.log(`\n=== Scheme: ${scheme.name} ===`);
  const results = runInvariantSuite(scheme);
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'} - ${r.invariant}`, JSON.stringify(r));
  }
}
