/**
 * score_run.mjs - score one or more eval runs across every axis, by EXECUTION.
 *
 *   node factory/score_run.mjs run5
 *   node factory/score_run.mjs run4 run5        (side by side)
 *
 * Reads factory/eval/eval_<name>.jsonl produced by modal_evalset.py.
 *
 * WHAT IS AND IS NOT MEASURED HERE
 * --------------------------------
 * Three of the five axes are scored by RUNNING the output, which is the only kind of
 * score that has ever told us the truth on this project:
 *
 *   code        node --check, then execute the non-DOM ones and see if they throw
 *   phaser      rendered in real Chromium (the same contract the training rows passed)
 *   godot       parsed by real headless Godot
 *
 * Two are scored by inspection, because "did it answer in the right FORM" is a property
 * of the text, not of running it:
 *
 *   structured  are the requested markdown headers present, in order, with no code fence
 *   interpret   does it state an interpretation, and is it in the right DOMAIN
 *
 * The interpret rubric is per-prompt and deliberately explicit: the known failure was a
 * model answering "explain personality" with combat stats, so each prompt carries the
 * words that mean it landed and the words that mean it landed somewhere else. That is a
 * heuristic and it is written down as one - it is not execution and should not be read
 * as if it were.
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { execFileSync, execFile } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';

// The Godot axis calls the SAME core the hub's verifier and the agent's finish gate call.
// Importing it rather than re-implementing is the whole point: an eval that grades Godot
// by a different standard than the gate is an eval that cannot tell you whether the gate
// is passable. `parseFileSet` likewise is the parser the Godot tab uses to read a model's
// reply, so the eval reads a generation exactly the way the product does.
import { verifyGodotFiles } from '../../server/godotVerify.js';
import { parseFileSet, shortPath } from '../../client/src/lib/godot.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..', '..');
// Overridable so a test can score a synthetic set without writing into the real eval
// directory. Same lesson as AGENT_QUEUE_FILE: a fixed path is why tests end up editing
// live state, and a grader is exactly the thing you want to be able to test offline.
const EVAL_DIR = process.env.EVAL_DIR || join(__dirname, 'eval');
// The URL is class-shaped: <workspace>--<app>-<Class>-<method>.modal.run. The obvious
// guess (app-method, no class) returns "modal-http: invalid function call", which this
// scorer would have recorded as "verifier unreachable" for every Phaser prompt - i.e. a
// clean 0/6 that says nothing about the model. Verify /api/health before trusting a run.
const CHROMIUM = process.env.CHROMIUM_VERIFY || 'https://mr-tattershall--chromium-verify-verifier-web.modal.run';

// Every distinct asset-library version the verifier reported while scoring. More than one
// means the library changed mid-run and the Phaser column is not internally comparable.
const ASSET_VERSIONS = new Set();

const names = process.argv.slice(2);
if (!names.length) {
  console.error('usage: node factory/score_run.mjs <name> [name2 ...]   e.g. run4 run5');
  process.exit(1);
}

// ── helpers ───────────────────────────────────────────────────────────────────
const fence = (t) => {
  const m = String(t || '').match(/```(\w+)?\s*\n([\s\S]*?)```/);
  return m ? { lang: (m[1] || '').toLowerCase(), code: m[2] } : null;
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

// ── per-axis scorers ──────────────────────────────────────────────────────────

/** code: does it compile, and does it run without throwing? */
async function scoreCode(row, tmp) {
  const b = fence(row.text);
  if (!b) return { pass: false, why: 'no code block' };
  const f = join(tmp, `${row.id}.js`);
  writeFileSync(f, b.code, 'utf8');
  const chk = await run(process.execPath, ['--check', f], tmp);
  if (!chk.ok) return { pass: false, why: 'syntax error' };
  if (DOM.test(b.code)) return { pass: true, why: 'compiles (DOM code, not run here)', soft: true };
  const ex = await run(process.execPath, [f], tmp, 15000);
  if (ex.killed) return { pass: false, why: 'hung' };
  // A blown stdout buffer is a runaway program, not a thrown error - reporting it as
  // "threw: stdout maxBuffer length exceeded" reads like a harness limit and invites you
  // to dismiss a real infinite loop. Verified by re-running one with a 200MB buffer: it
  // timed out rather than finishing.
  if (/maxBuffer/i.test(ex.err)) return { pass: false, why: 'runaway: produced unbounded output (infinite loop)' };
  if (!ex.ok) {
    // Node echoes the OFFENDING SOURCE LINE before the error, so "first line containing
    // Error" matched the assert helper's own definition and reported the model's source
    // back as if it were the failure. Match the error line by shape instead.
    const line = (ex.err.match(/^(?:[A-Za-z]*Error|AssertionError)(?::.*)?$/m) || [])[0]
      || ex.err.split('\n').filter(Boolean).pop() || '';
    return { pass: false, why: `threw: ${line.trim().slice(0, 90)}` };
  }
  return { pass: true, why: 'ran clean' };
}

/** phaser: rendered in real Chromium, same contract the training rows had to pass. */
async function scorePhaser(row) {
  const b = fence(row.text);
  if (!b) return { pass: false, why: 'no code block' };
  try {
    const r = await fetch(`${CHROMIUM}/api/game/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ engine: 'phaser', code: b.code }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!r.ok) return { pass: null, why: `verifier HTTP ${r.status}` };
    const j = await r.json();
    // Record which asset library this was scored against. A Phaser score is only comparable
    // across runs if the code loaded the same bytes, and the library changes as packs are
    // imported - so an unpinned score silently compares two different worlds.
    if (j.assetVersion) ASSET_VERSIONS.add(j.assetVersion);
    return { pass: !!j.ok, why: (j.verdict || '').slice(0, 90) };
  } catch (e) {
    // A harness failure is NOT a model failure. Tonight we cached 356 of those as real
    // verdicts and had to throw them away; never again.
    return { pass: null, why: `verifier unreachable: ${e.message.slice(0, 60)}` };
  }
}

/**
 * godot: RUN in real headless Godot, and did it actually do anything.
 *
 * This used to be `--check-only` on the first fenced block — it scored "does it parse".
 * That is a bar a stub clears, and it is why run6 read 3/15 and told us nothing: a model
 * that emits syntactically-valid GDScript which creates no nodes and prints nothing
 * scored identically to one that built a working scene. The axis was measuring
 * compilation, and we were reading it as capability.
 *
 * Now the unit is a PROJECT, parsed out of the reply the way the Godot tab parses it, and
 * graded by the same `verifyGodotFiles` the hub's Run button and the agent's finish gate
 * use. Three stages have to hold: every script parses, it executes without erroring, and
 * something observable happened (a node beyond the entry, or output). A `res://` path that
 * is in neither the project nor the asset manifest fails the run, exactly as it does for
 * Phaser — so the eval and the training gate cannot disagree about what a valid asset is.
 *
 * `legacy` carries the OLD bar for the same generation, so historical Godot numbers stay
 * interpretable. Without it, every comparison against a pre-2026-09-10 score silently
 * compares two different questions.
 */
async function scoreGodot(row, tmp) {
  if (!GODOT) return { pass: null, why: 'no Godot binary (vendor/godot/ or GODOT_BIN)', legacy: null };

  // Scored first and independently: the old number must not depend on anything new.
  const legacy = await legacyGodotParses(row, tmp);

  const files = parseFileSet(row.text);
  if (!files.length) return { pass: false, why: 'no code block', legacy };

  try {
    const v = await verifyGodotFiles({
      files: files.map((f) => ({ path: shortPath(f.path), content: f.content })),
      mode: 'auto',
      run: true,
      frames: 60,
    });
    // A harness failure is NOT a model failure - the same rule the Phaser axis learned the
    // hard way. 5xx is ours (no binary, crashed spawn); 4xx is the model handing us
    // something unusable, which IS a result.
    if (v.status >= 500) return { pass: null, why: `verifier: ${String(v.error || v.verdict).slice(0, 60)}`, legacy };
    if (v.status === 400 || v.status === 413) return { pass: false, why: String(v.error).slice(0, 90), legacy };
    return { pass: !!v.ok, why: (v.verdict || '').slice(0, 90), legacy };
  } catch (e) {
    return { pass: null, why: `godot harness failed: ${e.message.slice(0, 60)}`, legacy };
  }
}

/**
 * The pre-2026-09-10 Godot bar, reproduced exactly: first fenced block, `--check-only`.
 *
 * Kept deliberately dumb and deliberately separate. Its only job is to make the old scores
 * comparable to the new ones for one overlapping run; if it drifts toward the new grader
 * it stops being the thing it is here to reproduce.
 */
async function legacyGodotParses(row, tmp) {
  const b = fence(row.text);
  if (!b) return false;
  const f = join(tmp, `${row.id}.legacy.gd`);
  writeFileSync(f, b.code, 'utf8');
  const r = await run(GODOT, ['--headless', '--check-only', '--script', f], tmp, 30000);
  return !/SCRIPT ERROR|Parse Error|Failed to load script/i.test(`${r.out}
${r.err}`);
}

/** structured: the requested headers, in order, and NOT a code block. */
function scoreStructured(row) {
  // Header names contain DIGITS ("## Q1", "## Q2"). The old class excluded them, so a
  // four-header prompt parsed as two and the test scored itself easier than it was.
  const want = [...row.prompt.matchAll(/##\s*([A-Za-z][A-Za-z0-9 /&-]*?)(?=\s*,|\s*\.|$|\s+and\s)/g)].map((m) => m[1].trim());
  const t = String(row.text || '');
  if (fence(t)) return { pass: false, why: 'returned a code block for a documentation request' };
  if (!want.length) return { pass: null, why: 'could not parse the requested headers' };
  let at = -1, missing = [], outOfOrder = false;
  for (const h of want) {
    const i = t.toLowerCase().indexOf('## ' + h.toLowerCase());
    if (i < 0) { missing.push(h); continue; }
    if (i < at) outOfOrder = true;
    at = i;
  }
  if (missing.length) return { pass: false, why: `missing header(s): ${missing.join(', ')}` };
  if (outOfOrder) return { pass: false, why: 'headers present but out of order' };
  return { pass: true, why: `all ${want.length} headers, in order, no code block` };
}

/**
 * interpret: does it STATE its interpretation, and land in the right domain?
 *
 * Explicit per-prompt rubric rather than a vibe. `want` = at least one must appear;
 * `avoid` = the known wrong domain. in_personality is the canonical probe: the failure
 * mode was answering it with combat stats.
 */
const INTERPRET_RUBRIC = {
  in_personality:     { want: /\b(trait|personality|temperament|openness|extravers|introvert|disposition|mood)\b/i, avoid: /\b(damage|attack power|hitpoints|\bhp\b|armou?r|dps)\b/i },
  in_personality_rpg: { want: /\b(trait|personality|temperament|disposition|mood|bravery|loyalty)\b/i,               avoid: /\b(damage|attack power|hitpoints|\bhp\b|armou?r|dps)\b/i },
  in_weather:         { want: /\b(rain|weather|precipitat|droplet|storm)\b/i,                                        avoid: null },
  in_shop:            { want: /\b(shop|store|buy|sell|price|inventory|merchant)\b/i,                                 avoid: null },
  // Stems, not whole words: trailing \b rejected "saving" and "persistent" and scored a
  // correct answer wrong. Inflections are the norm in prose comments.
  in_save:            { want: /\b(sav(e|ing)|load|serial|persist|checkpoint|pref)/i,                                 avoid: null },
  in_speed:           { want: /\b(performance|optimi[sz]|faster|speed|cache|throttle|profil)\b/i,                    avoid: null },
  in_hard:            { want: /\b(difficult|harder|challenge|balanc|scaling)\b/i,                                    avoid: null },
  in_sound:           { want: /\b(sound|audio|sfx|volume|play)\b/i,                                                  avoid: null },
  in_map:             { want: /\b(map|terrain|biome|generat|procedural|tile)\b/i,                                    avoid: null },
  in_ai:              { want: /\b(ai|behaviou?r|state machine|pathfind|steering|decision)\b/i,                       avoid: null },
  // Added when the eval widened from 32 to 75 prompts. Same rule as above: `want` is the
  // domain the request plainly points at, `avoid` names a wrong domain only where a
  // specific confusion is plausible.
  in_inventory:       { want: /\b(inventor|bag|slot|capacit|stack|storage|weight)/i,                                 avoid: null },
  in_ui:              { want: /\b(font|text|contrast|readab|legib|size|colou?r|ui|hud)/i,                            avoid: null },
  in_balance:         { want: /\b(econom|price|cost|balanc|currenc|shop|sink|reward)/i,                              avoid: null },
  in_progress:        { want: /\b(grind|progress|xp|level|curve|pacing|reward|rate)/i,                               avoid: null },
  in_camera:          { want: /\b(camera|viewport|follow|zoom|scroll|bounds|view)/i,                                 avoid: null },
};

function scoreInterpret(row) {
  const t = String(row.text || '');
  const b = fence(t);
  const code = b ? b.code : t;
  // "Lead with a one-line comment stating your interpretation."
  //
  // Checking literally line 1 scored this 0/10 for a model that states its
  // interpretation on every single prompt - it just emits a one-line assert() helper
  // above it first, which is what its training rows do. The trained behaviour is
  // "say what you think this means, up top", so scan the opening lines rather than
  // insisting on the very first character.
  const head = code.split('\n').filter((l) => l.trim()).slice(0, 5);
  const leads = head.some((l) => /^\s*(\/\/|#|\/\*)/.test(l));
  const r = INTERPRET_RUBRIC[row.id];
  if (!r) return { pass: null, why: 'no rubric' };
  const inDomain = r.want.test(code);
  const wrongDomain = r.avoid ? r.avoid.test(code) : false;
  if (!leads) return { pass: false, why: 'no leading interpretation comment' };
  if (!inDomain) return { pass: false, why: 'did not land in the expected domain' };
  if (wrongDomain) return { pass: false, why: 'drifted into the wrong domain (combat stats)' };
  return { pass: true, why: 'states its interpretation, right domain' };
}

// ── run ───────────────────────────────────────────────────────────────────────
const AXES = ['code', 'phaser', 'godot', 'structured', 'interpret'];
const results = {};
// Per-prompt results, so variants generated from DIFFERENT prompt sets can still be
// compared honestly. The eval grew from 32 prompts to 75 on 2026-09-09; without this,
// `code 7/9` (base) sat next to `code 14/20` (run6) in the same column as though they
// were the same test. They are not, and presenting them that way is worse than not
// comparing at all.
const scoredById = {};

for (const name of names) {
  const path = join(EVAL_DIR, `eval_${name}.jsonl`);
  if (!existsSync(path)) { console.error(`missing ${path} — download it from the gen-output volume first`); process.exit(1); }
  const rows = readFileSync(path, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const tmp = join(tmpdir(), `score-${name}-${Date.now()}`);
  mkdirSync(tmp, { recursive: true });

  const per = {};
  for (const a of AXES) per[a] = { pass: 0, fail: 0, skip: 0, detail: [] };
  // The OLD Godot bar, scored on the same generations. Reported beside the new one so a
  // pre-2026-09-10 score can still be read; see scoreGodot.
  per.godot.legacy = { pass: 0, total: 0 };
  const byId = {};

  process.stderr.write(`\nscoring ${name} (${rows.length} generations)`);
  for (const row of rows) {
    const axis = row.axis || 'code';
    let r;
    if (axis === 'code') r = await scoreCode(row, tmp);
    else if (axis === 'phaser') r = await scorePhaser(row);
    else if (axis === 'godot') r = await scoreGodot(row, tmp);
    else if (axis === 'structured') r = scoreStructured(row);
    else if (axis === 'interpret') r = scoreInterpret(row);
    else continue;

    const bucket = per[axis];
    if (r.pass === null) bucket.skip++;
    else if (r.pass) bucket.pass++;
    else bucket.fail++;
    if (axis === 'godot' && r.legacy !== null && r.legacy !== undefined) {
      bucket.legacy.total++;
      if (r.legacy) bucket.legacy.pass++;
    }
    bucket.detail.push({ id: row.id, pass: r.pass, why: r.why });
    byId[row.id] = { axis, pass: r.pass, why: r.why };
    process.stderr.write(r.pass === null ? '?' : r.pass ? '.' : 'x');
  }
  process.stderr.write('\n');
  rmSync(tmp, { recursive: true, force: true });
  results[name] = per;
  scoredById[name] = byId;
}

// ── report ────────────────────────────────────────────────────────────────────
const pad = (s, n) => String(s).padEnd(n);
console.log(`\n${'='.repeat(76)}`);
console.log('EVALUATION — scored by execution where execution is possible');
console.log('='.repeat(76));

// ── shared-prompt comparison ──────────────────────────────────────────────────
// Variants generated before and after the eval widened have DIFFERENT prompt sets. The
// only honest comparison is the intersection; anything a variant has to itself is
// reported separately as an absolute rate, never in the same column.
//
// Without this, `code 7/9` (base, 32-prompt eval) sat beside `code 14/20` (run6,
// 75-prompt eval) under one heading as though they were the same test. They are not,
// and presenting them that way is worse than not comparing at all.
const idSets = names.map((n) => new Set(Object.keys(scoredById[n])));
const shared = [...idSets[0]].filter((id) => idSets.every((s) => s.has(id)));
const differs = idSets.some((s) => s.size !== shared.length);

if (differs) {
  console.log(`\nPrompt sets differ:`);
  names.forEach((n, i) => console.log(`  ${pad(n, 12)} ${idSets[i].size} prompts`));
  console.log(`  ${pad('shared', 12)} ${shared.length} prompts  <- the only comparable subset`);

  console.log(`\n${'='.repeat(76)}`);
  if (ASSET_VERSIONS.size === 1) {
    console.log(`  asset library: ${[...ASSET_VERSIONS][0]}`);
  } else if (ASSET_VERSIONS.size > 1) {
    console.log(`  !! asset library CHANGED during scoring (${[...ASSET_VERSIONS].join(', ')})`);
    console.log('     the phaser column is not internally comparable - rescore.');
  }
  console.log(`COMPARABLE — the ${shared.length} prompts every variant answered`);
  console.log('='.repeat(76));
  console.log(`\n${pad('axis', 13)}${names.map((n) => pad(n, 14)).join('')}`);
  console.log('-'.repeat(76));
  for (const a of AXES) {
    const ids = shared.filter((id) => scoredById[names[0]][id].axis === a);
    if (!ids.length) continue;
    const cells = names.map((n) => {
      const p = ids.filter((id) => scoredById[n][id].pass === true).length;
      const sk = ids.filter((id) => scoredById[n][id].pass === null).length;
      return pad(`${p}/${ids.length - sk}${sk ? ` (${sk}?)` : ''}`, 14);
    });
    console.log(`${pad(a, 13)}${cells.join('')}`);
  }
  const tot = names.map((n) => {
    const p = shared.filter((id) => scoredById[n][id].pass === true).length;
    const sk = shared.filter((id) => scoredById[n][id].pass === null).length;
    return pad(`${p}/${shared.length - sk}`, 14);
  });
  console.log('-'.repeat(76));
  console.log(`${pad('TOTAL', 13)}${tot.join('')}`);

  console.log(`\n${'='.repeat(76)}`);
  console.log('EACH VARIANT ON ITS OWN FULL SET (columns are NOT comparable)');
  console.log('='.repeat(76));
}
console.log(`\n${pad('axis', 13)}${names.map((n) => pad(n, 14)).join('')}how it was scored`);
console.log('-'.repeat(76));
const HOW = {
  code: 'node --check + execute',
  phaser: 'rendered in Chromium',
  godot: 'RAN in headless Godot + did something',
  structured: 'headers present, in order',
  interpret: 'stated interpretation + domain',
};
for (const a of AXES) {
  const cells = names.map((n) => {
    const b = results[n][a];
    const total = b.pass + b.fail;
    return pad(`${b.pass}/${total}${b.skip ? ` (${b.skip}?)` : ''}`, 14);
  });
  console.log(`${pad(a, 13)}${cells.join('')}${HOW[a]}`);

  // The old Godot bar, on the same generations. Printed directly underneath because the
  // two numbers answer different questions and the gap between them IS the finding: every
  // prompt that parses but does nothing sits in it. Historical Godot scores (run6's 3/15)
  // were measured the lower way, and comparing them to the row above is meaningless.
  if (a === 'godot' && names.some((n) => results[n].godot.legacy.total)) {
    const old = names.map((n) => {
      const L = results[n].godot.legacy;
      return pad(L.total ? `${L.pass}/${L.total}` : '-', 14);
    });
    console.log(`${pad('  └ parses', 13)}${old.join('')}the OLD bar — comparable to pre-2026-09-10 scores`);
  }
}

for (const n of names) {
  console.log(`\n${'-'.repeat(76)}\n${n} — per prompt\n${'-'.repeat(76)}`);
  for (const a of AXES) {
    for (const d of results[n][a].detail) {
      const mark = d.pass === null ? ' ?  ' : d.pass ? ' ok ' : 'FAIL';
      console.log(`  ${mark} ${pad(a, 11)} ${pad(d.id, 20)} ${d.why}`);
    }
  }
}

// Anything scored '?' is a HARNESS failure, not a model result. Saying so loudly is the
// lesson from caching 356 unreachable-verifier responses as real verdicts.
const skipped = names.flatMap((n) => AXES.map((a) => results[n][a].skip)).reduce((x, y) => x + y, 0);
if (skipped) {
  console.log(`\n⚠️  ${skipped} prompt(s) could not be scored (marked ?). Those are HARNESS failures — an unreachable verifier or a missing binary — NOT model failures. Fix the harness and re-score; do not report them as results.`);
}
console.log('');
