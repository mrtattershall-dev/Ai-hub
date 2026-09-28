// REPO C, STAGE 3 — how much of pyparsing can frozen r3 obtain authority to act on?
//
// Two independent axes, kept separate exactly as on Repo B:
//   OBSERVABILITY  is there a witness that makes the site execute?
//   ENVELOPE       may r3 attempt this operation at all?
//
// No inference here. This measures the authority surface before a model is ever consulted.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { envelopeOf } from '../../legasus/legacore/capability.mjs';

const NL = String.fromCharCode(10);
const ROOT = 'benchmarks/repoC/pristine';
const PKG = 'pyparsing';

// Every top-level function and every method in the modules r3 reached, with its own identity.
const INVENTORY = [
  'import ast, json, os, sys',
  'root = sys.argv[1]',
  'out = []',
  'for f in sorted(os.listdir(root)):',
  '    if not f.endswith(".py"):',
  '        continue',
  '    src = open(os.path.join(root, f), encoding="utf-8").read()',
  '    try:',
  '        tree = ast.parse(src)',
  '    except SyntaxError:',
  '        continue',
  '    def visit(node, cls):',
  '        for ch in getattr(node, "body", []):',
  '            if isinstance(ch, ast.ClassDef):',
  '                visit(ch, ch.name)',
  '            elif isinstance(ch, (ast.FunctionDef, ast.AsyncFunctionDef)):',
  '                body = [b for b in ch.body if not (isinstance(b, ast.Expr)',
  '                        and isinstance(b.value, ast.Constant)',
  '                        and isinstance(b.value.value, str))]',
  '                lines = sorted({ln for b in body for ln in range(b.lineno,',
  '                               (b.end_lineno or b.lineno) + 1)})',
  '                out.append({"module": f, "name": ch.name, "cls": cls,',
  '                            "method": cls is not None, "lines": lines,',
  '                            "decorated": len(ch.decorator_list) > 0})',
  '                visit(ch, cls)',
  '    visit(tree, None)',
  'print(json.dumps(out))',
].join(NL);

const inv = JSON.parse(execFileSync('python', ['-c', INVENTORY, ROOT + '/' + PKG],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } }));

const sweep = JSON.parse(readFileSync('benchmarks/repoC/sweep.json', 'utf8'));
const reached = new Set();
for (const q of sweep.reachedQLines) {
  const b = q.indexOf('|'); const c = q.lastIndexOf(':');
  reached.add(q.slice(0, b) + ':' + q.slice(c + 1));
}

const rows = [];
for (const fn of inv) {
  const mod = fn.module.replace(/\.py$/, '');
  const witnessedLines = fn.lines.filter((l) => reached.has(mod + ':' + l));
  const observable = witnessedLines.length > 0;
  // The frozen envelope: a bounded function-body edit is IN; a method is a multi-file class change and
  // is OUT. r3 never learned methods, by deliberate decision before Repo B.
  const env = fn.method ? 'OUT_METHOD_UNSUPPORTED'
    : (envelopeOf('BOUNDED_FUNCTION_BODY_EDIT').verdict
      || envelopeOf('BOUNDED_FUNCTION_BODY_EDIT').status || 'IN');
  rows.push({ ...fn, witnessed: witnessedLines.length, total: fn.lines.length, observable,
    envelope: env, admissible: observable && !fn.method });
}

const t = (p) => rows.filter(p).length;
console.log('REPO C / stage 3 — authority surface under frozen r3, no inference');
console.log('');
console.log('callables in the corpus            : ' + rows.length);
console.log('  module-level functions           : ' + t((r) => !r.method));
console.log('  methods (OUT of the r3 envelope) : ' + t((r) => r.method));
console.log('');
console.log('OBSERVABILITY');
console.log('  at least one witnessed site      : ' + t((r) => r.observable));
console.log('  no witnessed site                : ' + t((r) => !r.observable));
console.log('');
console.log('THE INTERSECTION');
console.log('  ADMISSIBLE (witnessed AND in-envelope) : ' + t((r) => r.admissible));
console.log('  witnessed but OUT of envelope          : ' + t((r) => r.observable && r.method));
console.log('  in-envelope but unwitnessed            : ' + t((r) => !r.observable && !r.method));
console.log('');
const adm = rows.filter((r) => r.admissible).sort((a, b) => b.witnessed - a.witnessed);
console.log('admissible callables:');
for (const a of adm) {
  console.log('  ' + (a.module + '/' + a.name).padEnd(34) + a.witnessed + '/' + a.total + ' sites');
}
writeFileSync('benchmarks/repoC/admission.json', JSON.stringify({ rows }, null, 1), 'utf8');
console.log('');
console.log('wrote benchmarks/repoC/admission.json');
