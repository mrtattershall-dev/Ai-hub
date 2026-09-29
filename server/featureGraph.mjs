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
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const NL = String.fromCharCode(10);

/**
 * The graph, from the structured requirement and an analysis of the baseline. NO CANDIDATE PARAMETER
 * EXISTS - the signature is the safeguard.
 */
export function derive(page, task, { topLevelFunctions, referencedElsewhere }) {
  const req = task.requirement;
  const nodes = [];
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
  }
  for (const [i, e] of (req.effects || []).entries()) {
    nodes.push({ id: `E${i + 1}`, kind: 'effect', need: e, from: 'requirement.effects', dependsOn: ['W'], inBaseline: false });
  }
  // The existing update route. Named from analysis; its PRESENCE is settled by observation below.
  const top = topLevelFunctions(page);
  const renderer = top.find((f) => f.params === 0 && referencedElsewhere(page, f));
  if (renderer) nodes.push({ id: 'U', kind: 'existing-route', need: `the page's update path ${renderer.name}()`, from: 'page analysis', dependsOn: [], inBaseline: true });
  for (const [i, inv] of (req.invariants || []).entries()) {
    nodes.push({ id: `P${i + 1}`, kind: 'preserved', need: inv, from: 'requirement.invariants', inBaseline: true });
  }
  return { nodes, missingAtBaseline: nodes.filter((n) => !n.inBaseline && n.kind !== 'effect').map((n) => n.id) };
}

/**
 * Which nodes does a candidate actually satisfy? Run, never read.
 *
 *   C  clicking the selector does not error -> the control exists
 *   W  clicking it changes observable state -> it responds, so it is wired. An INERT control passes C
 *      and fails W, which is the distinction a code-reading checker cannot make.
 *   E* the task's own addition steps, run through the spec's prerequisite sequence
 *   P* the task's own carried steps
 *   U  the baseline's update route still functions - checked on the CANDIDATE, so a candidate that
 *      breaks the page's own filtering fails it
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

    // Effects and preserved behaviour: the task's OWN steps, in the spec's own order.
    const addition = task.provenance.additionSteps || [];
    const carried = task.provenance.carriedSteps || [];
    const upTo = Math.max(...addition, ...carried);
    const full = await run(spec.steps.filter((s) => s.n <= upTo));
    const effects = graph.nodes.filter((n) => n.kind === 'effect');
    effects.forEach((n, i) => { satisfied[n.id] = addition[i] !== undefined && full.passing.includes(addition[i]); });
    graph.nodes.filter((n) => n.kind === 'preserved').forEach((n, i) => {
      satisfied[n.id] = carried.length > 1 && full.passing.includes(carried[Math.min(i + 1, carried.length - 1)]);
    });
    // U on the CANDIDATE: the page's own update route still functions, evidenced by its filtering step.
    if (graph.nodes.some((n) => n.id === 'U')) satisfied.U = carried.length > 1 && full.passing.includes(carried[1]);

    const covered = graph.nodes.filter((n) => satisfied[n.id]).map((n) => n.id);
    const missing = graph.nodes.filter((n) => !satisfied[n.id]).map((n) => n.id);
    return { satisfied, covered, missing, complete: missing.length === 0 };
  } finally { if (existsSync(ws)) { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } } }
}
