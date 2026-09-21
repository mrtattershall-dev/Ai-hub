/**
 * mutate.mjs - the frozen BIND-1 mutation family, applied by AST inside one function.
 *
 *   node legasus/mutate.mjs <subject-file> <function-name> <out-dir>
 *
 * Generic on purpose: every operator is chosen by syntactic shape, never by what the code
 * means. One mutant per applicable site. A mutant that does not parse is INVALID_MUTANT and
 * is kept in the manifest as such - it is never repaired.
 *
 * The manifest records, per mutant, the byte offsets of the function and of the mutation
 * site IN THE MUTANT FILE (re-parsed after splicing, so nothing is assumed about how the
 * edit moved things).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { locateFunction } from './coverage.mjs';

const [subjectArg, fnName, outArg] = process.argv.slice(2);
if (!subjectArg || !fnName || !outArg) {
  console.error('usage: node legasus/mutate.mjs <subject-file> <function-name> <out-dir>');
  process.exit(2);
}
const subject = resolve(subjectArg);
const outDir = resolve(outArg);
mkdirSync(join(outDir, 'mutants'), { recursive: true });

const src = readFileSync(subject, 'utf8');
const region = locateFunction(src, fnName);
if (!region) { console.error(`no function named ${fnName} in ${subject}`); process.exit(2); }
const fn = region.node;

/** Generic child-node walker: no knowledge of node kinds beyond "has a type". */
function walk(node, visit, parent = null) {
  if (!node || typeof node.type !== 'string') return;
  visit(node, parent);
  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'start' || key === 'end') continue;
    const v = node[key];
    if (Array.isArray(v)) { for (const c of v) walk(c, visit, node); }
    else if (v && typeof v.type === 'string') walk(v, visit, node);
  }
}

const splice = (start, end, text) => src.slice(0, start) + text + src.slice(end);
const between = (a, b, re) => { const m = src.slice(a, b).match(re); return m ? a + m.index : -1; };

const mutants = [];
const add = (family, site, describe, start, end, text) =>
  mutants.push({ family, site, describe, source: splice(start, end, text) });

// RETURN_EMPTY / RETURN_UNDEFINED: the whole body.
add('RETURN_EMPTY', region.bodyStart + 1, 'body := return []', region.bodyStart, region.bodyEnd, '{ return []; }');
add('RETURN_UNDEFINED', region.bodyStart + 1, 'body := return undefined', region.bodyStart, region.bodyEnd, '{ return undefined; }');

walk(fn.body, (n) => {
  if (n.type === 'IfStatement' || n.type === 'ConditionalExpression') {
    const t = n.test;
    add('INVERT_COND', t.start, `invert test @${t.start}`, t.start, t.end, `!(${src.slice(t.start, t.end)})`);
  }
  if (n.type === 'IfStatement') {
    const c = n.consequent;
    add('DROP_BRANCH', c.start, `drop consequent @${c.start}`, c.start, c.end, '{}');
    if (n.alternate) {
      const elseAt = between(n.consequent.end, n.alternate.start, /\belse\b/);
      if (elseAt >= 0) add('DROP_BRANCH', n.alternate.start, `drop else @${n.alternate.start}`, elseAt, n.alternate.end, '');
    }
  }
  if (n.type === 'Literal' && typeof n.value === 'number') {
    add('BOUNDARY', n.start, `${n.raw} := ${n.value + 1}`, n.start, n.end, String(n.value + 1));
    add('BOUNDARY', n.start, `${n.raw} := ${n.value - 1}`, n.start, n.end, String(n.value - 1));
  }
  if (n.type === 'BinaryExpression' && ['<', '<=', '>', '>='].includes(n.operator)) {
    const swap = { '<': '<=', '<=': '<', '>': '>=', '>=': '>' }[n.operator];
    const opAt = between(n.left.end, n.right.start, new RegExp(n.operator.replace(/[<>=]/g, '\\$&')));
    if (opAt >= 0) add('BOUNDARY', opAt, `${n.operator} := ${swap}`, opAt, opAt + n.operator.length, swap);
  }
  if (n.type === 'ExpressionStatement' && ['AssignmentExpression', 'UpdateExpression', 'CallExpression'].includes(n.expression.type)) {
    add('DROP_EFFECT', n.start, `drop ${n.expression.type} @${n.start}`, n.start, n.end, ';');
  }
  if (n.type === 'TryStatement' && n.handler) {
    const b = n.handler.body;
    add('EXCEPTION', b.start, `swallow catch @${b.start}`, b.start, b.end, '{}');
    const param = n.handler.param ? src.slice(n.handler.param.start, n.handler.param.end) : null;
    add('EXCEPTION', b.start, `propagate catch @${b.start}`, b.start, b.end, param ? `{ throw ${param}; }` : '{ throw new Error("propagated"); }');
  }
});

// Materialise, re-parse each mutant for its own offsets, and syntax-check it.
const manifest = [];
mutants.forEach((m, i) => {
  const id = `M${String(i + 1).padStart(3, '0')}-${m.family}`;
  const file = join(outDir, 'mutants', `${id}.js`);
  writeFileSync(file, m.source);
  const check = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  let offsets = null;
  if (check.status === 0) {
    try {
      const r = locateFunction(m.source, fnName);
      // A single-site splice starts AT the site, so the site's start offset is unchanged in
      // the mutant; the function's end moves. Both are re-read from the mutant's own parse.
      offsets = r ? { fnStart: r.fnStart, fnEnd: r.fnEnd, site: m.site } : null;
    } catch { offsets = null; }
  }
  manifest.push({
    id, family: m.family, describe: m.describe, file,
    valid: check.status === 0 && !!offsets,
    invalidReason: check.status !== 0 ? (check.stderr || '').split('\n').find((l) => /Error/.test(l)) || 'node --check failed' : (!offsets ? 'function not found after splice' : null),
    region: offsets,
  });
});

const families = {};
for (const m of manifest) { families[m.family] = families[m.family] || { total: 0, valid: 0 }; families[m.family].total++; if (m.valid) families[m.family].valid++; }
const summary = {
  subject, fnName,
  region: { fnStart: region.fnStart, fnEnd: region.fnEnd },
  families,
  notApplicable: ['EXCEPTION'].filter((f) => !families[f]),
  mutants: manifest,
};
writeFileSync(join(outDir, 'mutants.json'), JSON.stringify(summary, null, 2));
console.log(`subject: ${subject} :: ${fnName} [${region.fnStart}, ${region.fnEnd})`);
for (const [f, c] of Object.entries(families)) console.log(`  ${f.padEnd(17)} ${c.valid}/${c.total} valid`);
if (summary.notApplicable.length) console.log(`  not applicable: ${summary.notApplicable.join(', ')}`);
console.log(`${manifest.length} mutants -> ${join(outDir, 'mutants.json')}`);
