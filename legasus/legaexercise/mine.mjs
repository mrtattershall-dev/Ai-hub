// MINING EXECUTIONS — do not synthesize the world if the repository already contains a machine for
// creating it.
//
// The wrong abstraction is "construct arguments from type annotations": two hundred heuristics about
// Python objects, and a local answer to a general question. The right one is that a repository which is
// worth changing is a repository that already knows how to run itself. Its authored examples build a
// Version, a Specifier, a parsed wheel filename correctly BY CONSTRUCTION, because a human wrote them to
// demonstrate the real thing.
//
// Mining is a PURE SOURCE READ. Nothing is imported and nothing is executed here - an example becomes
// evidence only when the witness traces it. Mining produces candidate invocations; tracing decides
// whether any of them are admissible.
import { execFileSync } from 'node:child_process';

const NL = String.fromCharCode(10);

const MINER = [
  'import ast, doctest, json, os, sys',
  'root = sys.argv[1]',
  'pkg = sys.argv[2]',
  'parser = doctest.DocTestParser()',
  'out = []',
  'pkgdir = os.path.join(root, pkg)',
  '',
  'def docstring_of(node):',
  '    if not getattr(node, "body", None):',
  '        return None, None',
  '    first = node.body[0]',
  '    if isinstance(first, ast.Expr) and isinstance(first.value, ast.Constant) \\',
  '            and isinstance(first.value.value, str):',
  '        return first.value.value, first.lineno',
  '    return None, None',
  '',
  'def visit(node, qual, dotted, module_file):',
  '    doc, line = docstring_of(node)',
  '    if doc:',
  '        try:',
  '            examples = parser.get_examples(doc)',
  '        except Exception:',
  '            examples = []',
  '        prior = []',
  '        for ex in examples:',
  '            src = ex.source.rstrip()',
  '            if src:',
  '                out.append({',
  '                    "module": module_file,',
  '                    "dotted": dotted,',
  '                    "owner": qual,',
  '                    "docLine": line,',
  '                    "setup": list(prior),',
  '                    "invocation": src,',
  '                    "wants": (ex.want or "").strip(),',
  '                })',
  '                prior.append(src)',
  '    for child in getattr(node, "body", []):',
  '        if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):',
  '            visit(child, (qual + "." + child.name) if qual else child.name, dotted, module_file)',
  '',
  'for fname in sorted(os.listdir(pkgdir)):',
  '    if not fname.endswith(".py"):',
  '        continue',
  '    path = os.path.join(pkgdir, fname)',
  '    with open(path, encoding="utf-8") as fh:',
  '        src = fh.read()',
  '    try:',
  '        tree = ast.parse(src)',
  '    except SyntaxError:',
  '        continue',
  '    dotted = pkg if fname == "__init__.py" else pkg + "." + fname[:-3]',
  '    visit(tree, "", dotted, fname)',
  '',
  'print(json.dumps(out))',
].join(NL);

// Mine every authored doctest example in a package. Each example carries the examples that preceded it in
// the same docstring as its setup, because doctests are sequential and an example that assigns `v1` is
// part of the machine that makes the next one work.
export function mineDoctests({ rootDir, packageName, timeoutMs = 60000 }) {
  const raw = execFileSync('python', ['-c', MINER, rootDir, packageName],
    { encoding: 'utf8', timeout: timeoutMs, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
  const rows = JSON.parse(raw);
  return rows.map((r) => ({ ...r, provenance: 'DOCTEST' }));
}

export { NL };
