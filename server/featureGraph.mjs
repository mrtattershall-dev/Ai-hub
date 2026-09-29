// ══════════════════════════════════════════════════════════════════════════════════════════════════
// featureGraph.mjs — the required-artifact graph, as a STATEFUL OBLIGATION GRAPH over observed state.
//
// STAGE 1 ONLY: graph-as-CHECKER. The generator never sees it. Showing a generator "create the control,
// then wire it" hands over the feature-assembly reasoning the experiment exists to measure - the same
// shape as pre-supplying an empty function body. Stages 2 (feedback after a failed attempt) and 3
// (planning) are separate treatments and are NOT implemented here.
//
// THE PRECISE CLAIM, because a loose one is easy to make here: Legasus DERIVES THE EXPECTED GRAPH
// WITHOUT READING THE CANDIDATE, and then READS AND RUNS THE CANDIDATE to determine which nodes are
// missing. It is not "explaining missing parts without reading the candidate" - the second half
// necessarily inspects it. What matters is that the expectation was fixed beforehand.
//
// A NODE IS NOT A CHECKLIST ENTRY. It carries the state that must be established first, the action
// applied, the claim that must then hold, and - where it repeats an earlier claim - the perturbation
// that makes the repeat worth running. `graphNodeMutants.mjs` forced this: a re-exercise step with no
// perturbation between the two applications CANNOT separate a working control from a dead one, and one
// mutant proved it by escaping. See behaviorModel.mjs for the criterion.
//
// SAFEGUARD 1 - DERIVE BEFORE SEEING ANY CANDIDATE. `derive(page, task, deps)` takes no candidate and
// cannot see one. The behavioural observation it consumes is of the DELIVERED BASELINE, which is input.
//
// SAFEGUARD 2 - EVERY NODE IS VERIFIED OBSERVATIONALLY. `U` does not count because the planner named
// `filterRows()`; it counts because the baseline's own behaviour is observed to work. `C` must exist in
// the DOM. `W` must actually respond. `E*` must hold after the prerequisite sequence. Nothing here
// judges code by reading it.
//
// SAFEGUARD 3 - EVERY NODE'S EVIDENCE IS ITS OWN, AND IS FIXED AT DERIVATION TIME. A node carries
// either `step` (one of the task's own spec steps, traced to the requirement) or `sequence` (steps the
// graph derived). NO TWO NODES MAY SHARE A STEP; `derive` throws if they do. Two defects forced this:
//
//   (1) EFFECTS WERE PAIRED TO STEPS BY POSITION. `requirement.effects[i]` was matched to
//       `provenance.additionSteps[i]`. The emitter records no such correspondence, and on the filter
//       shape the order is exactly INVERTED, so E1 was labelled "the field is empty" while being
//       settled by the all-items-back assertion - and step 6 was silently dropped. A trace link has to
//       be explicit, never inferred from array order. Effect nodes now come ONE PER ADDITION STEP,
//       NAMED BY THE ASSERTION THAT SETTLES THEM.
//
//   (2) U AND P1 WERE THE SAME MEASUREMENT UNDER TWO NAMES. Both read `carriedSteps[1]`, so no mutant
//       could fail one and spare the other. U is now the route AS IT ALREADY WORKS (a carried step
//       before the first addition); P is the invariant RE-EXERCISED AFTER it, never the no-error step.
//       Where no such step exists the node is REFUSED, not faked.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const NL = String.fromCharCode(10);
const CHANGED = 'JSON.stringify(dom.visible) !== JSON.stringify(domBefore.visible) || JSON.stringify(dom.inputValues) !== JSON.stringify(domBefore.inputValues)';

/**
 * The graph, from the structured requirement, an analysis of the baseline, and a behavioural
 * observation of the baseline. NO CANDIDATE PARAMETER EXISTS - the signature is the safeguard.
 *
 * `deps.observation` is the result of behaviorModel.observeBaseline. Without it the graph cannot know
 * whether any of its sequences distinguish anything, so it is required rather than optional.
 */
export function derive(page, task, { topLevelFunctions, referencedElsewhere, observation }) {
  if (!observation) throw new Error('featureGraph.derive needs a behavioural observation of the baseline');
  const req = task.requirement;
  const prov = task.provenance || {};
  const steps = ((task.diagnostic || {}).spec || {}).steps || [];
  const nameOf = (n) => (steps.find((s) => s.n === n) || {}).name || `step ${n}`;
  const nodes = [];
  const refusals = [...(observation.refusals || [])];

  const addition = [...(prov.additionSteps || [])].sort((a, b) => a - b);
  const carried = [...(prov.carriedSteps || [])].sort((a, b) => a - b);
  const firstAddition = addition.length ? addition[0] : Infinity;
  const p = observation.perturbation;
  const trigger = req.trigger.selector
    ? { kind: req.trigger.kind, selector: req.trigger.selector }
    : { kind: 'key', key: req.trigger.key };

  // ── C and W. No selector means no surface node: a keyboard trigger has no control to create, and
  //    inventing one would score every keyboard candidate as missing a thing the task never asked for.
  const sel = req.trigger.selector || null;
  if (sel) {
    const id = sel.replace(/^#/, '');
    nodes.push({
      id: 'C', kind: 'surface', need: `a control matching ${sel}`,
      from: 'requirement.trigger.selector', selector: sel, inBaseline: new RegExp(`id\\s*=\\s*["']?${id}`).test(page),
      preconditions: [], action: trigger, claim: 'true',
      sequence: [{ n: 8001, name: `${sel} exists and can be clicked`, do: [trigger], expect: 'true' }],
    });
    // W needs a state in which a CORRECT control would visibly do something. Clicking from a fresh load
    // is the prerequisite-closure defect: a working clear button correctly changes nothing there. The
    // perturbation is the prerequisite, and it is one the baseline was OBSERVED to respond to.
    if (p) {
      nodes.push({
        id: 'W', kind: 'wiring', need: `a ${req.trigger.kind} handler on ${sel} that responds from a perturbed state`,
        from: 'requirement.trigger.kind', selector: sel, dependsOn: ['C'], inBaseline: false,
        preconditions: [p.action], action: trigger, claim: CHANGED, distinguishedBy: p.action,
        sequence: [
          { n: 8002, name: 'establish a state where the control is meaningful', do: [p.action], expect: 'true' },
          { n: 8003, name: 'clicking changes observable state', do: [trigger], expect: CHANGED },
        ],
      });
    } else {
      refusals.push({ id: 'W', type: 'NO_PERTURBATION', why: 'no observed perturbation, so there is no state from which a correct control would visibly do anything' });
    }
  } else {
    refusals.push({ id: 'C/W', type: 'NO_SURFACE_REQUIRED', why: `the trigger is ${req.trigger.kind} with no selector, so there is no surface to require` });
  }

  // ── One effect node per ADDITION STEP, named by the assertion that settles it. See defect (1).
  for (const [i, n] of addition.entries()) {
    nodes.push({
      id: `E${i + 1}`, kind: 'effect', need: nameOf(n), step: n,
      from: 'provenance.additionSteps; the requirement asks for ' + JSON.stringify(req.effects || []),
      dependsOn: sel && nodes.some((x) => x.id === 'W') ? ['W'] : [], inBaseline: false,
    });
  }

  // ── The existing update route: named from analysis, settled by a carried step that runs BEFORE the
  //    addition is ever exercised - the route as it already works.
  const top = topLevelFunctions(page);
  const renderer = top.find((f) => f.params === 0 && referencedElsewhere(page, f));
  const routeStep = carried.find((n) => n > 1 && n < firstAddition);
  if (renderer && routeStep !== undefined) {
    nodes.push({
      id: 'U', kind: 'existing-route', need: `the page's update path ${renderer.name}(), as it already works`,
      step: routeStep, from: 'page analysis', dependsOn: [], inBaseline: true,
    });
  } else if (!renderer) {
    refusals.push({ id: 'U', type: 'NO_UPDATE_ROUTE', why: 'no named zero-parameter update route is referenced elsewhere in the page' });
  } else {
    refusals.push({ id: 'U', type: 'NO_ROUTE_EVIDENCE', why: `no carried step runs before the first addition step (${firstAddition}), so the route has no evidence of its own` });
  }

  // ── Preserved invariants, re-exercised AFTER the addition. The no-error step is never evidence for an
  //    invariant: it asserts the absence of errors, not that a behaviour survived. See defect (2).
  const preservedSteps = carried.filter((n) => n > firstAddition && n !== prov.noErrorStep);
  for (const [i, inv] of (req.invariants || []).entries()) {
    if (preservedSteps[i] === undefined) {
      refusals.push({ id: `P${i + 1}`, type: 'NO_POST_ADDITION_EXERCISE', why: `no carried step re-exercises ${JSON.stringify(inv)} after the addition` });
      continue;
    }
    nodes.push({ id: `P${i + 1}`, kind: 'preserved', need: inv, step: preservedSteps[i], from: 'requirement.invariants', inBaseline: true });
  }

  // ── RE-EXERCISE EDGES, AND WHETHER THEY DISTINGUISH ANYTHING ─────────────────────────────────────
  // The emitter asserts some things twice. The criterion for calling the later one a repeat needs no
  // interpretation: the two steps' `expect` strings are BYTE-IDENTICAL. But a repeat is only worth
  // running if the page was MOVED OUT of the claim's target state in between - otherwise "it still
  // works" and "it stopped responding" produce the same observation, which is the mutant that escaped.
  const settled = nodes.filter((n) => n.step !== undefined).sort((a, b) => a.step - b.step);
  const expectOf = (n) => (steps.find((s) => s.n === n) || {}).expect;
  const doOf = (n) => (steps.find((s) => s.n === n) || {}).do || [];
  const sameAct = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const dropped = [];
  for (const n of settled) {
    // THE PRIOR EXERCISE IS LOOKED UP OVER ALL SPEC STEPS, NOT ONLY OVER NODES. Searching nodes only
    // meant that a repeat of a step the graph did not turn into a node looked like a FRESH claim and
    // was never asked whether it distinguishes anything - which is exactly the state g3's P1 was in,
    // passing its mutant by luck rather than by rule.
    const priorStep = steps.filter((q) => q.n < n.step && q.expect !== undefined && q.expect === expectOf(n.step)).pop();
    if (!priorStep) continue;
    const priorNode = settled.find((q) => q.step === priorStep.n) || null;
    n.reExerciseOf = priorNode ? priorNode.id : `step ${priorStep.n}`;
    if (priorNode) n.dependsOn = [...new Set([...(n.dependsOn || []), priorNode.id])];

    // WHAT MOVED THE PAGE OUT OF THE CLAIM IN BETWEEN? Two different things can, and conflating them
    // was a bug: the first version asked only "was the observed perturbation applied in between", which
    // is right for a repeated TRIGGER but wrong for a repeated ROUTE assertion. On the filter shape,
    // what makes "typing still narrows" worth asserting a second time is that THE TRIGGER fired in
    // between and un-narrowed the list - not that more text was typed. Refusing it was a false refusal.
    const between = steps.filter((q) => q.n > priorStep.n && q.n < n.step).flatMap((q) => q.do || []);
    if (p && between.some((a) => sameAct(a, p.action))) {
      // OBSERVED: the intervening action was measured on the DELIVERED page to leave the claim's state.
      n.distinguishedBy = p.action; n.distinguishing = 'OBSERVED'; continue;
    }
    if (between.some((a) => sameAct(a, trigger))) {
      // CONDITIONAL: the intervening action is the trigger itself, which the requirement says changes
      // this state - but the trigger does not exist on the baseline, so that cannot be OBSERVED here.
      // The repeat is therefore only meaningful IF the trigger worked, and that is recorded as a real
      // dependency on the node that owns the trigger's first application, not assumed silently.
      const owner = settled.find((q) => q.step > priorStep.n && q.step < n.step && doOf(q.step).some((a) => sameAct(a, trigger)));
      n.distinguishedBy = trigger; n.distinguishing = 'CONDITIONAL';
      if (owner) n.dependsOn = [...new Set([...(n.dependsOn || []), owner.id])];
      continue;
    }
    n.nonDistinguishing = true;
    dropped.push({ node: n, priorStep, priorNode });
  }

  // A non-distinguishing repeat is REFUSED, not kept and excused. Where the graph can build its own
  // distinguishing sequence it does, and says so: perturb, apply the trigger, perturb AGAIN, apply the
  // trigger again, and require the claim. The second application then starts from a state the claim is
  // known to be FALSE in, so a handler that has gone quiet cannot pass it.
  for (const { node, priorStep, priorNode } of dropped) {
    nodes.splice(nodes.indexOf(node), 1);
    refusals.push({ id: node.id, type: 'UNOBSERVABLE_REPEAT', why: `step ${node.step} repeats step ${priorStep.n} with no intervening action that could alter the property it asserts, so it cannot separate a preserved behaviour from one that was only true the first time` });
    if (!p) { refusals.push({ id: 'D', type: 'NO_PERTURBATION', why: 'no observed perturbation, so no distinguishing sequence can be built either' }); continue; }
    nodes.push({
      id: 'D', kind: 'durability',
      need: `the trigger still restores the page after it is moved away a second time (derived, because step ${node.step} could not tell that apart)`,
      from: `derived from behaviour: ${node.id} was non-distinguishing`,
      dependsOn: priorNode ? [priorNode.id] : [], inBaseline: false,
      preconditions: [p.action, trigger, p.action], action: trigger, claim: observation.claim, distinguishedBy: p.action,
      sequence: [
        { n: 8004, name: 'move the page out of the target state', do: [p.action], expect: 'true' },
        { n: 8005, name: 'apply the trigger', do: [trigger], expect: 'true' },
        { n: 8006, name: 'move it out AGAIN - this is what the task never did', do: [p.action], expect: `!(${observation.claim})` },
        { n: 8007, name: 'apply the trigger a second time and require the restore', do: [trigger], expect: observation.claim },
      ],
    });
  }

  // No two nodes may share evidence. If they do, the graph reports one measurement twice and no mutant
  // can separate them; that is a derivation bug, not something to discover downstream.
  const byStep = new Map();
  for (const n of nodes.filter((x) => x.step !== undefined)) {
    if (byStep.has(n.step)) throw new Error(`featureGraph: ${byStep.get(n.step)} and ${n.id} both rest on step ${n.step}`);
    byStep.set(n.step, n.id);
  }
  return { nodes, refusals, missingAtBaseline: nodes.filter((n) => !n.inBaseline && n.kind !== 'effect').map((n) => n.id) };
}

/**
 * Which nodes does a candidate actually satisfy? Run, never read.
 *
 * A node with `sequence` is run on its own, from a fresh load, and is satisfied when its LAST step
 * passes - the earlier steps establish state and are not claims. A node with `step` is settled by the
 * task's own spec, run once in the task's own order.
 */
export async function verify(candidate, { task, spec, graph, deps }) {
  const ws = mkdtempSync(join(tmpdir(), 'fgraph-'));
  const entry = spec.entry || 'index.html';
  const run = async (steps) => {
    const r = await deps.playCheck(ws, { ...spec, contract: 'feature-graph coverage', steps });
    return { passing: [...(r.passing || [])], failing: [...(r.failing || [])] };
  };
  try {
    writeFileSync(join(ws, entry), candidate.endsWith(NL) ? candidate : candidate + NL, 'utf8');
    const satisfied = {};

    // Derived sequences, each from its own fresh load so none contaminates another.
    for (const n of graph.nodes.filter((x) => x.sequence)) {
      const r = await run(n.sequence);
      const last = n.sequence[n.sequence.length - 1].n;
      satisfied[n.id] = r.passing.includes(last);
    }
    // W rests on C: a click that "changes state" on a page with no such control is not evidence.
    if (satisfied.W !== undefined) satisfied.W = satisfied.C === true && satisfied.W;

    // Task-bound nodes, from ONE run of the spec in its own order, up to the last step any node needs.
    const needed = graph.nodes.filter((n) => n.step !== undefined);
    if (needed.length) {
      const upTo = Math.max(...needed.map((n) => n.step));
      const full = await run(spec.steps.filter((s) => s.n <= upTo));
      for (const n of needed) satisfied[n.id] = full.passing.includes(n.step);
    }

    const covered = graph.nodes.filter((n) => satisfied[n.id]).map((n) => n.id);
    const missing = graph.nodes.filter((n) => !satisfied[n.id]).map((n) => n.id);
    return { satisfied, covered, missing, complete: missing.length === 0 };
  } finally { if (existsSync(ws)) { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } } }
}
