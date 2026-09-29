'use strict';
// RD-005.1 — Where do per-field fold semantics live?
//
// RD-005 decided resolution is chosen by a field's semantics (additive / max /
// set / label...). This card asks WHERE that declaration lives:
//   * Global-flat schema : one central map fieldName -> semantics.
//   * Component-scoped    : each component declares its own fields' semantics,
//                           keyed by componentType.fieldName.
//
// Falsifiable difference: two DIFFERENT component types legitimately reuse a
// field name with DIFFERENT semantics (enemy.level is "max"; a skill's level
// is "additive"). A flat namespace cannot hold both. Zero deps.

// Component declarations — each component owns its fields' semantics locally.
const enemyComponent = { type: 'enemy', fields: { level: 'max', hp: 'max' } };
const skillComponent = { type: 'skill', fields: { level: 'additive', xp: 'additive' } };
const components = [enemyComponent, skillComponent];

// --- Global-flat: merge everything into one fieldName -> semantics map -------
function GlobalFlatSchema(comps) {
  const map = new Map();
  const collisions = [];
  for (const c of comps) for (const [f, sem] of Object.entries(c.fields)) {
    if (map.has(f) && map.get(f) !== sem) collisions.push(f); // silent clobber
    map.set(f, sem);
  }
  return {
    name: 'GlobalFlat',
    collisions,
    semanticsFor(type, field) { return map.has(field) ? map.get(field) : 'defer'; },
  };
}

// --- Component-scoped: key by type.field, no cross-type collision ------------
function ComponentScopedSchema(comps) {
  const map = new Map();
  for (const c of comps) for (const [f, sem] of Object.entries(c.fields)) {
    map.set(`${c.type}.${f}`, sem);
  }
  return {
    name: 'ComponentScoped',
    collisions: [],
    semanticsFor(type, field) { const k = `${type}.${field}`; return map.has(k) ? map.get(k) : 'defer'; },
    // extensibility: a NEW component brings its own entries; nothing central is edited.
    register(component) { for (const [f, sem] of Object.entries(component.fields)) map.set(`${component.type}.${f}`, sem); },
  };
}

function runSuite(schema) {
  const r = [];
  // 1. Same-type consistency: same field on two enemy instances resolves same.
  r.push(['same-type consistency', schema.semanticsFor('enemy', 'level') === schema.semanticsFor('enemy', 'level')]);
  // 2. Namespace safety: enemy.level=max AND skill.level=additive both correct.
  const enemyLevel = schema.semanticsFor('enemy', 'level');
  const skillLevel = schema.semanticsFor('skill', 'level');
  r.push([`namespace safety (enemy.level=max, skill.level=additive)`,
    enemyLevel === 'max' && skillLevel === 'additive', `got enemy=${enemyLevel} skill=${skillLevel}`]);
  // 3. Undeclared field defaults to 'defer' (never guesses / crashes).
  r.push(['undeclared field -> defer', schema.semanticsFor('enemy', 'mysteryField') === 'defer']);
  return r;
}

for (const schema of [GlobalFlatSchema(components), ComponentScopedSchema(components)]) {
  console.log(`\n=== Schema location: ${schema.name} ===`);
  if (schema.collisions.length) console.log(`  ! field-name collisions flattened: ${schema.collisions.join(', ')}`);
  for (const [name, pass, detail] of runSuite(schema)) console.log(`${pass ? 'PASS' : 'FAIL'} - ${name}${detail ? '  (' + detail + ')' : ''}`);
}

// extensibility demo: adding a component to the scoped schema needs no central edit
const scoped = ComponentScopedSchema(components);
scoped.register({ type: 'inventory', fields: { gold: 'additive' } });
console.log(`\nextensibility: after registering 'inventory' with no central-map edit, inventory.gold = ${scoped.semanticsFor('inventory', 'gold')}`);

console.log('\n=== verdict ===');
console.log('Global-flat silently clobbers reused field names across types (enemy.level vs skill.level).');
console.log('Component-scoped keys by type.field: no collision, and new components self-register.');
