// ══════════════════════════════════════════════════════════════════════════════════════════════════
// workspaceFiles.mjs — the GOVERNED FILE SET of an application, and the whole-app reply contract.
//
// The crossover benchmark asks whether bounded, localized editing beats repeated whole-application
// reproduction as software grows. That question only has meaning if the whole-app arm really does
// reproduce the whole application:
//
//   it receives the complete MANIFEST and every governed source file
//   it must return EVERY governed path
//   a missing, duplicate or extra path is a REFUSAL
//
// NOTHING IS SILENTLY INHERITED FROM THE OLD WORKSPACE. If a reply omits a file, the old copy is not
// quietly kept: that would let the arm reproduce one small file and inherit the rest for free, which is
// precisely the cost this experiment is trying to measure. Omission is a refusal, and it is named.
//
// Arm A returns only its bounded edit. THAT DIFFERENCE IS THE TREATMENT, not an unfairness to correct.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';

const NL = String.fromCharCode(10);

/** Files that describe the EXPERIMENT rather than the application, and are never governed source. */
const NOT_SOURCE = new Set(['task.json', 'play.json', 'run.json']);
const SOURCE_EXT = /\.(html?|js|mjs|css|json)$/i;

/**
 * The governed source files of a page directory, as sorted relative paths. Deterministic, because the
 * manifest is part of the contract and a reply is judged against it.
 */
export function governedFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(d).sort()) {
      const full = join(d, name);
      let st;
      try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) {
        if (name === 'node_modules' || name.startsWith('.') || name.endsWith('.attempts')) continue;
        walk(full);
        continue;
      }
      const rel = relative(dir, full).split(sep).join('/');
      if (NOT_SOURCE.has(rel)) continue;
      if (!SOURCE_EXT.test(name)) continue;
      out.push(rel);
    }
  };
  walk(dir);
  return out.sort();
}

export const FILE_MARK = '=== FILE: ';
export const END_MARK = '=== END ===';

/** The application, as one text: a manifest followed by every file, each under its own marker. */
export function serializeApp(dir, paths) {
  const parts = [];
  for (const p of paths) parts.push(`${FILE_MARK}${p} ===`, readFileSync(join(dir, p), 'utf8').replace(/\s+$/, ''));
  parts.push(END_MARK);
  return parts.join(NL);
}

export function manifestText(dir, paths) {
  return paths.map((p) => {
    const bytes = readFileSync(join(dir, p), 'utf8').length;
    return `  ${p} (${bytes} bytes)`;
  }).join(NL);
}

/**
 * Parse a whole-app reply and JUDGE IT AGAINST THE MANIFEST.
 *
 * Returns { ok: true, files } only when the reply carries exactly the governed paths - no more, no
 * fewer, none twice. Every other case is a named refusal, because each is a different failure:
 *
 *   NO_FILE_MARKERS     the reply is not in the required shape at all
 *   MISSING_PATHS       it dropped part of the application
 *   EXTRA_PATHS         it invented files the application does not have
 *   DUPLICATE_PATHS     it emitted the same path twice, so which one is the app is undefined
 *   ECHOED_THE_INPUT    every file came back byte-identical to what was sent
 */
export function parseApp(reply, manifest, before) {
  let text = String(reply || '');
  const fence = text.match(/```(?:[a-z]*)\s*([\s\S]*?)```/i);
  if (fence && fence[1].includes(FILE_MARK)) text = fence[1];
  const idx = text.indexOf(FILE_MARK);
  if (idx === -1) return { ok: false, reason: 'NO_FILE_MARKERS', detail: `the reply carries no "${FILE_MARK}" marker, so no file can be identified` };
  text = text.slice(idx);

  const files = new Map();
  const dupes = [];
  const re = new RegExp(`^${FILE_MARK.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(.+?) ===\\s*$`, 'gm');
  const marks = [...text.matchAll(re)];
  for (let i = 0; i < marks.length; i++) {
    const path = marks[i][1].trim();
    const from = marks[i].index + marks[i][0].length;
    const to = i + 1 < marks.length ? marks[i + 1].index : (text.indexOf(END_MARK, from) === -1 ? text.length : text.indexOf(END_MARK, from));
    const body = text.slice(from, to).replace(/^\r?\n/, '').replace(/\s+$/, '');
    if (files.has(path)) dupes.push(path); else files.set(path, body);
  }
  if (dupes.length) return { ok: false, reason: 'DUPLICATE_PATHS', detail: `the reply emits ${dupes.join(', ')} more than once, so which copy is the application is undefined` };

  const got = [...files.keys()].sort();
  const want = [...manifest].sort();
  const missing = want.filter((p) => !files.has(p));
  const extra = got.filter((p) => !want.includes(p));
  if (missing.length) return { ok: false, reason: 'MISSING_PATHS', detail: `the reply omits ${missing.join(', ')}; an omitted file is NOT inherited from the old workspace` };
  if (extra.length) return { ok: false, reason: 'EXTRA_PATHS', detail: `the reply adds ${extra.join(', ')}, which is not part of the governed application` };

  if (before && want.every((p) => (files.get(p) || '').trim() === String(before[p] || '').trim())) {
    return { ok: false, reason: 'ECHOED_THE_INPUT', detail: 'every governed file came back unchanged' };
  }
  return { ok: true, files, paths: want, chars: [...files.values()].reduce((s, v) => s + v.length, 0) };
}

/** Write a parsed application into a workspace, creating directories as needed. */
export function writeApp(ws, files) {
  for (const [p, body] of files) {
    const full = join(ws, p);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body.endsWith(NL) ? body : body + NL, 'utf8');
  }
}

/** Copy the governed files of a page directory into a workspace, unchanged. */
export function copyApp(dir, ws, paths) {
  for (const p of paths) {
    const full = join(ws, p);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, readFileSync(join(dir, p), 'utf8'), 'utf8');
  }
}
