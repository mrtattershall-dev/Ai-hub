// ══════════════════════════════════════════════════════════════════════════════════════════════════
// featureGraph.mjs — the required-artifact graph, as a COVERAGE MAP over observed state.
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
// SAFEGUARD 1 - DERIVE BEFORE SEEING ANY CANDIDATE. `derive(page, task)` takes no candidate and cannot
// see one. A graph built by inspecting output and deciding afterwards which nodes mattered would be a
// post-hoc story, not a map.
//
// SAFEGUARD 2 - EVERY NODE IS VERIFIED OBSERVATIONALLY. `U` does not count because the planner named
// `filterRows()`; it counts because the baseline's own filtering behaviour is observed to work. `C`
// must exist in the DOM. `W` must actually respond to a click. `E*` must hold after the prerequisite
// interaction sequence. Nothing here judges code by reading it.
//
// SAFEGUARD 3 - EVERY NODE'S EVIDENCE IS ASSIGNED AT DERIVATION TIME AND IS ITS OWN. Each node that is
// settled by a spec step carries that step's number in `step`, fixed before any candidate exists, and
// NO TWO NODES MAY SHARE A STEP. Two defects found by graphNodeMutants.mjs forced this:
//
//   (1) EFFECTS WERE PAIRED TO STEPS BY POSITION. `requirement.effects[i]` was matched to
//       `provenance.additionSteps[i]`. The emitter records no such correspondence, and on the filter
//       shape the order is exactly INVERTED - effects are ["<field> is empty", "every item visible"]
//       while addition steps are [3 = every item back, 4 = field empty, 6 = second click]. So E1 was
//       labelled "the field is empty" while being settled by the all-items-back assertion, and step 6
//       was silently dropped. The effect nodes now come ONE PER ADDITION STEP and are NAMED BY THE
//       ASSERTION THAT SETTLES THEM; `requirement.effects` is recorded as the provenance of the
//       addition set as a whole, which is all the emitter actually supports.
//
//   (2) U AND P1 WERE THE SAME MEASUREMENT UNDER TWO NAMES. Both read `carriedSteps[1]`, so no mutant
//       could ever fail one and spare the other, and every U mutant was scored OVER-BROAD for breaking
//       a sentinel that was not a separate thing. They are now separated the way the emitter's own
//       steps separate them: U is the route AS IT ALREADY WORKS (a carried step before the first
//       addition), P is the invariant RE-EXERCISED AFTER the addition (a carried step after it, never
//       the no-error step). Where no such step exists the node is REFUSED, not faked - see `refusals`.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const NL = String.fromCharCode(10);

/**
 * The graph, from the structured requirement and an analysis of the baseline. NO CANDIDATE PARAMETER
 * EXISTS - the signature is the safeguard. Returns `refusals` alongside `nodes`: where the page or the
 * task does not support a node, that is recorded rather than invented.
 */
export function derive(page, task, { topLevelFunctions, referencedElsewhere }) {
  const req = task.requirement;
  const prov = task.provenance || {};
  const steps = ((task.diagnostic || {}).spec || {}).steps || [];
  const nameOf = (n) => (steps.find((s) => s.n === n) || {}).name || `step ${n}`;
  const nodes = [];
  const refusals = [];

  const addition = [...(prov.additionSteps || [])].sort((a, b) => a - b);
  const carried = [...(prov.carriedSteps || [])].sort((a, b) => a - b);
  const firstAddition = addition.length ? addition[0] : Infinity;

  // ── C and W, from the trigger. No selector means no surface node: a keyboard trigger has no control
  //    to create, and inventing one would score every keyboard candidate as missing a thing the task
  //    never asked for.
  const sel = req.trigger.selector || null;
  if (sel) {
    const id = sel.replace(/^#/, '');
    nodes.push({
      id: 'C', kind: 'surface', need: `a control matching ${sel}`,
      from: 'requirement.trigger.selector', selector: sel,
      inBaseline: new RegExp(`id\\s*=\\s*["']?${id}`).test(page),
    });
    nodes.push({
      id: 'W', kind: 'wiring', need: `a ${req.trigger.kind} handler on ${sel}`,
      from: 'requirement.trigger.kind', selector: sel, dependsOn: ['C'], inBaseline: false,
    });
  } else {
    refusals.push({ id: 'C/W', why: `the trigger is ${req.trigger.kind} with no selector, so there is no surface to require` });
  }

  // ── One effect node per ADDITION STEP, named by the assertion that settles it. See defect (1).
  for (const [i, n] of addition.entries()) {
    nodes.push({
      id: `E${i + 1}`, kind: 'effect', need: nameOf(n), step: n,
      from: 'provenance.additionSteps; the requirement asks for ' + JSON.stringify(req.effects || []),
      dependsOn: sel ? ['W'] : [], inBaseline: false,
    });
  }

  // ── The existing update route, named from analysis, settled by observation. Its evidence must be a
  //    carried step that runs BEFORE the addition is ever exercised - the route as it already works.
  const top = topLevelFunctions(page);
  const renderer = top.find((f) => f.params === 0 && referencedElsewhere(page, f));
  const routeStep = carried.find((n) => n > 1 && n < firstAddition);
  if (renderer && routeStep !== undefined) {
    nodes.push({
      id: 'U', kind: 'existing-route', need: `the page's update path ${renderer.name}(), as it already works`,
      step: routeStep, from: 'page analysis', dependsOn: [], inBaseline: true,
    });
  } else if (!renderer) {
    refusals.push({ id: 'U', why: 'no named zero-parameter update route is referenced elsewhere in the page' });
  } else {
    refusals.push({ id: 'U', why: `no carried step runs before the first addition step (${firstAddition}), so the route has no evidence of its own` });
  }

  // ── Preserved invariants, re-exercised AFTER the addition. The no-error step is never evidence for
  //    an invariant: it asserts the absence of errors, not that a behaviour survived. See defect (2).
  const preservedSteps = carried.filter((n) => n > firstAddition && n !== prov.noErrorStep);
  for (const [i, inv] of (req.invariants || []).entries()) {
    if (preservedSteps[i] === undefined) {
      refusals.push({ id: `P${i + 1}`, why: `no carried step re-exercises ${JSON.stringify(inv)} after the addition` });
      continue;
    }
    nodes.push({ id: `P${i + 1}`, kind: 'preserved', need: inv, step: preservedSteps[i], from: 'requirement.invariants', inBaseline: true });
  }

  // No two nodes may share evidence. If they do, the graph is reporting one measurement twice and no
  // mutant can separate them; that is a derivation bug, not something to discover downstream.
  const byStep = new Map();
  for (const n of nodes.filter((x) => x.step !== undefined)) {
    if (byStep.has(n.step)) throw new Error(`featureGraph: ${byStep.get(n.step)} and ${n.id} both rest on step ${n.step}`);
    byStep.set(n.step, n.id);
  }

  // ── RE-EXERCISE EDGES. The emitter asserts some things twice: on the filter shape, step 6 repeats
  //    step 3's assertion after a second click, and step 5 repeats step 2's after the addition has
  //    been used. Those later nodes are not independent claims - they ask whether the SAME assertion
  //    still holds under a further exercise, so they presuppose the earlier one. The criterion is
  //    objective and needs no interpretation: the two steps' `expect` strings are BYTE-IDENTICAL.
  //    Declaring the edge is what lets a mutant that destroys a behaviour outright count the repeat as
  //    expected collateral, while still requiring a mutant that fails ONLY the repeat - a control that
  //    works the first time and not the second - to prove the repeat is not vacuous.
  const settled = nodes.filter((n) => n.step !== undefined).sort((a, b) => a.step - b.step);
  const expectOf = (n) => (steps.find((s) => s.n === n) || {}).expect;
  for (const [i, n] of settled.entries()) {
    const prior = settled.slice(0, i).find((p) => expectOf(p.step) !== undefined && expectOf(p.step) === expectOf(n.step));
    if (prior) { n.dependsOn = [...new Set([...(n.dependsOn || []), prior.id])]; n.reExerciseOf = prior.id; }
  }
  return { nodes, refusals, missingAtBaseline: nodes.filter((n) => !n.inBaseline && n.kind !== 'effect').map((n) => n.id) };
}

/**
 * Which nodes does a candidate actually satisfy? Run, never read.
 *
 *   C  clicking the selector does not error -> the control exists
 *   W  clicking it changes observable state -> it responds, so it is wired. An INERT control passes C
 *      and fails W, which is the distinction a code-reading checker cannot make.
 *   E* / P* / U  each node's OWN pre-assigned spec step, from the single full run of the spec
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
    const sel = (graph.nodes.find((n) => n.id === 'C') || {}).selector;
    const satisfied = {};

    // C and W, each from a fresh load, so neither contaminates the other.
    if (sel) {
      const c = await run([{ n: 8001, name: 'the control exists', do: [{ kind: 'click', selector: sel }], expect: 'true' }]);
      satisfied.C = c.passing.includes(8001);
      // W: a click must CHANGE something - but only from a state where a CORRECT control would.
      // The first version clicked on a fresh load, where nothing is filtered, so a working clear
      // button correctly changed nothing and failed W. That is the prerequisite-closure defect,
      // appearing for the third time today (obligationMutants, rescore, here). The spec's own
      // steps before the first addition ARE the prerequisite, so they run first.
      const firstAddition = Math.min(...(task.provenance.additionSteps || [Infinity]));
      const setup = spec.steps.filter((x) => x.n < firstAddition);
      const w = await run([
        ...setup,
        { n: 8003, name: 'clicking changes observable state', do: [{ kind: 'click', selector: sel }], expect: 'JSON.stringify(dom.visible) !== JSON.stringify(domBefore.visible) || JSON.stringify(dom.inputValues) !== JSON.stringify(domBefore.inputValues)' },
      ]);
      satisfied.W = satisfied.C && w.passing.includes(8003);
    }

    // Every step-settled node, from ONE run of the spec in its own order, up to the last step any node
    // needs. Each node reads the step assigned to it at derivation time - never a step chosen now.
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
