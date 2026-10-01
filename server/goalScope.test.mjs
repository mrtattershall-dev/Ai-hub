/**
 * goalScope.test.mjs - the pure forward-dependency resolver behind FG-2 SCOPE.   node server/goalScope.test.mjs
 */
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scope, jsSpecifiers, pySpecifiers, SCOPE_CAP } from './goalScope.mjs';

let passed = 0, failed = 0;
const ok = (c, m) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${m}`); c ? passed++ : failed++; };
const temps = [];
function ws(files) { const d = mkdtempSync(join(tmpdir(), 'gs-')); temps.push(d); for (const [f, b] of Object.entries(files)) { mkdirSync(join(d, f, '..'), { recursive: true }); writeFileSync(join(d, f), b); } return [d, Object.keys(files)]; }
const has = (s, ...xs) => xs.every((x) => s.inScope.has(x));

console.log('goalScope - specifiers');
ok(JSON.stringify(jsSpecifiers("const a=require('./a');\nimport b from \"../b.js\";\nimport './c';\nconst d = await import('./d');\nrequire('lodash');")) === JSON.stringify(['./a', '../b.js', './c', './d']), 'JS: require/import/from/dynamic, relative only, packages ignored');
ok(JSON.stringify(pySpecifiers('import os\nfrom helper import x\nimport a.b, c as d\n')) === JSON.stringify(['os', 'helper', 'a.b', 'c']), 'python: import / from-import / comma / as');

console.log('goalScope - closure');
{ const [d, files] = ws({ 's2.js': "require('./util');", 'util.js': "require('./deep/x.js');", 'deep/x.js': '', 'junk.js': 'x', 'lib/index.js': '' });
  const s = scope(d, { goal: 'Add greet() to s2.js', files });
  ok(s.named && has(s, 's2.js', 'util.js', 'deep/x.js') && !s.inScope.has('junk.js'), 'named file + transitive requires are in scope; unrelated file is out');
  ok(s.outOfScope.includes('junk.js') && s.outOfScope.includes('lib/index.js'), 'outOfScope lists the rest'); }
{ const [d, files] = ws({ 'a.js': "require('./b');", 'b.js': "require('./a');", 'c.js': '' });
  const s = scope(d, { goal: 'fix a.js', files }); ok(has(s, 'a.js', 'b.js') && !s.inScope.has('c.js'), 'a cycle terminates'); }
{ const [d, files] = ws({ 'a.js': "require('./lib');", 'lib/index.js': "require('../m.mjs');", 'm.mjs': '' });
  const s = scope(d, { goal: 'edit a.js', files }); ok(has(s, 'a.js', 'lib/index.js', 'm.mjs'), 'directory index and .mjs resolve'); }
{ const [d, files] = ws({ 'a.js': "require(variable);", 'b.js': '' });
  const s = scope(d, { goal: 'edit a.js', files }); ok(has(s, 'a.js') && !s.inScope.has('b.js'), 'a computed require is NOT followed (declared blind spot)'); }
{ const [d, files] = ws({ 'S1_Library.js': '' });
  const s = scope(d, { goal: 'Add checkout to s1_library.js', files }); ok(has(s, 'S1_Library.js'), 'namedFiles lower-cases; the real path is recovered'); }
{ const [d, files] = ws({ 'x.js': '', 'y.js': '' });
  const s = scope(d, { goal: 'Make the project better.', files }); ok(!s.named && s.inScope.size === 2 && s.outOfScope.length === 0, 'a goal naming no file -> whole workspace (unchanged behaviour)'); }
{ const [d, files] = ws({ 'x.js': '', 'y.js': '' });
  const s = scope(d, { goal: 'nothing named', entry: 'y.js', files }); ok(!s.named && s.inScope.size === 2, 'the entry alone does NOT narrow the scope (Amendment 1: entry-only callers keep the whole workspace)'); }
{ const big = {}; for (let i = 0; i < 100; i++) big[`f${i}.js`] = i < 99 ? `require('./f${i + 1}');` : '';
  const [d, files] = ws(big); const s = scope(d, { goal: 'edit f0.js', files }); ok(s.inScope.size === SCOPE_CAP, `the closure is bounded at ${SCOPE_CAP}`); }

console.log('goalScope - python and tests');
{ const [d, files] = ws({ 's3_calc.py': 'from helper import h\n', 'helper.py': '', 'test_s3_calc.py': 'from s3_calc import add\n', 'test_helper.py': 'import helper\n', 'test_other.py': 'def test_x(): assert False\n', 'tests/test_byname.py': 'import os\n' });
  const s = scope(d, { goal: 'Add add(a, b) to s3_calc.py.', files });
  ok(has(s, 's3_calc.py', 'helper.py'), 'python forward imports resolve');
  ok(s.tests.includes('test_s3_calc.py') && s.tests.includes('test_helper.py'), "tests importing a scoped module (or named test_<m>) are in scope");
  ok(!s.tests.includes('test_other.py') && !s.tests.includes('tests/test_byname.py'), 'unrelated tests are out of scope'); }
{ const [d, files] = ws({ 'pkg/__init__.py': '', 'pkg/mod.py': 'from . import x\n', 'main.py': 'import pkg.mod\n' });
  const s = scope(d, { goal: 'edit main.py', files }); ok(has(s, 'main.py', 'pkg/mod.py'), 'dotted package import resolves to pkg/mod.py'); }
{ const [d, files] = ws({ 'a.py': '', 'test_a.py': 'import a\n', 'test_b.py': 'import b\n', 'b.py': '' });
  const s = scope(d, { goal: 'improve things', files }); ok(!s.named && s.tests.length === 2, 'no named file -> every test is in scope'); }

for (const d of temps) { try { rmSync(d, { recursive: true, force: true }); } catch {} }
console.log(`\n  ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
