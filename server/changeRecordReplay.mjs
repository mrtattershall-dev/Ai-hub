// ══════════════════════════════════════════════════════════════════════════════════════════════════
// changeRecordReplay.mjs — READ-ONLY projections over a change record, and the contradictions they find.
//
// Nothing here writes. Projections are RECOMPUTED from the stored facts every time, never stored, so a
// better graph does not require rewriting history to match it - the historical raw run replays under
// the schema it was written with, and the projection over it improves independently.
//
// THE DETECTORS ARE NOT GENERIC CODE SMELLS. Each one is a specific handoff failure this project has
// actually made and later had to correct. If the protocol is worth anything, a record written at the
// time of each of those mistakes must light up here without anyone remembering the mistake.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { provenanceOf } from './changeRecord.mjs';

const byId = (rec) => new Map(rec.events.map((e) => [e.id, e]));

/** Which events have been superseded, and by what. Corrections are appended, so this is a projection. */
export function supersessions(rec) {
  const m = new Map();
  for (const e of rec.events) {
    const s = e.body && e.body.supersedes;
    if (s) m.set(s, [...(m.get(s) || []), e.id]);
  }
  return m;
}

/** The run, reconstructed end to end: what was asked, observed, expected, produced, judged, and done. */
export function replay(rec) {
  const pick = (section) => rec.events.filter((e) => e.section === section);
  const superseded = supersessions(rec);
  // A correction that carries no replacement is a WITHDRAWAL: it retires the old claim and puts nothing
  // in its place, so the live view must show neither. It is still fully readable under `corrections`
  // and in the raw events - withdrawing a claim never deletes it.
  const withdrawal = (e) => e.body && e.body.supersedes && Object.keys(e.body).every((k) => k === 'supersedes' || k === 'why');
  const live = (e) => !superseded.has(e.id) && !withdrawal(e);
  return {
    schema: rec.schema, runId: rec.runId, changeId: rec.changeId,
    task: pick('TASK').map((e) => e.body),
    baseline: pick('BASELINE').map((e) => e.body),
    graph: pick('GRAPH').filter(live).map((e) => ({ id: e.id, ...e.body })),
    proposal: pick('PROPOSAL').map((e) => e.body),
    verification: pick('VERIFICATION').map((e) => e.body),
    diagnosis: pick('DIAGNOSIS').filter(live).map((e) => e.body),
    decision: pick('DECISION').filter(live).map((e) => e.body),
    authority: pick('AUTHORITY').map((e) => e.body),
    writes: pick('WRITE').map((e) => ({ id: e.id, authority: e.authority, cites: e.cites, ...e.body })),
    lessons: pick('LESSON').filter(live).map((e) => e.body),
    unknowns: rec.events.filter((e) => e.class === 'UNCERTAINTY').map((e) => ({ type: e.uncertainty, ...e.body })),
    corrections: [...superseded.entries()].map(([was, now]) => ({ was, now })),
  };
}

/**
 * The contradictions. Each `kind` names a handoff failure with a real history in this project.
 * A finding here is not advisory - it says a downstream component rebuilt something upstream never said.
 */
export function contradictions(rec) {
  const out = [];
  const ids = byId(rec);
  const superseded = supersessions(rec);
  const nodes = rec.events.filter((e) => e.section === 'GRAPH' && e.body && e.body.node);

  // ── TWO NODES, ONE MEASUREMENT. U and P1 both read carriedSteps[1]; no mutant could ever fail one
  //    and spare the other, and every route-breaking mutant was scored over-broad for it.
  const byEvidence = new Map();
  for (const e of nodes) {
    const ev = e.body.evidence;
    if (ev === undefined || ev === null) continue;
    const k = JSON.stringify(ev);
    byEvidence.set(k, [...(byEvidence.get(k) || []), e.body.node]);
  }
  for (const [k, who] of byEvidence) {
    if (who.length > 1) out.push({ kind: 'SHARED_EVIDENCE', where: who.join(' and '), why: `both rest on evidence ${k}, so they are one measurement under two names and no mutant can separate them` });
  }

  // ── A NODE LABELLED FROM ONE PLACE AND SETTLED BY ANOTHER. requirement.effects[i] was paired to
  //    additionSteps[i] by position, and the order was inverted, so E1 read "the field is empty" while
  //    being decided by the all-items-back assertion. A trace link must be explicit.
  const stepFacts = new Map();
  for (const e of rec.events.filter((x) => x.section === 'TASK' && x.body && x.body.steps)) {
    for (const s of e.body.steps) stepFacts.set(s.n, s);
  }
  for (const e of nodes) {
    const s = stepFacts.get(e.body.evidence);
    if (!s || !e.body.need) continue;
    if (e.body.needFrom === 'evidence-step' && e.body.need !== s.name) {
      out.push({ kind: 'MISLABELLED_TRACE', where: e.body.node, why: `claims to be named by its evidence step but says ${JSON.stringify(e.body.need)} while step ${s.n} asserts ${JSON.stringify(s.name)}` });
    }
  }

  // ── A REPEAT THAT CANNOT DISTINGUISH ANYTHING. Pressing the trigger twice from a state that already
  //    satisfies the claim: correct and dead behaviour are observationally identical.
  for (const e of nodes) {
    if (e.body.reExerciseOf && !e.body.distinguishing) {
      out.push({ kind: 'UNDISTINGUISHED_REPEAT', where: e.body.node, why: `repeats ${e.body.reExerciseOf} without declaring what makes the repeat observable` });
    }
  }

  // ── AN ACCEPTANCE WITH NOTHING BEHIND IT. The farm artifact was accepted while the page threw at
  //    load, because the decision never had to cite the verification it supposedly rested on.
  for (const e of rec.events.filter((x) => x.section === 'DECISION')) {
    if (!e.body || !/ACCEPT|RETAIN/.test(String(e.body.outcome || ''))) continue;
    const prov = provenanceOf(rec, e.id);
    const ver = prov.filter((p) => p.section === 'VERIFICATION');
    if (!ver.length) { out.push({ kind: 'UNSUPPORTED_DECISION', where: e.body.outcome, why: 'accepts without citing any verification' }); continue; }
    const bad = ver.find((v) => v.body && (v.body.errors || []).length);
    if (bad) out.push({ kind: 'UNSUPPORTED_DECISION', where: e.body.outcome, why: `accepts while citing a verification that recorded ${bad.body.errors.length} page error(s)` });
  }

  // ── A CLAIM RESTING ON NOTHING OBSERVED. Refused at append time now, but a record written by an
  //    older or looser writer must still be caught on the way in.
  for (const e of rec.events.filter((x) => x.class === 'CLAIM')) {
    if (e.body && e.body.supersedes) continue;
    if (!provenanceOf(rec, e.id).some((p) => p.class === 'FACT')) {
      out.push({ kind: 'CLAIM_WITHOUT_FACT', where: e.section, why: 'nothing in its provenance was ever observed' });
    }
  }

  // ── A WRITE THAT NOTHING AUTHORISED, or whose authority was scoped to something else.
  for (const e of rec.events.filter((x) => x.class === 'EFFECT')) {
    const auth = ids.get(e.authority);
    if (!auth) { out.push({ kind: 'UNGOVERNED_EFFECT', where: e.id, why: 'cites no permission in this record' }); continue; }
    const target = e.body && e.body.target;
    const scope = auth.body && auth.body.scope;
    if (target && scope && !(Array.isArray(scope) ? scope.includes(target) : scope === target)) {
      out.push({ kind: 'OUT_OF_SCOPE_EFFECT', where: e.id, why: `wrote ${target}, which is outside the authorised scope ${JSON.stringify(scope)}` });
    }
  }

  // ── A CLAIM STILL STANDING ON SUPERSEDED GROUND. This is the Claim Dependency Ledger question: when
  //    a checker changes, which earlier claims must now be replayed, narrowed, or withdrawn?
  for (const e of rec.events.filter((x) => x.class === 'CLAIM')) {
    if (superseded.has(e.id) || (e.body && e.body.supersedes)) continue;
    const stale = provenanceOf(rec, e.id).filter((p) => p.id !== e.id && superseded.has(p.id));
    if (stale.length) out.push({ kind: 'STALE_CLAIM', where: e.section, why: `rests on ${stale.map((s) => s.id).join(', ')}, which has since been superseded - replay, narrow or withdraw it` });
  }

  return out;
}

/** A short human rendering, for reading one run without a viewer. */
export function render(rec) {
  const r = replay(rec);
  const L = [`change ${r.changeId}  run ${r.runId}  schema ${r.schema}`];
  for (const e of rec.events) {
    const tag = `${String(e.seq).padStart(2)} ${e.section.padEnd(12)} ${e.class.padEnd(11)}`;
    const cites = e.cites.length ? `  <- ${e.cites.map((c) => c.split(':')[1]).join(',')}` : '';
    const what = e.uncertainty ? e.uncertainty : (e.body && (e.body.node || e.body.outcome || e.body.what)) || '';
    L.push(`  ${tag} ${String(what).slice(0, 70)}${cites}`);
  }
  const bad = contradictions(rec);
  L.push(bad.length ? `  ${bad.length} CONTRADICTION(S):` : '  no contradictions detected');
  for (const b of bad) L.push(`    ${b.kind}  ${b.where}: ${b.why}`);
  return L.join(String.fromCharCode(10));
}
