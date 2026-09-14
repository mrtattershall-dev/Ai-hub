// TYPED CONTRACT DERIVATION - replaces the flat wants[] that mis-specified 7 of 20 goals.
//
// THE DEFECT THIS FIXES. `deriveGate` turned
//     "Add delete(key) and clear() to the EXISTING Cache in s7_cache.js"
// into wants = ["Cache", "delete", "clear"], a flat list with the ownership thrown away. The checker
// then demanded all three at MODULE level, which methods never are - so every add-method goal was
// unpassable by construction. Worse, the same list was rendered into the PROMPT ("it must export:
// Cache, delete, clear"), so the model dutifully wrote `function delete(key)` - a SyntaxError,
// because `delete` is a reserved word. The apparatus did not merely mis-score the output, it
// CHANGED it. That is treatment contamination, not scoring error, and results built on it are void
// rather than understated.
//
// THE STRUCTURAL RULE that prevents a repeat: one heuristic must not silently define both the
// instruction and the evaluator. So this module emits a typed contract AND a human-readable
// rendering of what it believes the goal asked for. The rendering is what a person checks; the typed
// contract is what the checker consumes; fixtures prove both directions:
//
//     goal text -> typed contract -> rendered interpretation -> known-good passes / known-bad fails
//
// THE DISCRIMINATOR, read off the 20 goal texts rather than guessed: after "to the EXISTING", the
// target is either a Capitalised identifier (a class - the names are its MEMBERS) or a filename
// (a module - the names are MODULE EXPORTS).
import { deriveGate } from './derive.mjs';

const CLASS_RE = /^[A-Z][\w$]*$/;
const FILE_RE = /^[\w.]+\.(?:js|py|html|md)$/i;
// Only LANGUAGE KEYWORDS. The old list filtered `adds?`, which silently deleted the legitimate
// method `add` from goal 13's contract - a stopword list cannot tell prose from an API name.
const STOP = /^(?:new|if|for|while|return|function|class|def|print|console|typeof|instanceof)$/;

const names = (s) => {
  const out = [];
  // NO SPACE before the paren. Prose reads "copies of a book (adding an isbn...)" and the old
  // `\s*` matched `book (`, inventing methods named `book`, `copies` and `number`. An API name
  // in these goals is always written tight against its parameter list.
  const r = /([A-Za-z_$][\w$]*)\(/g;
  let m;
  while ((m = r.exec(s))) { if (!STOP.test(m[1]) && !out.includes(m[1])) out.push(m[1]); }
  return out;
};

export function deriveContract(goal) {
  const g = String(goal);
  const base = deriveGate(g);
  const c = {
    lead: base.lead, files: base.files, lang: base.lang, isEdit: base.isEdit,
    moduleExports: [], members: [], domIds: [], domClasses: [],
  };
  const addExport = (n) => { if (n && !c.moduleExports.includes(n)) c.moduleExports.push(n); };
  const addMember = (owner, name, kind = 'instance_method') => {
    if (!c.members.some((x) => x.owner === owner && x.name === name)) c.members.push({ owner, kind, name });
  };

  // --- DOM contracts. An id and a class are different obligations and were previously conflated.
  {
    const re = /"([a-z0-9][a-z0-9_-]{2,})"/gi;
    let m;
    while ((m = re.exec(g)) !== null) {
      const tok = m[1];
      if (tok.includes('.')) continue;
      const pre = g.slice(Math.max(0, m.index - 90), m.index);
      const idHits = [...pre.matchAll(/\bids?\b/gi)];
      const clHits = [...pre.matchAll(/\bclass(?:es)?\b/gi)];
      const lastId = idHits.length ? idHits[idHits.length - 1].index : -1;
      const lastCl = clHits.length ? clHits[clHits.length - 1].index : -1;
      if (lastCl > lastId) { if (!c.domClasses.includes(tok)) c.domClasses.push(tok); }
      else if (lastId >= 0) { if (!c.domIds.includes(tok)) c.domIds.push(tok); }
    }
  }

  // --- "Add <things> to the EXISTING <target> ..."  The target decides module vs member.
  const add = g.match(/^\s*Add\s+(.+?)\s+to\s+(?:the\s+EXISTING\s+)?([A-Za-z_$][\w$.]*)/i);
  if (add) {
    const head = add[1];
    const target = add[2];
    let headNames = names(head);
    // When the head is PROSE - "Add holds to the EXISTING Library in s1_library.js: placeHold(...)"
    // or "Add variables to the EXISTING s5_expr.js: evaluate(expr, vars = {})" - the API names live
    // after the colon. Only consulted when the head named nothing, to keep the blast radius small:
    // colon sections routinely mention EXISTING methods in passing ("like get(key)").
    if (!headNames.length) {
      const ci = g.indexOf(':');
      if (ci >= 0) headNames = names(g.slice(ci + 1));
    }
    if (CLASS_RE.test(target)) {
      // "Add checkout(isbn, member) and available(isbn) to the EXISTING Library in s1_library.js"
      addExport(target);
      // "and a static identity(n)" is not an instance method, and the rendering should say so.
      // Plain substring test rather than a built regex - the name is already a bare identifier.
      headNames.forEach((n) => addMember(target, n,
        g.includes('static ' + n + '(') ? 'static_method' : 'instance_method'));
    } else if (FILE_RE.test(target)) {
      // "Add parse_log(text) and bad_lines(text) to the EXISTING s2_logs.py"
      // and "Add availability(...) to the EXISTING s10_desk.js and export it"
      headNames.forEach(addExport);
    } else {
      // "Add headings to to_html in the EXISTING s4_markdown.py" - the target IS the function, and
      // the contract is that it still exists afterwards. headNames here is prose ("headings").
      addExport(target);
      if (/\band\s+export\s+it\b/i.test(g)) headNames.forEach(addExport);
    }
  }

  // --- "Make evaluate() in the EXISTING s5_expr.js handle ..." - the named function must survive.
  const mk = g.match(/^\s*Make\s+([a-z_$][\w$]*)\s*\(/i);
  if (mk) addExport(mk[1]);

  // --- Creation goals. "exporting a Library class:" / "with a Graph class:" name a class whose
  //     methods are listed after the colon; "exporting evaluate(expr)" names a module function.
  if (!add && !mk) {
    const cls = g.match(/(?:exporting|with)\s+(?:a|an)\s+([A-Z][\w$]*)\s+class/);
    if (cls) {
      addExport(cls[1]);
      const colon = g.slice(g.indexOf(cls[0]) + cls[0].length);
      names(colon).filter((n) => n !== cls[1] && !CLASS_RE.test(n)).forEach((n) => addMember(cls[1], n));
    }
    const fn = g.match(/(?:export(?:ing|s)?|with)\s+([a-z_$][\w$]*)\s*\(/);
    if (fn) addExport(fn[1]);
  }

  // A page is not a module. Goal 29's "the EXISTING s9 board" produced a target `s9` that is
  // neither class nor filename, and the fallback branch turned it into a module export.
  if (c.lang === 'web' || c.lang === 'md') { c.moduleExports = []; c.members = []; }

  return c;
}

// The interpretation a HUMAN checks. If this sentence does not match the goal, the contract is wrong
// and nothing downstream of it means anything - which is exactly what happened with goal 17.
export function renderContract(c) {
  const parts = [];
  if (c.moduleExports.length) parts.push(c.lead + ' must export ' + c.moduleExports.join(', '));
  const byOwner = new Map();
  for (const m of c.members) {
    if (!byOwner.has(m.owner)) byOwner.set(m.owner, []);
    byOwner.get(m.owner).push(m.name);
  }
  for (const [owner, ms] of byOwner) parts.push(owner + ' must have method' + (ms.length > 1 ? 's ' : ' ') + ms.join(', '));
  if (c.domIds.length) parts.push('the page must contain element id' + (c.domIds.length > 1 ? 's ' : ' ') + c.domIds.join(', '));
  if (c.domClasses.length) parts.push((c.domIds.length ? 'and ' : '') + 'use class' + (c.domClasses.length > 1 ? 'es ' : ' ') + c.domClasses.join(', '));
  return parts.length ? parts.join('; ') + '.' : '(no contract derived)';
}

// What the PROMPT is allowed to say. It must describe members as members, never as exports - the old
// rendering is what induced `function delete(key)`.
export function renderForPrompt(c) {
  const parts = [];
  if (c.moduleExports.length) parts.push('export ' + (c.moduleExports.length > 1 ? c.moduleExports.slice(0, -1).join(', ') + ' and ' + c.moduleExports[c.moduleExports.length - 1] : c.moduleExports[0]));
  const byOwner = new Map();
  for (const m of c.members) {
    if (!byOwner.has(m.owner)) byOwner.set(m.owner, []);
    byOwner.get(m.owner).push(m.name);
  }
  const list = (xs) => (xs.length > 1 ? xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1] : xs[0]);
  for (const [owner, ms] of byOwner) {
    parts.push('give ' + owner + ' the method' + (ms.length > 1 ? 's ' : ' ') + list(ms.map((n) => n + '()')));
  }
  // DOM goals previously produced NO prompt text at all, so the model was told nothing about the
  // ids and classes it was going to be scored on.
  if (c.domIds.length) parts.push('include element' + (c.domIds.length > 1 ? 's with ids ' : ' with id ') + list(c.domIds));
  if (c.domClasses.length) parts.push('use the class' + (c.domClasses.length > 1 ? 'es ' : ' ') + list(c.domClasses));
  return parts.length ? 'It must ' + list(parts) + '.' : '';
}
