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
import { scope } from './goalScope.mjs';   // FG-2 SCOPE: which files a goal is about (pure, no git)
import { identityOf } from './cid1.mjs';   // FG-5 RECEIPT: a content identity over exactly the files judged

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

/**
 * LOAD-check every JS module, not just the entry point. This is the cheapest-obvious-fix control
 * that INC-1B's result demanded, and it targets the exact failure class that result found.
 *
 * WHAT IT CATCHES, and why syntaxSweep cannot. All three surviving INC-1B baseline breakages were
 * the same bug: `module.exports` naming a function that was never defined (`total`, `remove`,
 * `restock`). That file passes `node --check` - the reference is legal syntax - and throws the
 * moment anything requires it. The finish gate ran the ENTRY point and nothing else, so a broken
 * non-entry module was reported as "all N source file(s) pass a syntax check" and the run finished
 * verified. Set G's six regressions were three files whose module-level code throws at require().
 * Same class, third sighting.
 *
 * AT THE FINISH BOUNDARY, NOT PER WRITE - and that placement is a recorded negative result, not a
 * preference. e0ca8ef tested strict per-write load-refusal against the reconstructed Set G
 * workspace: 52% of intermediate states were unloadable, 5 of 8 breaking transitions were repaired
 * by the model itself inside the run, and s10_desk.js was 100% unloadable only because
 * s1_library.js was broken. Refusing each write would fight the model's own repair loop and blame
 * files for other files' breakage. Judging the state the run intends to LEAVE avoids both.
 *
 * A TIMEOUT IS NOT A FAILURE. A module that starts a server or opens a listener legitimately never
 * returns from import(). Counting that as broken would refuse correct work, and a verifier that
 * invents a requirement is worse than one that misses it. Timeouts are reported as `unknown` and
 * never become problems.
 *
 * import() in a CHILD, reusing EXPORT_PROBE's mechanism, because the workspace - not this process -
 * decides whether a .js file is CommonJS or ESM.
 */
const LOAD_PROBE = `
const { pathToFileURL } = require("node:url");
const { resolve } = require("node:path");
import(pathToFileURL(resolve(process.cwd(), process.argv[1])).href)
  .then(() => process.exit(0))
  .catch((e) => { console.error(String((e && e.message) || e)); process.exit(4); });
`;

async function loadSweep(workspace, files) {
  const notes = [];
  let checked = 0, broken = 0, unknown = 0;
  for (const f of files.slice(0, 80)) {
    if (!/\.(c|m)?js$/i.test(f)) continue;           // python is covered by py_compile + its own run
    const r = await sh('node', ['-e', LOAD_PROBE, f], workspace, 15_000);
    checked++;
    if (r.ok) continue;
    // Exit 4 is the probe's own "could not load" channel. Anything else - a timeout, a signal, a
    // spawn failure - is NOT evidence the module is broken, and must not be reported as if it were.
    if (r.code === 4) {
      broken++;
      notes.push(`${f}: ${(r.err || 'threw on load').split('\n').slice(0, 2).join(' ').slice(0, 200)}`);
    } else {
      unknown++;
    }
  }
  return { checked, broken, unknown, notes };
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
/**
 * Run in a CHILD node, against the file the goal is about, to answer one question: is NAME actually
 * exported? Kept as a string because it must execute in the workspace's own module resolution, not in
 * the hub's - the workspace decides whether a .js file is CommonJS or ESM, and this process cannot.
 *
 * import() rather than require(), so a .mjs entry and a "type":"module" workspace read the same way.
 * A regex over the source text would be cheaper and would also accept a file that cannot actually
 * load; this project has already been bitten by a checker that read text instead of running it.
 *
 * Three shapes all count as exporting NAME, because all three are things ordinary code does:
 *     export function add / module.exports = { add }   -> a named key on the namespace
 *     module.exports = function add                    -> the default IS the function
 *     module.exports = { add }, seen through import()  -> default is the object holding it
 *
 * Exit codes are the channel: 0 exported, 3 loaded but absent, 4 could not load at all. 3 and 4 are
 * different failures and the model needs to be told which one it has.
 */
const EXPORT_PROBE = `
const { pathToFileURL } = require("node:url");
const { resolve } = require("node:path");
const want = process.argv[2];
import(pathToFileURL(resolve(process.cwd(), process.argv[1])).href).then((m) => {
  const d = m && m.default;
  const has = (o) => !!o && (typeof o === "object" || typeof o === "function") && want in o && o[want] !== undefined;
  process.exit(has(m) || (typeof d === "function" && d.name === want) || has(d) ? 0 : 3);
}).catch((e) => { console.error(String((e && e.message) || e)); process.exit(4); });
`;

/**
 * The name a goal says must be EXPORTED, or null when it does not say so clearly.
 *
 * "verified" has meant "it parses and it ran without crashing". Measured 2026-09-13 against a real hub
 * run: the goal "Create add.js exporting a function add(a, b)" was satisfied by
 *     function add(a, b) { return a + b; }
 * which passes `node --check`, runs, exits 0 - and exports NOTHING (require() returns {}). The run was
 * stamped verified:true and finished clean, so the model was TOLD it had succeeded. That matters more
 * than an ordinary miss: a model handed "verified" has no reason to keep working.
 *
 * Two orderings occur in real goal text, putting the name on opposite sides of the keyword:
 *     "exporting a function add(a, b)"   -> after
 *     "exporting a Library class"        -> before
 * Anything it cannot read confidently yields null and the check does not run at all. A verifier that
 * INVENTS a requirement is worse than one that misses it - a false failure blocks correct work and
 * teaches the model to fight the gate. Proven against seven goal strings before being wired in,
 * including three that must yield nothing.
 */
export function exportedName(goal) {
  const g = String(goal || '');
  if (!/\bexport(s|ing|ed)?\b/i.test(g)) return null;
  const after = g.match(/\bexport(?:s|ing|ed)?\s+(?:an?\s+)?(?:function|class|const|object)\s+([A-Za-z_$][\w$]*)/i);
  if (after) return after[1];
  const before = g.match(/\bexport(?:s|ing|ed)?\s+(?:an?\s+)?([A-Za-z_$][\w$]*)\s+(?:function|class|object)\b/i);
  if (before) return before[1];
  const bare = g.match(/\bexport(?:s|ing|ed)?\s+(?:an?\s+)?([A-Za-z_$][\w$]*)\b/i);
  if (bare && !/^(a|an|the|it|them|this|that|and|to|from)$/i.test(bare[1])) return bare[1];
  return null;
}

/**
 * FG-3 ADMISSION (legasus/screen/FG-3-ADMISSION_PREREG.md): does this goal ask for a CHANGE to named
 * files? Only then can "zero writes landed" mean "nothing could have satisfied it". Frozen list; its
 * blind spot is recorded there ("s1_library.js needs checkout()" has no verb here and is not admitted).
 */
const MUTATING_VERB = /\b(add|create|implement|write|build|make|fix|change|update|refactor|rename|remove|delete|extend|introduce|replace|move|convert|migrate)\b/i;
export const asksForChange = (goal) => MUTATING_VERB.test(String(goal || ''));

export async function verify(workspace, { entry, goal, landedWrites } = {}) {
  const detected = detectKind(workspace);
  let { kind } = detected;
  const { files, pkg } = detected;
  // An ENTRY decides the language. Set E (2026-09-11): a workspace holding ten projects had package.json (the
  // workspace marker), so every check was "node" - a .py entry would have run under node.
  // 'web' is in this list too: a workspace that has held several goals keeps every index.html ever written, and
  // without this ONE stale page pins kind:'web' for good - the web branch returns early having proved only that
  // the file exists, so every later Python or Node goal in that workspace is 'verified' without being run. A
  // real web goal names no .py/.js entry, so it still takes the web path.
  if (entry && ['node', 'python', 'unknown', 'web'].includes(kind)) {
    if (/\.py$/i.test(entry)) kind = 'python';
    else if (/\.(c|m)?js$/i.test(entry)) kind = 'node';
  }
  const problems = [];
  const evidence = [];
  // FG-2 SCOPE (legasus/screen/FG-2-SCOPE_PREREG.md). A finish may be BLOCKED only on evidence about the
  // goal's named files and their forward dependency closure. fatal-09 measured 23 blocks grounded in a
  // file the goal never named and 17 from whole-workspace pytest; FG-1 reproduced both on this tree.
  // Breakage OUTSIDE the scope is not silenced - it goes to `notes`, rendered loudly, and the end-of-run
  // repair still runs - it just cannot hold a finished goal hostage. A goal that names no file keeps the
  // whole workspace as its scope (today's behaviour, unchanged).
  const notes = [];
  const sc = scope(workspace, { goal, entry, files });
  const inFiles = sc.named ? files.filter((f) => sc.inScope.has(f)) : files;
  const outFiles = sc.named ? files.filter((f) => !sc.inScope.has(f)) : [];
  const OUTSIDE = 'OUTSIDE THIS GOAL (not blocking)';

  // FG-3 ADMISSION. A `Verified` finish is a receipt for work that happened. fatal-09: two verified
  // finishes with ZERO landed writes on the goal's file, both scored FAIL, both entered the corpus
  // labelled verified; FG-1 reproduced the shape here (a file that loads but lacks the goal). The rule
  // applies only when the caller SUPPLIES the count (undefined = unknown = not applied, so every
  // existing caller is unchanged), the goal names files, and the goal asks for a change. Everything
  // else is still collected, so the model sees that the file runs AND that nothing landed.
  let admission = null;
  if (landedWrites === 0 && sc.named && asksForChange(goal)) {
    admission = 'NO_WORK';
    problems.push('NO WORK LANDED: this goal asks for a change to ' + [...sc.inScope].slice(0, 3).join(', ')
      + ', and no write succeeded in this run - nothing on disk changed, so the goal cannot have been done by this run.'
      + ' Make the change (read the file first), or - if existing code already satisfies the goal - say so and finish again; that finish will be recorded UNVERIFIED, not Verified.');
  }

  const syn = await syntaxSweep(workspace, inFiles);
  if (syn.checked) {
    if (syn.broken) {
      problems.push(`${syn.broken} of ${syn.checked} source file(s) do not compile:\n    ` + syn.notes.join('\n    '));
    } else {
      evidence.push(`all ${syn.checked} source file(s) pass a syntax check${sc.named ? " (this goal's scope)" : ''}`);
    }
  }
  const synOut = outFiles.length ? await syntaxSweep(workspace, outFiles) : null;
  if (synOut && synOut.broken) {
    notes.push(`${OUTSIDE}: ${synOut.broken} of ${synOut.checked} file(s) the goal does not name do not compile - leftover from earlier work; the end-of-run repair still applies:\n    ` + synOut.notes.join('\n    '));
  }

  // THE LOAD SWEEP. Deliberately AFTER the syntax sweep and reported separately: "parses" and
  // "loads" are different facts, and merging them is how the weaker one came to stand for both.
  // Only run when syntax is clean - a file that does not parse cannot load either, and reporting
  // both would name one defect twice and bury the root cause.
  if (kind === 'node' && syn.checked && !syn.broken) {
    const load = await loadSweep(workspace, inFiles);
    if (load.broken) {
      problems.push(`${load.broken} of ${load.checked} module(s) PARSE but THROW when loaded:\n    `
        + load.notes.join('\n    ')
        + `\n    A file can pass a syntax check and still crash everything that requires it -`
        + ` typically by exporting a name that was never defined.`);
    } else if (load.checked) {
      evidence.push(`all ${load.checked} module(s) load without throwing`
        + (load.unknown ? ` (${load.unknown} did not finish loading and were not judged)` : '')
        + (sc.named ? " (this goal's scope)" : ''));
    }
    // The same sweep over files the goal did not name: a loud note, never a block (FG-2 SCOPE).
    if (outFiles.length && !(synOut && synOut.broken)) {
      const lo = await loadSweep(workspace, outFiles);
      if (lo.broken) notes.push(`${OUTSIDE}: ${lo.broken} of ${lo.checked} module(s) the goal does not name throw when loaded:\n    ` + lo.notes.join('\n    '));
    }
  }

  // FG-5 RECEIPT (5b). WHAT was judged, named: the entry, the scoped files the sweeps ran over, and a
  // content identity over exactly those files - cid1's encoding and domain over a SUBSET, so it is
  // labelled "over N files" and never presented as the workspace's cid1. A refused identity is null
  // and said so; naming never changes a verdict. D-BIND's discipline, applied to the hub's own receipt:
  // a Verified note that cannot tell a reader which bytes it is about is the shape M19 had.
  let judged;
  const subjectFiles = inFiles.slice(0, 80);
  try {
    judged = { entry: entry ?? null, files: subjectFiles, id: identityOf(subjectFiles.map((f) => ({ type: 'F', path: f, bytes: readFileSync(join(workspace, f)) }))) };
  } catch (e) {
    judged = { entry: entry ?? null, files: subjectFiles, id: null, reason: `identity unavailable: ${String(e.message || e).slice(0, 120)}` };
  }

  if (kind === 'web') {
    // The web path is covered by test_web + visual inspection in the agent loop; this
    // only confirms the entry point is really there and reachable.
    if (!existsSync(join(workspace, 'index.html'))) problems.push('no index.html - a web app needs an entry point');
    else evidence.push('index.html exists (browser evidence comes from test_web / see_screen)');
    return { ok: !problems.length, kind, evidence, problems, notes, admission, judged, needsBrowser: true };
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

        // "verified" has to mean the GOAL was met, not merely that the file ran. See exportedName() above:
        // a real run was stamped verified for a file that parses, runs, exits 0 - and exports nothing.
        // Probed ONLY when the file ran cleanly. Importing a server that stays up would hang to the
        // timeout and then report a missing export that is really a listening socket - a false failure
        // here is worse than the miss, because it blocks correct work.
        const want = exportedName(goal);
        if (want && r.ok && !r.timedOut) {
          const p = await sh('node', ['-e', EXPORT_PROBE, cand, want], workspace, 15_000);
          if (p.code === 3) {
            problems.push(`\`${cand}\` does not export \`${want}\`, which the goal asks for - loading the file yields no such value. Add an export, e.g. \`module.exports = { ${want} };\``);
          } else if (p.code === 4) {
            problems.push(`\`${cand}\` could not be loaded as a module, so its export of \`${want}\` cannot be confirmed:\n    ${(p.err || p.out).split('\n').slice(0, 4).join('\n    ').slice(0, 400)}`);
          } else if (p.ok) {
            evidence.push(`\`${cand}\` exports \`${want}\`, as the goal asks`);
          }
          // A probe that timed out claims NOTHING either way - no problem, no evidence.
        }
      }
    }
    return { ok: !problems.length, kind, evidence, problems, notes, admission, judged };
  }

  if (kind === 'python') {
    const allTests = files.filter((f) => /(^|\/)(test_|tests?\/)/.test(f) && f.endsWith('.py'));
    // FG-2 SCOPE: only tests that belong to the goal's files may block. The others still RUN, and a
    // failure among them is a loud note - fatal-09 counted 17 blocks from whole-workspace pytest.
    const testFiles = sc.named ? sc.tests.filter((t) => allTests.includes(t)) : allTests;
    const otherTests = allTests.filter((t) => !testFiles.includes(t));
    if (sc.named && otherTests.length) {
      const o = await sh('python', ['-m', 'pytest', '-q', ...otherTests], workspace, 90_000);
      if (!o.ok) notes.push(`${OUTSIDE}: ${otherTests.length} test file(s) the goal does not name fail (${otherTests.join(', ')}):\n    ${(o.out || o.err).split('\n').slice(-6).join('\n    ').slice(0, 600)}`);
    }
    if (testFiles.length) {
      const r = await sh('python', ['-m', 'pytest', '-q', ...(sc.named ? testFiles : [])], workspace, 90_000);
      if (r.ok) evidence.push(`pytest passed (${testFiles.length} test file(s)${sc.named ? " in this goal's scope" : ''})`);
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
    return { ok: !problems.length, kind, evidence, problems, notes, admission, judged };
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
    return { ok: !problems.length, kind, evidence, problems, notes, admission, judged };
  }

  // unknown: the syntax sweep is all we have, and that is worth saying out loud.
  if (!syn.checked) evidence.push('no recognisable project type - nothing could be executed to prove this works');
  return { ok: !problems.length, kind, evidence, problems };
}

/** Human/model-readable rendering. */
export function format(r) {
  const L = [`PROJECT VERIFICATION (detected: ${r.kind})`];
  for (const e of r.evidence) L.push(`  ✅ ${e}`);
  for (const n of r.notes || []) L.push(`  ⚠️ ${n}`);
  for (const p of r.problems) L.push(`  ❌ ${p}`);
  if (r.problems.length) L.push('\nFix these before finishing — the project does not run as written.');
  else if ((r.notes || []).length) L.push('\nThe ⚠️ items are outside this goal and do not block it - but leftover breakage poisons later work. Say so in your summary.');
  return L.join('\n');
}
