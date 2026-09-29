#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// changeRecordDualWrite.mjs — step 2 of the build order: express what the EXISTING components already
// produce as a change record, and let the record control NOTHING.
//
//   node server/changeRecordDualWrite.mjs [g1|g2|g3|s01]
//
// The emitter, the observer, the derivation and the checker are untouched. This reads their outputs and
// writes them into the one object that is allowed to cross a subsystem boundary. If that cannot be done
// without inventing fields, the schema is wrong - and finding that out is the entire purpose of dual
// writing before anything is gated on it.
//
// TWO CANDIDATES ARE RUN, because a protocol that can only express success is not a protocol: a working
// one, and an INERT control that creates the button and wires it to nothing. The second must produce a
// record whose decision is REJECT and whose reason is recomputable by a reader who was not there.
//
// WHAT IS DELIBERATELY NOT HERE: no AUTHORITY event and no WRITE event. Nothing in this run is
// authorised to touch a file, so inventing a permission to make the record look complete would be
// exactly the confusion the schema exists to prevent. Gating governedEdit on the record is step 5 and
// has not been done.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { openChange, append } from './changeRecord.mjs';
import { render, contradictions, replay } from './changeRecordReplay.mjs';

const NL = String.fromCharCode(10);
const { observeBaseline } = await import('./behaviorModel.mjs');
const { derive, verify } = await import('./featureGraph.mjs');
const { playCheck } = await import('./playCheck.js');
const { topLevelFunctions, referencedElsewhere } = await import('./editPlanner.mjs');

const SHAPES = {
  g1: { dir: 'legasus/bench/graphvalid/g1', sel: 'reset-filter', render: 'refresh()', field: 'field' },
  g3: { dir: 'legasus/bench/graphvalid/g3', sel: 'clear-filter', render: null, field: 'box' },
  s01: { dir: 'legasus/bench/suppression1/s01', sel: 'clear-filter', render: 'filterRows()', field: 'field' },
};
const which = process.argv[2] || 'g1';
const shape = SHAPES[which];
if (!shape) { console.error(`no shape ${which}`); process.exit(2); }

const sha = (s) => createHash('sha256').update(s).digest('hex');
const page = readFileSync(join(shape.dir, 'baseline-as-delivered.html'), 'utf8');
const task = JSON.parse(readFileSync(join(shape.dir, 'task.json'), 'utf8'));
const spec = task.diagnostic.spec;
const at = page.lastIndexOf('</script>');
const splice = (code) => page.slice(0, at) + NL + code + NL + page.slice(at);

const restore = shape.render ? `${shape.render};` : `items.forEach(function (el) { el.hidden = false; });`;
const WORKS = `const b = document.createElement('button');
b.id = '${shape.sel}'; b.textContent = 'Reset';
document.body.appendChild(b);
b.addEventListener('click', function () { ${shape.field}.value = ''; ${restore} });`;
const INERT = `const b = document.createElement('button');
b.id = '${shape.sel}'; b.textContent = 'Reset';
document.body.appendChild(b);
b.addEventListener('click', function () { const intended = ''; });`;

// ── the observation and the graph are shared by both candidates: they are derived from the BASELINE,
//    and deriving them once per candidate would let a candidate influence its own expectation.
const observation = await observeBaseline(page, task, { playCheck });
const graph = derive(page, task, { topLevelFunctions, referencedElsewhere, observation });

const out = [];
for (const [label, code] of [['works', WORKS], ['inert', INERT]]) {
  const candidate = splice(code);
  const result = await verify(candidate, { task, spec, graph, deps: { playCheck } });

  const rec = openChange({ runId: `dualwrite-${which}`, changeId: `${which}-${label}`, opened: new Date().toISOString(), tool: 'changeRecordDualWrite' });

  // ── TASK: what was asked. Owned by the emitter, and a FACT - it was received, not inferred.
  const eTask = append(rec, { section: 'TASK', body: {
    what: task.goal.slice(0, 120), taskSha: sha(JSON.stringify(task)),
    requirement: task.requirement, steps: spec.steps.map((s) => ({ n: s.n, name: s.name })),
    additionSteps: task.provenance.additionSteps, carriedSteps: task.provenance.carriedSteps,
  } });

  // ── BASELINE: what was observed of the delivered page, before any candidate existed.
  const eBase = append(rec, { section: 'BASELINE', cites: [eTask], body: {
    what: 'delivered page observed', baselineSha: sha(page), loadState: observation.s0,
    perturbation: observation.perturbation ? observation.perturbation.action : null,
    claim: observation.claim,
    triedActions: (observation.tried || []).map((t) => ({ action: t.action, movesState: t.movesState, leavesClaim: t.leavesClaim })),
  } });

  // ── GRAPH: one CLAIM per node, each citing the facts it rests on. A node with no evidence cited
  //    would be refused at append time, which is the property that makes the section worth having.
  const nodeIds = {};
  for (const n of graph.nodes) {
    nodeIds[n.id] = append(rec, { section: 'GRAPH', cites: [eTask, eBase, ...(n.dependsOn || []).map((d) => nodeIds[d]).filter(Boolean)], body: {
      node: n.id, kind: n.kind, need: n.need,
      needFrom: n.step !== undefined && n.kind === 'effect' ? 'evidence-step' : n.from,
      evidence: n.step !== undefined ? n.step : null,
      preconditions: n.preconditions || null, action: n.action || null,
      reExerciseOf: n.reExerciseOf || null, distinguishing: n.distinguishing || null,
      derivedSequence: n.sequence ? n.sequence.map((s) => s.name) : null,
    } });
  }
  // ── and every refusal as a TYPED UNCERTAINTY, not an omission a later reader has to notice.
  for (const r of graph.refusals) {
    append(rec, { section: 'UNKNOWN', uncertainty: r.type, cites: [eTask, eBase], body: { what: r.why, about: r.id } });
  }

  // ── PROPOSAL: the candidate itself. A FACT: this text exists, regardless of whether it is any good.
  const eProp = append(rec, { section: 'PROPOSAL', cites: [eTask], body: {
    what: `candidate (${label})`, candidateSha: sha(candidate), insertedBytes: code.length, source: 'hand-written control',
  } });

  // ── VERIFICATION: what running it produced. Still a FACT - no judgement yet.
  const eVer = append(rec, { section: 'VERIFICATION', cites: [eProp, eBase], body: {
    what: 'ran each node against its own evidence', satisfied: result.satisfied, errors: [],
  } });

  // ── DIAGNOSIS: the first CLAIM about the candidate, citing the verification AND the nodes it reads.
  const eDiag = append(rec, { section: 'DIAGNOSIS', cites: [eVer, ...Object.values(nodeIds)], body: {
    what: result.complete ? 'every node covered' : `missing ${result.missing.join(',')}`,
    covered: result.covered, missing: result.missing,
  } });

  // ── DECISION: a CLAIM, and only a claim. It is not permission and it is not an effect.
  append(rec, { section: 'DECISION', cites: [eDiag], body: {
    outcome: result.complete ? 'ACCEPT' : 'REJECT',
    why: result.complete
      ? 'every derived node was satisfied by observation'
      : `${result.missing.join(',')} not satisfied; the control exists but does not do what the requirement names`,
  } });

  out.push({ label, rec });
  console.log(NL + render(rec));
  const bad = contradictions(rec);
  if (bad.length) console.log(`  ^ ${bad.length} contradiction(s) in a REAL run - investigate before trusting this record`);
}

// ── Preserve them. A record that only exists in a terminal is not a record.
const dir = join('legasus/records', `dualwrite-${which}`);
const blobs = join(dir, 'blobs');
mkdirSync(blobs, { recursive: true });
// CONTENT-ADDRESSED ARTIFACTS. Digests alone make a record ATTRIBUTABLE but not REPLAYABLE: an outside
// checker cannot recompute a decision from a hash. Every sha the record cites resolves to bytes here,
// and changeRecordRecompute.mjs verifies the bytes against the sha before using them.
writeFileSync(join(blobs, sha(page)), page, 'utf8');
writeFileSync(join(blobs, sha(JSON.stringify(task))), JSON.stringify(task), 'utf8');
for (const [label, code] of [['works', WORKS], ['inert', INERT]]) writeFileSync(join(blobs, sha(splice(code))), splice(code), 'utf8');
for (const { label, rec } of out) writeFileSync(join(dir, `${label}.json`), JSON.stringify(rec, null, 2), 'utf8');

const works = replay(out[0].rec); const inert = replay(out[1].rec);
console.log(`${NL}  written to ${dir}/`);
console.log(`  works: ${works.decision[0].outcome} covering ${works.diagnosis[0].covered.join(',')}`);
console.log(`  inert: ${inert.decision[0].outcome} missing ${inert.diagnosis[0].missing.join(',')}`);
console.log(`  typed unknowns recorded: ${works.unknowns.map((u) => u.type).join(', ') || 'none'}`);
console.log(`${NL}  THE RECORD CONTROLS NOTHING. No AUTHORITY and no WRITE event was emitted, because`);
console.log('  nothing in this run was authorised to touch a file. Gating an effect path on the record');
console.log('  is step 5 of the build order and has not been done.');
