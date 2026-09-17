// MECHANICAL GUARD against the project's fourth-repeat apparatus hazard.
//
// A shell heredoc collapses doubled backslashes. JS written that way arrives on disk with `'\\s'`
// turned into `'\s'` - and in a JS string literal `\s` is simply `s`, so the file stays SYNTACTICALLY
// VALID, the regex silently changes meaning, and the program produces a plausible wrong answer with
// no error anywhere. That is the nastiest shape a bug can take in this project: it reports OK while
// the work is lost.
//
// Four repetitions is enough that another written rule is not the answer. This is the tooling being
// made hostile to the failure mode: a scan that finds the corruption signature directly.
//
// THE SIGNATURE: inside a quoted string literal, an escape sequence whose escaped character is a
// REGEX metacharacter and not a JS one. `'\\s'` (correct) reads as an escaped backslash followed by a
// plain `s` and is untouched. `'\s'` (corrupted) reads as an escape of `s`, which JS does not define
// and silently discards.
//
// Template literals are skipped: they have different escaping rules and this codebase builds its
// regexes from quoted strings.
import { readFileSync } from 'node:fs';

// Characters that are regex metacharacters but NOT valid JS string escapes. A lone backslash before
// any of these is a corrupted regex, never an intention. `n t r v f 0 \ ' " u x` are real JS escapes
// and are deliberately absent.
const REGEX_ONLY = new Set(['s', 'd', 'w', 'S', 'D', 'W', 'b', 'B',
  '.', '(', ')', '[', ']', '{', '}', '+', '*', '?', '^', '$', '|']);

// Walk a source file, tracking whether we are inside a quoted literal, a comment, or a template.
// A regex scan cannot do this correctly, and using a regex to police regex escaping would be funny
// in the wrong way.
export function scan(src, file) {
  const hits = [];
  let i = 0;
  let line = 1;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    // comments
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; }
      i += 2; continue;
    }
    // template literal: skipped wholesale
    if (c === '`') {
      i++;
      while (i < n && src[i] !== '`') { if (src[i] === '\\') i++; else if (src[i] === '\n') line++; i++; }
      i++; continue;
    }
    // regex literal written directly is fine - its backslashes are not string escapes. Detecting one
    // properly needs the preceding token; the cheap approximation below skips only what follows a
    // character that cannot end an expression, which is where a literal regex can legally start.
    if (c === '/' && /[=(,:[!&|?{};\n]/.test((src.slice(0, i).match(/\S\s*$/) || [''])[0].trim() || '\n')) {
      i++;
      let cls = false;
      while (i < n && (cls || src[i] !== '/')) {
        if (src[i] === '\\') i++;
        else if (src[i] === '[') cls = true;
        else if (src[i] === ']') cls = false;
        else if (src[i] === '\n') break;
        i++;
      }
      i++; continue;
    }
    if (c === "'" || c === '"') {
      const quote = c;
      const startLine = line;
      const startAt = i;
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === '\n') break;                 // unterminated; let the parser complain
        if (src[i] === '\\') {
          const esc = src[i + 1];
          if (REGEX_ONLY.has(esc)) {
            hits.push({ file, line: startLine, escape: '\\' + esc,
              text: src.slice(startAt, Math.min(n, startAt + 72)) });
          }
          i += 2; continue;
        }
        i++;
      }
      i++; continue;
    }
    i++;
  }
  return hits;
}

export function scanFile(path) {
  return scan(readFileSync(path, 'utf8'), path);
}
