/**
 * make_repair_input.mjs - collect every failing generation together with the REAL error.
 *
 *   node factory/make_repair_input.mjs run5
 *
 * Writes factory/repair_in_<name>.json, the input to modal_repair.py.
 *
 * The error text matters more than anything else here. "It didn't work" teaches the model
 * nothing; `Parse Error: Expected "{" after enum name` at a specific line tells it exactly
 * what to change. So each check captures the FULL diagnostic rather than the 90-character
 * summary the scoreboard prints.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { execFile } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..', '..');
const CHROMIUM = process.env.CHROMIUM_VERIFY || 'https://mr-tattershall--chromium-verify-verifier-web.modal.run';
const name = process.argv[2];
if (!name) { console.error('usage: node factory/make_repair_input.mjs <name>'); process.exit(1); }

// Same system prompts the generations were produced under - a repair turn under a
// different system prompt is a different experiment.
const SYS = {
  code: 'You are a senior engineer who writes complete, self-contained, runnable code. Every identifier you reference must be declared or imported, declarations must precede use, and you only call methods/APIs that actually exist. Return code that runs as given.',
  phaser: 'You are an expert Phaser 3 game developer. You write complete, runnable Phaser 3 programs using only real Phaser 3 APIs (Phaser.Game, scenes, this.add, this.physics, this.tweens, this.input, this.load, etc.). Return code that runs as given against Phaser 3.',
  interpret: 'You correctly interpret what the user actually wants — the right scope, the right domain, and sensible defaults — even from a short or casual request. Lead with a one-line comment stating your interpretation, then write the right code: not over-built, not under-built, in the correct domain. Return code that runs as given.',
  structured: 'You produce structured planning documents. When the user asks for specific markdown section headers, you return exactly those headers, in that order, each followed by concise prose or bullets. You never return code blocks for a documentation request.',
  godot: 'You write GDScript for Godot 4. A standalone script must `extends SceneTree`, do its work in `_init()`, and call `quit()` when finished or it will run forever. Use static typing where it helps, assert() to check results, and print() to report. Return code that runs as given.',
};

const fence = (t) => {
  const m = String(t || '').match(/```(\w+)?\s*\n([\s\S]*?)```/);
  return m ? m[2] : null;
};
const DOM = /\b(document|window\.|requestAnimationFrame|getContext|addEventListener|localStorage|new Image|new Audio|AudioContext)\b/;

function resolveGodot() {
  if (process.env.GODOT_BIN && existsSync(process.env.GODOT_BIN)) return process.env.GODOT_BIN;
  for (const n of ['godot_console.exe', 'godot.exe', 'godot']) {
    const p = join(REPO, 'vendor', 'godot', n);
    if (existsSync(p)) return p;
  }
  return null;
}
const GODOT = resolveGodot();

function run(cmd, args, cwd, timeout = 20000) {
  return new Promise((res) => {
    execFile(cmd, args, { cwd, timeout, windowsHide: true, maxBuffer: 4e6 },
      (err, stdout, stderr) => res({ ok: !err, out: stdout || '', err: stderr || (err ? err.message : ''), killed: !!(err && err.killed) }));
  });
}

const rows = readFileSync(join(__dirname, 'eval', `eval_${name}.jsonl`), 'utf8')
  .split('\n').filter(Boolean).map((l) => JSON.parse(l));
const tmp = join(tmpdir(), `repair-${Date.now()}`);
mkdirSync(tmp, { recursive: true });

const out = [];
for (const row of rows) {
  const code = fence(row.text);
  const axis = row.axis;
  let error = null;

  if (axis === 'code' && code) {
    const f = join(tmp, `${row.id}.js`);
    writeFileSync(f, code, 'utf8');
    const chk = await run(process.execPath, ['--check', f], tmp);
    if (!chk.ok) error = chk.err.slice(0, 900);
    else if (!DOM.test(code)) {
      const ex = await run(process.execPath, [f], tmp, 15000);
      if (ex.killed) error = 'The program never terminated — it hung. Something loops forever.';
      else if (!ex.ok) error = ex.err.split('\n').slice(0, 12).join('\n').slice(0, 900);
    }
  } else if (axis === 'godot' && code) {
    if (GODOT) {
      const f = join(tmp, `${row.id}.gd`);
      writeFileSync(f, code, 'utf8');
      const r = await run(GODOT, ['--headless', '--check-only', '--script', f], tmp, 30000);
      const text = `${r.out}\n${r.err}`;
      if (/SCRIPT ERROR|Parse Error|Failed to load script/i.test(text)) {
        error = text.split('\n').filter((l) => /SCRIPT ERROR|Parse Error|at:|Failed to load/i.test(l))
          .slice(0, 6).join('\n').slice(0, 900);
      }
    }
  } else if (axis === 'phaser' && code) {
    try {
      const r = await fetch(`${CHROMIUM}/api/game/verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engine: 'phaser', code }), signal: AbortSignal.timeout(90_000),
      });
      const j = await r.json();
      if (!j.ok) {
        const hard = (j.errors || []).filter((e) => /JS ERROR|NETWORK/.test(e));
        error = `${j.verdict}\n${hard.slice(0, 4).join('\n')}`.slice(0, 900);
      }
    } catch (e) { /* harness failure — not a model failure, so never send it for repair */ }
  } else if (axis === 'structured') {
    const want = [...row.prompt.matchAll(/##\s*([A-Za-z][A-Za-z0-9 /&-]*?)(?=\s*,|\s*\.|$|\s+and\s)/g)].map((m) => m[1].trim());
    const t = String(row.text || '');
    if (fence(t)) error = 'You returned a code block. This was a documentation request — it must be markdown prose under the exact headers asked for, with no code.';
    else {
      const missing = want.filter((h) => t.toLowerCase().indexOf('## ' + h.toLowerCase()) < 0);
      if (missing.length) error = `Missing required header(s): ${missing.join(', ')}. The requested headers, in order, are: ${want.map((h) => '## ' + h).join(', ')}.`;
    }
  }
  // interpret has no executable error to feed back - a domain miss is a judgement, not a
  // diagnostic, so there is nothing honest to hand the model. Left out deliberately.

  if (error) out.push({ axis, id: row.id, system: SYS[axis], prompt: row.prompt, previous: row.text, error });
  process.stderr.write(error ? 'F' : '.');
}
process.stderr.write('\n');
rmSync(tmp, { recursive: true, force: true });

const dest = join(__dirname, `repair_in_${name}.json`);
writeFileSync(dest, JSON.stringify(out, null, 1), 'utf8');
console.log(`\n${out.length} failing generation(s) captured with their real errors -> ${dest}`);
for (const o of out) console.log(`  ${o.axis.padEnd(11)} ${o.id.padEnd(18)} ${o.error.split('\n')[0].slice(0, 70)}`);
