// THE COORDINATED CONSOLIDATION SUITE.
//
// One invocation that runs EVERY package from the directory it requires, and propagates EVERY failure.
//
// WHY THIS EXISTS. Running `node --test "legasus/**/*.test.mjs"` from the repo root gives 892/900. That
// number is VALID for the root invocation and the eight failures are real failures of it — location
// dependence explains them, it does not erase them. But the external-linter package resolves fixture
// paths and `node_modules/eslint/lib/rules/...` against the PROCESS CWD, so from the root it cannot
// reach what it needs. Run from its own directory the same file passes 10/10.
//
// Two separate runs are two separate results. Neither is a combined run. This file makes the combined
// run exist, with the working directory recorded as part of the invocation rather than left implicit.
//
// THE FROZEN CHECKER IS NOT ALTERED. The CWD dependence stays as it is; a portability fix is a
// separately versioned change, not something to slip in behind a green number.
//
// FAILURE PROPAGATION IS THE WHOLE POINT. A runner that reports per-package results and exits 0 is worse
// than no runner: it manufactures a clean headline out of red packages. Exit is nonzero if ANY package
// fails, if any package is UNRUNNABLE, or if any package reports zero tests.
import { spawnSync, execFileSync } from 'node:child_process';
import { readdirSync, statSync, existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const sh = (...a) => { try { return execFileSync(a[0], a.slice(1), { cwd: ROOT, encoding: 'utf8' }).trim(); } catch (e) { return null; } };
const sha = (p) => { try { return createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 16); } catch (e) { return 'ABSENT'; } };

const walk = (d, out = []) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (f === 'node_modules') continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (f.endsWith('.test.mjs')) out.push(p);
  }
  return out;
};

const EXTERNAL_LINTER = join(ROOT, 'legasus/runtime/epistemic-admission/external-linter');

// ---- PACKAGES. Each declares the directory it MUST run from, and why.
const PACKAGES = [
  {
    name: 'legasus (root invocation)',
    cwd: ROOT,
    why: 'resolves nothing against CWD; the repo root is its natural invocation',
    files: () => walk(join(ROOT, 'legasus')).filter((p) => !p.startsWith(EXTERNAL_LINTER)),
  },
  {
    name: 'external-linter (own directory)',
    cwd: EXTERNAL_LINTER,
    why: 'resolves attack/ fixtures AND node_modules/eslint/lib/rules/** against the PROCESS CWD, and'
      + ' declares its own dependencies in its own package.json — it must run from here',
    files: () => walk(EXTERNAL_LINTER),
  },
];

// ---- PROVENANCE. Recorded as part of the result, not alongside it.
const head = sh('git', 'rev-parse', 'HEAD');
const branch = sh('git', 'rev-parse', '--abbrev-ref', 'HEAD');
const dirty = (sh('git', 'status', '--porcelain') || '').split(/\r?\n/).filter(Boolean);

console.log('CONSOLIDATION SUITE');
console.log('');
console.log('  branch        ' + branch);
console.log('  HEAD          ' + head);
console.log('  worktree      ' + ROOT);
console.log('  dirty paths   ' + dirty.length + (dirty.length ? '  (listed at end)' : ''));
console.log('  node          ' + process.version);
console.log('');
console.log('  DEPENDENCY LOCKS');
for (const l of ['package-lock.json', 'server/package-lock.json', 'client/package-lock.json',
  'legasus/runtime/epistemic-admission/external-linter/package-lock.json']) {
  console.log('    ' + sha(join(ROOT, l)) + '  ' + l);
}
console.log('');

const results = [];
for (const pkg of PACKAGES) {
  const files = pkg.files().map((p) => relative(pkg.cwd, p).replace(/\\/g, '/'));
  const cmd = ['--test', ...files];
  console.log('----------------------------------------------------------------------');
  console.log('PACKAGE   ' + pkg.name);
  console.log('  cwd     ' + relative(ROOT, pkg.cwd).replace(/\\/g, '/') || '.');
  console.log('  because ' + pkg.why);
  console.log('  files   ' + files.length);
  console.log('  command node --test <' + files.length + ' files>');

  if (!existsSync(pkg.cwd)) {
    results.push({ pkg: pkg.name, runnable: false, why: 'cwd does not exist' });
    console.log('  RESULT  UNRUNNABLE — cwd does not exist');
    continue;
  }
  if (files.length === 0) {
    results.push({ pkg: pkg.name, runnable: false, why: 'no test files found' });
    console.log('  RESULT  UNRUNNABLE — no test files found');
    continue;
  }

  const r = spawnSync(process.execPath, cmd, { cwd: pkg.cwd, encoding: 'utf8',
    maxBuffer: 1 << 28, timeout: 2_400_000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const num = (k) => { const m = out.match(new RegExp('^\\u2139 ' + k + ' (\\d+)$', 'm')); return m ? Number(m[1]) : null; };
  const tests = num('tests'), pass = num('pass'), fail = num('fail');
  const failing = [...out.matchAll(/^✖ (.+?) \(\d/gm)].map((m) => m[1])
    .filter((s) => s !== 'failing tests');

  results.push({ pkg: pkg.name, runnable: true, tests, pass, fail,
    exit: r.status, timedOut: !!r.error, failing: [...new Set(failing)] });

  console.log('  RESULT  tests=' + tests + ' pass=' + pass + ' fail=' + fail + ' exit=' + r.status);
  for (const f of [...new Set(failing)].slice(0, 12)) console.log('            FAIL  ' + f);
  console.log('');
}

// ---- THE COMBINED VERDICT. One number, and it is allowed to be bad.
console.log('======================================================================');
let tests = 0, pass = 0, fail = 0, bad = false;
for (const r of results) {
  if (!r.runnable) { bad = true; console.log('  UNRUNNABLE  ' + r.pkg + ' — ' + r.why); continue; }
  if (r.timedOut) { bad = true; console.log('  TIMED OUT   ' + r.pkg); }
  if (r.tests === null) { bad = true; console.log('  UNPARSEABLE ' + r.pkg + ' (exit ' + r.exit + ')'); continue; }
  tests += r.tests; pass += r.pass; fail += r.fail;
  if (r.fail > 0 || r.exit !== 0) bad = true;
  console.log('  ' + String(r.pass) + '/' + String(r.tests) + '  ' + r.pkg
    + (r.fail ? '   ' + r.fail + ' FAILING' : ''));
}
console.log('');
console.log('  COMBINED   tests=' + tests + '  pass=' + pass + '  fail=' + fail);
console.log('');
if (dirty.length) {
  console.log('  UNCOMMITTED AT TIME OF RUN — the tested source state is NOT this HEAD alone:');
  for (const d of dirty) console.log('    ' + d);
  console.log('');
}
console.log(bad
  ? '  VERDICT  NOT CLEAN. A package failed, timed out, or could not run.'
  : '  VERDICT  every package ran from its required directory and reported zero failures.');
process.exit(bad ? 1 : 0);
