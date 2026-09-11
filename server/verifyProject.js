/**
 * verifyProject.js - "what is the evidence this actually works?"
 *
 * THE GAP THIS CLOSES
 * -------------------
 * The finish gate asked exactly one question: does index.html exist, and has test_web
 * been run since the last edit? Which means a web app was held to a real standard and
 * everything else was held to none. A Python script, a CLI tool, a Node service, a
 * Godot project - all could be declared DONE having never been executed once.
 *
 * So: detect what KIND of thing was built, and demand the evidence appropriate to it.
 * The agent cannot finish until the project's own kind of proof exists and is clean.
 *
 * Deliberately NOT a test framework. It answers one question - "does this run?" - which
 * is the question a claim of completion actually rests on.
 */
import { execFile } from 'child_process';
import { existsSync, readdirSync, statSync, readFileSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXEC_TIMEOUT = 45_000;

/**
 * Find Godot the same way godotVerify.js does, rather than demanding GODOT_BIN.
 * Requiring the env var meant a bundled Godot sitting right there in vendor/ was
 * ignored, and every GDScript project came back "UNVERIFIED" on a machine that could
 * verify it perfectly well.
 *
 * The console build is preferred on Windows: the plain godot.exe detaches from the
 * console and its parse errors never reach stdout, which is the whole output this
 * check reads.
 */
function resolveGodot() {
  if (process.env.GODOT_BIN && existsSync(process.env.GODOT_BIN)) return process.env.GODOT_BIN;
  const vendor = join(__dirname, '..', 'vendor', 'godot');
  const names = process.platform === 'win32' ? ['godot_console.exe', 'godot.exe'] : ['godot'];
  for (const n of names) {
    const p = join(vendor, n);
    if (existsSync(p)) return p;
  }
  return null;
}

// On Windows, npm/npx/yarn/pnpm are .cmd shims, and execFile cannot spawn a .cmd
// without a shell - it fails with ENOENT. That made verifyProject report "npm test
// failed" for a project whose tests pass, which is worse than not checking at all:
// the agent's finish gate would block a working Node project forever, and the agent
// would thrash trying to fix code that was never broken.
//
// Caught live by the ping-pong harness on 2026-09-09 - the builder said "16/16 checks
// passed" and the verifier said "DOES NOT RUN". The builder was right.
// Windows leaves exactly one workable route here, and it needs a guard.
//   execFile('npm', …)      -> ENOENT   (npm is a .cmd shim, not an .exe)
//   execFile('npm.cmd', …)  -> EINVAL   (Node 20+ refuses .cmd outright, CVE-2024-27980)
//   execFile('npm', …, {shell:true})    -> works, but concatenates argv UNESCAPED
//
// So: shell only for the shims, and only when every argument is a plain literal. The
// assertion is the point - the day someone passes a model-supplied string through here,
// it throws instead of becoming shell injection.
const WIN = process.platform === 'win32';
const CMD_SHIM = new Set(['npm', 'npx', 'yarn', 'pnpm']);
const SAFE_ARG = /^[A-Za-z0-9._\-=/:]+$/;

function sh(cmd, args, cwd, timeout = EXEC_TIMEOUT) {
  return new Promise((res) => {
    const opts = { cwd, timeout, windowsHide: true, maxBuffer: 4 * 1024 * 1024 };
    if (WIN && CMD_SHIM.has(cmd)) {
      const unsafe = args.find((a) => !SAFE_ARG.test(String(a)));
      if (unsafe) return res({ ok: false, code: 1, out: '', err: `refusing to shell-run ${cmd} with unsafe argument: ${unsafe}`, timedOut: false });
      opts.shell = true;
    }
    execFile(cmd, args, opts,
      (err, stdout, stderr) => res({
        ok: !err,
        code: err ? (err.code ?? 1) : 0,
        out: (stdout || '').trim(),
        err: (stderr || '').trim() || (err ? err.message : ''),
        timedOut: !!(err && err.killed),
      }));
  });
}

/** Every file in the workspace, skipping the noise. */
function walk(dir, rel = '', acc = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of entries) {
    if (['node_modules', '.git', '__pycache__', '.venv', 'venv', '.screenshots'].includes(e.name)) continue;
    const full = join(dir, e.name);
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) walk(full, r, acc);
    else acc.push(r);
  }
  return acc;
}

/**
 * What kind of project is this? Ordered by specificity - a Godot project that also
 * contains an index.html is a Godot project.
 */
export function detectKind(workspace) {
  const files = walk(workspace);
  const has = (re) => files.some((f) => re.test(f));

  if (has(/(^|\/)project\.godot$/)) return { kind: 'godot', files };
  if (existsSync(join(workspace, 'index.html'))) return { kind: 'web', files };
  if (has(/\.gd$/)) return { kind: 'gdscript', files };

  const pkg = join(workspace, 'package.json');
  if (existsSync(pkg)) {
    let j = {};
    try { j = JSON.parse(readFileSync(pkg, 'utf8')); } catch {}
    return { kind: 'node', files, pkg: j };
  }
  if (has(/\.py$/)) return { kind: 'python', files };
  if (has(/\.(c|m)?js$/)) return { kind: 'node', files, pkg: null };
  return { kind: 'unknown', files };
}

/** Compile-check every source file. Free, and catches the dumbest failures. */
async function syntaxSweep(workspace, files) {
  const notes = [];
  let checked = 0, broken = 0;
  for (const f of files.slice(0, 80)) {
    const ext = extname(f).toLowerCase();
    let r = null;
    if (ext === '.py') r = await sh('python', ['-m', 'py_compile', join(workspace, f)], workspace, 20_000);
    else if (['.js', '.mjs', '.cjs'].includes(ext)) r = await sh('node', ['--check', join(workspace, f)], workspace, 20_000);
    if (!r) continue;
    checked++;
    if (!r.ok) { broken++; notes.push(`${f}: ${(r.err || 'syntax error').split('\n').slice(0, 3).join(' ').slice(0, 200)}`); }
  }
  return { checked, broken, notes };
}

/**
 * Run the project and see whether it works.
 * Returns { ok, kind, evidence, problems[] } - `ok:false` blocks finishing.
 */
export async function verify(workspace, { entry } = {}) {
  const detected = detectKind(workspace);
  let { kind } = detected;
  const { files, pkg } = detected;
  // An ENTRY decides the language. Set E (2026-09-11): a workspace holding ten projects had package.json (the
  // workspace marker), so every check was "node" - a .py entry would have run under node.
  if (entry && ['node', 'python', 'unknown'].includes(kind)) {
    if (/\.py$/i.test(entry)) kind = 'python';
    else if (/\.(c|m)?js$/i.test(entry)) kind = 'node';
  }
  const problems = [];
  const evidence = [];

  const syn = await syntaxSweep(workspace, files);
  if (syn.checked) {
    if (syn.broken) {
      problems.push(`${syn.broken} of ${syn.checked} source file(s) do not compile:\n    ` + syn.notes.join('\n    '));
    } else {
      evidence.push(`all ${syn.checked} source file(s) pass a syntax check`);
    }
  }

  if (kind === 'web') {
    // The web path is covered by test_web + visual inspection in the agent loop; this
    // only confirms the entry point is really there and reachable.
    if (!existsSync(join(workspace, 'index.html'))) problems.push('no index.html - a web app needs an entry point');
    else evidence.push('index.html exists (browser evidence comes from test_web / see_screen)');
    return { ok: !problems.length, kind, evidence, problems, needsBrowser: true };
  }

  if (kind === 'node') {
    const scripts = (pkg && pkg.scripts) || {};
    if (scripts.test && !/no test specified/i.test(scripts.test)) {
      const r = await sh('npm', ['test', '--silent'], workspace, 90_000);
      if (r.ok) evidence.push('`npm test` passed');
      else problems.push(`\`npm test\` failed (exit ${r.code}):\n    ${(r.err || r.out).split('\n').slice(0, 8).join('\n    ').slice(0, 800)}`);
    } else {
      // Entry-point resolution, widest-net-last.
      //
      // This used to check ONLY index/main/app/server.js, so a project whose entry was
      // calc.js or first.js reported "no obvious entry point" and the finish gate blocked
      // it - even though `node first.js` printed PASS and exited 0. Agents name files
      // after what they do, not after four conventions, so this failed on nearly every
      // single-file build. Found 2026-09-09 when it blocked the supervisor test.
      const conventional = ['index.js', 'main.js', 'app.js', 'server.js'].find((f) => existsSync(join(workspace, f)));
      const jsFiles = files.filter((f) => /\.(c|m)?js$/i.test(f) && !f.split('/').pop().startsWith('_'));
      // A file with top-level statements is runnable; one that only declares things is a
      // library. Prefer the former when several exist.
      const runnable = jsFiles.find((f) => {
        try { return /^\s*(?:console\.|if\s*\(|assert|[A-Za-z_$][\w$]*\s*\()/m.test(readFileSync(join(workspace, f), 'utf8')); }
        catch { return false; }
      });
      const cand = entry || (pkg && pkg.main) || conventional || runnable || jsFiles[0];
      if (!cand) problems.push('no test script and no obvious entry point - nothing here has been proven to run');
      else {
        const r = await sh('node', [cand], workspace, 30_000);
        // A long-running server is killed by the timeout, which is SUCCESS for a server -
        // it means it started and stayed up. Treating that as failure would make every
        // service look broken.
        if (r.timedOut) evidence.push(`\`node ${cand}\` started and kept running (killed at the timeout, which is what a server should do)`);
        else if (r.ok) evidence.push(`\`node ${cand}\` ran and exited cleanly`);
        else problems.push(`\`node ${cand}\` crashed (exit ${r.code}):\n    ${(r.err || r.out).split('\n').slice(0, 8).join('\n    ').slice(0, 800)}`);
      }
    }
    return { ok: !problems.length, kind, evidence, problems };
  }

  if (kind === 'python') {
    const testFiles = files.filter((f) => /(^|\/)(test_|tests?\/)/.test(f) && f.endsWith('.py'));
    if (testFiles.length) {
      const r = await sh('python', ['-m', 'pytest', '-q'], workspace, 90_000);
      if (r.ok) evidence.push(`pytest passed (${testFiles.length} test file(s))`);
      else problems.push(`pytest failed:\n    ${(r.out || r.err).split('\n').slice(-10).join('\n    ').slice(0, 800)}`);
    } else {
      const cand = entry || ['main.py', 'app.py', '__main__.py'].find((f) => existsSync(join(workspace, f)))
        || files.find((f) => f.endsWith('.py') && !f.startsWith('_'));
      if (!cand) problems.push('no Python entry point found - nothing has been proven to run');
      else {
        const r = await sh('python', [cand], workspace, 30_000);
        if (r.timedOut) evidence.push(`\`python ${cand}\` ran until the timeout (long-running, no crash)`);
        else if (r.ok) evidence.push(`\`python ${cand}\` ran and exited cleanly${r.out ? ` — output: ${r.out.split('\n')[0].slice(0, 120)}` : ''}`);
        else problems.push(`\`python ${cand}\` crashed (exit ${r.code}):\n    ${(r.err || r.out).split('\n').slice(-8).join('\n    ').slice(0, 800)}`);
      }
    }
    return { ok: !problems.length, kind, evidence, problems };
  }

  if (kind === 'godot' || kind === 'gdscript') {
    const bin = resolveGodot();
    const gd = files.filter((f) => f.endsWith('.gd'));
    if (!gd.length) problems.push('a Godot project with no .gd scripts - nothing to verify');
    else if (!bin) {
      // Not a failure of the CODE, so it must not block finishing - but the agent
      // should say plainly that its GDScript is unproven rather than imply otherwise.
      evidence.push(`${gd.length} GDScript file(s) present; no Godot binary found (bundle one at vendor/godot/ or set GODOT_BIN), so they are UNVERIFIED`);
    } else {
      let bad = 0;
      for (const f of gd.slice(0, 25)) {
        const r = await sh(bin, ['--headless', '--check-only', '--script', join(workspace, f)], workspace, 30_000);
        // Godot exits 0 even on parse failure, so the OUTPUT decides, never the code.
        const text = `${r.out}\n${r.err}`;
        if (/SCRIPT ERROR|Parse Error|Failed to load script/i.test(text)) {
          bad++;
          problems.push(`${f}: ${(text.match(/(SCRIPT ERROR|Parse Error)[^\n]*/i) || [''])[0].slice(0, 200)}`);
        }
      }
      if (!bad) evidence.push(`all ${Math.min(gd.length, 25)} GDScript file(s) parse in headless Godot`);
    }
    return { ok: !problems.length, kind, evidence, problems };
  }

  // unknown: the syntax sweep is all we have, and that is worth saying out loud.
  if (!syn.checked) evidence.push('no recognisable project type - nothing could be executed to prove this works');
  return { ok: !problems.length, kind, evidence, problems };
}

/** Human/model-readable rendering. */
export function format(r) {
  const L = [`PROJECT VERIFICATION (detected: ${r.kind})`];
  for (const e of r.evidence) L.push(`  ✅ ${e}`);
  for (const p of r.problems) L.push(`  ❌ ${p}`);
  if (r.problems.length) L.push('\nFix these before finishing — the project does not run as written.');
  return L.join('\n');
}
