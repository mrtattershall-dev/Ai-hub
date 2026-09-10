/**
 * godotVerify.js - parse, run and inspect Godot work in the real engine, headless.
 *
 * Godot can't join the Game tab's engine chips: those are "CDN script -> JS global ->
 * iframe", and Godot is a native engine, not a JS library. So it gets its own surface,
 * built on the same idea as gameVerify.js - execute for real server-side, report a
 * verdict with evidence attached.
 *
 *   GET  /api/godot/status                  -> { found, version, projectAvailable, capabilities }
 *   POST /api/godot/verify { files, main, mode, frames, useProject }
 *   POST /api/godot/verify { code }            (single-file shorthand, still supported)
 *
 * WHAT CHANGED AND WHY
 * --------------------
 * This used to accept one file that had to `extends SceneTree`, and `--check-only` was
 * the strongest thing it could say. That is a bar a stub clears: a script that parses and
 * does nothing scored a pass, which is also why the training eval's Godot axis could not
 * tell working GDScript from syntactically-valid filler.
 *
 * Now the unit is a PROJECT (see godotProject.js): several files, scenes, `res://`
 * resources, and a Node-shaped script running inside a scene the way real Godot code
 * does. Three stages, each answering a different question:
 *
 *   parse   does every script compile?                  `--check-only --script`
 *   run     does it execute without erroring?           `--script`, or a scene + `--quit-after`
 *   build   did it actually construct a scene tree?     the probe autoload's dump
 *
 * The third stage is the one a stub fails. It is the direct analogue of the Chromium
 * verifier's "is the canvas non-zero" check and exists for the same reason: without it,
 * "ran clean and did nothing" is indistinguishable from "worked".
 *
 * Godot CLI facts this is built around, all verified on 4.6.3:
 *   1. `--script` requires the script to extend SceneTree to run standalone.
 *   2. Godot exits 0 EVEN ON PARSE FAILURE, so success is decided by scanning output,
 *      never by exit code.
 *   3. A SceneTree script that never calls quit() runs forever -> hard timeout + kill.
 *      A *scene* run needs no such discipline from the code under test: `--quit-after
 *      <N>` ends it after N iterations, which is what makes ordinary Node-shaped
 *      GDScript verifiable at all.
 */
import { Router } from 'express';
import { spawn, execSync } from 'child_process';
import { mkdtempSync, rmSync, existsSync, readdirSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as assets from './assets.js';
import {
  planRun, materialize, parseGodotOutput, treeStats,
  normalizePath, resPath, DEFAULT_FRAMES,
} from './godotProject.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Find a Godot binary, in priority order:
 *   1. GODOT_BIN                      - explicit override, always wins
 *   2. a bundled copy next to the app - vendor/godot/, for a packaged distribution
 *   3. the system PATH                - a normal `godot` install
 *   4. common install locations       - Steam, Program Files, ~/Downloads
 *
 * The path used to be hardcoded to one machine's Downloads folder, so the Godot tab
 * worked for exactly one person. Anything shipped to other people has to search.
 */
function resolveGodot() {
  const candidates = [];
  if (process.env.GODOT_BIN) candidates.push(process.env.GODOT_BIN);

  // Bundled alongside the app - the layout a packaged build would ship.
  const vendor = join(__dirname, '..', 'vendor', 'godot');
  const exe = process.platform === 'win32' ? ['godot.exe', 'godot_console.exe'] : ['godot'];
  for (const e of exe) candidates.push(join(vendor, e));

  // On PATH.
  try {
    const which = process.platform === 'win32' ? 'where godot' : 'which godot';
    const found = execSync(which, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().split(/\r?\n/)[0].trim();
    if (found) candidates.push(found);
  } catch { /* not on PATH */ }

  // Common install spots.
  if (process.platform === 'win32') {
    const home = process.env.USERPROFILE || '';
    for (const base of [join(home, 'Downloads'), 'C:/Program Files/Godot', join(home, 'AppData/Local/Programs/Godot')]) {
      try {
        for (const d of readdirSync(base)) {
          if (!/godot/i.test(d)) continue;
          const full = join(base, d);
          try {
            if (statSync(full).isDirectory()) {
              for (const f of readdirSync(full)) if (/godot.*\.exe$/i.test(f)) candidates.push(join(full, f));
            } else if (/godot.*\.exe$/i.test(d)) candidates.push(full);
          } catch {}
        }
      } catch {}
    }
  }

  for (const c of candidates) {
    try { if (c && existsSync(c) && statSync(c).isFile()) return c; } catch {}
  }
  return null;
}

const GODOT_BIN = resolveGodot();
// Optional: validate against the real game so autoloads/classes resolve.
const PROJECT_DIR = process.env.GODOT_PROJECT || 'C:/Users/tatte/OneDrive/Documents/new-game-project';

const RUN_TIMEOUT_MS = 15_000;
const PARSE_TIMEOUT_MS = 25_000;      // the FIRST spawn is slow on a cold file cache
const MAX_CODE = 200_000;
const MAX_FILES = 40;
const MAX_TOTAL = 600_000;
const MAX_PARSE_FILES = 12;           // per-file parse spawns, capped so a big project stays interactive
const MAX_FRAMES = 600;               // ~10s of game time; past that, use a real editor
const ERROR_RE = /(SCRIPT ERROR|Parse Error|Failed to load script|^ERROR:)/im;

function godot(args, { cwd, timeout = RUN_TIMEOUT_MS, abortOnError = false } = {}) {
  return new Promise((resolve) => {
    let out = '', err = '', timedOut = false, erroredEarly = false;
    const p = spawn(GODOT_BIN, args, { cwd, windowsHide: true });
    const t = setTimeout(() => { timedOut = true; try { p.kill('SIGKILL'); } catch {} }, timeout);
    // A GDScript error aborts _init() before it can reach quit(), so the process would
    // otherwise sit until the timeout. Once an error is on the wire we already know the
    // answer: give it a moment to finish printing the backtrace, then stop waiting.
    const maybeAbort = () => {
      if (!abortOnError || erroredEarly) return;
      if (!ERROR_RE.test(out + err)) return;
      erroredEarly = true;
      setTimeout(() => { try { p.kill('SIGKILL'); } catch {} }, 400);
    };
    p.stdout.on('data', (d) => { out += d; maybeAbort(); });
    p.stderr.on('data', (d) => { err += d; maybeAbort(); });
    p.on('error', (e) => { clearTimeout(t); resolve({ out, err: `spawn failed: ${e.message}`, code: -1, timedOut, erroredEarly }); });
    p.on('close', (code) => { clearTimeout(t); resolve({ out, err, code, timedOut, erroredEarly }); });
  });
}

// Strip the banner Godot prints on every invocation so it doesn't look like output.
function clean(s) {
  return s.split(/\r?\n/)
    .filter((l) => !/^Godot Engine v|^https:\/\/godotengine\.org/.test(l.trim()))
    .join('\n').trim();
}

/**
 * Accept either shape of request body and return one file set.
 *
 * `{ code }` is the shorthand the tab and the self-test have always sent, and it stays
 * exactly as valid as it was - a single unnamed script. `{ files }` is the real unit.
 * Keeping both is not politeness to old callers: the shorthand is genuinely the right
 * request for "check this one snippet", which is most of what a chat reply produces.
 */
function readFileSet(body) {
  const { code, files, main = '' } = body || {};
  if (Array.isArray(files) && files.length) {
    if (files.length > MAX_FILES) return { error: `too many files (${files.length} > ${MAX_FILES})` };
    const out = [];
    let total = 0;
    for (const f of files) {
      const path = normalizePath(f && f.path);
      if (!path) return { error: `unusable file path: ${JSON.stringify(f && f.path)}` };
      const content = String((f && f.content) ?? '');
      total += content.length;
      out.push({ path, content });
    }
    if (total > MAX_TOTAL) return { error: `project too large (${total} > ${MAX_TOTAL} chars)` };
    return { files: out, main };
  }
  if (typeof code === 'string' && code.trim()) {
    if (code.length > MAX_CODE) return { error: `code too large (${code.length} > ${MAX_CODE})` };
    // Name it for what it is. A Node script needs a scene built around it and that scene
    // has to point at a filename, so "snippet.gd" is load-bearing, not decoration.
    return { files: [{ path: 'snippet.gd', content: code }], main: 'snippet.gd' };
  }
  return { error: 'no code supplied' };
}

/** Merge the structured reads of several Godot invocations into one payload. */
function collect(chunks) {
  const errors = [], warnings = [], prints = [];
  let tree = [];
  for (const c of chunks) {
    errors.push(...c.errors);
    warnings.push(...c.warnings);
    prints.push(...c.prints);
    if (c.tree.length) tree = c.tree;
  }
  return { errors, warnings, prints, tree };
}

/**
 * Verify a Godot file set. The HTTP route and the agent's `verify_godot` tool are both
 * thin wrappers over this, so the agent and a human pressing Run are graded identically -
 * a verifier that disagrees with itself depending on who called it is worse than none.
 *
 * Returns a plain object with a `status` for the route to use; it never touches `res`.
 */
export async function verifyGodotFiles(body = {}) {
  const { run = true, useProject = false, mode: wantMode = 'auto' } = body;
  const frames = Math.max(1, Math.min(MAX_FRAMES, Number(body && body.frames) || DEFAULT_FRAMES));
  const parsed = readFileSet(body);
  if (parsed.error) {
    return { status: /^no code/.test(parsed.error) || /unusable/.test(parsed.error) ? 400 : 413, error: parsed.error };
  }
  if (!GODOT_BIN || !existsSync(GODOT_BIN)) {
    return { status: 500, error: `Godot not found${GODOT_BIN ? ` at ${GODOT_BIN}` : ''}. Set GODOT_BIN.` };
  }

  // `run: false` is the old Parse button and still means exactly that.
  const plan = planRun(parsed.files, { main: parsed.main, mode: run ? wantMode : 'parse' });
  const dir = mkdtempSync(join(tmpdir(), 'hub-gd-'));
  const stages = [];
  const reads = [];

  try {
    const mat = materialize(dir, plan, { assets });

    // Running inside the real project makes res:// resolve to the game, so autoloads
    // and class_name types are visible. Only the single-script case can do that, because
    // anything more would mean writing files into someone's actual game directory,
    // which is not this verifier's to do.
    const singleScript = plan.files.length === 1 && /\.gd$/i.test(plan.files[0].path);
    const inProject = useProject && singleScript && existsSync(join(PROJECT_DIR, 'project.godot'));
    const scriptAbs = inProject ? join(dir, plan.files[0].path) : null;
    const cwd = inProject ? PROJECT_DIR : dir;

    // ---- stage 1: parse ------------------------------------------------------
    // Every script, not just the entry point. A project whose entry parses and whose
    // helper does not is broken, and reporting only the entry sends the model looking
    // in the wrong file.
    const scripts = plan.files.filter((f) => /\.gd$/i.test(f.path)).slice(0, MAX_PARSE_FILES);
    const parseTargets = inProject ? [{ path: plan.files[0].path, arg: scriptAbs }] : scripts;
    let parseFailed = false, parseTimedOut = false;
    const parseOut = [];

    for (const f of parseTargets) {
      const arg = f.arg || resPath(f.path);
      const r = await godot(['--headless', '--check-only', '--script', arg], { cwd, timeout: PARSE_TIMEOUT_MS });
      const text = clean(r.out + '\n' + r.err);
      if (text) parseOut.push(text);
      reads.push(parseGodotOutput(text));
      if (ERROR_RE.test(text)) parseFailed = true;
      if (r.timedOut) parseTimedOut = true;
      if (parseFailed) break;      // the first parse error is the one worth reading
    }

    stages.push({
      stage: 'parse',
      ok: !parseFailed && !parseTimedOut,
      checked: parseTargets.length,
      output: parseOut.join('\n').trim(),
      timedOut: parseTimedOut,
    });

    const respond = (extra) => {
      const merged = collect(reads);
      return ({
        status: 200,
        mode: plan.mode,
        main: plan.main ? resPath(plan.main) : '',
        notes: plan.notes,
        stages,
        usedProject: inProject,
        frames: plan.mode === 'scene' ? frames : null,
        // Errors carry file:line, so the tab can point at the offending line and a
        // repair brief can name it instead of quoting a message with no address.
        errors: merged.errors.slice(0, 40),
        warnings: merged.warnings.slice(0, 20),
        prints: merged.prints.slice(0, 200),
        tree: merged.tree,
        treeStats: treeStats(merged.tree),
        assetsUsed: mat.assetsUsed,
        assetsMissing: mat.assetsMissing,
        assetVersion: (() => { try { return assets.version(); } catch { return null; } })(),
        generated: plan.files.filter((f) => f.generated).map((f) => resPath(f.path)),
        ...extra,
      });
    };

    if (parseFailed || parseTimedOut) {
      return respond({
        ok: false,
        ranScript: false,
        verdict: parseTimedOut ? 'Parse check timed out.' : 'GDScript failed to parse.',
      });
    }
    if (!run || plan.mode === 'parse') {
      return respond({
        ok: true,
        ranScript: false,
        verdict: run
          ? `Parses cleanly. ${plan.notes[0] || 'Nothing here is runnable on its own.'}`
          : 'Parses cleanly (not executed).',
      });
    }

    // ---- stage 2: execute ----------------------------------------------------
    let execResult;
    if (plan.mode === 'script') {
      // A SceneTree script drives its own lifetime, so the timeout is the only brake.
      execResult = await godot(['--headless', '--script', scriptAbs || resPath(plan.main)], { cwd, abortOnError: true });
    } else {
      // `--quit-after` ends the run for us, so the code under test does not have to
      // call quit() - which is the whole reason Node-shaped GDScript is testable here.
      execResult = await godot(
        ['--headless', '--path', dir, '--quit-after', String(frames), resPath(plan.main)],
        { timeout: Math.min(60_000, 20_000 + frames * 50) },
      );
    }

    const execText = clean(execResult.out + '\n' + execResult.err);
    const execRead = parseGodotOutput(execText);
    reads.push(execRead);
    const runFailed = ERROR_RE.test(execText);
    stages.push({ stage: 'run', ok: !runFailed && !execResult.timedOut, output: execText, timedOut: execResult.timedOut });

    // ---- stage 3: did it actually DO anything? -------------------------------
    // Scene runs only. A SceneTree script has no scene to build, and asserting one
    // would fail every correct standalone script there is.
    //
    // The bar is deliberately not "built > 0". Measured while building this: an empty
    // `extends Node` stub with a `pass` body still scores one node, because the harness
    // scene's own root IS the script under test - so a pure stub would have passed the
    // check meant to catch pure stubs, which is the exact failure mode this stage was
    // added to close on the training eval's Godot axis.
    //
    // So: something beyond the entry node, or something printed. Either is evidence the
    // code ran and had an effect; neither is provable of a `pass` body.
    const stats = treeStats(execRead.tree);
    const observable = stats.built > 1 || execRead.prints.length > 0;
    if (plan.mode === 'scene') {
      stages.push({
        stage: 'activity',
        ok: observable,
        output: observable
          ? `${stats.built} node(s) [${stats.classes.slice(0, 8).join(', ')}], ${execRead.prints.length} line(s) of output`
          : stats.built
            ? 'the entry node exists but nothing else happened - no child nodes, no output'
            : 'the scene tree was empty - nothing was instantiated',
      });
    }

    const missing = mat.assetsMissing.length;
    let ok, verdict;
    if (runFailed) {
      // Report the error, not the hang it caused - the error is the actionable half.
      ok = false;
      const first = execRead.errors[0];
      verdict = first && first.file
        ? `Parsed, but errored while running: ${first.message} (${first.file}:${first.line})`
        : 'Parsed, but errored while running.';
    } else if (execResult.timedOut) {
      ok = false;
      verdict = plan.mode === 'script'
        ? `Ran for ${RUN_TIMEOUT_MS / 1000}s without finishing - a SceneTree script must call quit().`
        : `The scene did not finish ${frames} frames in time - something is blocking the main loop.`;
    } else if (missing) {
      // A missing asset is a FAILURE, not a warning, and the rule is the Chromium
      // verifier's: the training gate rejects unknown asset paths, so a verifier that
      // shrugged at one would disagree with the gate and pass code that loads nothing.
      ok = false;
      const names = mat.assetsMissing.slice(0, 3).map((a) => a.path).join(', ');
      verdict = `Loads ${missing} resource(s) that do not exist: ${names}${missing > 3 ? ', …' : ''}. Use list_assets for exact names.`;
    } else if (plan.mode === 'scene' && !observable) {
      ok = false;
      verdict = stats.built
        ? `Ran ${frames} frames without erroring, but nothing observable happened - no child nodes were created and nothing was printed.`
        : 'Ran without erroring, but built an empty scene tree - nothing was instantiated.';
    } else {
      ok = true;
      verdict = plan.mode === 'scene'
        ? `Runs in headless Godot: ${frames} frames, ${stats.built} node(s) live (${stats.classes.slice(0, 4).join(', ')}).`
        : (execText ? 'Parses and runs cleanly in headless Godot.'
                    : 'Parses and runs cleanly (no output). Did you mean to print() something?');
    }

    return respond({ ok, verdict, ranScript: true });
  } catch (e) {
    return { status: 500, ok: false, verdict: `Verification failed to run: ${e.message}`, stages, ranScript: false };
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch {}
  }
}

export default function godotVerifyRouter() {
  const router = Router();

  router.get('/status', async (_req, res) => {
    if (!GODOT_BIN || !existsSync(GODOT_BIN)) return res.json({ found: false, bin: GODOT_BIN });
    // Godot's FIRST spawn is slow (cold file cache) - a 10s cap intermittently
    // timed out and left the version reading 'unknown' in the UI. One retry on
    // an empty read costs nothing when it is already warm.
    let r = await godot(['--headless', '--version'], { timeout: PARSE_TIMEOUT_MS });
    if (!clean(r.out || r.err)) r = await godot(['--headless', '--version'], { timeout: PARSE_TIMEOUT_MS });
    let assetVersion = null, assetCount = 0;
    try { assetVersion = assets.version(); assetCount = assets.list().items.length; } catch {}
    res.json({
      found: true,
      bin: GODOT_BIN,
      version: clean(r.out || r.err).split(/\r?\n/)[0] || 'unknown',
      projectAvailable: existsSync(join(PROJECT_DIR, 'project.godot')),
      project: PROJECT_DIR,
      // What this verifier can actually do, so the tab never offers what it can't back up.
      capabilities: { multiFile: true, scenes: true, sceneRun: true, assets: true, treeDump: true },
      maxFiles: MAX_FILES,
      defaultFrames: DEFAULT_FRAMES,
      assetVersion,
      assetCount,
    });
  });

  router.post('/verify', async (req, res) => {
    const out = await verifyGodotFiles(req.body || {});
    const { status = 200, ...payload } = out || {};
    res.status(status).json(payload);
  });

  return router;
}
