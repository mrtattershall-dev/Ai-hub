// TEXT GUARD — the escape hazard has migrated out of code, so the mechanism follows it.
//
// NINE OCCURRENCES. The first four were JS written through shell heredocs. Five, six and eight were
// one-off probes. SEVEN was an invisible control character in source. NINE was a MARKDOWN write: a
// necessity-table section written through a shell-quoted `node -e`, whose backtick span was executed as
// a command substitution and silently deleted the example it contained. The sentence stayed fluent, the
// commit was already made, and the only diagnostic was a shell line that read like unrelated noise.
//
// `escape-guard.mjs` scans .mjs files and had never scanned a prose artifact, because prose was not
// where the discipline was expected to slip. Nine occurrences say the expectation was wrong.
//
// THE FIRST VERSION OF THIS GUARD FLAGGED 25 THINGS AND ALL 25 WERE FALSE POSITIVES. It checked
// backtick balance PER LINE, and this project's prose wraps inline spans across lines constantly:
//
//     ... then began leaking - `if n > 0: return
//     "small"` destroys a preserved behaviour ...
//
// It also flagged the hazard ledger for quoting the very shell noise it documents. A guard with a 100%
// false-positive rate is worse than no guard: it gets ignored within a day, and then it is a
// reassurance rather than a check. The admit list in the tests now comes from the REAL CORPUS rather
// than from invented single-line examples, which is where the first version went wrong.
//
// WHAT IS DETECTABLE, honestly bounded. A vanished backtick span leaves no backticks behind, so
// balance alone cannot see the case that actually happened. These can:
//
//   CONTROL CHARACTER     a raw byte below space other than tab/LF/CR. Always corruption.
//   SHELL NOISE           captured stderr, outside code spans and fences - a document containing it
//                         unquoted means a command wrote where an editor should have.
//   UNBALANCED BACKTICKS  an odd count across the WHOLE document body: half a span was consumed.
//   EMPTY DELIMITERS      an empty inline span, or a bare pair of empty parens sitting in prose.
//                         That is occurrence nine's exact signature.
//
// WHAT IT CANNOT SEE, so the guard is not trusted beyond its reach: a substitution replaced by
// plausible text, or a span deleted cleanly between two spaces leaving even parity. The only complete
// defence is not passing prose through a shell, and this exists because that rule has failed nine times.
import { readFileSync } from 'node:fs';

const NL = String.fromCharCode(10);
const CONTROL_ALLOWED = new Set([9, 10, 13]);
const TICK = String.fromCharCode(96);

const SHELL_NOISE = [
  'command not found',
  'No such file or directory',
  'syntax error near unexpected token',
  'unexpected EOF while looking for matching',
];

export function scanText(src, file) {
  const hits = [];
  const lines = src.split(NL);
  let inFence = false;
  let tickTotal = 0;
  let lastTickLine = 0;
  let prevBlank = true;
  let inIndented = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const n = i + 1;

    for (let j = 0; j < line.length; j++) {
      const c = line.charCodeAt(j);
      if (c < 32 && !CONTROL_ALLOWED.has(c)) {
        hits.push({ file, line: n, kind: 'control-character',
          detail: 'U+' + c.toString(16).toUpperCase().padStart(4, '0'),
          why: 'a raw control character in a text artifact is always corruption' });
      }
    }

    const fenceMarks = (line.match(new RegExp(TICK + TICK + TICK, 'g')) || []).length;
    if (fenceMarks) { if (fenceMarks % 2 === 1) inFence = !inFence; continue; }
    if (inFence) continue;
    // An indented CODE BLOCK starts after a blank line. Four-space indentation inside a bullet list is
    // a LIST CONTINUATION and is prose - and the first version skipped those, so the closing backtick
    // of a span wrapped into a list continuation was never counted and the document read as unbalanced.
    // That was the last false positive in the corpus sweep.
    if (/^\s{4,}\S/.test(line) && prevBlank) { inIndented = true; }
    if (!/^\s{4,}\S/.test(line) && line.trim()) { inIndented = false; }
    prevBlank = !line.trim();
    if (inIndented) continue;

    // Inline spans are stripped before the prose checks, so a document may QUOTE shell noise or empty
    // parens inside code and still be clean. The hazard ledger has to be able to describe the hazard.
    const ticks = (line.match(new RegExp(TICK, 'g')) || []).length;
    if (ticks) { tickTotal += ticks; lastTickLine = n; }
    // The empty-span check must run BEFORE spans are stripped, or the stripper eats the very thing it
    // is looking for - an empty span matches the span pattern. Found by the test failing, which is
    // what the test was for.
    if (new RegExp(TICK + TICK + '(?!' + TICK + ')').test(line)) {
      hits.push({ file, line: n, kind: 'empty-code-span', detail: line.trim().slice(0, 60),
        why: 'an empty inline span is what a consumed substitution leaves behind' });
    }
    const prose = line.replace(new RegExp(TICK + '[^' + TICK + ']*' + TICK, 'g'), ' ')
      .replace(new RegExp(TICK), ' ');
    const quoted = /"[^"]*"/.test(line);

    for (const noise of SHELL_NOISE) {
      if (prose.includes(noise) && !quoted) {
        hits.push({ file, line: n, kind: 'shell-noise', detail: noise,
          why: 'unquoted shell stderr in a document means a command wrote where an editor should have' });
      }
    }
    if (/(^|\s)\(\)(\s|$|[.,;:-])/.test(prose)) {
      hits.push({ file, line: n, kind: 'empty-parens', detail: line.trim().slice(0, 60),
        why: 'a bare pair of empty parentheses in prose is occurrence nine s exact signature' });
    }
  }

  // Balance across the WHOLE body, because this project's prose wraps spans across lines.
  if (tickTotal % 2 === 1) {
    hits.push({ file, line: lastTickLine, kind: 'unbalanced-backticks', detail: String(tickTotal),
      why: 'an odd backtick count across the document means half an inline span was consumed' });
  }
  return hits;
}

export function scanTextFile(path) {
  return scanText(readFileSync(path, 'utf8'), path);
}

export { NL };
