/**
 * changeRecord.test.mjs — does the protocol refuse bad handoffs, and does replay catch the ones this
 * project actually made?
 *
 *   node server/changeRecord.test.mjs
 *
 * Two halves, and the second is the point. Anyone can write a schema. The question is whether a record
 * written AT THE TIME of each historical mistake lights up without a reader remembering the mistake.
 *
 * THE POSITIVE CONTROL RUNS FIRST. A detector that fires on everything is worthless, and this project
 * has shipped a branch that could not fail before. A clean record must produce ZERO contradictions, or
 * nothing below means anything.
 */
import { openChange, append, supersede, verifyChain, SCHEMA_VERSION } from './changeRecord.mjs';
import { replay, contradictions, render } from './changeRecordReplay.mjs';

let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };
const throws = (fn, m) => { try { fn(); say(false, `${m} - IT WAS ACCEPTED`); } catch (e) { say(true, `${m} (${String(e.message).slice(0, 72)})`); } };
const kinds = (rec) => contradictions(rec).map((c) => c.kind);

const STEPS = [
  { n: 1, name: 'loads showing every item' },
  { n: 2, name: 'typing narrows the list as it already does' },
  { n: 3, name: 'clicking #reset-filter brings every item back' },
  { n: 4, name: 'and leaves #q empty' },
  { n: 5, name: 'filtering still narrows the list afterwards' },
];

/** A well-formed record: task -> baseline -> graph -> proposal -> verification -> decision. */
function cleanRecord() {
  const rec = openChange({ runId: 'run-1', changeId: 'chg-1', opened: '2026-09-29T00:00:00Z', tool: 'test' });
  const task = append(rec, { section: 'TASK', body: { what: 'add #reset-filter', steps: STEPS, effects: ['#q is empty', 'every item visible'] } });
  const base = append(rec, { section: 'BASELINE', body: { what: 'delivered page observed', sha: 'abc123', perturbation: { kind: 'type', selector: '#q' } } });
  const nC = append(rec, { section: 'GRAPH', cites: [task, base], body: { node: 'C', need: 'a control matching #reset-filter', needFrom: 'requirement.trigger.selector', evidence: null } });
  const nE1 = append(rec, { section: 'GRAPH', cites: [task, nC], body: { node: 'E1', need: 'clicking #reset-filter brings every item back', needFrom: 'evidence-step', evidence: 3 } });
  const nE2 = append(rec, { section: 'GRAPH', cites: [task, nC], body: { node: 'E2', need: 'and leaves #q empty', needFrom: 'evidence-step', evidence: 4 } });
  const nP1 = append(rec, { section: 'GRAPH', cites: [task, nE1], body: { node: 'P1', need: 'typing still narrows', needFrom: 'requirement.invariants', evidence: 5, reExerciseOf: 'step 2', distinguishing: 'CONDITIONAL' } });
  const prop = append(rec, { section: 'PROPOSAL', body: { what: 'candidate', sha: 'def456', rawLength: 412 } });
  const ver = append(rec, { section: 'VERIFICATION', cites: [prop], body: { what: 'ran the spec', passing: [1, 2, 3, 4, 5], failing: [], errors: [] } });
  const diag = append(rec, { section: 'DIAGNOSIS', cites: [ver, nC, nE1, nE2, nP1], body: { what: 'every node covered', covered: ['C', 'E1', 'E2', 'P1'], missing: [] } });
  const dec = append(rec, { section: 'DECISION', cites: [diag], body: { outcome: 'ACCEPT', why: 'all nodes covered, no page errors' } });
  return { rec, ids: { task, base, nC, nE1, nE2, nP1, prop, ver, diag, dec } };
}

// ══ POSITIVE CONTROL ══════════════════════════════════════════════════════════════════════════════
console.log('\npositive control - a clean record must be quiet');
{
  const { rec } = cleanRecord();
  say(rec.schema === SCHEMA_VERSION, `the record declares its schema version (${rec.schema})`);
  say(verifyChain(rec).intact, 'the event chain verifies');
  const found = kinds(rec);
  say(found.length === 0, `a well-formed record produces zero contradictions${found.length ? ` - GOT ${found.join(', ')}` : ''}`);
  const r = replay(rec);
  say(r.graph.length === 4 && r.decision[0].outcome === 'ACCEPT', 'and replays end to end: 4 graph nodes, decision ACCEPT');
}

// ══ THE BOUNDARY REFUSALS ═════════════════════════════════════════════════════════════════════════
console.log('\nfacts, claims, permissions and effects are not interchangeable');
{
  const rec = openChange({ runId: 'r', changeId: 'c' });
  const fact = append(rec, { section: 'TASK', body: { what: 'a task' } });
  throws(() => append(rec, { section: 'DECISION', body: { outcome: 'ACCEPT' } }), 'a claim that cites nothing is refused');
  throws(() => append(rec, { section: 'WRITE', cites: [fact], body: { target: 'index.html' } }), 'an effect with no permission is refused');
  throws(() => append(rec, { section: 'WRITE', cites: [fact], authority: fact, body: { target: 'index.html' } }), 'an effect whose "authority" is actually a fact is refused');
  throws(() => append(rec, { section: 'AUTHORITY', body: { what: 'go ahead' } }), 'a permission with no scope is refused');
  throws(() => append(rec, { section: 'UNKNOWN', uncertainty: 'VIBES', body: {} }), 'an uncertainty with an undeclared type is refused');
  throws(() => append(rec, { section: 'DECISION', cites: ['chg-9:0:deadbeef'], body: { outcome: 'ACCEPT' } }), 'citing an event from another record is refused');
  const perm = append(rec, { section: 'AUTHORITY', body: { scope: ['index.html'], revisionOf: 'abc' } });
  const w = append(rec, { section: 'WRITE', cites: [fact], authority: perm, body: { target: 'index.html' } });
  say(!!w, 'and a write that cites both its evidence and its permission is accepted');
}

console.log('\nappend, never overwrite');
{
  const { rec, ids } = cleanRecord();
  const before = rec.events.length;
  supersede(rec, { supersedes: ids.dec, why: 'a trailing runtime error was found after acceptance' });
  say(rec.events.length === before + 1, 'a correction ADDS an event');
  say(rec.events.find((e) => e.id === ids.dec).body.outcome === 'ACCEPT', 'and the superseded claim is still readable, exactly as first written');
  say(replay(rec).decision.length === 0, 'while the replayed view no longer shows it as live');
  say(replay(rec).corrections.length === 1, 'and the correction itself is visible in the record');
  throws(() => supersede(rec, { supersedes: ids.ver, why: 'inconvenient' }), 'a FACT cannot be superseded - it was observed');
}

console.log('\nediting a record in place is detectable');
{
  const { rec } = cleanRecord();
  const tampered = { ...rec, events: rec.events.map((e, i) => (i === 8 ? { ...e, body: { ...e.body, missing: ['C'] } } : e)) };
  const v = verifyChain(tampered);
  say(!v.intact && v.problems.some((p) => /edited in place/.test(p.why)), 'a body changed after the fact fails its own digest');
}

// ══ THE HISTORICAL CONTRADICTIONS ═════════════════════════════════════════════════════════════════
// Each of these is a record as it would have been written AT THE TIME of a real mistake.
console.log('\nreplay catches the handoff failures this project actually made');

{ // U and P1 both read carriedSteps[1]
  const rec = openChange({ runId: 'r', changeId: 'dup' });
  const t = append(rec, { section: 'TASK', body: { what: 'filter task', steps: STEPS } });
  append(rec, { section: 'GRAPH', cites: [t], body: { node: 'U', need: 'the update path filterRows()', needFrom: 'page analysis', evidence: 2 } });
  append(rec, { section: 'GRAPH', cites: [t], body: { node: 'P1', need: 'typing still narrows', needFrom: 'requirement.invariants', evidence: 2 } });
  say(kinds(rec).includes('SHARED_EVIDENCE'), 'SHARED_EVIDENCE: two nodes resting on one measurement (the real U/P1 defect)');
}

{ // effects paired to steps by position, order inverted
  const rec = openChange({ runId: 'r', changeId: 'swap' });
  const t = append(rec, { section: 'TASK', body: { what: 'filter task', steps: STEPS, effects: ['#q is empty', 'every item visible'] } });
  append(rec, { section: 'GRAPH', cites: [t], body: { node: 'E1', need: '#q is empty', needFrom: 'evidence-step', evidence: 3 } });
  say(kinds(rec).includes('MISLABELLED_TRACE'), 'MISLABELLED_TRACE: E1 labelled "#q is empty" while settled by the all-items-back assertion');
}

{ // the g2 repeat with nothing in between
  const rec = openChange({ runId: 'r', changeId: 'rep' });
  const t = append(rec, { section: 'TASK', body: { what: 'key task', steps: [{ n: 3, name: 'pressing 0 restores' }, { n: 4, name: 'pressing 0 again leaves it' }] } });
  const e1 = append(rec, { section: 'GRAPH', cites: [t], body: { node: 'E1', need: 'pressing 0 restores', needFrom: 'evidence-step', evidence: 3 } });
  append(rec, { section: 'GRAPH', cites: [t, e1], body: { node: 'E2', need: 'pressing 0 again leaves it', needFrom: 'evidence-step', evidence: 4, reExerciseOf: 'E1' } });
  say(kinds(rec).includes('UNDISTINGUISHED_REPEAT'), 'UNDISTINGUISHED_REPEAT: a repeat that declares nothing making it observable');
}

{ // the farm acceptance, over a page that threw at load
  const rec = openChange({ runId: 'r', changeId: 'farm' });
  const t = append(rec, { section: 'TASK', body: { what: 'build the farm page' } });
  const p = append(rec, { section: 'PROPOSAL', body: { what: 'candidate', sha: 'f00' } });
  const v = append(rec, { section: 'VERIFICATION', cites: [p], body: { what: 'ran it', passing: [1], failing: [], errors: ['ReferenceError: plant is not defined'] } });
  append(rec, { section: 'DECISION', cites: [v, t], body: { outcome: 'ACCEPT', why: 'the checks that ran, passed' } });
  say(kinds(rec).includes('UNSUPPORTED_DECISION'), 'UNSUPPORTED_DECISION: accepting while citing a verification that recorded a page error');
}

{ // an acceptance citing no verification at all
  const rec = openChange({ runId: 'r', changeId: 'blind' });
  const t = append(rec, { section: 'TASK', body: { what: 'anything' } });
  append(rec, { section: 'DECISION', cites: [t], body: { outcome: 'RETAIN', why: 'looks right' } });
  say(kinds(rec).includes('UNSUPPORTED_DECISION'), 'UNSUPPORTED_DECISION: retaining without citing any verification at all');
}

{ // a write outside its authorised scope
  const rec = openChange({ runId: 'r', changeId: 'scope' });
  const t = append(rec, { section: 'TASK', body: { what: 'edit one file' } });
  const a = append(rec, { section: 'AUTHORITY', body: { scope: ['index.html'], revisionOf: 'abc' } });
  append(rec, { section: 'WRITE', cites: [t], authority: a, body: { target: 'server/acceptance.mjs' } });
  say(kinds(rec).includes('OUT_OF_SCOPE_EFFECT'), 'OUT_OF_SCOPE_EFFECT: a write to a file the permission never covered');
}

{ // THE CLAIM DEPENDENCY LEDGER: a lesson still standing on ground that has since moved
  const { rec, ids } = cleanRecord();
  const lesson = append(rec, { section: 'LESSON', cites: [ids.diag], body: { what: 'bounded edits beat whole-file returns here', scope: 'this page shape only' } });
  say(kinds(rec).length === 0, 'a lesson resting on live evidence is quiet');
  supersede(rec, { supersedes: ids.diag, why: 'the graph mislabelled E1; the diagnosis was recomputed' });
  const found = contradictions(rec);
  say(found.some((c) => c.kind === 'STALE_CLAIM'), 'STALE_CLAIM: superseding the diagnosis marks the lesson that rested on it as needing replay');
  say(!!lesson && found.some((c) => c.kind === 'STALE_CLAIM' && /LESSON/.test(c.where)), 'and names the LESSON specifically - this is the "which claims must now be withdrawn" question, answered mechanically');
}

console.log('\nrendered example of the g2 repeat record:');
{
  const rec = openChange({ runId: 'r', changeId: 'rep2' });
  const t = append(rec, { section: 'TASK', body: { what: 'key task', steps: [{ n: 3, name: 'pressing 0 restores' }, { n: 4, name: 'pressing 0 again leaves it' }] } });
  const e1 = append(rec, { section: 'GRAPH', cites: [t], body: { node: 'E1', need: 'pressing 0 restores', needFrom: 'evidence-step', evidence: 3 } });
  append(rec, { section: 'UNKNOWN', uncertainty: 'UNOBSERVABLE_REPEAT', cites: [t], body: { what: 'step 4 repeats step 3 with nothing in between' } });
  append(rec, { section: 'GRAPH', cites: [t, e1], body: { node: 'D', need: 'derived durability sequence', needFrom: 'behaviour', distinguishing: 'OBSERVED', reExerciseOf: 'E1' } });
  console.log(render(rec).split(String.fromCharCode(10)).map((l) => '  ' + l).join(String.fromCharCode(10)));
}

console.log(`\n  change record: ${passed} passed, ${failed} failed -> ${failed
  ? 'THE PROTOCOL DOES NOT HOLD ITS OWN BOUNDARIES'
  : 'bad handoffs are refused at the boundary, and every historical contradiction replays'}`);
process.exit(failed ? 1 : 0);
