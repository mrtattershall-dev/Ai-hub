// REPO B TASK GENERATION — mechanical, so the repository chooses the work rather than me.
//
// Every task in Run 0 was hand-written after I inspected functions looking for material the box could
// handle. That is recorded honestly in the development provenance, and it is exactly the bias Repo B
// exists to escape. Here the procedure is:
//
//     enumerate every top-level function in the package
//        -> apply a MUTATION OPERATOR drawn from a fixed, preregistered list
//        -> run the r2 admission pipeline unchanged
//        -> let the machine DERIVE the envelope
//        -> keep what is admissible, record what is not
//
// The mutation operators are deliberately crude and general. A clever operator chosen per function would
// reintroduce exactly the selection bias this is meant to remove.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, existsSync, copyFileSync }
  from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { locate, applyMutation, runtimeAuthority, runProbe } from '../devrepo/admission.mjs';
import { envelopeOfInstance, OPERATION } from '../../legasus/legacore/capability.mjs';

const NL = String.fromCharCode(10);
const PKG = 'benchmarks/repoB/pristine/packaging';
const WORK = 'benchmarks/repoB/.gen';

// FIXED, PREREGISTERED MUTATION OPERATORS. Each is a textual transform with an inverse meaning: the task
// is always "restore the behaviour this operator removed".
export const OPERATORS = [
  { id: 'BOUNDARY_SHIFT', why: 'a comparison boundary moved by one',
    find: /([<>]=?)\s*(\d+)\b/, apply: (m) => m[1] + ' ' + (Number(m[2]) + 1) },
  { id: 'COMPARISON_FLIP', why: 'a strict comparison relaxed or tightened',
    find: /(\breturn\s+[^=\n]*?)(<=|>=|<|>)(\s)/,
    apply: (m) => m[1] + ({ '<=': '<', '>=': '>', '<': '<=', '>': '>=' })[m[2]] + m[3] },
  { id: 'BOOLEAN_WEAKEN', why: 'a conjunct dropped from a boolean return',
    find: /(\breturn\s+[^\n]+?)\s+and\s+[^\n]+$/m, apply: (m) => m[1] },
  { id: 'NEGATION_DROP', why: 'a not removed from a condition',
    find: /\bif\s+not\s+/, apply: () => 'if ' },
  { id: 'EQUALITY_FLIP', why: 'an equality inverted',
    find: /\s(==|!=)\s/, apply: (m) => (m[1] === '==' ? ' != ' : ' == ') },
];

function pythonFunctions(file) {
  const prog = [
    'import ast, json, sys',
    'src = open(sys.argv[1], encoding="utf8").read()',
    'tree = ast.parse(src)',
    'out = []',
    'for n in tree.body:',
    '    if isinstance(n, ast.FunctionDef) and not n.name.startswith("_"):',
    '        seg = ast.get_source_segment(src, n)',
    '        args = [a.arg for a in n.args.args]',
    '        out.append({"name": n.name, "args": args, "src": seg, "method": False,',
    '                    "cls": None, "defaults": len(n.args.defaults)})',
    '    elif isinstance(n, ast.ClassDef):',
    '        for k in n.body:',
    '            if isinstance(k, ast.FunctionDef) and not k.name.startswith("__"):',
    '                seg = ast.get_source_segment(src, k)',
    '                args = [a.arg for a in k.args.args]',
    '                out.append({"name": k.name, "args": args, "src": seg, "method": True,',
    '                            "cls": n.name, "defaults": len(k.args.defaults)})',
    'print(json.dumps(out))',
  ].join(NL);
  try {
    return JSON.parse(execFileSync('python', ['-c', prog, file],
      { encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'] }));
  } catch (e) { return []; }
}

// Probe a function with crude, type-agnostic inputs. A call that raises is a legitimate observation -
// what matters is whether pristine and mutant AGREE, not whether either succeeds.
function probeCallsFor(fn) {
  const vals = ['0', '1', '"1.0"', '"foo"', '"1.2.3"', '[]', '"=1.0"', '2', '"Foo_Bar"'];
  const calls = [];
  const arity = Math.max(0, fn.args.length - fn.defaults);
  for (const v of vals) {
    const args = new Array(Math.max(arity, Math.min(1, fn.args.length))).fill(v).join(', ');
    calls.push('print(repr(m.' + fn.name + '(' + args + ')))');
  }
  return calls.slice(0, 6);
}

const files = readdirSync(PKG).filter((f) => f.endsWith('.py') && !f.startsWith('__'));
if (existsSync(WORK)) rmSync(WORK, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });
mkdirSync(join(WORK, 'packaging'), { recursive: true });
// Only .py files. Consulting the oracle with Python creates __pycache__ inside the corpus, which both
// breaks a byte-for-byte copy and is a latent runtime-authority hazard: stale bytecode can shadow edited
// source. Probes run with PYTHONDONTWRITEBYTECODE so the corpus is not mutated by being read.
for (const f of readdirSync(PKG)) {
  if (f.endsWith('.py')) copyFileSync(join(PKG, f), join(WORK, 'packaging', f));
}

const candidates = [];
for (const file of files) {
  const src = readFileSync(join(PKG, file), 'utf8');
  for (const fn of pythonFunctions(join(PKG, file))) {
    if (!fn.src) continue;
    for (const op of OPERATORS) {
      // THE ANCHOR IS THE WHOLE LINE, not the matched fragment. A fragment like " == " or "if not " is
      // never unique in a file, so the first version rejected 143 of 144 functions as ambiguous and made
      // the repository look as though it had no mutable surface at all. The anchor has to be specific
      // enough to name one place; the OPERATOR still decides what changes within it.
      const fnLines = fn.src.split(NL);
      const hit = fnLines.findIndex((l) => op.find.test(l));
      if (hit < 0) continue;
      const line = fnLines[hit];
      const m = line.match(op.find);
      if (!m) continue;
      const anchorLF = line;
      const replacement = line.replace(op.find, op.apply(m));
      if (replacement === anchorLF) continue;
      const loc = locate(src, anchorLF);
      if (loc.count !== 1) continue;         // still ambiguous: not a usable task
      candidates.push({ file, fn: fn.name, args: fn.args, operator: op.id, why: op.why,
        method: !!fn.method, cls: fn.cls || null,
        anchorLF, replacement, calls: fn.method ? [] : probeCallsFor(fn) });
      break;                                  // at most one task per function
    }
  }
}

console.log('  REPO B — mechanical task generation from packaging');
console.log('');
console.log('    files scanned                ' + files.length);
console.log('    candidate mutations found    ' + candidates.length);

writeFileSync('benchmarks/repoB/candidates.json', JSON.stringify(candidates, null, 1), 'utf8');
console.log('    written -> benchmarks/repoB/candidates.json');
console.log('');
const byOp = {};
for (const c of candidates) byOp[c.operator] = (byOp[c.operator] || 0) + 1;
for (const [k, v] of Object.entries(byOp)) console.log('      ' + k.padEnd(20) + v);
const byFile = {};
for (const c of candidates) byFile[c.file] = (byFile[c.file] || 0) + 1;
console.log('');
for (const [k, v] of Object.entries(byFile).sort((a, b) => b[1] - a[1]).slice(0, 12)) {
  console.log('      ' + k.padEnd(24) + v);
}
