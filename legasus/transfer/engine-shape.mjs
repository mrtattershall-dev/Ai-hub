/**
 * engine-shape.mjs - TRANSFER-BIND step 1: record a foreign codebase's NATIVE execution and
 * test shape, without modifying it and without reference to what BIND requires.
 *
 *   node legasus/transfer/engine-shape.mjs <foreign-root> <out-dir> [--run]
 *
 * Static pass (always): for every candidate witness file - module system, how it is invoked,
 * what it loads, whether it exits by itself, what its per-case output lines literally look
 * like, and whether those lines carry identifiers that are unique within the file. Also the
 * exported surface of the non-test files, as candidate subject regions.
 *
 * Dynamic pass (--run): each witness file executed ONCE, unmodified, from the foreign root,
 * under NODE_V8_COVERAGE, with a budget. Records exit code, duration, output line counts,
 * whether coverage files appeared, and which files the process wrote under the foreign root.
 *
 * NOTHING here decides whether the shape is adequate for anything. It records.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, statSync, existsSync } from 'node:fs';
import { join, resolve, relative, extname } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

/**
 * Kill a child AND its descendants, and settle on `exit` rather than `close`.
 * APPARATUS-NOTES 23/25/27/28: `close` waits for every holder of the child's stdio pipes,
 * including a process outside the killed tree; one such holder cost a 180s budget 53 minutes.
 * 23 of this foreign codebase's 33 witness files spawn processes, so the hazard is live here.
 */
function killTree(child) {
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* not a group leader */ } }
  try { child.kill(); } catch { /* already gone */ }
}

const [rootArg, outArg, ...flags] = process.argv.slice(2);
if (!rootArg || !outArg) { console.error('usage: node legasus/transfer/engine-shape.mjs <foreign-root> <out-dir> [--run]'); process.exit(2); }
const ROOT = resolve(rootArg);
const OUT = resolve(outArg);
const RUN = flags.includes('--run');
const BUDGET_MS = 120_000;
mkdirSync(OUT, { recursive: true });

/** Every .js/.mjs/.cjs under the root, excluding node_modules and dot-dirs. */
function walk(dir, acc = [], depth = 0) {
  if (depth > 6) return acc;
  let entries = [];
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc, depth + 1);
    else if (['.js', '.mjs', '.cjs'].includes(extname(e.name))) acc.push(p);
  }
  return acc;
}

const all = walk(ROOT);
const isTest = (p) => /(^|[\\/])[^\\/]*(_test|\.test)\.(m|c)?js$/.test(p);
const tests = all.filter(isTest);
const nonTests = all.filter((p) => !isTest(p));

// --- static shape -------------------------------------------------------------------------
const CASE_LINE_CANDIDATES = [
  { name: 'PASS_FAIL_leading', re: /^\s*(PASS|FAIL)\s+(.+?)\s*$/ },
  { name: 'ok_notok_tap', re: /^\s*(not ok|ok)\s+(.+?)\s*$/ },
  { name: 'check_cross', re: /^\s*(✓|✗|✔|✘)\s+(.+?)\s*$/ },
];

function staticShape(p) {
  const src = readFileSync(p, 'utf8');
  const rel = relative(ROOT, p).replace(/\\/g, '/');
  const requires = [...src.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]);
  const imports = [...src.matchAll(/^\s*import\s[\s\S]*?from\s*['"]([^'"]+)['"]/gm)].map((m) => m[1]);
  // the literal console.log templates that could carry a per-case line
  const logs = [...src.matchAll(/console\.log\(([^\n]*)\)/g)].map((m) => m[1]).filter((s) => /PASS|FAIL|ok |✓|✗/.test(s));
  return {
    file: rel,
    bytes: src.length,
    lines: src.split('\n').length,
    moduleSystem: imports.length && !requires.length ? 'esm' : requires.length && !imports.length ? 'cjs' : imports.length && requires.length ? 'mixed' : 'none-detected',
    extension: extname(p),
    strictPragma: /^\s*['"]use strict['"]/.test(src),
    requires: [...new Set(requires)],
    requiresExternal: [...new Set(requires.filter((r) => !r.startsWith('.')))],
    imports: [...new Set(imports)],
    exportsCjs: [...new Set([...src.matchAll(/module\.exports\s*=\s*\{([^}]*)\}/g)].flatMap((m) => m[1].split(',').map((s) => s.split(':')[0].trim()).filter(Boolean)))],
    exportsCjsNamed: [...new Set([...src.matchAll(/(?:module\.)?exports\.(\w+)\s*=/g)].map((m) => m[1]))],
    exportsEsm: [...new Set([...src.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)].map((m) => m[1]))],
    callsProcessExit: /process\.exit\s*\(/.test(src),
    writesFs: /\bfs\.(writeFile|writeFileSync|appendFile|appendFileSync|mkdir|mkdirSync|rm|rmSync|unlink)\b/.test(src),
    spawnsProcesses: /\b(spawn|spawnSync|exec|execSync|execFile|execFileSync|fork)\s*\(/.test(src),
    usesNetwork: /\b(http|https|net|dgram|fetch|WebSocket)\b/.test(src),
    usesTimers: /\b(setTimeout|setInterval)\s*\(/.test(src),
    caseLogTemplates: logs.slice(0, 8),
  };
}

const testShapes = tests.map(staticShape);
const subjectShapes = nonTests.map(staticShape);

// --- dynamic shape ------------------------------------------------------------------------
function snapshotFiles() {
  const m = new Map();
  for (const p of walk(ROOT)) { try { m.set(p, statSync(p).mtimeMs); } catch { /* gone */ } }
  return m;
}

function runOne(p) {
  return new Promise((done) => {
    const rel = relative(ROOT, p).replace(/\\/g, '/');
    const covDir = join(OUT, 'cov', rel.replace(/[\\/]/g, '__'));
    rmSync(covDir, { recursive: true, force: true });
    mkdirSync(covDir, { recursive: true });
    const before = snapshotFiles();
    const t0 = Date.now();
    let out = '';
    const child = spawn(process.execPath, [p], {
      cwd: ROOT, env: { ...process.env, NODE_V8_COVERAGE: covDir }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    let timedOut = false;
    let settled = false;
    const timer = setTimeout(() => { timedOut = true; killTree(child); }, BUDGET_MS);
    // `exit` fires when the CHILD leaves, regardless of who still holds its pipes. A short
    // grace window lets buffered stdout drain; a survivor delays nothing beyond it, and the
    // fact that it happened is recorded rather than absorbed into the duration.
    let drainMs = null;
    const settle = (code, signal, via) => {
      if (settled) return; settled = true;
      clearTimeout(timer);
      const ms = Date.now() - t0;
      const after = snapshotFiles();
      const touched = [...after.keys()].filter((f) => !before.has(f) || before.get(f) !== after.get(f)).map((f) => relative(ROOT, f).replace(/\\/g, '/'));
      let covFiles = 0;
      try { covFiles = readdirSync(covDir).filter((f) => f.endsWith('.json')).length; } catch { /* none */ }
      const lines = out.split('\n');
      const matched = {};
      for (const c of CASE_LINE_CANDIDATES) {
        const hits = lines.map((l) => l.match(c.re)).filter(Boolean);
        const ids = hits.map((h) => h[2]);
        matched[c.name] = { count: hits.length, distinctIds: new Set(ids).size, duplicatedIds: ids.length - new Set(ids).size };
      }
      done({ file: rel, exitCode: code, signal, ms, timedOut, settledVia: via, drainMs, stdoutLines: lines.length, coverageFiles: covFiles,
        caseLineCandidates: matched, filesTouchedUnderRoot: touched, tail: out.trim().split('\n').slice(-3).join(' | ').slice(0, 300) });
    };
    child.on('exit', (code, signal) => {
      const tExit = Date.now();
      // Give stdout 2s to drain after the child is gone; then settle regardless of `close`.
      const grace = setTimeout(() => { drainMs = Date.now() - tExit; settle(code, signal, 'exit+drain-timeout'); }, 2000);
      child.on('close', () => { clearTimeout(grace); drainMs = Date.now() - tExit; settle(code, signal, 'close'); });
    });
    child.on('error', (e) => settle(null, null, `spawn-error: ${e.message}`));
  });
}

const runs = [];
if (RUN) {
  for (const p of tests) {
    const r = await runOne(p);
    runs.push(r);
    const best = Object.entries(r.caseLineCandidates).sort((a, b) => b[1].count - a[1].count)[0];
    console.log(`  exit=${String(r.exitCode).padStart(3)} ${String(r.ms).padStart(6)}ms cov=${String(r.coverageFiles).padStart(3)} lines=${String(r.stdoutLines).padStart(4)} ${best[0]}=${best[1].count}(dup ${best[1].duplicatedIds}) touched=${r.filesTouchedUnderRoot.length}  ${r.file}`);
  }
}

const shape = { root: ROOT, at: new Date().toISOString(), node: process.version, platform: process.platform,
  counts: { allSourceFiles: all.length, testFiles: tests.length, nonTestFiles: nonTests.length },
  packageJson: existsSync(join(ROOT, 'package.json')) ? JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) : null,
  isGitRepo: existsSync(join(ROOT, '.git')),
  testShapes, subjectShapes, runs, ranDynamic: RUN, budgetMs: BUDGET_MS };
writeFileSync(join(OUT, 'engine-shape.json'), JSON.stringify(shape, null, 2));
console.log(`-> ${join(OUT, 'engine-shape.json')}  (${tests.length} test files, ${nonTests.length} other source files, dynamic=${RUN})`);
