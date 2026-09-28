// LegaParse: PROGRAM-LEVEL CONCERN GRAPH.
//
// v1 assumed a feature lives inside one function. It abstained on 6/6 of the sealed substrate because
// none of those features do: a01/a02 span a constructor and methods, a03 spans module state and three
// functions. The concept was not wrong - the abstraction was.
//
// A CONCERN is a piece of program state together with every location that participates in it. Locations
// are classified by ROLE, derived from what they do to the state, not from what they are called:
//
//     OWNER      declares or initialises the state
//     MUTATOR    writes to it
//     CONSUMER   reads it
//     REGISTRY   a module-level collection that enumerates variants of it
//
// Roles are structural. Nothing here knows about tallies, stacks, columns or comments, and adding such
// knowledge is forbidden - it would fit the holdout rather than generalize.
//
// Scope: Python. Indentation-structured, so units are found by indentation rather than by a parser. This
// is a limitation worth stating rather than hiding: a real LegaParse would use an AST.
const NL = String.fromCharCode(10);
const indentOf = (l) => (l.match(/^[ \t]*/) || [''])[0].length;

// Every named unit in the module: top-level functions, classes, and methods within classes. A unit is a
// (name, qualified name, line range, body) tuple. Module level itself is a unit too, so module state and
// registries participate on the same footing as functions - which is the generalization v1 lacked.
export function units(src) {
  const lines = src.split(NL);
  const out = [];
  const open = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l.trim()) continue;
    const ind = indentOf(l);
    while (open.length && ind <= open[open.length - 1].indent) {
      const u = open.pop();
      u.end = i - 1;
      out.push(u);
    }
    const m = l.match(/^(\s*)(def|class)\s+([A-Za-z_]\w*)/);
    if (m) {
      open.push({ kind: m[2], name: m[3], indent: m[1].length, start: i,
        qual: (open.length ? open[open.length - 1].name + '.' : '') + m[3] });
    }
  }
  while (open.length) { const u = open.pop(); u.end = lines.length - 1; out.push(u); }
  // module level, excluding the bodies of the units above
  const covered = new Set();
  for (const u of out) for (let i = u.start; i <= u.end; i++) covered.add(i);
  const moduleLines = [];
  for (let i = 0; i < lines.length; i++) if (!covered.has(i) && lines[i].trim()) moduleLines.push(i);
  out.push({ kind: 'module', name: '<module>', qual: '<module>', indent: -1,
    start: 0, end: lines.length - 1, moduleLines });
  return out.sort((a, b) => a.start - b.start);
}

// State symbols: attributes (self.x) and module-level names bound to a container or constant.
export function stateSymbols(src) {
  const syms = new Set();
  for (const m of src.matchAll(/\bself\.(_?[A-Za-z]\w*)\s*(?:=|\[)/g)) syms.add('self.' + m[1]);
  for (const m of src.matchAll(/^([A-Z_][A-Z0-9_]*)\s*=/gm)) syms.add(m[1]);
  for (const m of src.matchAll(/^(?:\s{4})?([a-z_]\w*)\s*=\s*(?:\[\]|\{\}|None)\s*$/gm)) syms.add(m[1]);
  return [...syms];
}

// A write is an assignment to the symbol, an indexed assignment into it, or a mutating method call on
// it. A keyword argument such as `key=lambda` is NOT a write - a loose "line contains =" fallback
// misclassified a pure reader (busiest_day) as a mutator.
const ESC = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function writeRe(bare) {
  const b = '(?:self\\.)?' + ESC(bare);
  return new RegExp(b + '\\s*(?:\\[[^\\]]*\\])?\\s*=(?!=)' + '|' + b + '\\s*\\.\\s*(?:append|extend|add|update|pop)\\s*\\(');
}

// For one state symbol, every unit that participates and how.
export function concernFor(src, sym) {
  const lines = src.split(NL);
  const us = units(src);
  const bare = sym.replace(/^self\./, '');
  const re = new RegExp('(?:self\\.)?\\b' + bare.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
  const participants = [];
  for (const u of us) {
    const idxs = u.kind === 'module' ? u.moduleLines
      : Array.from({ length: u.end - u.start + 1 }, (_, k) => u.start + k);
    const hits = idxs.filter((i) => re.test(lines[i]));
    if (!hits.length) continue;
    const W = writeRe(bare);
    const writes = hits.filter((i) => W.test(lines[i]));
    const declares = hits.filter((i) => new RegExp('^\\s*(?:self\\.)?' + bare + '\\s*=').test(lines[i]));
    const role = declares.length ? (u.kind === 'module' ? 'REGISTRY' : 'OWNER')
      : writes.length ? 'MUTATOR' : 'CONSUMER';
    participants.push({ unit: u.qual, kind: u.kind, role,
      lines: hits, lastLine: hits[hits.length - 1], firstLine: hits[0],
      unitStart: u.start, unitEnd: u.end });
  }
  // A container unit (class) whose every hit lies inside a nested unit is not itself a participant -
  // it was double-counting the same lines as its methods.
  const nested = participants.filter((p) => p.kind !== 'class' && p.kind !== 'module');
  const kept = participants.filter((p) => p.kind !== 'class'
    || !p.lines.every((i) => nested.some((n) => i >= n.unitStart && i <= n.unitEnd)));
  return { symbol: sym, participants: kept };
}

// Every concern in the module, richest first. A concern with one participant is not a concern.
export function concerns(src) {
  return stateSymbols(src)
    .map((s) => concernFor(src, s))
    .filter((c) => c.participants.length >= 2)
    .sort((a, b) => b.participants.length - a.participants.length);
}
