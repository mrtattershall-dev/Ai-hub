// DERIVED LOOP-OWNERSHIP FACTS.
//
// The recurring `<p>a a b b</p>` failure is not "the model likes duplicating text". It is a violation of
// an EXCLUSIVE OWNERSHIP invariant that the program never declares:
//
//     blank-line branch   owns the line -> continue
//     "- " branch         owns the line -> continue
//     heading branch      owns the line -> continue
//     otherwise           the fall-through owns it:  current.append(line.strip())
//
// `continue` is the ownership-transfer primitive. An inserted branch that CONSUMES the line without
// terminating the iteration leaves ownership falling through as well, and the same semantic input is
// processed twice. The rule is invisible unless you read the loop as a whole, which is exactly the kind
// of global fact a 1.5B generating a local snippet cannot be expected to infer.
//
// So it is DERIVED here, like scope facts, rather than written into prose by me. The distinction that
// matters for the project: a field a planner can compute is a field a real system could supply; a field
// only I can write is an oracle in disguise.
const NL = String.fromCharCode(10);
const indentOf = (l) => (l.match(/^[ \t]*/) || [''])[0].length;

function functionBody(src, fn) {
  const m = src.match(new RegExp('^def\\s+' + fn + '\\s*\\(', 'm'));
  if (!m) return null;
  const rest = src.slice(m.index).split(NL);
  let end = rest.length;
  for (let i = 1; i < rest.length; i++) {
    if (rest[i].trim() === '') continue;
    if (!/^[ \t]/.test(rest[i])) { end = i; break; }
  }
  return rest.slice(0, end);
}

export function loopOwnership(src, fn) {
  const body = functionBody(src, fn);
  if (!body) return null;

  // The iteration variable and the loop body's indentation.
  let loopAt = -1; let loopIndent = 0; let iterVar = null;
  for (let i = 0; i < body.length; i++) {
    const m = body[i].match(/^(\s*)for\s+([A-Za-z_]\w*)\s+in\b/);
    if (m) { loopAt = i; loopIndent = m[1].length; iterVar = m[2]; break; }
  }
  if (loopAt === -1) return null;

  const lines = [];
  for (let i = loopAt + 1; i < body.length; i++) {
    if (body[i].trim() && indentOf(body[i]) <= loopIndent) break;
    lines.push({ i, text: body[i], indent: indentOf(body[i]) });
  }
  const bodyIndent = Math.min(...lines.filter((l) => l.text.trim()).map((l) => l.indent));

  // A branch at the loop-body indentation, and whether it terminates the iteration.
  const branches = [];
  for (let k = 0; k < lines.length; k++) {
    const l = lines[k];
    if (l.indent !== bodyIndent || !/^\s*(if|elif)\b/.test(l.text)) continue;
    let terminates = false;
    for (let j = k + 1; j < lines.length; j++) {
      if (lines[j].text.trim() && lines[j].indent <= bodyIndent) break;
      if (/^\s*(continue|return|break)\b/.test(lines[j].text)) { terminates = true; break; }
    }
    branches.push({ guard: l.text.trim(), terminates });
  }

  // The FALL-THROUGH owner: a statement at the loop-body indentation, outside every branch, that
  // consumes the iteration variable.
  const fallthrough = lines.filter((l) => l.indent === bodyIndent
    && !/^\s*(if|elif|else|for|while)\b/.test(l.text)
    && new RegExp('\\b' + iterVar + '\\b').test(l.text)
    && /\.(append|extend|add)\(/.test(l.text))
    .map((l) => l.text.trim());

  return {
    iterVar,
    bodyIndent,
    fallthrough_owner: fallthrough[0] || null,
    exclusive_branches: branches.filter((b) => b.terminates).map((b) => b.guard),
    non_terminating_branches: branches.filter((b) => !b.terminates).map((b) => b.guard),
    invariant: fallthrough.length
      ? 'exactly one owner may consume each ' + iterVar
      : null,
    rule: fallthrough.length
      ? 'any new branch that consumes `' + iterVar + '` must terminate the iteration (continue) before '
        + 'the fall-through owner runs'
      : null,
  };
}

// The sentence an edit contract should carry for a site inside such a loop.
export function ownershipClause(src, fn) {
  const o = loopOwnership(src, fn);
  if (!o || !o.fallthrough_owner) return '';
  return 'This branch claims ownership of `' + o.iterVar + '`. End the iteration with `continue` after '
    + 'handling it, or `' + o.fallthrough_owner + '` will consume the same ' + o.iterVar + ' a second time.';
}
