/**
 * wiring.test.mjs - does every capability have a consumer?
 *
 *   node server/wiring.test.mjs
 *
 * WHY THIS EXISTS
 * ---------------
 * The recurring fault in this repo is not broken code. It is CORRECT code that nothing
 * calls. Twice in one session: a Google account you could connect while no tool could use
 * the token, and an unattended-work supervisor that `start-hub.bat` could not switch on.
 * Both were finished, tested, and completely inert. Nothing failed, because nothing ran.
 *
 * `agent_audit.mjs` already applies this idea to tools - "a tool is only real when four
 * things agree". This generalises it to the rest of the codebase:
 *
 *   an export with no importer          is a promise to a caller that does not exist
 *   an api.js helper no component calls is a feature with no way to reach it
 *   a route nothing requests           is a server capability the product does not have
 *
 * HOW IT AVOIDS BECOMING NOISE
 * ----------------------------
 * A check that cries wolf gets muted, so there are two lists and they behave differently:
 *
 *   DELIBERATE  something genuinely reached from outside the code (a browser redirect, an
 *               uptime probe, a test hook). Silent. Each entry carries a reason.
 *   KNOWN_DEBT  real unwired capability that predates this check. WARNS, does not fail,
 *               so the suite goes green today - but the list is printed every run so it
 *               cannot be forgotten. Do not add to it.
 *
 * Anything else FAILS. That is the point: this stops the NEXT one, and keeps the current
 * ones visible instead of buried.
 *
 * A stale entry in either list also fails - once something IS wired, saying it is not is
 * just a lie that will mislead the next reader.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

/** Reached from outside this codebase, so "nothing calls it" is expected and correct. */
const DELIBERATE = {
  'GET /api/health': 'probed by tunnels and uptime checks, not by the client',
  'GET /callback': 'the Google OAuth redirect - a browser navigates here, no code calls it',
  'GET /api/auth/hint': 'fetched by loadHubToken before any api.js helper exists',
};

/**
 * Unwired capability that predates this check. WARNS only. Do not add to this list -
 * wire the thing, or delete it.
 */
const KNOWN_DEBT = {
  'api.js: getSettings': 'GET /api/settings has a server route and a client binding, and no component calls either',
  'api.js: saveSettings': 'same - a settings store with no UI on top of it',
  'api.js: getHistoryItem': 'HistoryPage lists rows but never opens one, so the detail fetch is unused',
  'auth.js: suggestToken': 'generates a HUB_TOKEN to suggest, but nothing offers it anywhere',
  'browser.js: browserPath': 'resolves the Chromium path for callers that do not exist yet',
  'godotProject.js: isGenerated': 'knows which Godot files are generated; no caller asks',
  'engines.js: ENGINE_IDS': 'the engine id list - consumers all iterate ENGINES directly instead',
};

// ── collect sources ────────────────────────────────────────────────────────────────────
function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    if (e === 'node_modules' || e === '.git' || e === '.engine-cache' || e === 'workspace') continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (['.js', '.mjs', '.jsx'].includes(extname(p)) && !p.includes('.bak') && !p.includes('.pre-')) out.push(p);
  }
  return out;
}

const files = [...walk(join(ROOT, 'server')), ...walk(join(ROOT, 'client/src')), ...walk(join(ROOT, 'shared'))];

/**
 * Blank out everything that is prose rather than code, before any scanning.
 *
 * Comments were stripped from the first version because a tombstone comment for a deleted
 * export re-reported it. STRING LITERALS matter just as much and were missed: agent.js
 * embeds its whole system prompt as a template literal, and that prompt contains worked
 * examples of tool calls - including a literal `export function lerp(a, b, t)` showing the
 * model how append_file works. The scanner read that as a real export with no importer, and
 * two of us nearly deleted a line of the agent's prompt documentation on its say-so.
 *
 * A detector that cannot tell code from a code EXAMPLE will confidently report the example.
 */
const stripComments = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/.*$/gm, '$1')
  .replace(/`(?:[^`\\]|\\.)*`/g, '``')
  .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
  .replace(/"(?:[^"\\\n]|\\.)*"/g, '""');

const src = Object.fromEntries(files.map((f) => [f, stripComments(readFileSync(f, 'utf8'))]));
const isClient = (f) => f.includes(`client${'\\'}src`) || f.includes('client/src');

/**
 * Files that could USE a symbol - everything except the one that declares it, and except
 * THIS file.
 *
 * Excluding this file is load-bearing, and the reason is worth keeping. The lists above
 * name the unwired things, so `suggestToken` appears in this source. Without the exclusion
 * the scanner found that mention, concluded the symbol was used, and stopped reporting it -
 * which then made its own KNOWN_DEBT entry look stale. Listing a problem made the problem
 * invisible: an allowlist that silently empties itself is worse than no allowlist.
 */
const SELF = fileURLToPath(import.meta.url);
const usedElsewhere = (name, declaredIn, only = () => true) =>
  files.some((f) => f !== declaredIn && f !== SELF && only(f) && new RegExp(`\\b${name}\\b`).test(src[f]));

let passed = 0;
const problems = [];
const warned = [];
const test = (name, fn) => {
  try { fn(); passed++; }
  catch (e) { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; }
};

const classify = (key, describe) => {
  if (DELIBERATE[key]) return 'deliberate';
  if (KNOWN_DEBT[key]) { warned.push(`${key} — ${KNOWN_DEBT[key]}`); return 'debt'; }
  problems.push(describe);
  return 'problem';
};

// ── 1. server exports with no importer ─────────────────────────────────────────────────
const serverFiles = files.filter((f) => !isClient(f) && !/\.test\.|_test\./.test(f));
for (const f of serverFiles) {
  const names = [
    ...[...src[f].matchAll(/export (?:async )?function (\w+)/g)].map((m) => m[1]),
    ...[...src[f].matchAll(/export const (\w+)\s*=/g)].map((m) => m[1]),
  ];
  for (const n of names) {
    if (n.startsWith('__')) continue;                       // test hooks, deliberately exported
    if (usedElsewhere(n, f)) continue;
    // Used only inside its own file: it does not need to be exported, but it is not dead.
    const selfUses = (src[f].match(new RegExp(`\\b${n}\\b`, 'g')) || []).length;
    if (selfUses > 1) continue;
    classify(`${basename(f)}: ${n}`, `${basename(f)} exports ${n}, and nothing imports it`);
  }
}

// ── 2. client api.js helpers no component calls ────────────────────────────────────────
const apiFile = join(ROOT, 'client/src/lib/api.js');
if (src[apiFile]) {
  const names = [...src[apiFile].matchAll(/export (?:const|async function|function) (\w+)/g)].map((m) => m[1]);
  for (const n of names) {
    if (usedElsewhere(n, apiFile, isClient)) continue;
    classify(`api.js: ${n}`, `api.js exports ${n}, and no component calls it - the feature has no way in`);
  }
}

// ── 3. routes nothing requests ─────────────────────────────────────────────────────────
const routes = new Map();
for (const f of serverFiles) {
  for (const m of src[f].matchAll(/(?:app|router)\.(get|post|put|delete)\('([^']+)'/g)) {
    routes.set(`${m[1].toUpperCase()} ${m[2]}`, f);
  }
}
for (const [route, f] of routes) {
  const path = route.split(' ')[1];
  if (path.includes(':')) continue;                          // parameterised - matched textually is unreliable
  const segment = path.replace(/^\//, '').split('/').filter(Boolean).pop();
  if (!segment) continue;
  const referenced = files.some((o) => o !== f && new RegExp(`['\`/]${segment}['\`?/]`).test(src[o]));
  if (referenced) continue;
  classify(route, `${route} is served, and nothing in the client or the tests ever requests it`);
}

// ── the assertions ─────────────────────────────────────────────────────────────────────
test('every capability has a consumer, is deliberately external, or is listed as known debt', () => {
  assert.deepEqual(problems, [],
    `newly unwired capability:\n  - ${problems.join('\n  - ')}\n\n`
    + 'Wire it to a caller, delete it, or - if it is genuinely reached from outside the code - '
    + 'add it to DELIBERATE with a reason.');
});

test('no stale entries: everything listed as deliberate or debt is still unwired', () => {
  const stillUnwired = new Set([...warned.map((w) => w.split(' — ')[0]), ...Object.keys(DELIBERATE)]);
  const stale = Object.keys(KNOWN_DEBT).filter((k) => !stillUnwired.has(k));
  assert.deepEqual(stale, [],
    `these are wired up now, so remove them from KNOWN_DEBT: ${stale.join(', ')}`);
});

if (warned.length) {
  console.log('\n  known unwired capability (not failing, but do not add to this list):');
  for (const w of warned) console.log(`    · ${w}`);
}
console.log(`\nwiring: ${passed} passed${process.exitCode ? ' (with failures above)' : ''}`);
