/**
 * audit.mjs — STAGE-3 static architectural audit (the deterministic half of "Hostile Audit").
 *
 *   node factory/audit.mjs factory/dataset_vb.jsonl
 *
 * The gate proves self-containment; exec proves it runs; this measures whether the code is
 * architecturally SOUND — the failure class above execution (god objects, dead fields,
 * disconnected systems, weak inter-system interaction). All deterministic via the AST, no
 * model needed. The semantic half (domain identification — "Personality{maxHp,damage}" is
 * really a combat archetype) needs an LLM-judge and is a separate stage.
 *
 * Per module it reports:
 *   systems            = # top-level classes
 *   god-object         = 1 class carrying everything (>=8 methods) or any class >=15 methods
 *   unused fields      = this.X written but never read (dead data)
 *   dead top-level     = declared (class/func/const) but never referenced
 *   disconnected       = a class defined but never instantiated/used anywhere
 *   interaction density= cross-class references (System↔System wiring — the D&H/Cursebound signal)
 */
import { readFileSync, writeFileSync } from 'fs';
import * as acorn from 'acorn';

const IN = process.argv[2];
const FILTER = process.argv.includes('--filter');   // also write <in>.auditpass.jsonl
if (!IN) { console.error('usage: node audit.mjs <dataset.jsonl> [--filter]'); process.exit(1); }

function walk(node, visit, parent = null) {
  if (!node || typeof node.type !== 'string') return;
  visit(node, parent);
  for (const k in node) {
    if (k === 'type' || k === 'start' || k === 'end' || k === 'loc' || k === 'range') continue;
    const v = node[k];
    if (Array.isArray(v)) v.forEach(c => c && typeof c.type === 'string' && walk(c, visit, node));
    else if (v && typeof v.type === 'string') walk(v, visit, node);
  }
}
function parse(code) {
  for (const st of ['module', 'script']) {
    try { return acorn.parse(code, { ecmaVersion: 'latest', sourceType: st, allowReturnOutsideFunction: true }); } catch {}
  }
  return null;
}

function auditModule(code) {
  const ast = parse(code);
  if (!ast) return null;

  // top-level declarations
  const classNodes = [];
  const topNames = new Map();         // name -> declaration node
  for (const n of ast.body) {
    const d = (n.type === 'ExportNamedDeclaration' || n.type === 'ExportDefaultDeclaration') && n.declaration ? n.declaration : n;
    if (d.type === 'ClassDeclaration' && d.id) { classNodes.push(d); topNames.set(d.id.name, d); }
    else if (d.type === 'FunctionDeclaration' && d.id) topNames.set(d.id.name, d);
    else if (d.type === 'VariableDeclaration') for (const v of d.declarations) if (v.id.type === 'Identifier') topNames.set(v.id.name, d);
  }
  const classNames = new Set(classNodes.map(c => c.id.name));

  // count identifier references by name across the whole module (excluding member property keys)
  const refs = new Map();
  walk(ast, (node, parent) => {
    if (node.type === 'Identifier') {
      // skip the property side of `a.b` (b), and object keys
      if (parent && parent.type === 'MemberExpression' && parent.property === node && !parent.computed) return;
      if (parent && parent.type === 'Property' && parent.key === node && !parent.computed) return;
      refs.set(node.name, (refs.get(node.name) || 0) + 1);
    }
  });
  // a declaration's own id counts as 1 ref; "used" means >1
  const dead = [...topNames.keys()].filter(name => (refs.get(name) || 0) <= 1);
  const disconnected = classNodes.filter(c => (refs.get(c.id.name) || 0) <= 1).map(c => c.id.name);

  // per class: methods, this-field writes vs reads, and DI interaction.
  // DI interaction = a call on an INJECTED dependency: this.<field>.method(), where <field>
  // was assigned from a constructor param. This is real System↔System wiring — and unlike
  // class-name counting, it correctly rewards dependency injection over `new`-style coupling
  // AND ignores internal data-structure ops (this.list.push is not a system interaction).
  let methodsMax = 0, unusedFields = 0, interaction = 0;
  for (const c of classNodes) {
    let methods = 0;
    const writes = new Set(), reads = new Set();
    const paramNames = new Set(), injected = new Set();
    const ctor = c.body.body.find(m => m.type === 'MethodDefinition' && m.key.type === 'Identifier' && m.key.name === 'constructor');
    if (ctor) for (const p of ctor.value.params) if (p.type === 'Identifier') paramNames.add(p.name);
    // fields assigned from a constructor param = injected dependencies
    walk(c.body, (node) => {
      if (node.type === 'AssignmentExpression' && node.operator === '=' && node.left.type === 'MemberExpression'
        && node.left.object.type === 'ThisExpression' && !node.left.computed && node.left.property.type === 'Identifier'
        && node.right.type === 'Identifier' && paramNames.has(node.right.name)) injected.add(node.left.property.name);
    });
    walk(c.body, (node, parent) => {
      if (node.type === 'MethodDefinition') methods++;
      if (node.type === 'MemberExpression' && node.object.type === 'ThisExpression' && !node.computed && node.property.type === 'Identifier') {
        const isWrite = parent && parent.type === 'AssignmentExpression' && parent.left === node && parent.operator === '=';
        (isWrite ? writes : reads).add(node.property.name);
      }
      if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression') {
        const o = node.callee.object;       // this.<injectedField>.method()
        if (o.type === 'MemberExpression' && o.object.type === 'ThisExpression' && !o.computed
          && o.property.type === 'Identifier' && injected.has(o.property.name)) interaction++;
      }
    });
    for (const f of writes) if (!reads.has(f)) unusedFields++;
    methodsMax = Math.max(methodsMax, methods);
  }
  const godObject = (classNodes.length === 1 && methodsMax >= 8) || methodsMax >= 15;

  return { systems: classNodes.length, godObject, unusedFields, dead: dead.length,
           disconnected: disconnected.length, interaction };
}

const rows = readFileSync(IN, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
let n = 0, sysSum = 0, god = 0, unusedSum = 0, deadSum = 0, discSum = 0, interSum = 0, noParse = 0, singleClass = 0;
let dropMonolith = 0, dropOrphan = 0;
const passRows = [];
for (const r of rows) {
  const m = r.messages[2].content.match(/```\w*\n([\s\S]*?)```/);
  if (!m) continue;
  const a = auditModule(m[1]);
  if (!a) { noParse++; continue; }
  n++; sysSum += a.systems; if (a.godObject) god++; if (a.systems <= 1) singleClass++;
  unusedSum += a.unusedFields; deadSum += a.dead; discSum += a.disconnected; interSum += a.interaction;
  // run-4 filter: drop high-confidence architectural failures
  const separationAsked = /separated game systems|separate.*systems|each system/i.test(r.messages[1].content);
  if (separationAsked && a.systems <= 1) { dropMonolith++; continue; }   // asked for N systems, built a monolith
  if (a.disconnected > 0) { dropOrphan++; continue; }                    // a class defined but never used
  passRows.push(r);
}
const avg = (s) => (s / n).toFixed(2);
const pct = (c) => `${(100 * c / n).toFixed(1)}%`;
console.log(`\n=== stage-3 architectural audit: ${IN} (${n} modules) ===`);
console.log(`  avg systems (classes)/module:   ${avg(sysSum)}`);
console.log(`  single-class modules:           ${singleClass} (${pct(singleClass)})`);
console.log(`  GOD-OBJECTS (1 class, many resp):${god} (${pct(god)})`);
console.log(`  avg interaction density:        ${avg(interSum)}   (cross-system references — higher = richer)`);
console.log(`  unused fields (dead data):      ${unusedSum} total, ${avg(unusedSum)}/module`);
console.log(`  dead top-level decls:           ${deadSum} total, ${avg(deadSum)}/module`);
console.log(`  disconnected systems:           ${discSum} total, ${avg(discSum)}/module`);
if (noParse) console.log(`  unparseable: ${noParse}`);
if (FILTER) {
  const out = IN.replace(/\.jsonl$/, '') + '.auditpass.jsonl';
  writeFileSync(out, passRows.map(r => JSON.stringify(r)).join('\n') + '\n', 'utf8');
  console.log(`\n  --filter: kept ${passRows.length} -> ${out}`);
  console.log(`    (dropped ${dropMonolith} monolith-when-separation-asked + ${dropOrphan} orphan-class)`);
}
console.log(`\n  (domain-identification accuracy — "Personality{maxHp,damage}" — is the LLM-judge half, not measured here)`);
