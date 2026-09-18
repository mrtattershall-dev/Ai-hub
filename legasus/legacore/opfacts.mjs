// OPERATION FACTS — what an operation PROVIDES and what it REQUIRES, with the execution phase of each
// requirement made first-class.
//
// THE CONCEPT THE DERIVER LACKED. `symbol_availability` understood "op A provides `_timeouts`" and had
// no way to say "op B requires `DEFAULTS` and `_timeouts`". So a bare statement like
//
//     DEFAULTS.update(_timeouts())
//
// was almost invisible: it introduces nothing, so nothing was derived, and all 17 candidate positions
// stood where execution permits 8. The missing general fact is that
//
//     an operation can impose ordering because of what it CONSUMES, even when it provides nothing.
//
// WHY PHASE AND NOT JUST "REQUIRES". Python evaluates different parts of the same construct at
// different times, and a rule that ignores this either manufactures dependencies or misses them:
//
//     def f():  return helper()        helper is DEFERRED - resolved when f RUNS
//     def f(x=helper()):  ...          helper is IMMEDIATE - defaults evaluate when the def executes
//     @register(helper)                IMMEDIATE - decorators run at definition time
//     class A:  x = helper()           IMMEDIATE - a class body executes on definition
//     class A:
//         def f(self): return helper() DEFERRED - the method body does not
//
// Treating a deferred body reference as an ordering dependency is the exact mistake this project made
// once already, in a witness it wrote itself. Making phase part of the representation means it cannot
// recur by accident: a DEFERRED requirement simply never participates in import-time narrowing.
//
// HONEST LIMIT: this is an indentation-and-token analyzer, not a Python AST. It handles the phases
// listed above and will not handle every construct (comprehension scoping, walrus in defaults, nested
// lambdas with defaults). The representation can express the fact; the extractor's coverage is a
// separate and smaller claim.
const NL = String.fromCharCode(10);
const ind = (l) => (l.match(/^[ \t]*/) || [''])[0].length;

// Names that are never a program symbol worth ordering against.
const KEYWORDS = new Set(['def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while', 'in', 'not',
  'and', 'or', 'is', 'None', 'True', 'False', 'try', 'except', 'finally', 'raise', 'with', 'as',
  'import', 'from', 'pass', 'break', 'continue', 'lambda', 'yield', 'global', 'nonlocal', 'assert',
  'del', 'self', 'cls',
  // builtins: present in every program, never something an operation must be ordered against
  'len', 'str', 'int', 'float', 'bool', 'list', 'dict', 'set', 'tuple', 'sum', 'max', 'min', 'abs',
  'sorted', 'reversed', 'range', 'print', 'round', 'enumerate', 'zip', 'isinstance', 'type', 'repr',
  'Exception', 'ValueError', 'TypeError', 'KeyError', 'AssertionError']);

// Identifiers used as VALUES on a line: bare names, not attribute suffixes, not keyword arguments.
function refs(text) {
  const out = [];
  const stripped = String(text)
    .replace(/(['"])(?:\\.|(?!\1)[^\\])*\1/g, '""')     // string literals carry no symbols
    .replace(/#.*$/, '');
  for (const m of stripped.matchAll(/(\.?)\b([A-Za-z_]\w*)\b(\s*=[^=])?/g)) {
    if (m[1] === '.') continue;                          // attribute access: not a free name
    if (m[3]) continue;                                  // keyword argument or assignment target
    const t = m[2];
    if (KEYWORDS.has(t)) continue;
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

// The default-value expressions of a def header: everything after an `=` inside the parameter list.
// These evaluate when the `def` statement executes, which is why they are IMMEDIATE.
function defaultExprs(header) {
  const open = header.indexOf('(');
  const close = header.lastIndexOf(')');
  if (open < 0 || close <= open) return '';
  const params = header.slice(open + 1, close);
  let out = '';
  let depth = 0;
  let collecting = false;
  for (const ch of params) {
    if ('([{'.includes(ch)) depth++;
    if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { collecting = false; continue; }
    if (ch === '=' && depth === 0) { collecting = true; continue; }
    if (collecting) out += ch;
  }
  return out;
}

// The base-class list of a class header, which also evaluates on definition.
function baseExprs(header) {
  const m = header.match(/^\s*class\s+\w+\s*\((.*)\)\s*:/);
  return m ? m[1] : '';
}

// Parameter names of a def header: everything before an `=`, per comma-separated slot.
function paramNames(header) {
  const open = header.indexOf('(');
  const close = header.lastIndexOf(')');
  if (open < 0 || close <= open) return [];
  const out = [];
  let depth = 0;
  let slot = '';
  const flush = () => {
    const name = slot.split('=')[0].replace(/[*]/g, '').split(':')[0].trim();
    if (/^[A-Za-z_]\w*$/.test(name)) out.push(name);
    slot = '';
  };
  for (const ch of header.slice(open + 1, close)) {
    if ('([{'.includes(ch)) depth++;
    if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { flush(); continue; }
    slot += ch;
  }
  flush();
  return out;
}

// THREE CORRECTIONS THE WITNESSES CAUGHT, before this touched any family:
//
//  1. PARAMETERS AND LOCALS ARE NOT REQUIREMENTS. `def f(x=helper()): return x` reported `x` as a
//     deferred requirement. It is a parameter - bound by the call, never something the program must
//     provide. Locals bound inside a body have the same status.
//
//  2. `provides` IS SCOPED TO THE FRAGMENT'S OWN TOP LEVEL. `class A: x = helper()` reported `x`, and
//     `class A: def f(...)` reported `f`. Neither is available to anyone else - they are attributes of
//     A, reachable only as `A.x` and `A.f`. Only names bound at the fragment's outermost level are
//     provided. A fragment that is itself a method body has that method at ITS top level, which is the
//     right answer for an operation inserted into a class.
//
//  3. Both of the above were reported as failures by witnesses rather than discovered by a family,
//     which is the whole reason the witnesses were written first.
export function operationFacts(code) {
  const lines = String(code).split(NL);
  const provides = [];
  const immediate = [];
  const deferred = [];

  const stack = [];
  const isLocal = (t) => stack.some((s) => s.locals && s.locals.has(t));
  const addI = (t) => { if (t && !immediate.includes(t) && !isLocal(t)) immediate.push(t); };
  const addD = (t) => { if (t && !deferred.includes(t) && !isLocal(t)) deferred.push(t); };
  const bindLocal = (t) => {
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].kind === 'def') { stack[i].locals.add(t); return; }
    }
  };

  for (const raw of lines) {
    if (!raw.trim()) continue;
    const i = ind(raw);
    while (stack.length && i <= stack[stack.length - 1].indent) stack.pop();
    const insideDef = stack.some((s) => s.kind === 'def');
    const atTop = stack.length === 0;
    const line = raw.trim();

    // Decorators run at definition time, so they are immediate even though they sit above a def.
    if (line.startsWith('@')) {
      for (const t of refs(line.slice(1))) (insideDef ? addD : addI)(t);
      continue;
    }

    const d = raw.match(/^\s*def\s+(\w+)\s*\(/);
    if (d) {
      if (atTop) provides.push(d[1]); else bindLocal(d[1]);
      // Defaults evaluate NOW; the body does not.
      for (const t of refs(defaultExprs(raw))) (insideDef ? addD : addI)(t);
      stack.push({ kind: 'def', indent: i, locals: new Set(paramNames(raw)) });
      continue;
    }
    const c = raw.match(/^\s*class\s+(\w+)\b/);
    if (c) {
      if (atTop) provides.push(c[1]);
      for (const t of refs(baseExprs(raw))) (insideDef ? addD : addI)(t);
      stack.push({ kind: 'class', indent: i });
      continue;
    }

    const bind = raw.match(/^\s*([A-Za-z_]\w*)\s*=(?!=)/);
    if (bind) { if (atTop) provides.push(bind[1]); else bindLocal(bind[1]); }
    const selfBind = raw.match(/^\s*self\.(\w+)\s*=(?!=)/);
    if (selfBind) provides.push(selfBind[1]);
    const loopVar = raw.match(/^\s*for\s+([A-Za-z_]\w*)\s+in\b/);
    if (loopVar) bindLocal(loopVar[1]);
    const asVar = raw.match(/\bas\s+([A-Za-z_]\w*)/);
    if (asVar) bindLocal(asVar[1]);

    for (const t of refs(line)) (insideDef ? addD : addI)(t);
    if (/:\s*$/.test(line)) stack.push({ kind: 'block', indent: i });
  }

  return {
    provides,
    requires_immediate: immediate.filter((t) => !provides.includes(t)),
    requires_deferred: deferred.filter((t) => !provides.includes(t)),
  };
}

export { NL };
