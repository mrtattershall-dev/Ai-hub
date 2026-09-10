/**
 * assemble_run8.mjs - harvested code -> chat-format training rows, for the 32B run.
 *
 *   node factory/assemble_run8.mjs                       # defaults below
 *   node factory/assemble_run8.mjs --in <harvest dir>    # where the *.jsonl harvests live
 *   node factory/assemble_run8.mjs --out trained_run8.jsonl --seed 8 --repo-cap 0.4
 *   node factory/assemble_run8.mjs --interpret 2000 --structured 1000
 *
 * Idempotent: reads whatever inputs exist, reports the ones that do not, writes one file.
 * Re-run when a missing harvest lands and it is simply included.
 *
 * WHAT IS DIFFERENT FROM run7
 * ---------------------------
 * run7 re-cut existing chat datasets. run8 builds rows from HARVESTED CODE, so the prompt
 * has to be synthesised here, and that synthesis is the craft: a mechanical prompt teaches
 * a model to answer mechanical prompts. Descriptions come from the code's own comments
 * where they exist, and from the file path / unit name otherwise, across several phrasings.
 *
 * GATES (in order, every count reported)
 *   1. code < 120 chars
 *   2. duplicate normalised body (plus: a unit whose body sits verbatim inside a kept
 *      program from the same file teaches nothing that program did not)
 *   3. gate.runnableWithAssets against ../assets/manifest.json - a row may load an asset
 *      ONLY if the library really has it; CDNs and unknown assets/ paths are rejected
 *   4. eval contamination across EVERY axis in modal_evalset.py - any user turn with word
 *      overlap >= 0.75 against a held-out prompt and NOTHING is written
 *
 * COMPOSITION
 *   No harvested repo may exceed --repo-cap (default 40%) of an axis. Cuts are a stratified
 *   sample by path prefix, not the first N, so coverage stays broad. The user's own code
 *   (own_units, edits) has no repo and is exempt. A single-repo axis cannot satisfy the cap
 *   by cutting (the cut lowers the denominator too), so it is kept whole and flagged.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (name, d) => {
  const i = argv.indexOf('--' + name);
  return i > -1 && argv[i + 1] !== undefined ? argv[i + 1] : d;
};

const IN_DIR = resolve(flag('in',
  'C:/Users/tatte/AppData/Local/Temp/claude/C--Users-tatte-OneDrive-Documents-ai-native-engine/a8160f8c-9099-46b5-8e59-75485c848e44/scratchpad'));
const OUT = resolve(HERE, flag('out', 'trained_run8.jsonl'));
const SEED = Number(flag('seed', 8));
const REPO_CAP = Number(flag('repo-cap', 0.4));
// The cap is a RATIO, so when the other repos are still thin (harvest_js mid-run) it can cut
// a repo to almost nothing: 13 other Phaser rows -> phaserjs/examples capped at 8. The floor
// is a guard against that; default 0 applies the ratio exactly as specified.
const REPO_FLOOR = Number(flag('repo-floor', 0));
const CAP_INTERPRET = Number(flag('interpret', 2000));
const CAP_STRUCTURED = Number(flag('structured', 1000));
const MIN_CHARS = 120;
const MAX_CONTEXT_CHARS = 8000;
const MANIFEST = resolve(HERE, '../../assets/manifest.json');
const EVALSET = join(HERE, 'modal_evalset.py');

// -- deterministic randomness ----------------------------------------------------
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(SEED);
const shuffle = (arr, r = rand) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
// Per-row phrasing choice is derived from the row itself, so the same input always gets
// the same prompt no matter what else is in the run.
const hashStr = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};
const pick = (arr, key) => arr[hashStr(key) % arr.length];

// -- io --------------------------------------------------------------------------
const badLines = {};
const readJsonl = (f) => {
  if (!existsSync(f)) return null;
  const out = [];
  for (const l of readFileSync(f, 'utf8').split('\n')) {
    if (!l.trim()) continue;
    try { out.push(JSON.parse(l)); } catch { badLines[f] = (badLines[f] || 0) + 1; }   // a half-written tail line
  }
  return out;
};
const nl = (s) => String(s ?? '').replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').replace(/\s+$/, '');
const fence = (code) => '```javascript\n' + nl(code) + '\n```';
const sysOf = (r) => (r.messages.find((m) => m.role === 'system') || {}).content || '';
const userOf = (r) => (r.messages.find((m) => m.role === 'user') || {}).content || '';
const bodyOf = (r) => (r.messages.find((m) => m.role === 'assistant') || {}).content || '';
const row = (system, user, assistant) => ({ messages: [
  { role: 'system', content: system }, { role: 'user', content: user }, { role: 'assistant', content: assistant },
] });

// -- system prompts --------------------------------------------------------------
// Phaser: byte-identical to dataset_phaser_modal.jsonl so this slice and run7's speak with
// one voice. Read from the file when it is there; the literal is the fallback.
const SYS_PHASER_FALLBACK = 'You are an expert Phaser 3 game developer. You write complete, runnable Phaser 3 programs using only real Phaser 3 APIs (Phaser.Game, scenes, this.add, this.physics, this.tweens, this.input, this.time). Draw with generated graphics - never load external assets. Return code that runs as given.';
const modalRows = readJsonl(join(HERE, 'dataset_phaser_modal.jsonl'));
const SYS_PHASER = (modalRows && modalRows.length && sysOf(modalRows[0])) || SYS_PHASER_FALLBACK;
const SYS_CODE = 'You are an expert game programmer working in vanilla JavaScript and the HTML5 canvas. You write clear, correct code that fits the program it belongs to: every identifier you use is declared in scope or in the code shown, and you only call APIs that exist. Return code that runs as given.';
const editRows = readJsonl(join(HERE, 'dataset_edits.jsonl'));
const SYS_EDIT = (editRows && editRows.length && sysOf(editRows[0]))
  || 'You are a senior engineer who modifies existing code. You make the smallest change that satisfies the request, you preserve everything that already works, and you return the complete updated code. Return code that runs as given.';

// -- description synthesis -------------------------------------------------------
const NOISE_WORDS = new Set(['public', 'src', 'js', 'lib', 'libs', 'examples', 'example', 'demo', 'demos', 'test', 'tests', 'es6', 'wip', '_wip']);
const wordsOf = (s) => String(s)
  .replace(/\.[a-z0-9]+$/i, '')
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/[_\-.]+/g, ' ')
  .toLowerCase().replace(/\s+/g, ' ').trim();

/** "public/3.86/src/physics/arcade/bounce.js" -> { dirs: "physics arcade", leaf: "bounce" } */
function pathWords(path) {
  const parts = String(path || '').split('/').filter(Boolean);
  const leaf = wordsOf(parts.pop() || '');
  const dirs = parts
    .filter((p) => !/^\d+(\.\d+)*$/.test(p) && !/^v?\d/.test(p) && !NOISE_WORDS.has(p.toLowerCase()))
    .map(wordsOf).filter(Boolean);
  return { dirs, leaf };
}
const an = (phrase) => (/^[aeiou]/i.test(phrase) && !/^(u[st]|uni|use|usu|euro|one)/i.test(phrase) ? 'an ' : 'a ') + phrase;
function pathDescription(path) {
  const { dirs, leaf: rawLeaf } = pathWords(path);
  const leaf = rawLeaf.replace(/^\d+\s*/, '');                         // "6831 normal map rotation"
  const d = dirs.map((x) => (x === 'bugs' ? 'bug reproduction' : x)).join(' ');
  if (!leaf && !d) return 'a small example';
  if (!d) return leaf;
  if (!leaf) return an(`${d} example`);
  return an(`${d} example: ${leaf}`);
}

/** Leading block or line comments; null when they are banners, licences or links only. */
function leadingComment(code) {
  const src = nl(code).replace(/^\s+/, '');
  const lines = [];
  let m;
  if ((m = src.match(/^\/\*+([\s\S]*?)\*\//))) {
    lines.push(...m[1].split('\n').map((l) => l.replace(/^\s*\*+\s?/, '')));
  } else if (src.startsWith('//')) {
    for (const l of src.split('\n')) {
      if (!l.trim().startsWith('//')) break;
      lines.push(l.replace(/^\s*\/\/+\s?/, ''));
    }
  }
  const RULER = /[─═]|^[\s=\-*#_~]{4,}$|[=\-*#_~]{4,}/;
  // A ruler anywhere in the block means this is a SECTION BANNER ("// ── Combat ──"), which
  // names the region of the file, not the unit under it. Using it would attach the wrong
  // intent to the code, so the block is discarded and the name is used instead.
  if (lines.some((l) => RULER.test(l))) return null;
  const text = lines
    .filter((l) => !/^[\s=\-*#_~─═]*$/.test(l))                         // rulers / blank
    .filter((l) => !/^\s*@\w+/.test(l))                                 // @param, @returns...
    .filter((l) => !/^(https?:\/\/\S+|eslint|jshint|global|TODO|FIXME)/i.test(l.trim()))
    .join(' ').replace(/\s+/g, ' ').trim();
  if (text.length < 12 || text.length > 320) return null;
  if (/copyright|licen[cs]e|all rights reserved|\(c\)|@author/i.test(text)) return null;
  if (/https?:\/\/|^(based on|adapted from|ported from|inspired by|original(ly)? by|credit)/i.test(text)) return null;   // attribution, not intent
  // Commented-out code ("//var canvas = ...") and directives ("/// <reference .../>") are
  // comments syntactically but not descriptions. Prose has none of these.
  if (/[;{}<>]|\w\s*=\s*\S|\w\(|^\s*(var|let|const|if|for|while|return|function)\b/.test(text)) return null;
  const words = text.split(' ');
  if (words.length <= 5 && text === text.toUpperCase()) return null;   // "COMBAT FUNCTIONS" banner
  return text.replace(/\.+$/, '');
}

// Third-person intent from a name. Honest and plain; the comment path above is preferred.
const VERBS = {
  update: 'updates', spawn: 'spawns', draw: 'draws', render: 'renders', get: 'gets', set: 'sets',
  init: 'initialises', initialize: 'initialises', create: 'creates', build: 'builds', make: 'makes',
  handle: 'handles', load: 'loads', save: 'saves', apply: 'applies', compute: 'computes', calc: 'calculates',
  calculate: 'calculates', check: 'checks', add: 'adds', remove: 'removes', reset: 'resets', start: 'starts',
  stop: 'stops', tick: 'ticks', step: 'steps', show: 'shows', hide: 'hides', toggle: 'toggles', play: 'plays',
  enter: 'enters', exit: 'exits', do: 'performs', run: 'runs', fire: 'fires', shoot: 'shoots', move: 'moves',
  flash: 'flashes', trigger: 'triggers', respawn: 'respawns', resize: 'resizes', select: 'selects', retry: 'retries',
  next: 'advances to the next', switch: 'switches', notify: 'shows a notification for', ask: 'asks', send: 'sends',
  collect: 'collects', dismiss: 'dismisses', ensure: 'ensures', find: 'finds', pick: 'picks', place: 'places',
  open: 'opens', close: 'closes', clear: 'clears', damage: 'damages', heal: 'heals', kill: 'kills', use: 'uses',
  equip: 'equips', craft: 'crafts', buy: 'buys', sell: 'sells', generate: 'generates', gen: 'generates',
  parse: 'parses', format: 'formats', measure: 'measures', preload: 'preloads', destroy: 'destroys',
  emit: 'emits', attach: 'attaches', detach: 'detaches', register: 'registers', bind: 'binds', wire: 'wires up',
  refresh: 'refreshes', rebuild: 'rebuilds', animate: 'animates', tween: 'tweens', begin: 'begins', end: 'ends',
  finish: 'finishes', restart: 'restarts', pause: 'pauses', resume: 'resumes', mark: 'marks', track: 'tracks',
  count: 'counts', sort: 'sorts', filter: 'filters', map: 'maps', walk: 'walks', pathfind: 'pathfinds',
  advance: 'advances', queue: 'queues', push: 'pushes', pop: 'pops', roll: 'rolls', pulse: 'pulses',
  scroll: 'scrolls', drop: 'drops', throw: 'throws', swing: 'swings', attack: 'attacks', cast: 'casts',
  unlock: 'unlocks', lock: 'locks', grant: 'grants', award: 'awards', log: 'logs', print: 'prints',
  serialize: 'serialises', deserialize: 'deserialises', restore: 'restores', validate: 'validates',
  normalize: 'normalises', clamp: 'clamps', lerp: 'interpolates', ease: 'eases', blend: 'blends',
  read: 'reads', write: 'writes', copy: 'copies', clone: 'clones', merge: 'merges', split: 'splits',
  describe: 'describes', explain: 'explains', announce: 'announces', display: 'displays', paint: 'paints',
  fill: 'fills', stroke: 'strokes', shake: 'shakes', fade: 'fades', highlight: 'highlights', cycle: 'cycles',
};
const ARTICLE_SKIP = new Set(['all', 'new', 'next', 'current', 'each', 'every', 'random', 'active', 'nearby', 'visible',
  'to', 'from', 'in', 'on', 'at', 'by', 'for', 'with', 'into', 'onto', 'over', 'up', 'down', 'out', 'off']);
function nameIntent(name, kind) {
  const words = wordsOf(String(name || '').replace(/^_+/, '')).split(' ').filter(Boolean);
  if (!words.length) return null;
  const [head, ...rest] = words;
  const tail = rest.join(' ');
  if (kind === 'class') return words.length > 1 ? `models the ${words.join(' ')}` : `models ${an(words[0])}`;
  if (head === 'on' && rest.length) return `handles the ${tail} event`;
  if (['is', 'has', 'can', 'should'].includes(head) && rest.length) return `reports whether ${tail}`;
  if (VERBS[head]) {
    if (!rest.length) return `${VERBS[head]} it`;
    const art = ARTICLE_SKIP.has(rest[0]) || /\b(the|a|for|to)$/.test(VERBS[head]) ? '' : 'the ';
    return `${VERBS[head]} ${art}${tail}`;
  }
  return null;   // no recognised verb: say nothing rather than something invented
}

// -- prompt templates ------------------------------------------------------------
const PROGRAM_PHASER = [
  (d) => `Write a complete Phaser 3 program: ${d}.`,
  (d) => `Write a complete Phaser 3 program that demonstrates ${d}.`,
  (d) => `Show me ${d} in Phaser 3. Give me the whole program, ready to run.`,
  (d) => `I want a small Phaser 3 demo covering ${d}. Write it as one complete program.`,
  (d) => `Build a complete Phaser 3 scene showing ${d}.`,
  (d) => `Can you write a full Phaser 3 program for ${d}?`,
];
const PROGRAM_CODE = [
  (d) => `Write a complete vanilla JavaScript program: ${d}.`,
  (d) => `Write a complete, self-contained JavaScript program that demonstrates ${d}.`,
  (d) => `Show me ${d} in plain JavaScript with the canvas. Give me the whole program.`,
  (d) => `I want a small canvas demo covering ${d}. Write it as one complete program, no frameworks.`,
  (d) => `Build ${d} as a complete vanilla JavaScript program.`,
  (d) => `Can you write a full JavaScript program for ${d}?`,
];
// `tail` is a clause that reads after "<kind>": "that spawns the damage number", or
// 'described in the code as "..."', or null when nothing honest can be said about intent.
const PROGRAM_REPO_FILE = [
  (d, fw) => `Write ${d}${fw}, complete.`,
  (d, fw) => `Write ${d} as one complete file${fw}.`,
  (d, fw) => `Give me the full source of ${d}${fw}, as a complete program.`,
  (d, fw) => `Reproduce ${d} in full${fw}.`,
  (d, fw) => `I need ${d} written out completely, ready to run${fw}.`,
  (d, fw) => `Write out ${d}${fw}, complete and runnable.`,
];
const UNIT_ASK = [
  (n, k, t) => (t ? `Write the \`${n}\` ${k} ${t}.` : `Write the \`${n}\` ${k}.`),
  (n, k, t) => (t ? `Implement \`${n}\`, a ${k} ${t}.` : `Implement the \`${n}\` ${k}.`),
  (n, k, t) => (t ? `Add a ${k} called \`${n}\` ${t}.` : `Add a ${k} called \`${n}\`.`),
  (n, k, t) => (t ? `Now write \`${n}\` - the ${k} ${t}.` : `Now write \`${n}\`.`),
];
const THIRD_PERSON = /^(returns|gets|sets|creates|draws|updates|handles|checks|spawns|renders|builds|computes|calculates|plays|shows|hides|loads|saves|adds|removes|starts|stops|resets|ticks|applies|makes|runs|fires|converts|finds|tries|initiali[sz]es|walks|advances|opens|closes|clears|reports|counts|sorts|picks|places|moves|toggles|triggers|respawns|resizes|generates|parses|formats|emits|registers|refreshes|rebuilds|animates|paints|fills|fades|highlights|cycles|keeps|tracks|ensures|marks|queues|schedules|rolls|damages|heals|kills|equips|crafts|buys|sells|seriali[sz]es|restores|validates|clamps|blends|reads|writes|copies|clones|merges|splits|describes|explains|displays|selects|switches|sends|collects|dismisses|uses|awards|grants|unlocks|locks|logs|prints|pushes|pops|drops|throws|attacks|casts|shakes|wires|binds|attaches|detaches|destroys|preloads|measures|stores|caches|looks|determines|decides|resolves|dispatches|broadcasts|syncs|snaps|wraps|scales|rotates|positions|lays|spreads|accumulates|increments|decrements|recomputes|invokes|calls|maps|filters|reduces|iterates|loops|steps|simulates|helper|helpers)\b/i;
function commentTail(comment) {
  let c = comment.replace(/^[A-Z]/, (ch) => ch.toLowerCase()).replace(/[.]+$/, '');
  const first = c.split(/\s+/)[0].toLowerCase();
  if (VERBS[first]) return `that ${c.replace(/^\S+/, VERBS[first])}`;   // imperative -> third person
  if (THIRD_PERSON.test(c) && !/^helpers?\b/i.test(c)) return `that ${c}`;
  if (c.length > 140) c = c.slice(0, 137).replace(/\s+\S*$/, '') + '...';
  return `described in the code as "${c}"`;
}
const contextBlock = (context) => {
  const items = (Array.isArray(context) ? context : []).map(nl).filter(Boolean);
  const kept = [];
  let used = 0;
  for (const it of items) {
    if (used + it.length > MAX_CONTEXT_CHARS && kept.length) break;
    kept.push(it);
    used += it.length + 2;
  }
  return kept.length ? 'Here is the surrounding code:\n```javascript\n' + kept.join('\n\n') + '\n```\n' : '';
};

// -- builders --------------------------------------------------------------------
const GENERIC_CLASS = /^(Example|Demo|Demo[A-Z]?|Scene[A-Z]?|GameScene|Preloader|Boot|Main|MainMenu|Game|App|Test)$/;
const GENERIC_FN = /^(create|preload|update|init|constructor|render|destroy|shutdown)$/;

function buildProgram(h) {
  const comment = leadingComment(h.code);
  const repoFile = !comment && h.repo && !isExamplesRepo(h.repo);
  const desc = comment || (repoFile ? repoFileDescription(h) : pathDescription(h.path));
  const d = desc.replace(/^[A-Z]/, (c) => c.toLowerCase());
  const key = h.path + '|' + h.repo;
  const user = repoFile
    ? pick(PROGRAM_REPO_FILE, key)(d, h.axis === 'phaser' ? ', in Phaser 3' : ', in vanilla JavaScript')
    : pick(h.axis === 'phaser' ? PROGRAM_PHASER : PROGRAM_CODE, key)(d);
  return row(h.axis === 'phaser' ? SYS_PHASER : SYS_CODE, user, fence(h.code));
}

const repoShort = (repo) => String(repo || '').split('/').pop();
const isExamplesRepo = (repo) => /phaserjs\/examples/i.test(String(repo || ''));
/** For a real project (not the examples site) the path is a file in a repo, not a topic. */
function repoFileDescription(h) {
  const base = String(h.path || '').split('/').pop();
  const { leaf } = pathWords(h.path);
  const what = leaf === 'script' ? 'script' : `${leaf} script`;
  return /\.(m?js)$/i.test(base)
    ? `the ${what} (${base}) of the ${repoShort(h.repo)} project`
    : `the ${what} of the ${repoShort(h.repo)} project`;
}

function buildUnit(h) {
  const kind = (h.unitKind || h.kind) === 'class' ? 'class' : 'function';
  const name = h.name || 'unit';
  const generic = kind === 'class' ? GENERIC_CLASS.test(name) : GENERIC_FN.test(name);
  const comment = leadingComment(h.code);
  let tail;
  if (comment) tail = commentTail(comment);
  else if (generic && h.path && h.repo && !isExamplesRepo(h.repo)) {
    const base = String(h.path).split('/').pop();
    tail = kind === 'class'
      ? `that is the \`${name}\` class in ${base} of the ${repoShort(h.repo)} project`
      : `that is the \`${name}\` step in ${base} of the ${repoShort(h.repo)} project`;
  } else if (generic && h.path) {
    tail = kind === 'class'
      ? `that implements ${pathDescription(h.path)}`
      : `that is the ${name} step of ${pathDescription(h.path)}`;
  } else {
    const i = nameIntent(name, kind);
    tail = i ? `that ${i}` : null;
  }
  const ask = pick(UNIT_ASK, `${h.repo || h.game}|${h.path || ''}|${name}`)(name, kind, tail);
  const user = contextBlock(h.context) + ask;
  return row(h.axis === 'phaser' ? SYS_PHASER : SYS_CODE, user, fence(h.code));
}

/**
 * Edit rows. The instruction is built from diffSummary, and it describes WHAT changed -
 * new identifiers referenced, identifiers no longer referenced, size delta - and nothing
 * about why. The exact diffSummary shape is produced by another session, so every key is
 * read defensively: arrays of strings are identifier lists (added-ish or removed-ish by key
 * name), numbers are counts, strings are used as-is.
 */
// Strip strings and comments so a word that only appears inside a string literal or a
// comment ("Here until dusk", "#d4b870") is not mistaken for an identifier the code uses.
const codeOnly = (src) => String(src || '')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/\/\/[^\n]*/g, ' ')
  .replace(/`(?:\\.|[^`\\])*`/g, ' ')
  .replace(/'(?:\\.|[^'\\\n])*'/g, ' ')
  .replace(/"(?:\\.|[^"\\\n])*"/g, ' ');
const usesIdent = (code, id) => new RegExp('(^|[^\\w$])' + id.replace(/\$/g, '\\$') + '(?![\\w$])').test(code);
const listOf = (xs) => (xs.length <= 1 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]);
function describeDiff(ds, before, after) {
  const added = [], removed = [], notes = [];
  const beforeCode = codeOnly(before), afterCode = codeOnly(after);
  let linesAdded = null, linesRemoved = null, firstDiff = null;
  const isIdent = (x) => typeof x === 'string' && /^[A-Za-z_$][\w$]{2,}$/.test(x) && !/^(the|and|for|new|var|let)$/i.test(x);
  for (const [k, v] of Object.entries(ds || {})) {
    const key = k.toLowerCase();
    if (Array.isArray(v)) {
      const ids = v.filter(isIdent);   // 1-2 char names are loop vars, not intent
      if (/remov|delet|drop|gone|old/.test(key)) {
        removed.push(...ids.filter((x) => usesIdent(beforeCode, x) && !usesIdent(afterCode, x)).slice(0, 6).map((x) => `\`${x}\``));
      } else if (/add|new|introduc|call|ref|ident|use/.test(key)) {
        added.push(...ids.filter((x) => usesIdent(afterCode, x) && !usesIdent(beforeCode, x)).slice(0, 6).map((x) => `\`${x}\``));
      }
    } else if (typeof v === 'number') {
      if (/added|insert|plus/.test(key) && /line/.test(key)) linesAdded = v;
      else if (/remov|delet|minus/.test(key) && /line/.test(key)) linesRemoved = v;
    } else if (typeof v === 'string' && v.trim() && /summary|desc|note|instruction|what/.test(key)) {
      notes.push(v.trim());
    } else if (v && typeof v === 'object' && /first|diff|hunk/.test(key) && typeof v.after === 'string') {
      firstDiff = v;
    }
  }
  const parts = [];
  if (notes.length) parts.push(notes.join(' '));
  if (added.length) parts.push(`it now also uses ${listOf(added)}`);
  if (removed.length) parts.push(`it no longer uses ${listOf(removed)}`);
  // With no identifiers to name, the first changed line is the only honest handle on WHAT
  // changed. Used only when both sides are short enough to quote whole.
  if (!added.length && !removed.length && firstDiff && firstDiff.before && firstDiff.before.trim()
      && firstDiff.after.trim() && firstDiff.before.length <= 120 && firstDiff.after.length <= 120
      && firstDiff.before.trim() !== firstDiff.after.trim()) {
    parts.push(`the line \`${firstDiff.before.trim()}\` becomes \`${firstDiff.after.trim()}\``);
  }
  if (!parts.length) return [];   // nothing describable: caller drops the row
  const bits = [];
  if (linesAdded) bits.push(`+${linesAdded}`);
  if (linesRemoved) bits.push(`-${linesRemoved}`);
  const n = (linesAdded || 0) + (linesRemoved || 0);
  if (bits.length) parts[parts.length - 1] += ` (${bits.join('/')} line${n === 1 ? '' : 's'})`;
  return parts;
}
const EDIT_ASK = [
  (n, k, what) => `Change this ${k} so that ${what}. Return the complete updated \`${n}\`; keep everything that already works.`,
  (n, k, what) => `Update \`${n}\` so that ${what}. Give me the whole ${k} back, not a diff.`,
  (n, k, what) => `Modify the ${k} so that ${what}. Return all of \`${n}\` with the change applied.`,
];
const ADD_ASK = [
  (n, k, t) => (t ? `Add a ${k} called \`${n}\` ${t}.` : `Add a ${k} called \`${n}\`.`),
  (n, k, t) => (t ? `Write the \`${n}\` ${k} ${t}, fitting the code above.` : `Write the \`${n}\` ${k}, fitting the code above.`),
  (n, k, t) => (t ? `This code needs a \`${n}\` ${k} ${t}. Write it.` : `This code needs a \`${n}\` ${k}. Write it.`),
];
function buildEdit(e) {
  const kind = e.kind === 'class' ? 'class' : 'function';
  const name = e.name || 'unit';
  const key = `${e.family}|${e.from}|${e.to}|${name}`;
  if (e.changeKind === 'add' || !e.before) {
    const comment = leadingComment(e.after);
    const i = nameIntent(name, kind);
    const tail = comment ? commentTail(comment) : (i ? `that ${i}` : null);
    const user = contextBlock(e.context) + pick(ADD_ASK, key)(name, kind, tail);
    return row(SYS_EDIT, user, fence(e.after));
  }
  const parts = describeDiff(e.diffSummary, e.before, e.after);
  if (!parts.length) return null;   // an edit with nothing sayable about it is not a teachable row
  const what = parts.join('; ');
  const ctx = contextBlock(e.context);
  const user = (ctx ? ctx + '\n' : '')
    + 'Here is the current code:\n```javascript\n' + nl(e.before) + '\n```\n'
    + pick(EDIT_ASK, key)(name, kind, what);
  return row(SYS_EDIT, user, fence(e.after));
}

// -- collect -----------------------------------------------------------------------
const notPresent = [];
let undescribableEdits = 0;
const collected = []; // { r, axis, source, repo, path, form, code }
const perSourceRead = {};

const strip = (p) => String(p || '').replace(/\\/g, '/');
function harvestFile(name, src) {
  const rows = readJsonl(join(IN_DIR, name));
  if (!rows) { notPresent.push(name); return; }
  perSourceRead[name] = rows.length;
  for (const h of rows) {
    const axis = h.axis === 'code' ? 'code' : 'phaser';
    const form = h.form === 'unit' ? 'unit' : 'program';
    const built = form === 'unit' ? buildUnit({ ...h, axis }) : buildProgram({ ...h, axis });
    collected.push({ r: built, axis, source: src, repo: h.repo || '?', path: strip(h.path), form, code: nl(h.code) });
  }
}
harvestFile('harvest_examples.jsonl', 'phaserjs/examples');
harvestFile('harvest_js.jsonl', 'harvest_js');
// The Modal fan-out over 1,976 repos. Landed after the first assembly run, so it is added
// here rather than replacing harvest_js - the dedupe pass below removes the overlap
// (harvest_js's 373 repos are a subset of these 1,976).
// The FILTERED wide harvest. The raw 50,710 was 80.3% generic JavaScript that merely lived
// in a repo tagged as a game - the same composition as run5's correctness slice, which took
// the code axis from 7/9 to 5/9 and then 3/9. filter_games.mjs keeps the 8,042 rows with
// actual evidence of game code in them.
harvestFile('harvest_wide_games.jsonl', 'harvest_wide');

{
  const rows = readJsonl(join(IN_DIR, 'own_units.jsonl'));
  if (!rows) notPresent.push('own_units.jsonl');
  else {
    perSourceRead['own_units.jsonl'] = rows.length;
    for (const h of rows) {
      const built = buildUnit({ ...h, axis: 'code', unitKind: h.kind, path: h.game, game: h.game });
      collected.push({ r: built, axis: 'code', source: 'own', repo: null, path: strip(h.game), form: 'unit', code: nl(h.code) });
    }
  }
}
{
  const rows = readJsonl(join(IN_DIR, 'edits.jsonl'));
  if (!rows) notPresent.push('edits.jsonl');
  else {
    perSourceRead['edits.jsonl'] = rows.length;
    for (const e of rows) {
      const r = buildEdit(e);
      if (!r) { undescribableEdits++; continue; }
      collected.push({ r, axis: 'edit', source: 'own-edits', repo: null, path: strip(e.family || e.to), form: e.changeKind === 'add' || !e.before ? 'add' : 'edit', code: nl(e.after) });
    }
  }
}
// Pass-through chat datasets, subsampled so they are present without dominating.
function passThrough(name, axis, cap) {
  const rows = readJsonl(join(HERE, name));
  if (!rows) { notPresent.push(name); return { read: 0, kept: 0 }; }
  perSourceRead[name] = rows.length;
  const take = shuffle(rows, rng(SEED + hashStr(name))).slice(0, cap);
  for (const r of take) collected.push({ r, axis, source: name.replace(/^dataset_|\.jsonl$/g, ''), repo: null, path: '', form: 'chat', code: bodyOf(r) });
  return { read: rows.length, kept: take.length };
}
const ptInterpret = passThrough('dataset_interpret.jsonl', 'interpret', CAP_INTERPRET);
const ptStructured = passThrough('dataset_structured.jsonl', 'structured', CAP_STRUCTURED);

// -- gate 1: too short ---------------------------------------------------------------
let tooShort = 0;
let stage = collected.filter((x) => {
  if (x.form === 'chat') return true;
  if (x.code.length < MIN_CHARS) { tooShort++; return false; }
  return true;
});

// -- gate 2: dedupe by normalised body ----------------------------------------------
const norm = (s) => String(s).replace(/\s+/g, '');
const seen = new Set();
let dupBodies = 0;
let subsumed = 0;
{
  // Programs first, so a unit that is a verbatim slice of its own program is the one dropped.
  const order = { program: 0, chat: 1, edit: 2, add: 3, unit: 4 };
  const sorted = stage.slice().sort((a, b) => order[a.form] - order[b.form]);
  const programByPath = new Map();
  const kept = [];
  for (const x of sorted) {
    const k = norm(x.form === 'chat' ? bodyOf(x.r) : x.code);
    if (!k) { dupBodies++; continue; }
    if (seen.has(k)) { dupBodies++; continue; }
    if (x.form === 'unit' && x.repo) {
      const prog = programByPath.get(x.repo + '|' + x.path);
      if (prog && k.length < prog.length && prog.includes(k)) { subsumed++; continue; }
    }
    seen.add(k);
    if (x.form === 'program') programByPath.set(x.repo + '|' + x.path, k);
    kept.push(x);
  }
  stage = kept;
}

// -- gate 3: runnable against the asset library ---------------------------------------
let manifestNames = new Set();
try {
  const m = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  manifestNames = new Set((m.items || m).map((i) => i.name).filter(Boolean));
} catch (e) {
  console.warn(`  !! could not read ${MANIFEST} (${e.message}) - falling back to the strict self-contained rule`);
}
let notRunnable = 0;
const notRunnableWhy = {};
let usesLibraryAssets = 0;
const libraryAssetsUsed = new Set();
let localImports = 0;
// gate.runnableWithAssets asks "does everything it loads exist?"; it does not ask whether a
// PROGRAM pulls in sibling source files. `import Boot from './Boot.js'` is complete only on
// disk next to Boot.js, so a row presented as "a complete program" must not do that.
const LOCAL_IMPORT = /\b(?:import\s[^;]*?from\s*|import\s*\(\s*|require\s*\(\s*|export\s[^;]*?from\s*)['"](?:\.{1,2}\/|\/)/;
{
  const gate = await import('./gate.mjs');
  stage = stage.filter((x) => {
    if (x.form === 'chat') return true;
    const g = gate.runnableWithAssets(x.code, manifestNames);
    if (!g.runnable) {
      notRunnable++;
      for (const why of g.reasons) {
        const key = why.replace(/references assets\/.+/, 'references an asset that is not in the library');
        notRunnableWhy[key] = (notRunnableWhy[key] || 0) + 1;
      }
      return false;
    }
    if (x.form === 'program' && LOCAL_IMPORT.test(x.code)) { localImports++; return false; }
    if (g.assets.length) { usesLibraryAssets++; g.assets.forEach((a) => libraryAssetsUsed.add(a)); }
    return true;
  });
}

// -- composition: repo cap per axis, stratified by path prefix ----------------------------
const prefixOf = (path) => {
  const parts = path.split('/').filter(Boolean);
  parts.pop();
  const dirs = parts.filter((p) => !/^\d+(\.\d+)*$/.test(p) && !NOISE_WORDS.has(p.toLowerCase()));
  return dirs.slice(0, 3).join('/') || '(root)';
};
function stratifiedTake(items, n, key) {
  const groups = new Map();
  for (const it of items) {
    const g = prefixOf(it.path);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(it);
  }
  const r = rng(SEED + hashStr(key));
  const queues = shuffle([...groups.values()].map((g) => shuffle(g, r)), r);
  const out = [];
  while (out.length < n && queues.length) {
    for (let i = 0; i < queues.length && out.length < n; i++) {
      out.push(queues[i].pop());
      if (!queues[i].length) { queues.splice(i, 1); i--; }
    }
  }
  return out;
}
const capNotes = [];
const capCuts = [];
{
  const byAxis = new Map();
  for (const x of stage) { if (!byAxis.has(x.axis)) byAxis.set(x.axis, []); byAxis.get(x.axis).push(x); }
  const kept = [];
  for (const [axis, rows] of byAxis) {
    const repoRows = new Map();
    let exempt = 0;
    for (const x of rows) {
      if (!x.repo) { exempt++; continue; }
      if (!repoRows.has(x.repo)) repoRows.set(x.repo, []);
      repoRows.get(x.repo).push(x);
    }
    // Iterate: cut the largest offending repo to cap/(1-cap) x everything else, then re-check,
    // because the cut lowers the axis total and can push a second repo over the line.
    const current = new Map([...repoRows].map(([k, v]) => [k, v]));
    const guard = new Set();
    for (;;) {
      const total = exempt + [...current.values()].reduce((a, v) => a + v.length, 0);
      const over = [...current.entries()].filter(([, v]) => v.length / total > REPO_CAP).sort((a, b) => b[1].length - a[1].length)[0];
      if (!over) break;
      const [repo, rrows] = over;
      const others = total - rrows.length;
      if (others === 0 || guard.has(repo)) {
        if (others === 0) capNotes.push(`${axis}: ${repo} is the ONLY source of this axis (${rrows.length} rows) - the ${Math.round(REPO_CAP * 100)}% cap cannot be met by cutting, kept whole; it will engage once another repo contributes ${axis} rows`);
        break;
      }
      const ratioCap = Math.floor((REPO_CAP / (1 - REPO_CAP)) * others);
      const cap = Math.max(ratioCap, Math.min(REPO_FLOOR, rrows.length));
      const take = stratifiedTake(rrows, cap, axis + '|' + repo);
      if (others < 100) capNotes.push(`${axis}: the cap on ${repo} is driven by only ${others} row(s) from other repos - the ratio is being applied to a THIN sample${REPO_FLOOR ? ` (floor ${REPO_FLOOR} applied)` : ''}. Re-run when harvest_js.jsonl is complete, or pass --repo-floor N to keep at least N rows.`);
      if (cap > ratioCap) capNotes.push(`${axis}: ${repo} kept at the floor of ${cap} rows, which is ${Math.round(100 * cap / (others + cap))}% of the axis - OVER the ${Math.round(REPO_CAP * 100)}% cap by request (--repo-floor)`);
      const before = {}, after = {};
      for (const x of rrows) before[prefixOf(x.path)] = (before[prefixOf(x.path)] || 0) + 1;
      for (const x of take) after[prefixOf(x.path)] = (after[prefixOf(x.path)] || 0) + 1;
      capCuts.push({ axis, repo, had: rrows.length, kept: take.length, cut: rrows.length - take.length, prefixesBefore: Object.keys(before).length, prefixesAfter: Object.keys(after).length, pct: Math.round(100 * take.length / (others + take.length)) });
      current.set(repo, take);
      guard.add(repo);
    }
    const keepSet = new Set(rows.filter((x) => !x.repo));
    for (const v of current.values()) v.forEach((x) => keepSet.add(x));
    for (const x of rows) if (keepSet.has(x)) kept.push(x);
  }
  stage = kept;
}

// -- gate 4: eval contamination, every axis -----------------------------------------------
const evalPrompts = [];
if (existsSync(EVALSET)) {
  const src = readFileSync(EVALSET, 'utf8');
  const rx = /\(\s*"(\w+)",\s*"([^"]+)",\s*(SYS_\w+),\s*"((?:[^"\\]|\\.)*)"\s*\)/g;
  let m;
  while ((m = rx.exec(src)) !== null) evalPrompts.push({ axis: m[1], id: m[2], prompt: m[4].replace(/\\"/g, '"') });
} else {
  console.warn(`  !! ${EVALSET} not found - contamination NOT checked`);
}
const STOP = new Set(['write', 'complete', 'phaser', 'program', 'that', 'with', 'they', 'from', 'this', 'when', 'into', 'each']);
const bag = (s) => new Set(String(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ')
  .split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w)));
const jac = (a, b) => {
  const i = [...a].filter((x) => b.has(x)).length;
  return i / (a.size + b.size - i || 1);
};
let worst = 0;
let worstPair = null;
const contaminatedRows = [];
const evalBags = evalPrompts.map((e) => bag(e.prompt));
for (const x of stage) {
  const b = bag(userOf(x.r));
  for (let i = 0; i < evalBags.length; i++) {
    const s = jac(b, evalBags[i]);
    if (s > worst) { worst = s; worstPair = [evalPrompts[i], userOf(x.r)]; }
    if (s >= 0.75) contaminatedRows.push({ evalId: evalPrompts[i].id, axis: x.axis, source: x.source, user: userOf(x.r), score: s });
  }
}

// -- shuffle -------------------------------------------------------------------------------
const out = shuffle(stage, rng(SEED)).map((x) => x.r);

// -- report --------------------------------------------------------------------------------
const pad = (s, n) => String(s).padStart(n);
console.log('\n=== run8 (harvested code -> chat rows) ===\n');
console.log(`  inputs from ${IN_DIR}`);
for (const [f, n] of Object.entries(perSourceRead)) console.log(`    ${f.padEnd(28)} ${pad(n, 6)} rows read`);
for (const f of notPresent) console.log(`    ${f.padEnd(28)}    not present (will be picked up on re-run)`);
for (const [f, n] of Object.entries(badLines)) console.log(`    !! ${n} unparsable line(s) skipped in ${f} (file still being written?)`);
console.log(`    asset manifest               ${pad(manifestNames.size, 6)} names`);
console.log(`    eval prompts                 ${pad(evalPrompts.length, 6)} across ${[...new Set(evalPrompts.map((e) => e.axis))].join('/') || 'none'}`);
console.log(`    pass-through caps            interpret ${ptInterpret.kept}/${ptInterpret.read}, structured ${ptStructured.kept}/${ptStructured.read}`);

console.log(`\n  ${pad(collected.length, 6)}  collected${undescribableEdits ? ` (+${undescribableEdits} edit rows skipped: diffSummary names nothing - no identifiers, no quotable first line)` : ''}`);
console.log(`  -${pad(tooShort, 5)}  code under ${MIN_CHARS} chars`);
console.log(`  -${pad(dupBodies, 5)}  duplicate normalised bodies`);
console.log(`  -${pad(subsumed, 5)}  units contained verbatim in a kept program from the same file`);
console.log(`  -${pad(notRunnable, 5)}  fail gate.runnableWithAssets`);
for (const [why, n] of Object.entries(notRunnableWhy).sort((a, b) => b[1] - a[1])) console.log(`            ${pad(n, 6)}  ${why}`);
console.log(`  -${pad(localImports, 5)}  programs that import sibling source files (not complete as given)`);
const capTotal = capCuts.reduce((a, c) => a + c.cut, 0);
console.log(`  -${pad(capTotal, 5)}  over the ${Math.round(REPO_CAP * 100)}% per-repo axis cap`);
for (const c of capCuts) console.log(`            ${c.axis}: ${c.repo} ${c.had} -> ${c.kept} (now ${c.pct}% of axis; ${c.prefixesAfter}/${c.prefixesBefore} path prefixes still covered)`);
for (const n of capNotes) console.log(`            !! ${n}`);
console.log(`  =${pad(out.length, 5)}  rows`);
console.log(`\n  rows that load an asset from the library: ${usesLibraryAssets}${libraryAssetsUsed.size ? ` (${[...libraryAssetsUsed].slice(0, 8).join(', ')})` : ''}`);

// axis x source table
{
  const table = new Map();
  const sources = new Set();
  for (const x of stage) {
    sources.add(x.source);
    if (!table.has(x.axis)) table.set(x.axis, new Map());
    const m = table.get(x.axis);
    m.set(x.source, (m.get(x.source) || 0) + 1);
  }
  const cols = [...sources];
  const w = Math.max(12, ...cols.map((c) => c.length + 2));
  console.log('\n  rows by axis x source');
  console.log('    ' + 'axis'.padEnd(12) + cols.map((c) => c.padStart(w)).join('') + 'total'.padStart(8));
  for (const [axis, m] of table) {
    const tot = [...m.values()].reduce((a, b) => a + b, 0);
    console.log('    ' + axis.padEnd(12) + cols.map((c) => String(m.get(c) || '').padStart(w)).join('') + String(tot).padStart(8));
  }
  const formCount = {};
  for (const x of stage) formCount[x.form] = (formCount[x.form] || 0) + 1;
  console.log(`    by form: ${Object.entries(formCount).map(([k, v]) => `${k} ${v}`).join(', ')}`);
}
const bodyChars = out.reduce((a, r) => a + bodyOf(r).length, 0);
const allChars = out.reduce((a, r) => a + r.messages.reduce((b, m) => b + m.content.length, 0), 0);
console.log(`\n  total rows         ${out.length}`);
console.log(`  distinct prompts   ${new Set(out.map((r) => userOf(r).trim().toLowerCase())).size}`);
console.log(`  distinct answers   ${new Set(out.map((r) => norm(bodyOf(r)))).size}`);
console.log(`  answer content     ${(bodyChars / 1e6).toFixed(2)}M chars (~${(bodyChars / 3.6e3 / 1e3).toFixed(2)}M tokens)`);
console.log(`  all messages       ${(allChars / 1e6).toFixed(2)}M chars (~${(allChars / 3.6e3 / 1e3).toFixed(2)}M tokens at chars/3.6)`);
console.log(`\n  eval overlap (all ${evalPrompts.length} held-out prompts): highest ${worst.toFixed(2)}, ${contaminatedRows.length} row(s) at/over 0.75`);
if (worstPair && worst >= 0.4) {
  console.log(`     eval  [${worstPair[0].id}]: ${worstPair[0].prompt.slice(0, 100)}`);
  console.log(`     train: ${worstPair[1].replace(/\s+/g, ' ').slice(0, 100)}`);
}

// samples: one program, one unit, one edit
const sampleOf = (pred) => stage.filter(pred)
  .map((x) => [x, Math.abs(userOf(x.r).length - 900)]).sort((a, b) => a[1] - b[1]).map((x) => x[0])[0];
const samples = [
  ['program', sampleOf((x) => x.form === 'program')],
  ['unit', sampleOf((x) => x.form === 'unit' && x.source === 'own') || sampleOf((x) => x.form === 'unit')],
  ['edit', sampleOf((x) => x.form === 'edit') || sampleOf((x) => x.form === 'add')],
];
console.log('\n  --- samples (user turn in full, assistant truncated) ---');
for (const [label, x] of samples) {
  if (!x) { console.log(`\n  [${label}] none available (input not present)`); continue; }
  console.log(`\n  [${label}] axis=${x.axis} source=${x.source} path=${x.path}`);
  console.log('  SYSTEM: ' + sysOf(x.r).slice(0, 120) + (sysOf(x.r).length > 120 ? '...' : ''));
  console.log('  USER:\n' + userOf(x.r).split('\n').map((l) => '    | ' + l).join('\n'));
  const a = bodyOf(x.r);
  console.log('  ASSISTANT:\n' + a.slice(0, 200).split('\n').map((l) => '    | ' + l).join('\n') + (a.length > 200 ? `\n    | ... (${a.length} chars)` : ''));
}

// -- refuse / write ---------------------------------------------------------------------------
if (contaminatedRows.length > 0) {
  console.error(`\nREFUSING TO WRITE: ${contaminatedRows.length} row(s) overlap a held-out eval prompt by >=0.75.`);
  for (const c of contaminatedRows.slice(0, 10)) console.error(`   [${c.evalId}] ${c.axis}/${c.source} ${c.score.toFixed(2)}: ${c.user.replace(/\s+/g, ' ').slice(0, 100)}`);
  process.exit(1);
}
if (!out.length) {
  console.error('\nREFUSING TO WRITE: no rows survived.');
  process.exit(1);
}
writeFileSync(OUT, out.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
console.log(`\n  -> ${OUT}\n`);
if (notPresent.length) console.log(`  NOTE: ${notPresent.join(', ')} not present; re-run this script when they land and they are included.\n`);
