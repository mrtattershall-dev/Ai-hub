// STRUCTURAL PRESERVATION — the second ground-truth channel, preregistered in NARROWABILITY_V2.md.
//
// THE INVARIANT: inserting an operation must not change the structural parent or the reachability of
// any PRE-EXISTING statement outside the granted edit.
//
// INDEPENDENCE IS THE WHOLE POINT. This must not consult `ownership_boundary` or any of its indent
// arithmetic, or the rule under test would be defining its own oracle. LegaCore says "this position
// violates ownership"; this module independently observes "these pre-existing statements changed
// parent". Two different mechanisms reaching the same verdict is evidence. One mechanism consulted
// twice is not.
//
// So the comparison is between two OBSERVED signatures of the same program text, before and after a
// candidate insertion. Nothing here knows what an operation is, what a constraint is, or why anyone
// wanted to insert something.
//
// IDENTITY IS BY LINE PROVENANCE, NOT BY TEXT.
//
// The first version identified statements by trimmed text plus occurrence index. That INVENTED a
// violation on its first real family: k03:op2 inserts code containing `return TOTAL`, a line the
// program already had, so the inserted copy took occurrence index 0 and the pre-existing statement was
// compared against it - reporting a re-parenting that never happened, on seven positions.
//
// The earlier comment claimed this identity was "conservative in the safe direction - it may miss a
// violation, never invent one". That was simply wrong, and an inserted duplicate is the ordinary case
// rather than an exotic one.
//
// An insertion has an exact known shape: a block of `count` lines placed after line `pos`. So the map
// from after-index to before-index is exact - lines at or before `pos` are themselves, lines after the
// block are shifted back by `count`, and the block itself is new. Comparison uses that map and needs no
// guessing at all.
const NL = String.fromCharCode(10);
const ind = (l) => (l.match(/^[ \t]*/) || [''])[0].length;
const HEADER = /^\s*(?:def|class|if|elif|else|for|while|try|except|finally|with)\b/;
const TERMINATOR = /^\s*(?:return|continue|break|raise)\b/;

// The observed structure of every non-blank statement: its chain of enclosing headers, and whether a
// terminator at its own indent precedes it inside its own block.
export function structureSignature(text) {
  const lines = text.split(NL);
  const stack = [];              // { indent, header }
  const sig = new Map();         // LINE INDEX -> { text, parents, reachable }
  const blockTerminated = [];    // parallel to stack: has this block already terminated?
  let topTerminated = false;

  for (let li = 0; li < lines.length; li++) {
    const raw = lines[li];
    if (!raw.trim()) continue;
    const col = ind(raw);
    while (stack.length && col <= stack[stack.length - 1].indent) {
      stack.pop();
      blockTerminated.pop();
    }
    const depth = stack.length;
    const terminatedHere = depth ? blockTerminated[depth - 1] : topTerminated;
    sig.set(li, {
      text: raw.trim(),
      parents: stack.map((s) => s.header),
      reachable: !terminatedHere,
    });

    if (TERMINATOR.test(raw)) {
      if (depth) blockTerminated[depth - 1] = true; else topTerminated = true;
    }
    if (HEADER.test(raw)) {
      stack.push({ indent: col, header: raw.trim() });
      blockTerminated.push(false);
    }
  }
  return sig;
}

// Compare the structure of PRE-EXISTING statements before and after an insertion.
//
// `insertion` is { pos, count }: a block of `count` lines placed immediately after line `pos` of
// `before`. Given that, the after-index of any pre-existing line is exact, so no statement is ever
// compared against an inserted line that happens to read the same.
//
// Without `insertion` the comparison falls back to matching by line index, which is correct only when
// the texts have the same shape; callers that insert MUST pass it.
export function structurePreserved(before, after, insertion) {
  const a = structureSignature(before);
  const b = structureSignature(after);
  const map = (i) => {
    if (!insertion) return i;
    return i <= insertion.pos ? i : i + insertion.count;
  };
  const violations = [];
  for (const [li, was] of a) {
    const now = b.get(map(li));
    if (!now || now.text !== was.text) {
      violations.push({ statement: was.text, kind: 'vanished',
        detail: 'a pre-existing statement is not where the insertion map says it should be' });
      continue;
    }
    if (JSON.stringify(now.parents) !== JSON.stringify(was.parents)) {
      violations.push({ statement: was.text, kind: 're_parented',
        was: was.parents, now: now.parents,
        detail: 'a pre-existing statement changed structural parent' });
    } else if (was.reachable && !now.reachable) {
      violations.push({ statement: was.text, kind: 'unreachable',
        detail: 'a pre-existing reachable statement is now behind a terminator in its block' });
    }
  }
  return { preserved: violations.length === 0, violations };
}

export { NL };
