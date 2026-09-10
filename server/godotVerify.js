/**
 * godotVerify.js — parse-check and run GDScript in real headless Godot.
 *
 * Godot can't join the Game tab's engine chips: those are "CDN script -> JS global ->
 * iframe", and Godot is a native engine, not a JS library. So it gets its own surface,
 * built on the same idea as gameVerify.js — execute for real server-side, report a verdict.
 *
 *   GET  /api/godot/status                     -> { found, version, projectAvailable }
 *   POST /api/godot/verify { code, run, useProject }
 *
 * Two stages, because they answer different questions:
 *   --check-only  parses without executing   (cheap; catches syntax/parse errors)
 *   --script      actually runs it           (catches runtime errors + gives you output)
 *
 * Three Godot CLI facts this is built around, all verified on 4.6.3:
 *   1. `--script` requires the script to extend SceneTree (not Node) to run standalone.
 *   2. Godot exits 0 EVEN ON PARSE FAILURE, so success is decided by scanning output
 *      for SCRIPT ERROR / Parse Error / "Failed to load script", never by exit code.
 *   3. A SceneTree script that never calls quit() runs forever -> hard timeout + kill.
 */
import { Router } from 'express';
import { spawn, execSync } from 'child_process';
import { mkdtempSync, writeFileSync, rmSync, existsSync, readdirSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Override with GODOT_BIN if you move or upgrade the binary.
/**
 * Find a Godot binary, in priority order:
 *   1. GODOT_BIN                     - explicit override, always wins
 *   2. a bundled copy next to the app - vendor/godot/, for a packaged distribution
 *   3. the system PATH               - a normal `godot` install
 *   4. common install locations      - Steam, Program Files, ~/Downloads
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

  // Common install spots, newest-looking first.
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
const MAX_CODE = 200_000;
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

export default function godotVerifyRouter() {
  const router = Router();

  router.get('/status', async (_req, res) => {
    if (!existsSync(GODOT_BIN)) return res.json({ found: false, bin: GODOT_BIN });
    // Godot's FIRST spawn is slow (cold file cache) - a 10s cap intermittently
    // timed out and left the version reading 'unknown' in the UI. One retry on
    // an empty read costs nothing when it is already warm.
    let r = await godot(['--headless', '--version'], { timeout: 25_000 });
    if (!clean(r.out || r.err)) r = await godot(['--headless', '--version'], { timeout: 25_000 });
    res.json({
      found: true,
      bin: GODOT_BIN,
      version: clean(r.out || r.err).split(/\r?\n/)[0] || 'unknown',
      projectAvailable: existsSync(join(PROJECT_DIR, 'project.godot')),
      project: PROJECT_DIR,
    });
  });

  router.post('/verify', async (req, res) => {
    const { code = '', run = true, useProject = false } = req.body || {};
    if (typeof code !== 'string' || !code.trim()) return res.status(400).json({ error: 'no code supplied' });
    if (code.length > MAX_CODE) return res.status(413).json({ error: `code too large (${code.length} > ${MAX_CODE})` });
    if (!existsSync(GODOT_BIN)) return res.status(500).json({ error: `Godot not found at ${GODOT_BIN}. Set GODOT_BIN.` });

    const dir = mkdtempSync(join(tmpdir(), 'hub-gd-'));
    const file = join(dir, 'snippet.gd');
    writeFileSync(file, code, 'utf8');
    // Running inside the real project makes res:// resolve to the game, so autoloads
    // and class_name types are visible; otherwise the temp dir is its own tiny res://.
    const cwd = useProject ? PROJECT_DIR : dir;
    const scriptArg = useProject ? file : 'snippet.gd';
    const stages = [];

    try {
      // ---- stage 1: parse only -------------------------------------------------
      const chk = await godot(['--headless', '--check-only', '--script', scriptArg], { cwd });
      const chkOut = clean(chk.out + '\n' + chk.err);
      const parseFailed = ERROR_RE.test(chkOut);
      stages.push({ stage: 'parse', ok: !parseFailed && !chk.timedOut, output: chkOut, timedOut: chk.timedOut });

      if (parseFailed || chk.timedOut) {
        return res.json({
          ok: false,
          verdict: chk.timedOut ? 'Parse check timed out.' : 'GDScript failed to parse.',
          stages, ranScript: false, usedProject: useProject,
        });
      }
      if (!run) {
        return res.json({ ok: true, verdict: 'Parses cleanly (not executed).', stages, ranScript: false, usedProject: useProject });
      }

      // ---- stage 2: actually execute -------------------------------------------
      const exec = await godot(['--headless', '--script', scriptArg], { cwd, abortOnError: true });
      const execOut = clean(exec.out + '\n' + exec.err);
      const runFailed = ERROR_RE.test(execOut);
      stages.push({ stage: 'run', ok: !runFailed && !exec.timedOut, output: execOut, timedOut: exec.timedOut });

      let ok, verdict;
      if (runFailed) {
        // Report the error, not the hang it caused — the error is the actionable half.
        ok = false;
        verdict = 'Parsed, but errored while running.';
      } else if (exec.timedOut) {
        ok = false;
        verdict = `Ran for ${RUN_TIMEOUT_MS / 1000}s without finishing — a SceneTree script must call quit().`;
      } else {
        ok = true;
        verdict = execOut
          ? 'Parses and runs cleanly in headless Godot.'
          : 'Parses and runs cleanly (no output). Did you mean to print() something?';
      }
      res.json({ ok, verdict, stages, ranScript: true, usedProject: useProject });
    } catch (e) {
      res.status(500).json({ ok: false, verdict: `Verification failed to run: ${e.message}`, stages, ranScript: false });
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });

  return router;
}
