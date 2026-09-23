/**
 * routeBound.js - BOUND THE EXPERIMENT TO COVERED EXECUTION PATHS.
 *
 * agent.js executes model-chosen tools at THREE sites:
 *
 *     drive()          - COVERED. host events, before-images, the d2 terminal gate.
 *     runSubtask()     - UNCOVERED. a sub-agent loop with its own dispatch.
 *     driveDetached()  - UNCOVERED. the human-approved-command path.
 *
 * Every d2 qualification to date was established on the covered site. An arm difference
 * produced through either uncovered site would be a difference in a path neither arm's
 * instrumentation can see - it would not be attributable to the treatment, and worse, it
 * would not look like an error.
 *
 * TWO DIFFERENT CLOSURES, AND THEY ARE NOT THE SAME CLAIM.
 *
 *   UNAVAILABLE   `spawn_subtask` is removed from the tool table, so the only entry to
 *                 runSubtask() does not exist. The model cannot call what is not there, and
 *                 the existing unknown-tool branch rejects the name if it emits it anyway.
 *                 This is a behavioural property and `__toolPolicyTest.hasTool` asserts it
 *                 against the real table.
 *
 *   DETECTED      driveDetached()'s execution needs a human to approve a command. An
 *                 unattended campaign has no approver, so it should never run - but "nobody
 *                 clicked the button" is not unavailability, and this project has already
 *                 recorded a route that executed 0 times in 17,466 replies while remaining
 *                 perfectly reachable. So the site is INSTRUMENTED instead: if it ever
 *                 executes, the run is marked and EXCLUDED from the comparison.
 *
 * Stating those as one thing would overclaim. They are reported separately.
 *
 * EXCLUSION IS THE RULE, NOT A WARNING. A run that traversed an uncovered site is not a
 * slightly noisier data point; the property under test was never established on that path.
 * `runIsBounded()` answers false and the run does not enter the analysed set.
 *
 * BUT AN EXCLUDED RUN IS AN OUTCOME, NOT A DISCARDED SAMPLE. Traversal is a preregistered
 * exclusion, so its FREQUENCY BY ARM is a result in its own right: if one arm reaches closed
 * routes more often, that is a fact about the treatment. `traversalReport()` carries the
 * excluded count alongside every denominator so a protocol-induced exclusion cannot disappear
 * from a published rate.
 *
 * IDENTICAL IN BOTH ARMS. This is configuration, not treatment: both arms get the same tool
 * table and the same detector. Arms differ in AUTHORITY, not in what they can reach.
 */

/**
 * Is route bounding active? Off by default, so the ordinary hub is unchanged and only a
 * campaign run opts in.
 *
 * Read once at import. The campaign sets it before the server starts; a value that could
 * change mid-run would make "this run was bounded" unanswerable after the fact.
 */
export const ROUTES_BOUNDED = process.env.AGENT_BOUND_ROUTES === '1';

/** The sites d2 instrumentation does NOT cover. Named, so a report can list them. */
export const UNCOVERED_SITES = Object.freeze(['runSubtask', 'driveDetached']);

/**
 * Record that execution happened at an uncovered site.
 *
 * Called BEFORE the tool runs, not after: a tool that throws still traversed the route, and
 * a detector that only fires on success would miss exactly the destructive cases.
 *
 * Mutates the run record rather than a module counter, because the question is always about
 * ONE run's eligibility, and a module-level total cannot answer it when runs overlap.
 */
export function noteUncoveredTraversal(run, site, tool) {
  if (!run || typeof run !== 'object') return;
  if (!Array.isArray(run.uncoveredTraversals)) run.uncoveredTraversals = [];
  run.uncoveredTraversals.push({ site, tool: tool || null, at: Date.now() });
}

/**
 * May this run enter the comparison?
 *
 * Returns a REASON, never a bare boolean, for the same reason the d2 gate does: "excluded"
 * with no attributable cause is indistinguishable from an apparatus failure, and this
 * project has already spent a session on a refusal whose message never reached the record.
 */
export function runIsBounded(run) {
  const t = (run && run.uncoveredTraversals) || [];
  if (t.length === 0) return { ok: true, traversals: 0 };
  const sites = [...new Set(t.map((x) => x.site))].join(', ');
  return {
    ok: false,
    traversals: t.length,
    reason: `executed ${t.length} tool call(s) at uncovered site(s): ${sites} - the d2 property was never established on that path, so this run is EXCLUDED`,
  };
}

/**
 * Should the approved-pending site refuse outright?
 *
 * Separated from the call site so the DECISION is testable without standing up a router, an
 * approval queue and a model. The placement of the call is a separate claim and is reported
 * as one: this function being right does not prove it is invoked in the right place.
 */
export function refuseAtDetachedSite() {
  return ROUTES_BOUNDED
    ? { refuse: true, message: 'ERROR: this command route is closed for the duration of the experiment.' }
    : { refuse: false };
}

/**
 * Report closed-route traversals AS AN EXPERIMENTAL OUTCOME, by arm.
 *
 * A traversal is a preregistered exclusion, NOT a discarded sample. If one arm reaches closed
 * routes more often than the other, that IS a result about the treatment - and quietly dropping
 * those runs would hide exactly that. This project already has a recorded case of every
 * published percentage resting on the wrong denominator, so the excluded count travels with
 * every rate computed from the remainder.
 *
 * `runs` is [{ arm, uncoveredTraversals }]. Returns per-arm totals plus the denominators, so a
 * report can never quote an analysed rate without the number of runs it dropped to get there.
 */
export function traversalReport(runs) {
  const byArm = {};
  for (const r of runs || []) {
    const arm = r.arm || 'UNKNOWN';
    const a = (byArm[arm] ||= { arm, runs: 0, traversedRuns: 0, traversals: 0, analysed: 0, sites: {} });
    a.runs++;
    const t = r.uncoveredTraversals || [];
    if (t.length === 0) { a.analysed++; continue; }
    a.traversedRuns++;
    a.traversals += t.length;
    for (const x of t) a.sites[x.site] = (a.sites[x.site] || 0) + 1;
  }
  const arms = Object.values(byArm);
  return {
    arms,
    // The sentence a report must carry. Written here so it cannot be omitted downstream.
    statement: arms.map((a) =>
      `${a.arm}: ${a.analysed}/${a.runs} runs analysed, ${a.traversedRuns} excluded for closed-route traversal (${a.traversals} call(s): ${Object.entries(a.sites).map(([s, n]) => `${s}=${n}`).join(', ') || 'none'})`,
    ).join(' | '),
  };
}
