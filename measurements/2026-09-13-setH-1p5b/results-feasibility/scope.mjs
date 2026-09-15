// DERIVED SCOPE FACTS - not oracle prose.
//
// B2's failures included `codes.append(line)` and `"\n".join(codes + links)` inside `to_html`. Neither
// name exists there: both are locals of the NEIGHBOURING `_inline` function, visible in the prompt. The
// model reached for what it could see.
//
// The fix must not be another hand-written sentence. Which identifiers are usable at a point in a
// Python file is a mechanical property of the source, so it is COMPUTED here. This matters for the
// wider question: a field a planner can derive is a field a real system could fill without a human,
// whereas a field only I can write is an oracle in disguise. The per-site "already handled" prose
// below remains oracle; this does not.
const reDef = /^def\s+([A-Za-z_$][\w$]*)\s*\(/gm;
const reNestedDef = /^[ \t]+def\s+([A-Za-z_$][\w$]*)\s*\(/gm;
const reAssign = /^[ \t]*([A-Za-z_][\w]*)\s*(?:=[^=]|\+=|-=)/gm;
const reFor = /^[ \t]*for\s+([A-Za-z_][\w]*)\s*(?:,|\s+in\b)/gm;
const reModuleConst = /^([A-Z_][A-Z0-9_]*)\s*=/gm;
const reImport = /^import\s+([A-Za-z_][\w]*)|^from\s+[\w.]+\s+import\s+([A-Za-z_][\w]*)/gm;

// The body of a top-level `def name(`, by indentation.
export function functionBody(src, fn) {
  const m = src.match(new RegExp('^def\\s+' + fn + '\\s*\\(', 'm'));
  if (!m) return null;
  const rest = src.slice(m.index).split('\n');
  let end = rest.length;
  for (let i = 1; i < rest.length; i++) {
    if (rest[i].trim() === '') continue;
    if (!/^[ \t]/.test(rest[i])) { end = i; break; }
  }
  return { start: m.index, text: rest.slice(0, end).join('\n') };
}

const collect = (re, text) => {
  const out = new Set();
  let m;
  const r = new RegExp(re.source, re.flags);
  while ((m = r.exec(text)) !== null) out.add(m[1] || m[2]);
  out.delete(undefined);
  return out;
};

export function scopeFacts(src, fn, extraInScope = []) {
  const body = functionBody(src, fn);
  if (!body) return null;

  const moduleFns = collect(reDef, src);
  const moduleConsts = collect(reModuleConst, src);
  const imports = collect(reImport, src);

  const localAssigns = collect(reAssign, body.text);
  const localFors = collect(reFor, body.text);
  const localDefs = collect(reNestedDef, body.text);
  // The function's OWN parameters. Missing these listed `text` - to_html's own argument - as foreign,
  // which would have been a straightforwardly wrong instruction.
  const params = new Set();
  const pm = body.text.match(new RegExp('^def\\s+' + fn + '\\s*\\(([^)]*)\\)'));
  if (pm) for (const p of pm[1].split(',')) {
    const n = p.trim().split(/[:=]/)[0].trim().replace(/^\*+/, '');
    if (/^[A-Za-z_]\w*$/.test(n)) params.add(n);
  }

  const inScope = new Set([...moduleFns, ...moduleConsts, ...imports, ...params,
    ...localAssigns, ...localFors, ...localDefs, ...extraInScope]);
  inScope.delete(fn);

  // Everything bound inside some OTHER top-level function, minus anything genuinely in scope here.
  // Loop TARGETS in other functions are deliberately excluded. `i` is a loop variable in _inline, but
  // the correct flush_ol writes `for i in ol_items` - naming it out-of-scope would forbid the right
  // answer. The warning is about READING foreign state, not about reusing a conventional fresh name.
  const foreign = new Set();
  const loopTargets = new Set();
  for (const other of moduleFns) {
    if (other === fn) continue;
    const ob = functionBody(src, other);
    if (!ob) continue;
    for (const n of collect(reAssign, ob.text)) foreign.add(n);
    for (const n of collect(reNestedDef, ob.text)) foreign.add(n);
    for (const n of collect(reFor, ob.text)) loopTargets.add(n);
  }
  for (const n of loopTargets) foreign.delete(n);
  for (const n of inScope) foreign.delete(n);

  return {
    inScope: [...inScope].filter(Boolean).sort(),
    outOfScope: [...foreign].filter(Boolean).sort(),
  };
}
