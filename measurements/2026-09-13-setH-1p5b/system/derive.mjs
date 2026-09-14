// Can a GATE be derived mechanically from a goal's text?
// The 100-goal gated harness needs, per goal: target file(s), language, create-vs-edit, and the
// API names the goal requires. gateLoop has 4 HAND-BUILT rungs; if this cannot be derived, the
// harness needs hand-authoring for 100 goals and the plan changes.
//
// Ground truth for the FILE comes from the checker's own per-goal results (checks-H wrote
// results[n-1].file), so file extraction is scored against something I did not author.
// The API names have no ground truth file, so those are reported for inspection, not scored.

export function deriveGate(goal) {
  const g = String(goal || '').replace(/\s+/g, ' ');

  // 1. TARGET FILES. Filenames are explicit and distinctive in this set.
  const files = [...new Set((g.match(/\bs?[A-Za-z_0-9]*\.(?:js|py|html|md)\b/g) || []))];
  // The file being CREATED/EDITED is normally the first mentioned after Create/Add/Write.
  const lead = (g.match(/\b(?:Create|Write)\s+([A-Za-z_0-9]+\.(?:js|py|html|md))/i)
    || g.match(/\bin\s+the\s+EXISTING\s+([A-Za-z_0-9]+\.(?:js|py|html|md))/i)
    || g.match(/\bEXISTING\s+([A-Za-z_0-9]+\.(?:js|py|html|md))/i)
    || g.match(/\bto\s+the\s+EXISTING\s+([A-Za-z_0-9]+\.(?:js|py|html|md))/i)
    || [])[1] || files[0] || null;

  const lang = !lead ? null
    : lead.endsWith('.py') ? 'py' : lead.endsWith('.js') ? 'js'
      : lead.endsWith('.html') ? 'web' : 'md';

  // 2. CREATE vs EDIT.
  const isEdit = /\bEXISTING\b/.test(g) || /^\s*Add\b/i.test(g);

  // 3. REQUIRED API NAMES. Several distinct shapes in this set.
  const wants = new Set();
  let m;
  // "exporting a Library class" / "exports shelfLine(library)" / "and export it"
  for (const r of [
    /exporting\s+(?:a|an)\s+([A-Z][\w$]*)\s+class/g,
    // "with a Graph class" / "with a Gradebook class" - creation goals naming the class after `with`.
    /\bwith\s+(?:a|an)\s+([A-Z][\w$]*)\s+class/g,
    // "exporting evaluate(expr)" as well as "exports shelfLine(library)" - `exports?` missed the
    // -ing form, which cost goal 5 its only derivable contract.
    /export(?:ing|s)?\s+([a-z_$][\w$]*)\s*\(/g,
    /\bwith\s+([a-z_$][\w$]*)\s*\(/g,
    // "Add headings to to_html in the EXISTING s4_markdown.py" - the contract is that the EXISTING
    // function is still there afterwards, which is precisely what these goals were breaking.
    /\bto\s+([a-z_$][\w$]*)\s+in\s+the\s+EXISTING/g,
    // "Make evaluate() in the EXISTING s5_expr.js handle parentheses"
    /\bMake\s+([a-z_$][\w$]*)\s*\(\s*\)/g,
    // "Add remove_node(n) to the EXISTING Graph in s6_graph.py" - the class must survive too.
    /\bto\s+the\s+EXISTING\s+([A-Z][\w$]*)\s+in\b/g,
  ]) { while ((m = r.exec(g))) wants.add(m[1]); }
  // DOM goals state their contract as element ids rather than function names.
  { const r = /"(s\d+-[\w-]+)"/g; while ((m = r.exec(g))) wants.add('#' + m[1]); }
  // "Add checkout(isbn, member) and available(isbn) to the EXISTING"
  const addHead = g.match(/^\s*Add\s+(.+?)\s+to\s+the\s+EXISTING/i);
  if (addHead) {
    const r = /([A-Za-z_$][\w$]*)\s*\(/g;
    while ((m = r.exec(addHead[1]))) wants.add(m[1]);
  }
  // "Add functions to evaluate() in the EXISTING s5_expr.js: min(...) and max(...), abs(x), sqrt(x)"
  const colon = g.split(':').slice(1).join(':');
  if (/^\s*Add\b/i.test(g) && colon) {
    const r = /\b([a-z_$][\w$]*)\s*\(/g;
    while ((m = r.exec(colon))) {
      const n = m[1];
      if (!/^(?:it|the|and|or|a|an|is|are|be|to|of|in|on|for|with|when|new|returns?|throws?|raises?|keeps?|adds?|calls?)$/.test(n)) wants.add(n);
    }
  }
  return { lead, files, lang, isEdit, wants: [...wants] };
}
