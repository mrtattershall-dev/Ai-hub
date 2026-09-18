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
// IDENTITY UNDER LINE SHIFT. An insertion renumbers every line below it, so a statement cannot be
// identified by line number. It is identified by its trimmed text plus its occurrence index among
// identical texts - stable under insertion, and sufficient to detect a statement that changed parent
// even when several statements read the same.
//
// DECLARED LIMIT: two structurally distinct statements with identical text and identical parent chains
// are indistinguishable to this signature. That is a real ambiguity, not a hidden one, and it makes the
// checker conservative in the safe direction - it may miss a violation, never invent one.
const NL = String.fromCharCode(10);
const ind = (l) => (l.match(/^[ \t]*/) || [''])[0].length;
const HEADER = /^\s*(?:def|class|if|elif|else|for|while|try|except|finally|with)\b/;
const TERMINATOR = /^\s*(?:return|continue|break|raise)\b/;

// The observed structure of every non-blank statement: its chain of enclosing headers, and whether a
// terminator at its own indent precedes it inside its own block.
export function structureSignature(text) {
  const lines = text.split(NL);
  const stack = [];              // { indent, header }
  const sig = new Map();         // key -> { parents, reachable }
  const seen = new Map();        // trimmed text -> count, for occurrence indices
  const blockTerminated = [];    // parallel to stack: has this block already terminated?
  let topTerminated = false;

  for (const raw of lines) {
    if (!raw.trim()) continue;
    const col = ind(raw);
    while (stack.length && col <= stack[stack.length - 1].indent) {
      stack.pop();
      blockTerminated.pop();
    }
    const trimmed = raw.trim();
    const n = (seen.get(trimmed) || 0);
    seen.set(trimmed, n + 1);
    const key = trimmed + '#' + n;

    const depth = stack.length;
    const terminatedHere = depth ? blockTerminated[depth - 1] : topTerminated;
    sig.set(key, {
      parents: stack.map((s) => s.header),
      reachable: !terminatedHere,
    });

    if (TERMINATOR.test(raw)) {
      if (depth) blockTerminated[depth - 1] = true; else topTerminated = true;
    }
    if (HEADER.test(raw)) {
      stack.push({ indent: col, header: trimmed });
      blockTerminated.push(false);
    }
  }
  return sig;
}

// Compare two signatures over the statements PRE-EXISTING in `before`. Statements the operation adds
// are not checked - an operation is allowed to add structure.
export function structurePreserved(before, after) {
  const a = structureSignature(before);
  const b = structureSignature(after);
  const violations = [];
  for (const [key, was] of a) {
    const now = b.get(key);
    if (!now) {
      violations.push({ statement: key.split('#')[0], kind: 'vanished',
        detail: 'a pre-existing statement is no longer present with the same text' });
      continue;
    }
    if (JSON.stringify(now.parents) !== JSON.stringify(was.parents)) {
      violations.push({ statement: key.split('#')[0], kind: 're_parented',
        was: was.parents, now: now.parents,
        detail: 'a pre-existing statement changed structural parent' });
    } else if (was.reachable && !now.reachable) {
      violations.push({ statement: key.split('#')[0], kind: 'unreachable',
        detail: 'a pre-existing reachable statement is now behind a terminator in its block' });
    }
  }
  return { preserved: violations.length === 0, violations };
}

export { NL };
