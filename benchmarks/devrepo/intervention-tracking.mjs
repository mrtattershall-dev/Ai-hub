// PREDICTION UNDER INTERVENTION — does a frozen algebra written later predict the behaviour of an older,
// independently implemented verifier on objects neither of them has seen?
//
// Every prior equivalence result was some version of "three things I wrote can be represented by my
// graph". This is different in three ways that matter:
//
//   THE OBJECTS ARE MANIPULATED.   Real function sources from the pristine corpus are deterministically
//                                  damaged in seven ways, so the answers MOVE because the object moved.
//   NEITHER SIDE READS THE OTHER.  frozen r2's `authorizeStructural` computes its verdict by its own loop
//                                  over PREDICATES; the graph computes entitlement by the generic walk.
//                                  Both consume the same PRIMITIVE observations about the candidate -
//                                  which is the claim - and neither consumes the other's conclusion.
//   NOTHING WAS FITTED.            The algebra was frozen in 807c361 / v2 before this file existed, and
//                                  the interventions are not the cases it was developed on.
//
// PREDICTION, frozen before the run:
//   I1  The graph's entitlement matches frozen r2's structural verdict on every task x intervention.
//   I2  NON-VACUITY: every intervention class actually changes the verdict for at least one task, and
//       both verdicts occur. Without I2, I1 is agreement about a constant.
//
// FALSIFICATION: a single mismatch names a combination semantics r2 has and the algebra does not, or the
// reverse. That would be a more useful result than another clean pass.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, PREDICATES, authorizeStructural, signatureOf }
  from '../../legasus/legagate/structural.mjs';
import { graph, add, node, invalidate, entitled, scope, NODE, EDGE }
  from '../../legasus/legaknow/justification.mjs';
import { TASKS } from './tasks.mjs';

const NL = String.fromCharCode(10);
const PRISTINE = 'benchmarks/devrepo/pristine/';

// Pull the real source of one function out of the corpus. This is authentic code, not a fixture written
// to make a predicate fire.
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

// SEVEN DETERMINISTIC INTERVENTIONS, each aimed at a different structural predicate.
const INTERVENTIONS = {
  NONE: (c) => c,
  SYNTAX_DAMAGE: (c) => c.replace(/\):\s*\n/, ')' + NL),
  EXTRA_TOP_LEVEL: (c) => 'import os' + NL + NL + c,
  NOT_A_FUNCTION: (c) => 'RESULT = ' + JSON.stringify(c.slice(0, 20)),
  RENAMED: (c) => c.replace(/^def (\w+)/m, 'def $1_renamed'),
  SIGNATURE_CHANGED: (c) => c.replace(/^def (\w+)\(/m, 'def $1(injected_param, '),
  EMPTY_BODY: (c) => {
    const lines = c.split(/\r?\n/);
    const i = lines.findIndex((l) => /^def /.test(l));
    return lines.slice(0, i + 1).join(NL) + NL + '    pass' + NL;
  },
};

// THE GRAPH'S VIEW. One node per structural primitive, built from `describe()` - a raw observation about
// the candidate - and combined by the generic entitlement walk. It never calls authorizeStructural.
function graphVerdict(code, ctx, sc) {
  const d = describe(code);
  const g = graph();
  const observation = node({ kind: NODE.OBSERVATION, proposition: 'the candidate was parsed and described',
    scope: sc, basis: 'AST' });
  add(g, observation);
  if (d.parses === null) {
    invalidate(g, observation.id, 'the describe harness could not run: nothing is claimed');
  }
  const primitives = [];
  for (const [name, p] of Object.entries(PREDICATES)) {
    const n = node({ kind: NODE.INTERPRETATION, proposition: name, scope: sc, basis: 'STRUCTURAL_PRIMITIVE',
      supports: [{ id: observation.id, edge: EDGE.DERIVED_FROM }] });
    add(g, n);
    let holds;
    try { holds = !!p.test(d, ctx); } catch (e) { holds = false; }
    if (!holds) invalidate(g, n.id, name + ' does not hold of this candidate');
    primitives.push(n);
  }
  const admissible = node({ kind: NODE.CLAIM, proposition: 'the candidate is structurally admissible',
    scope: sc, basis: 'GATE',
    supports: primitives.map((p) => ({ id: p.id, edge: EDGE.REQUIRES })) });
  add(g, admissible);
  return entitled(g, admissible.id, sc).ok;
}

let agree = 0; let total = 0;
const perIntervention = {};
const mismatches = [];
const dir = mkdtempSync(join(tmpdir(), 'interv-'));

for (const task of TASKS) {
  const base = sourceOf(task.module, task.fn);
  if (!base) continue;
  let signature = null;
  try { signature = signatureOf(readFileSync(PRISTINE + task.module, 'utf8'), task.fn); } catch (e) { /* */ }
  const ctx = { fn: task.fn, signature };
  const sc = scope({ repository: 'devrepo@pristine', environment: 'win|python3',
    invocation: 'structural', implementation: task.module + '.' + task.fn });

  for (const [name, fx] of Object.entries(INTERVENTIONS)) {
    let code;
    try { code = fx(base); } catch (e) { continue; }
    const r2 = authorizeStructural(code, ctx).ok;      // the older, independently implemented verifier
    const gr = graphVerdict(code, ctx, sc);            // the frozen algebra
    total++;
    if (r2 === gr) agree++; else mismatches.push({ task: task.id, name, r2, gr, code: code.slice(0, 80) });
    const p = perIntervention[name] || (perIntervention[name] = { admit: 0, refuse: 0, n: 0 });
    p.n++; if (r2) p.admit++; else p.refuse++;
  }
}
rmSync(dir, { recursive: true, force: true });

console.log('tasks x interventions evaluated: ' + total);
console.log('');
console.log('  intervention          n   r2 admits   r2 refuses');
for (const [k, v] of Object.entries(perIntervention)) {
  console.log('  ' + k.padEnd(20) + String(v.n).padStart(3) + String(v.admit).padStart(11)
    + String(v.refuse).padStart(13));
}
console.log('');
console.log('I1  graph matches frozen r2 on every case : ' + agree + '/' + total
  + (agree === total ? '   HELD' : '   FAILED'));
if (mismatches.length) {
  console.log('');
  console.log('MISMATCHES — each names a combination semantics one side has and the other does not:');
  for (const m of mismatches.slice(0, 10)) {
    console.log('  ' + m.task + '/' + m.name + '  r2=' + m.r2 + ' graph=' + m.gr);
  }
}
const varied = Object.values(perIntervention).filter((v) => v.admit > 0 && v.refuse === 0).length;
const changing = Object.entries(perIntervention).filter(([k, v]) => k !== 'NONE' && v.refuse > 0).length;
console.log('');
console.log('I2  NON-VACUITY: ' + changing + ' of ' + (Object.keys(INTERVENTIONS).length - 1)
  + ' damaging interventions actually caused refusals, and the control (NONE) admitted '
  + (perIntervention.NONE ? perIntervention.NONE.admit + '/' + perIntervention.NONE.n : 'n/a') + '.');
console.log(changing === Object.keys(INTERVENTIONS).length - 1 && perIntervention.NONE
  && perIntervention.NONE.admit > 0
  ? '  Both verdicts occur and every damage class bites, so I1 is agreement about a moving target.'
  : '  WARNING: some intervention never changed the verdict, so I1 is partly agreement about a constant.'
    + ' Interventions that never bit: '
    + Object.entries(perIntervention).filter(([k, v]) => k !== 'NONE' && v.refuse === 0)
      .map(([k]) => k).join(', '));
void writeFileSync; void varied;
