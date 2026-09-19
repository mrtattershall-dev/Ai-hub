// SPECIFICITY AND REASON TOPOLOGY — the experiment that has to run before the shared abstraction is
// worth calling strong.
//
// I1 showed that damage destroys entitlement on both sides. That is the easy half: a graph that had
// simply become conservative would ace it. Two things are harder, and both are tested here.
//
//   SPECIFICITY.  Transformations that LOOK like damage but preserve every obligation must still be
//                 ADMITTED by both sides. Comments, blank lines, trailing whitespace, redundant
//                 parentheses - textual churn that changes the bytes and nothing that matters.
//
//   TOPOLOGY.     Not merely WHETHER entitlement is lost, but WHICH obligation was destroyed and which
//                 survived. Predicting the refusal is behavioural equivalence. Predicting the reason
//                 topology - this obligation died, those four are untouched - is structural
//                 correspondence, and it is a far narrower target to hit by accident.
//
// PREREGISTERED TOPOLOGY. Derived by reading frozen r2's PREDICATES, before running anything. Each
// prediction names the EXACT set of obligations that must be lost; everything else must survive. Several
// of these cascade for a reason - SIGNATURE_UNCHANGED and NON_EMPTY_BODY are both keyed by ctx.fn, so
// renaming the function destroys them too - and predicting the cascade correctly is part of the test.
//
//   SYNTAX_DAMAGE       every obligation          (all six test d.parses === true)
//   EXTRA_TOP_LEVEL     SINGLE_TOP_LEVEL_STATEMENT, THAT_STATEMENT_IS_A_FUNCTION
//   NOT_A_FUNCTION      THAT_STATEMENT_IS_A_FUNCTION, DEFINES_THE_NAMED_FUNCTION,
//                       SIGNATURE_UNCHANGED, NON_EMPTY_BODY
//   RENAMED             DEFINES_THE_NAMED_FUNCTION, SIGNATURE_UNCHANGED, NON_EMPTY_BODY
//   SIGNATURE_CHANGED   SIGNATURE_UNCHANGED
//   EMPTY_BODY          NON_EMPTY_BODY
//   every PRESERVING transformation   nothing at all
//
// PREDICTIONS:
//   S1  Every preserving transformation is ADMITTED by frozen r2 and by the graph, for every task.
//   S2  Every destructive transformation loses EXACTLY the preregistered obligations, no more and no
//       fewer, in frozen r2.
//   S3  The graph's lost-obligation set equals frozen r2's failed set, case by case.
//
// FALSIFICATION: S1 failing means one side is conservative rather than correct. S2 failing means I have
// misread the gate I am claiming to predict. S3 failing names a place where the two agree on the verdict
// for different reasons - which would be the most interesting outcome of the three.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { describe, PREDICATES, authorizeStructural, signatureOf }
  from '../../legasus/legagate/structural.mjs';
import { graph, add, node, invalidate, entitled, scope, NODE, EDGE }
  from '../../legasus/legaknow/justification.mjs';
import { TASKS } from './tasks.mjs';

const NL = String.fromCharCode(10);
const PRISTINE = 'benchmarks/devrepo/pristine/';
const ALL = Object.keys(PREDICATES);

const EXTRACT = [
  'import ast, sys, json',
  'src = open(sys.argv[1], encoding="utf-8").read()',
  'tree = ast.parse(src)',
  'out = None',
  'for n in ast.walk(tree):',
  '    if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name == sys.argv[2]:',
  '        out = ast.get_source_segment(src, n)',
  '        break',
  'print(json.dumps(out))',
].join(NL);

const sourceOf = (module, fn) => {
  try {
    return JSON.parse(execFileSync('python', ['-c', EXTRACT, PRISTINE + module, fn],
      { encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } }));
  } catch (e) { return null; }
};

const afterDefLine = (c, insert) => {
  const lines = c.split(/\r?\n/);
  const i = lines.findIndex((l) => /^def .*:\s*$/.test(l));
  if (i < 0) return null;
  return [...lines.slice(0, i + 1), insert, ...lines.slice(i + 1)].join(NL);
};

const DESTRUCTIVE = {
  SYNTAX_DAMAGE: { fx: (c) => c.replace(/\):\s*\n/, ')' + NL), lost: ALL },
  EXTRA_TOP_LEVEL: { fx: (c) => 'import os' + NL + NL + c,
    lost: ['SINGLE_TOP_LEVEL_STATEMENT', 'THAT_STATEMENT_IS_A_FUNCTION'] },
  NOT_A_FUNCTION: { fx: (c) => 'RESULT = ' + JSON.stringify(c.slice(0, 20)),
    lost: ['THAT_STATEMENT_IS_A_FUNCTION', 'DEFINES_THE_NAMED_FUNCTION', 'SIGNATURE_UNCHANGED',
      'NON_EMPTY_BODY'] },
  RENAMED: { fx: (c) => c.replace(/^def (\w+)/m, 'def $1_renamed'),
    lost: ['DEFINES_THE_NAMED_FUNCTION', 'SIGNATURE_UNCHANGED', 'NON_EMPTY_BODY'] },
  SIGNATURE_CHANGED: { fx: (c) => c.replace(/^def (\w+)\(/m, 'def $1(injected_param, '),
    lost: ['SIGNATURE_UNCHANGED'] },
  EMPTY_BODY: { fx: (c) => {
    const lines = c.split(/\r?\n/);
    const i = lines.findIndex((l) => /^def /.test(l));
    return lines.slice(0, i + 1).join(NL) + NL + '    pass' + NL;
  }, lost: ['NON_EMPTY_BODY'] },
};

// SEMANTIC-NEGATIVE CONTROLS. Every one changes the BYTES and none changes a single obligation.
const PRESERVING = {
  ADDED_COMMENT: (c) => afterDefLine(c, '    # a comment that changes nothing'),
  BLANK_LINE: (c) => afterDefLine(c, ''),
  TRAILING_WHITESPACE: (c) => c.split(/\r?\n/).map((l) => (l.trim() ? l + '  ' : l)).join(NL),
  PARENTHESIZED_RETURN: (c) => {
    const lines = c.split(/\r?\n/);
    const i = lines.findIndex((l) => /^\s+return \S.*[^:]$/.test(l) && !l.includes('#'));
    if (i < 0) return null;
    lines[i] = lines[i].replace(/^(\s+return )(.*?)(\s*)$/, '$1($2)');
    return lines.join(NL);
  },
  TRAILING_NEWLINES: (c) => c + NL + NL,
};

function graphLost(code, ctx, sc) {
  const d = describe(code);
  const g = graph();
  const obs = node({ kind: NODE.OBSERVATION, proposition: 'the candidate was parsed and described',
    scope: sc, basis: 'AST' });
  add(g, obs);
  if (d.parses === null) invalidate(g, obs.id, 'the describe harness could not run');
  const prims = [];
  for (const [name, p] of Object.entries(PREDICATES)) {
    const n = node({ kind: NODE.INTERPRETATION, proposition: name, scope: sc,
      basis: 'STRUCTURAL_PRIMITIVE', supports: [{ id: obs.id, edge: EDGE.DERIVED_FROM }] });
    add(g, n);
    let holds;
    try { holds = !!p.test(d, ctx); } catch (e) { holds = false; }
    if (!holds) invalidate(g, n.id, name + ' does not hold');
    prims.push(n);
  }
  const claim = node({ kind: NODE.CLAIM, proposition: 'structurally admissible', scope: sc,
    basis: 'GATE', supports: prims.map((p) => ({ id: p.id, edge: EDGE.REQUIRES })) });
  add(g, claim);
  const e = entitled(g, claim.id, sc);
  const lost = ALL.filter((n) => e.problems.some((p) => p.why.startsWith(n + ' ')));
  return { ok: e.ok, lost };
}

const eq = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

let s1ok = 0; let s1n = 0; let s2ok = 0; let s2n = 0; let s3ok = 0; let s3n = 0;
const failures = [];
const skipped = [];

for (const task of TASKS) {
  const base = sourceOf(task.module, task.fn);
  if (!base) continue;
  let signature = null;
  try { signature = signatureOf(readFileSync(PRISTINE + task.module, 'utf8'), task.fn); } catch (e) { /* */ }
  const ctx = { fn: task.fn, signature };
  const sc = scope({ repository: 'devrepo@pristine', environment: 'win|python3',
    invocation: 'structural', implementation: task.module + '.' + task.fn });

  // Control: the untouched source must be admitted, or every comparison below is against a broken base.
  const baseR2 = authorizeStructural(base, ctx);
  if (!baseR2.ok) { skipped.push(task.id + ' (pristine source not admissible: ' + baseR2.failed + ')'); continue; }

  for (const [name, fx] of Object.entries(PRESERVING)) {
    const code = fx(base);
    if (code === null) { skipped.push(task.id + '/' + name + ' (not applicable)'); continue; }
    const r2 = authorizeStructural(code, ctx);
    const gr = graphLost(code, ctx, sc);
    s1n++; if (r2.ok && gr.ok) s1ok++;
    else failures.push({ task: task.id, name, kind: 'S1', r2: r2.failed, graph: gr.lost });
    s3n++; if (eq(r2.failed, gr.lost)) s3ok++;
    else failures.push({ task: task.id, name, kind: 'S3', r2: r2.failed, graph: gr.lost });
  }

  for (const [name, spec] of Object.entries(DESTRUCTIVE)) {
    const code = spec.fx(base);
    if (code === null) { skipped.push(task.id + '/' + name); continue; }
    const r2 = authorizeStructural(code, ctx);
    const gr = graphLost(code, ctx, sc);
    s2n++; if (eq(r2.failed, spec.lost)) s2ok++;
    else failures.push({ task: task.id, name, kind: 'S2', expected: spec.lost, r2: r2.failed });
    s3n++; if (eq(r2.failed, gr.lost)) s3ok++;
    else failures.push({ task: task.id, name, kind: 'S3', r2: r2.failed, graph: gr.lost });
  }
}

console.log('S1  PRESERVING transformations still ADMITTED  : ' + s1ok + '/' + s1n
  + (s1ok === s1n ? '   HELD' : '   FAILED'));
console.log('S2  DESTRUCTIVE lose EXACTLY the preregistered : ' + s2ok + '/' + s2n
  + (s2ok === s2n ? '   HELD' : '   FAILED'));
console.log('S3  graph reason topology == r2 failed set     : ' + s3ok + '/' + s3n
  + (s3ok === s3n ? '   HELD' : '   FAILED'));
if (skipped.length) {
  console.log('');
  console.log('not applicable (' + skipped.length + '): ' + skipped.slice(0, 6).join(', '));
}
if (failures.length) {
  console.log('');
  console.log('FAILURES — each names a specific disagreement:');
  for (const f of failures.slice(0, 16)) {
    console.log('  [' + f.kind + '] ' + f.task + '/' + f.name
      + (f.expected ? '  expected=' + f.expected.join('+') : '')
      + '  r2=' + (f.r2 || []).join('+') + '  graph=' + (f.graph || []).join('+'));
  }
}
