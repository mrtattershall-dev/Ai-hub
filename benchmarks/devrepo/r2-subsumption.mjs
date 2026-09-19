// THE STRONG VERSION: does the entitlement algebra subsume a layer that PREDATES it entirely?
//
// Every previous subsumption result compared the graph against decision procedures I wrote within days of
// the graph itself - independent in MECHANISM, not in AUTHORSHIP, and all consuming one sweep artifact.
// This compares it against frozen r2's own COMMIT decision, recorded by a real qwen2.5-coder:1.5b run
// through OBSERVE -> DECIDE -> RENDER -> PROPOSE -> CONSTRAIN -> PROVE -> COMMIT, before LegaKnow,
// LegaProgress, LegaPurpose or the justification graph existed.
//
// NON-CIRCULARITY IS THE WHOLE DIFFICULTY, and it is solved by not reading back any recorded verdict:
//
//   ENVELOPE      the RECORDED derivedEnvelope. Genuinely upstream of the commit decision.
//   STRUCTURE     RE-RUN of frozen r2's own structural gate on the model's RECORDED CANDIDATE TEXT.
//                 The gate's boolean is nowhere in the artifact; only the raw code is. This is a fresh
//                 computation over raw evidence, not a lookup.
//   VERIFICATION  the RECORDED oracle score, which is an INDEPENDENT measurement - the differential
//                 oracle, not r2's own PROVE verdict.
//
// `committed`, `refused` and the `why` text are NEVER read as inputs. They are the answer being predicted.
//
// PREDICTION, frozen before the run:
//   R1  The graph reproduces `legasus.committed` for all 12 recorded decisions.
//   R2  Non-vacuously: both outcomes occur, and the refusals are attributed to the node that actually
//       caused them - ENVELOPE for out-of-envelope operations, STRUCTURE for T04, which committed
//       nothing despite a derived envelope of IN.
//
// FALSIFICATION: any mismatch means the algebra does not subsume r2's commit authority, and the report
// must name which node disagreed. T04 is the case most likely to break it.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { authorizeStructural, signatureOf } from '../../legasus/legagate/structural.mjs';
import { graph, add, node, invalidate, entitled, scope, NODE, EDGE }
  from '../../legasus/legaknow/justification.mjs';
import { TASKS } from './tasks.mjs';

const RESULT = JSON.parse(readFileSync('benchmarks/devrepo/RESULT.dev1.json', 'utf8'));
const byId = Object.fromEntries(TASKS.map((t) => [t.id, t]));
const PRISTINE = 'benchmarks/devrepo/pristine/';

let agree = 0; let total = 0; const rows = [];
for (const [id, rec] of Object.entries(RESULT.tasks)) {
  const L = rec.legasus || {};
  const task = byId[id];
  const g = graph();
  const sc = scope({ repository: 'devrepo@pristine', environment: 'win|python3',
    invocation: 'probe-set', implementation: (task ? task.module + '.' + task.fn : id) });

  // ENVELOPE — recorded, and upstream of the decision.
  const env = node({ kind: NODE.ASSUMPTION, proposition: 'the operation is inside the r2 envelope',
    scope: sc, basis: 'CAPABILITY_CONTRACT' });
  add(g, env);
  if (L.derivedEnvelope !== 'IN') {
    invalidate(g, env.id, 'derived envelope is ' + L.derivedEnvelope);
  }

  // STRUCTURE — recomputed from the raw candidate text by frozen r2's own gate.
  const struct = node({ kind: NODE.INTERPRETATION, proposition: 'the candidate is structurally admissible',
    scope: sc, basis: 'STRUCTURAL_GATE' });
  add(g, struct);
  let structDetail = 'not run';
  if (!L.code) {
    invalidate(g, struct.id, 'no candidate text was produced');
    structDetail = 'no candidate';
  } else if (task) {
    let signature = null;
    try { signature = signatureOf(readFileSync(PRISTINE + task.module, 'utf8'), task.fn); } catch (e) { /* */ }
    const a = authorizeStructural(L.code, { fn: task.fn, signature });
    structDetail = a.ok ? 'all predicates hold' : a.failed.join(',');
    if (!a.ok) invalidate(g, struct.id, 'structural gate: ' + a.failed.join(', '));
  }

  // VERIFICATION — the independent differential oracle, not r2's own PROVE verdict.
  const ver = node({ kind: NODE.OBSERVATION, proposition: 'the candidate agrees with the oracle',
    scope: sc, basis: 'DIFFERENTIAL_ORACLE' });
  add(g, ver);
  if (!(L.score && L.score.pass)) invalidate(g, ver.id, 'the oracle disagreed on some probe');

  const commit = node({ kind: NODE.CLAIM, proposition: 'this candidate may become repository state',
    scope: sc, basis: 'COMMIT',
    supports: [{ id: env.id, edge: EDGE.REQUIRES }, { id: struct.id, edge: EDGE.REQUIRES },
      { id: ver.id, edge: EDGE.REQUIRES }] });
  add(g, commit);

  const e = entitled(g, commit.id, sc);
  const blame = e.problems.map((p) => (/envelope/.test(p.why) ? 'ENVELOPE'
    : /structurally admissible/.test(p.why) ? 'STRUCTURE'
      : /oracle/.test(p.why) ? 'VERIFICATION' : 'OTHER'));
  total++;
  if (e.ok === !!L.committed) agree++;
  rows.push({ id, recorded: !!L.committed, graph: e.ok, derived: L.derivedEnvelope,
    struct: structDetail, pass: !!(L.score && L.score.pass), blame: [...new Set(blame)].join('+') || '-' });
}

console.log('frozen r2 COMMIT decisions, recorded before the graph existed: ' + total);
console.log('');
console.log('  task  recorded  graph   envelope   oracle   structural gate (re-run)       blamed');
for (const r of rows) {
  console.log('  ' + r.id.padEnd(6) + String(r.recorded).padEnd(10) + String(r.graph).padEnd(8)
    + String(r.derived).padEnd(11) + String(r.pass).padEnd(9) + r.struct.slice(0, 30).padEnd(31)
    + r.blame + (r.recorded === r.graph ? '' : '   <-- MISMATCH'));
}
console.log('');
console.log('R1  reproduces the recorded commit decision : ' + agree + '/' + total
  + (agree === total ? '   HELD' : '   FAILED'));
const committed = rows.filter((r) => r.recorded).length;
console.log('R2  non-vacuity: ' + committed + ' committed, ' + (total - committed) + ' not. '
  + 'Blame is distributed across '
  + [...new Set(rows.filter((r) => !r.recorded).map((r) => r.blame))].join(' / '));

void execFileSync;
