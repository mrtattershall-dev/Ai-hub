/**
 * lessons.js - CONTEXT-KEYED lessons that survive restarts and are retrieved by relevance.
 *
 * A lesson is not "backslashes are bad". It is: in THIS language, with THIS tool, when THIS
 * error signature appears, THIS is what went wrong and THIS is what worked - with the evidence.
 * Stored one per line in <workspace>/LESSONS.jsonl (a project file: it survives a restart and
 * travels with the workspace). Two producers: the model (the `lesson` tool) and the Hub itself
 * (a tool call that failed with a signature, followed by a call on the same file that
 * succeeded). Two consumers: the opening context (lessons whose language matches the
 * project's files) and the moment of recurrence (a failing tool result whose signature and
 * context match a lesson gets that lesson appended, right there).
 *
 * Retrieval is by CONTEXT MATCH, never by recency alone. A lesson keyed to javascript is not
 * retrieved for a python error, however recent it is. That scoping is what keeps a specific
 * lesson from becoming a wrong blanket rule.
 */
import { readFileSync, appendFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { createHash } from 'node:crypto';

export const LESSONS_FILE = 'LESSONS.jsonl';
export const MAX_LESSONS_SHOWN = 3;

const EXT_LANG = { '.js': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript', '.ts': 'typescript', '.py': 'python', '.html': 'html', '.css': 'css', '.json': 'json', '.md': 'markdown', '.sh': 'bash', '.ps1': 'powershell' };
export function languageOf(path) {
  if (!path) return null;
  return EXT_LANG[extname(String(path)).toLowerCase()] || null;
}

/**
 * A stable, bounded signature for an error text: the first line, digits and quoted names
 * normalised, so "line 12" and "line 40" of the same failure share one signature.
 */
export function errorSignature(text) {
  const first = String(text || '').split('\n').find((l) => l.trim()) || '';
  const norm = first.replace(/\d+/g, 'N').replace(/(["'`])[^"'`]*\1/g, '$1…$1').replace(/\s+/g, ' ').trim().slice(0, 160);
  return norm || null;
}
const sigHash = (s) => createHash('sha256').update(String(s)).digest('hex').slice(0, 12);

export function readLessons(workspace) {
  const p = join(workspace, LESSONS_FILE);
  if (!existsSync(p)) return [];
  return readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

/**
 * Record a lesson. context: { language, tool, errorSignature?, phase? }. Returns the stored
 * record (with id and time). A lesson with the same (language, tool, signature, mistake) as an
 * existing one is not duplicated: its `seen` count and last evidence are updated instead.
 */
export function recordLesson(workspace, { context = {}, mistake, fix, evidence = null, source = 'model', status = null, detect = null }) {
  if (!mistake || !String(mistake).trim()) throw new Error('a lesson needs a MISTAKE');
  if (!fix || !String(fix).trim()) throw new Error('a lesson needs a FIX');
  const ctx = {
    language: context.language ? String(context.language).toLowerCase() : null,
    tool: context.tool ? String(context.tool) : null,
    errorSignature: context.errorSignature ? String(context.errorSignature).slice(0, 160) : null,
    phase: context.phase ? String(context.phase) : null,
  };
  const key = sigHash([ctx.language, ctx.tool, ctx.errorSignature, String(mistake).trim().toLowerCase().slice(0, 120)].join('|'));
  const existing = readLessons(workspace).find((l) => l.key === key);
  const rec = {
    id: existing ? existing.id : `L-${Date.now().toString(36)}-${key.slice(0, 6)}`, key,
    at: new Date().toISOString(), source, context: ctx,
    mistake: String(mistake).trim().slice(0, 400), fix: String(fix).trim().slice(0, 600),
    // STATUS: a model-proposed lesson is SUSPECTED until a fix demonstrably worked; a lesson the
    // Hub recorded from a failure followed by a success on the same file is CONFIRMED once.
    status: status || (existing?.status === 'confirmed' ? 'confirmed' : (source === 'hub' ? 'confirmed' : 'suspected')),
    // DETECT: an optional regular expression over the content an edit/write/command carries;
    // when it matches in this lesson's language and tool, the call is refused ONCE with the
    // lesson - the condition is caught before the edit reaches the working files.
    detect: detect ? String(detect).slice(0, 200) : (existing?.detect || null),
    evidence: evidence || null, seen: existing ? (existing.seen || 1) + 1 : 1,
  };
  appendFileSync(join(workspace, LESSONS_FILE), JSON.stringify(rec) + '\n', 'utf8');
  return rec;
}

/** The latest record per key (the file is append-only). */
export function currentLessons(workspace) {
  const byKey = new Map();
  for (const l of readLessons(workspace)) byKey.set(l.key, l);
  return [...byKey.values()];
}

/**
 * Score a lesson against a context. Language and tool must match when both sides name them;
 * a matching error signature is the strongest signal. A lesson with no language is generic
 * and matches any language at a lower score. Returns 0 for "does not apply".
 */
/** html pages carry inline javascript: a lesson keyed to either applies to both. */
const LANG_ALIAS = { html: 'javascript', javascript: 'javascript', typescript: 'javascript' };
export function sameLanguage(a, b) { return a === b || (LANG_ALIAS[a] && LANG_ALIAS[a] === LANG_ALIAS[b]); }
export function relevance(lesson, ctx) {
  const c = lesson.context || {};
  let score = 0;
  if (c.language && ctx.language) { if (!sameLanguage(c.language, ctx.language)) return 0; score += c.language === ctx.language ? 2 : 1.5; }
  else if (!c.language) score += 0.5;
  if (c.tool && ctx.tool) { if (c.tool !== ctx.tool) return 0; score += 1; }
  if (c.errorSignature && ctx.errorSignature) {
    if (c.errorSignature === ctx.errorSignature) score += 4;
    else if (ctx.errorSignature.startsWith(c.errorSignature.slice(0, 24))) score += 2;
    else return 0;   // both name a signature and they differ: a different mistake
  }
  if (c.phase && ctx.phase && c.phase === ctx.phase) score += 0.5;
  return score;
}

/** Lessons that apply to a context, best first, bounded. */
export function retrieve(workspace, ctx, { limit = MAX_LESSONS_SHOWN } = {}) {
  return currentLessons(workspace)
    .map((l) => ({ lesson: l, score: relevance(l, ctx) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || (b.lesson.seen || 1) - (a.lesson.seen || 1))
    .slice(0, limit)
    .map((x) => x.lesson);
}

/** The languages present in a workspace (top level and one level down; bounded). */
export function projectLanguages(workspace) {
  const langs = new Set();
  const walk = (dir, depth) => {
    let names = [];
    try { names = readdirSync(dir); } catch { return; }
    for (const n of names.slice(0, 200)) {
      if (n === 'node_modules' || n.startsWith('.')) continue;
      const p = join(dir, n);
      let st; try { st = statSync(p); } catch { continue; }
      if (st.isDirectory()) { if (depth < 1) walk(p, depth + 1); }
      else { const l = languageOf(n); if (l) langs.add(l); }
    }
  };
  walk(workspace, 0);
  return [...langs];
}

/** Lessons for the opening context: those keyed to a language the project uses, plus generic ones. */
export function lessonsForOpening(workspace, { limit = MAX_LESSONS_SHOWN } = {}) {
  const langs = [...new Set(projectLanguages(workspace))];
  return currentLessons(workspace)
    .filter((l) => !l.context?.language || langs.some((x) => sameLanguage(x, l.context.language)))
    .sort((a, b) => (b.seen || 1) - (a.seen || 1) || String(b.at).localeCompare(String(a.at)))
    .slice(0, limit);
}

export function renderLessons(lessons, heading) {
  if (!lessons.length) return '';
  const lines = [heading];
  for (const l of lessons) {
    const c = l.context || {};
    const where = [c.language, c.tool].filter(Boolean).join(' / ') || 'any context';
    lines.push(`- [${where}${c.errorSignature ? `; when: "${c.errorSignature.slice(0, 70)}"` : ''}; ${l.status || 'suspected'}] MISTAKE: ${l.mistake} FIX: ${l.fix}${l.seen > 1 ? ` (seen ${l.seen}x)` : ''}`);
  }
  return lines.join('\n');
}
