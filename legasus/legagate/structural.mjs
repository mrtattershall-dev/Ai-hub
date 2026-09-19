// LEGAGATE — STRUCTURAL AUTHORITY, decided by parsing rather than by pattern-matching text.
//
// WHY THIS REPLACES THE REGEX GATE. T04's proposal was `import re` followed by exactly one `def dedent`.
// The textual gate rejected it and reported "expected exactly one definition of dedent, saw [def dedent]",
// which is self-contradicting: one definition is what was wanted. The real cause was a different condition
// whose anchor lacked a multiline flag. The outcome was defensible; the stated mechanism was fiction.
//
//     A CORRECT REFUSAL FOR THE WRONG REASON PROVES THE SAFETY OF THE OUTCOME,
//     NOT THE CORRECTNESS OF THE AUTHORITY MECHANISM.
//
// So the gate now asks Python what the proposal IS. Every answer below is a structural fact from the AST -
// module-level statement kinds, the set of defined names, the shape of the body - not a guess from a
// regular expression. A rejection names the predicate that actually fired, and that correspondence is
// asserted by a test rather than trusted.
//
// THE OPERATION CLASS THIS GATE EXISTS TO WIDEN. Guards were the first box. The next one is BOUNDED
// FUNCTION-BODY EDITING: the proposal may rewrite the body of ONE structurally identified function, and
// may not touch anything else - not its signature, not its siblings, not module scope. That covers a very
// large share of real repairs (modify an expression, an assignment, a return, add a bounded branch) while
// keeping every law the guard box established.
import { execFileSync } from 'node:child_process';

const NL = String.fromCharCode(10);

// Ask Python to describe a source string structurally. Returns null when it does not parse - which is
// itself an answer, and the first predicate below.
export function describe(source) {
  const prog = [
    'import ast, json, sys',
    'src = sys.stdin.read()',
    'try:',
    '    tree = ast.parse(src)',
    'except SyntaxError as e:',
    '    print(json.dumps({"parses": False, "error": str(e)})); sys.exit(0)',
    'top = []',
    'for node in tree.body:',
    '    kind = type(node).__name__',
    '    name = getattr(node, "name", None)',
    '    top.append({"kind": kind, "name": name})',
    'funcs = [n.name for n in tree.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]',
    'sigs = {}',
    'bodies = {}',
    'for n in tree.body:',
    '    if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)):',
    '        a = n.args',
    '        sigs[n.name] = {',
    '            "args": [x.arg for x in a.posonlyargs] + [x.arg for x in a.args],',
    '            "kwonly": [x.arg for x in a.kwonlyargs],',
    '            "vararg": a.vararg.arg if a.vararg else None,',
    '            "kwarg": a.kwarg.arg if a.kwarg else None,',
    '            "defaults": len(a.defaults),',
    '            "decorators": [ast.unparse(d) for d in n.decorator_list],',
    '        }',
    '        bodies[n.name] = [type(s).__name__ for s in n.body]',
    'print(json.dumps({"parses": True, "top": top, "functions": funcs,',
    '                  "signatures": sigs, "bodies": bodies}))',
  ].join(NL);
  try {
    const out = execFileSync('python', ['-c', prog],
      { input: source, encoding: 'utf8', timeout: 20000, stdio: ['pipe', 'pipe', 'pipe'] });
    return JSON.parse(out);
  } catch (e) {
    // A harness failure is NOT a structural verdict, and must not be reported as one.
    return { parses: null, harnessError: String(e.message).split(NL)[0] };
  }
}

// Each predicate is named, independently evaluated, and carries the reason it exists. The diagnostic is
// DERIVED from which ones failed; nothing writes a message by hand beside the logic.
export const PREDICATES = {
  PARSES: {
    why: 'a proposal that does not parse cannot be reasoned about at all',
    test: (d) => d.parses === true,
  },
  SINGLE_TOP_LEVEL_STATEMENT: {
    why: 'the authority granted was to rewrite one function, so the proposal may contain exactly one'
      + ' module-level statement',
    test: (d) => d.parses === true && d.top.length === 1,
  },
  THAT_STATEMENT_IS_A_FUNCTION: {
    why: 'the one statement must be a function definition, not an import, assignment or expression',
    test: (d) => d.parses === true && d.top.length === 1
      && (d.top[0].kind === 'FunctionDef' || d.top[0].kind === 'AsyncFunctionDef'),
  },
  DEFINES_THE_NAMED_FUNCTION: {
    why: 'the function defined must be the one the task authorized',
    test: (d, ctx) => d.parses === true && d.functions.length === 1 && d.functions[0] === ctx.fn,
  },
  SIGNATURE_UNCHANGED: {
    why: 'rewriting a body is authorized; changing the interface is a different and wider change',
    test: (d, ctx) => {
      if (d.parses !== true || !ctx.signature) return false;
      const got = d.signatures[ctx.fn];
      if (!got) return false;
      const a = ctx.signature;
      return JSON.stringify(got.args) === JSON.stringify(a.args)
        && JSON.stringify(got.kwonly) === JSON.stringify(a.kwonly)
        && got.vararg === a.vararg && got.kwarg === a.kwarg
        && got.defaults === a.defaults
        && JSON.stringify(got.decorators) === JSON.stringify(a.decorators);
    },
  },
  NON_EMPTY_BODY: {
    why: 'an empty or placeholder body is not a repair',
    test: (d, ctx) => {
      if (d.parses !== true) return false;
      const b = d.bodies[ctx.fn] || [];
      const meaningful = b.filter((k) => k !== 'Pass');
      return meaningful.length > 0;
    },
  },
};

// The gate. Returns which predicates held, which failed, and a diagnostic derived from the failures.
export function authorizeStructural(code, ctx) {
  const d = describe(code);
  if (d.parses === null) {
    return { ok: false, harnessError: d.harnessError, failed: [], passed: [],
      why: 'the structural check could not be run, so no authority decision is claimed' };
  }
  const failed = []; const passed = [];
  for (const [name, p] of Object.entries(PREDICATES)) {
    let ok;
    try { ok = !!p.test(d, ctx); } catch (e) { ok = false; }
    (ok ? passed : failed).push(name);
  }
  return {
    ok: failed.length === 0, failed, passed, described: d,
    why: failed.length === 0
      ? 'every structural predicate holds'
      : failed.map((n) => n + ' (' + PREDICATES[n].why + ')').join('; '),
  };
}

// The signature of an existing function, so SIGNATURE_UNCHANGED has something real to compare against.
export function signatureOf(source, fn) {
  const d = describe(source);
  if (d.parses !== true) return null;
  return d.signatures[fn] || null;
}

export { NL };
