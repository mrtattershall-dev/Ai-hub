// EXPRESSION CONTINUATION — a CURRENT_PROGRAM_FACT the deriver did not represent.
//
// `bodies()` models compound statements: def, class, if, for, while, try, with. It knows nothing about
// a statement continued across lines by an unclosed bracket. So a module-level insertion between
//
//     SHAPE_KINDS = ["circle", "square", "rect"
//     ]
//
// was left standing as a legal boundary. It is a syntax error, and execution rejects it.
//
// THE CARE THIS NEEDS is entirely in the negatives. A naive depth counter finds brackets inside string
// literals and comments, decides ordinary code is "still open", and removes positions that are
// perfectly legal - over-constraint, which is worse than the miss it replaces. So the scanner tracks
// string state (both quote styles, with escapes) and strips comments outside strings.
//
// Triple-quoted strings are NOT modelled. A program containing one may be mis-scanned, and that is a
// declared limit rather than a silent risk: no family in the substrate contains one, and adding the
// state without a witness that can fire would be untested code claiming authority.
const NL = String.fromCharCode(10);
const OPEN = '([{';
const CLOSE = ')]}';

// Bracket depth remaining open AFTER the given line. Zero means the statement is complete there.
export function openAfterLine(src, upTo) {
  const lines = src.split(NL);
  let depth = 0;
  for (let i = 0; i <= upTo && i < lines.length; i++) {
    const line = lines[i];
    let quote = null;
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (quote) {
        if (ch === '\\') { j++; continue; }          // escaped character, whatever it is
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'") { quote = ch; continue; }
      if (ch === '#') break;                          // comment runs to end of line, outside a string
      if (OPEN.includes(ch)) depth++;
      else if (CLOSE.includes(ch)) depth = Math.max(0, depth - 1);
    }
  }
  return depth;
}

// The constraint: every candidate position sitting inside an open continuation is illegal.
export function continuationConstraint(src, candidates) {
  const inside = candidates.filter((p) => openAfterLine(src, p) > 0);
  if (!inside.length) return null;
  const lines = src.split(NL);
  return {
    kind: 'expression_continuation',
    claim: 'positions ' + inside.join(', ') + ' sit inside an unclosed bracket and are not insertion '
      + 'boundaries at all',
    witness: {
      rule: 'open_bracket_depth', positions: inside,
      depths: inside.map((p) => openAfterLine(src, p)),
      detail: inside.map((p) => 'after line ' + p + ' (' + JSON.stringify((lines[p] || '').trim().slice(0, 40))
        + ') bracket depth is ' + openAfterLine(src, p) + ', so the statement is still open').join('; '),
    },
    forbids: inside,
  };
}

export { NL };
