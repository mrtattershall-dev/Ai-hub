// LegaCore SITE SELECTION, first migration from oracle to computed.
//
// THE HYPOTHESIS. A feature added "like an existing one" occupies the same positions the existing one
// occupies. Goal 64 says so literally - "written like the unordered lists" - so its seven sites should
// be recoverable as the positions where the ANALOGUE FEATURE is referenced, with no anchor supplied.
//
// A feature in this code shape is a GROUP of collaborating positions:
//     declaration      items = []
//     flush function   def flush_list(): ... uses items
//     consumer branch  if line.startswith("- "): items.append(...)
//     flush call sites every flush_list() call
// Those are symbol references, and symbol references are computable. If the candidate set built from
// them contains the reference sites, site selection is derivable rather than oracle.
//
// WHAT IS AND IS NOT SUPPLIED. Supplied: the source, the target function, the goal text. NOT supplied:
// the reference anchors, their count, or their positions. The deriver has never read oraclesites.mjs.
//
// LOCKED ENDPOINT (frozen in LEGASUS_V4.md before this file was written): recall, precision, exact
// candidate-set match, inflation ratio. A trivial superset is not success; "every line" is an explicit
// failure.
const NL = String.fromCharCode(10);
const indentOf = (l) => (l.match(/^[ \t]*/) || [''])[0].length;

export function functionLines(src, fn) {
  const m = src.match(new RegExp('^def\\s+' + fn + '\\s*\\(', 'm'));
  if (!m) return null;
  const before = src.slice(0, m.index).split(NL).length - 1;
  const rest = src.slice(m.index).split(NL);
  let end = rest.length;
  for (let i = 1; i < rest.length; i++) {
    if (rest[i].trim() === '') continue;
    if (!/^[ \t]/.test(rest[i])) { end = i; break; }
  }
  return { offset: before, lines: rest.slice(0, end) };
}

// A feature group: a collection accumulator, the nested function that drains it, the branch that feeds
// it, and every call site of the drain. All found by symbol reference, nothing hard-coded.
export function featureGroups(src, fn) {
  const f = functionLines(src, fn);
  if (!f) return [];
  const L = f.lines;

  // accumulators: a name bound to an empty collection at function-body indent
  const accs = [];
  for (let i = 0; i < L.length; i++) {
    const m = L[i].match(/^(\s+)([A-Za-z_]\w*)\s*=\s*(\[\]|\{\}|None)\s*$/);
    if (m) accs.push({ name: m[2], line: i, indent: m[1].length });
  }

  const groups = [];
  for (const a of accs) {
    // the nested def whose body references this accumulator
    let drain = null;
    for (let i = 0; i < L.length; i++) {
      const d = L[i].match(/^\s+def\s+([A-Za-z_]\w*)\s*\(/);
      if (!d) continue;
      const di = indentOf(L[i]);
      let body = '';
      for (let j = i + 1; j < L.length; j++) {
        if (L[j].trim() && indentOf(L[j]) <= di) break;
        body += L[j] + NL;
      }
      if (new RegExp('\\b' + a.name + '\\b').test(body)) {
        let end = i;
        for (let j = i + 1; j < L.length; j++) {
          if (L[j].trim() && indentOf(L[j]) <= di) break;
          end = j;
        }
        drain = { name: d[1], line: i, endLine: end, indent: di };
        break;
      }
    }
    // every call site of the drain, and every branch that feeds the accumulator
    const calls = [];
    const feeders = [];
    for (let i = 0; i < L.length; i++) {
      if (drain && new RegExp('^\\s*' + drain.name + '\\s*\\(\\s*\\)').test(L[i])) {
        calls.push({ line: i, indent: indentOf(L[i]) });
      }
      if (new RegExp('\\b' + a.name + '\\.(append|extend|add)\\s*\\(').test(L[i])) {
        feeders.push({ line: i, indent: indentOf(L[i]) });
      }
    }
    groups.push({ accumulator: a, drain, calls, feeders,
      size: 1 + (drain ? 1 : 0) + calls.length + feeders.length });
  }
  return groups;
}

// Candidate insertion sites: for the chosen analogue group, one insertion point adjacent to each of its
// positions. The claim under test is that a NEW parallel feature belongs exactly where the existing one
// already lives.
export function deriveSites(src, fn, goalText) {
  const f = functionLines(src, fn);
  if (!f) return { ok: false, why: 'no function ' + fn };
  const groups = featureGroups(src, fn);
  if (!groups.length) return { ok: false, why: 'no feature group found' };

  // Which existing feature is the analogue? Prefer one the goal text names; otherwise the richest group,
  // since a feature with a declaration, a drain, a branch and several call sites is the most structured
  // thing to parallel.
  let analogue = null;
  for (const g of groups) {
    const names = [g.accumulator.name, g.drain && g.drain.name].filter(Boolean);
    if (names.some((n) => new RegExp('\\b' + n + '\\b').test(goalText))) { analogue = g; break; }
  }
  if (!analogue) {
    // goal 64 says "like the unordered lists" without naming `items`; map feature words to the group
    // whose drain emits that markup.
    const wants = (goalText.match(/<(\w+)>/g) || []).map((s) => s.slice(1, -1));
    for (const g of groups) {
      if (!g.drain) continue;
      const body = f.lines.slice(g.drain.line, g.drain.endLine + 1).join(NL);
      if (wants.some((w) => body.includes('<' + w + '>'))) { analogue = g; break; }
    }
  }
  if (!analogue) analogue = groups.slice().sort((a, b) => b.size - a.size)[0];

  const sites = [];
  const add = (line, indent, why) => {
    if (!sites.some((s) => s.line === line)) sites.push({ line, absLine: f.offset + line + 1, indent, why });
  };
  add(analogue.accumulator.line, analogue.accumulator.indent, 'parallel accumulator declaration');
  if (analogue.drain) add(analogue.drain.endLine, analogue.drain.indent, 'parallel drain function');
  for (const c of analogue.calls) add(c.line, c.indent, 'parallel drain call site');
  for (const fd of analogue.feeders) add(fd.line, fd.indent, 'parallel consumer branch');

  return { ok: true, analogue: { accumulator: analogue.accumulator.name,
    drain: analogue.drain && analogue.drain.name, groups: groups.length },
    sites: sites.sort((a, b) => a.line - b.line), fnLines: f.lines.length };
}
