#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// changeRecordRecompute.mjs — CAN AN OUTSIDE CHECKER RECOMPUTE WHY A CHANGE WAS RETAINED OR REJECTED?
//
//   node server/changeRecordRecompute.mjs legasus/records/dualwrite-g1
//
// This is the first of three bars the change record has to clear or it is elaborate bookkeeping:
//
//   1. an outside checker can recompute why an action was retained or restored   <- THIS FILE
//   2. a failure is preserved as usable causal evidence, not merely a log        <- partially: the
//      record keeps the refusals, the sequence and the superseded claims, but "causal" is not yet
//      demonstrated because nothing has used a preserved failure to change a later outcome
//   3. it predicts, on held-out tasks, when a configuration beats a fixed default <- NOT ATTEMPTED.
//      That needs a comparative run, not a schema, and claiming it now would be exactly the kind of
//      unearned claim the schema exists to refuse.
//
// WHAT "INDEPENDENT" MEANS HERE, precisely: this reads the TASK, BASELINE and PROPOSAL facts, resolves
// each cited digest to bytes and CHECKS THE BYTES AGAINST THE DIGEST, then re-runs the whole pipeline
// from scratch - observe, derive, verify - and compares ITS OWN diagnosis to the recorded one. It never
// reads the recorded GRAPH or DIAGNOSIS before computing its own. If it did, it would be agreeing with
// itself.
//
// A NEGATIVE CONTROL IS MANDATORY. A recomputation that always agrees is a branch that cannot fail, and
// this project has shipped one of those before. `--negative` recomputes each record against the OTHER
// record's candidate, and every one of those must DIVERGE.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { verifyChain } from './changeRecord.mjs';

const NL = String.fromCharCode(10);
const { observeBaseline } = await import('./behaviorModel.mjs');
const { derive, verify } = await import('./featureGraph.mjs');
const { playCheck } = await import('./playCheck.js');
const { topLevelFunctions, referencedElsewhere } = await import('./editPlanner.mjs');

const dir = process.argv[2] || 'legasus/records/dualwrite-g1';
const negative = process.argv.includes('--negative');
const sha = (s) => createHash('sha256').update(s).digest('hex');

let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };

if (!existsSync(join(dir, 'blobs'))) { console.error(`${dir} has no blobs/ - the record is attributable but not replayable`); process.exit(2); }
const blob = (h) => {
  const p = join(dir, 'blobs', h);
  if (!existsSync(p)) throw new Error(`the record cites ${h.slice(0, 12)} but no such artifact is stored`);
  const bytes = readFileSync(p, 'utf8');
  if (sha(bytes) !== h) throw new Error(`stored artifact ${h.slice(0, 12)} does not match its own digest`);
  return bytes;
};

const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
const records = files.map((f) => ({ f, rec: JSON.parse(readFileSync(join(dir, f), 'utf8')) }));

console.log(`recomputing ${records.length} record(s) in ${dir}${negative ? '  [NEGATIVE CONTROL: candidates swapped]' : ''}`);

for (const [i, { f, rec }] of records.entries()) {
  const of = (section) => rec.events.find((e) => e.section === section);
  const chain = verifyChain(rec);
  const recordedDiag = of('DIAGNOSIS').body;
  const recordedDec = of('DECISION').body;

  // The candidate: this record's own, or - under the negative control - a different one, to prove the
  // recomputation is reading the artifact rather than echoing the record.
  const src = negative ? records[(i + 1) % records.length] : { rec };
  const candidateSha = src.rec.events.find((e) => e.section === 'PROPOSAL').body.candidateSha;

  console.log(`${NL}${f}  recorded: ${recordedDec.outcome}  (${recordedDiag.what})`);
  say(chain.intact, 'the event chain verifies - the record was appended to, not edited');

  let mine;
  try {
    const page = blob(of('BASELINE').body.baselineSha);
    const task = JSON.parse(blob(of('TASK').body.taskSha));
    const candidate = blob(candidateSha);
    say(true, 'every cited artifact resolves and matches its digest');

    // Re-run the pipeline from scratch. The recorded graph is NOT read.
    const observation = await observeBaseline(page, task, { playCheck });
    const graph = derive(page, task, { topLevelFunctions, referencedElsewhere, observation });
    mine = await verify(candidate, { task, spec: task.diagnostic.spec, graph, deps: { playCheck } });
  } catch (e) { say(false, `recomputation could not run: ${e.message}`); continue; }

  const myOutcome = mine.complete ? 'ACCEPT' : 'REJECT';
  const sameCovered = JSON.stringify([...mine.covered].sort()) === JSON.stringify([...recordedDiag.covered].sort());
  const sameMissing = JSON.stringify([...mine.missing].sort()) === JSON.stringify([...recordedDiag.missing].sort());
  const agrees = myOutcome === recordedDec.outcome && sameCovered && sameMissing;

  console.log(`  recomputed: ${myOutcome}  covered [${mine.covered.join(',')}]  missing [${mine.missing.join(',')}]`);
  if (negative) {
    say(!agrees, `NEGATIVE CONTROL: recomputing against a different candidate DIVERGES from the record${agrees ? ' - IT DID NOT, so this check cannot fail' : ''}`);
  } else {
    say(agrees, agrees
      ? 'an independent recomputation reaches the same outcome, node for node, from the record alone'
      : `DIVERGES: record said ${recordedDec.outcome} covering [${recordedDiag.covered}], recomputation says ${myOutcome} covering [${mine.covered}]`);
  }
}

console.log(`${NL}  recompute: ${passed} passed, ${failed} failed -> ${failed
  ? 'THE RECORD DOES NOT SUPPORT INDEPENDENT RECOMPUTATION'
  : negative
    ? 'the recomputation reads the artifacts, not the record\'s own conclusions'
    : 'a reader who was not there can rebuild why each change was accepted or rejected'}`);
process.exit(failed ? 1 : 0);
