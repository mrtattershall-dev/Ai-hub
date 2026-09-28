# PREREGISTRATION — BACKWARD-1. Discovery from effect sinks, with the hub as a prospective subject.

Frozen before the mechanism exists and before any backward discovery has been run anywhere. Nothing
else is in this commit. Builds on `210d827`.

## Why this is required rather than an enhancement

Entry 28 recorded "backward discovery from effect sinks" as NOT STARTED, and it looked like a
coverage improvement. It is not.

Forward discovery seeds on an identity brand. Legasus has one because Legasus was built to make
authority visible. **A screen that only works on software built to be understood by it is not a
screen; it is a mirror.** If the eventual claim is that this can be pointed at ordinary repositories,
the forward direction cannot be the only anchor.

    FORWARD    evidence/authority -> possible influence
    BACKWARD   effect -> required justification
    SURFACE    the intersection: authority-bearing causal paths

## THE FROZEN SINK CLASSES

Taken from the owner's list, which predates any inspection of the prospective subject. **Categories
only. No file, function, module or API name appears here, and none may be added during the run:**

    filesystem mutation        process execution
    version-control mutation   state persistence
    network egress             commit operation

A sink is a call, reached from production, that effects one of these. Sinks are recognised by the
module boundary they cross, not by what anything is called.

## THE FROZEN RULE

> **TEST-ONLY ACCESSIBILITY CANNOT ESTABLISH PRODUCTION REACHABILITY.**

It establishes test behaviour and nothing more. Reachability is therefore a coordinate with a value,
never an absence:

    PRODUCTION_REACHED    reached on a path that no test entry point introduced
    TEST_ONLY             reached only via a test entry point or a test-only export
    UNREACHED             not observed

## THE COVERAGE ONTOLOGY THAT REPLACES THE FUNCTION DENOMINATOR

    EFFECT_DISCOVERED          a sink class instance exists
    EFFECT_WITNESSED           it executed
    ANCESTRY_OBSERVED          the execution path reaching it was recorded
    SUPPORT_CHARACTERIZED      which ancestors matter was established by perturbation
    JUSTIFICATION_ESTABLISHED  what authorized it was identified
    SCREENED                   compared against a provenance-bound criterion

A private function is not automatically a hole and a public export is not automatically coverage.

## CONTAMINATION REGISTER — what I already know about the prospective subject

Stated because it cannot be claimed afterwards that discovery was blind. Before this freeze I ran a
read-only inspection of `~/Projects/ai-coding-hub` and learned:

- `server/agent.js` is ~4,766 lines, ~101 function definitions, 11 exports of which 4 are `__*Test`
  aggregates used by the `.mjs` test suite.
- `server/` is ESM (`type: module`); the repository root is CommonJS.
- `agent.js` contains ~36 direct filesystem write call sites against ~12 calls through the injected
  `loadDb/saveDb/withDb`, and imports `fs`, `child_process` and a git module by name at module scope.
- `agentRouter({loadDb, saveDb, withDb})` is constructed at `server/index.js:472`.

That is mechanism-level knowledge about HOW interception could work. It is not knowledge of what the
hub's authority logic is or where its defects are. **No count above may be used as a target**, and
the predictions below are written so that knowing them does not help satisfy them.

## PREDICTIONS

**BK-1 (DECISIVE, PROSPECTIVE). Backward discovery recovers production paths through PRIVATE code
that forward discovery cannot reach.** Starting only from the frozen sink classes, with no function
names, no test handles and no hub-specific architectural knowledge supplied to the mechanism:

    forward discovery on the hub      -> predicted candidates through private code:  ~0
    backward discovery on the hub     -> predicted candidates through private code:  > 0

*Falsified if* backward discovery also finds nothing, or if what it finds is reachable by forward
discovery anyway.

**BK-2 (THE DANGEROUS NULL, PREREGISTERED AS FAILURE). If meaningful discovery requires `__*Test`
exports, hand-named functions, or knowledge of the hub's intended architecture, THE TRANSFER ATTEMPT
FAILS** and will be reported as failed rather than as a smaller success.
*Control BK-2b (must fire):* a sink reached only through a test entry point is classified TEST_ONLY
and is excluded from production coverage. If removing the `__*Test` exports from consideration
collapses the result, BK-1 is void.

**BK-3. "Private" stops meaning UNSCREENABLE.** At least one private function must reach
SUPPORT_CHARACTERIZED: its participation established by recorded ancestry AND its relevance
established by perturbation, not by being on the path.
*This is the substantive claim.* Appearing in a stack is not participation.

**BK-4. The intersection is measurable and is reported separately per subject.** On Legasus both
directions exist. On the hub the forward surface is predicted to be ~empty, so the intersection is
predicted ~empty too - **and that is a result about the method, not a coverage failure.**

**BK-5. No hub modification.** The hub is read-only. No commit, no edit, no file written into that
repository, and no running process touched.

**BK-6 (PREDICTION OF NO DETECTION).** This slice finds no hub defect. It is a reachability and
ancestry experiment. Any finding about the hub's behaviour is out of scope and would be reported as
an artifact to be separately preregistered.

## DEVELOPMENT DISCIPLINE

The mechanism is developed against **Legasus and synthetic fixtures only**. The hub is run **once**,
after the mechanism is frozen, exactly as `FREEZE_R4_AND_SELECT_REPO_D` discipline requires of a
prospective environment. Tuning the mechanism after seeing a hub result burns it, and a second run
after any change to the mechanism must be reported as a second run.

## WHAT THIS SLICE DOES NOT ESTABLISH

- Not a repository screen. Reaching ANCESTRY_OBSERVED is not reaching SCREENED.
- **The bridge-mutation gap from Entry 30 remains open** and is untouched by this.
- No semantic substrate, no six-role completion layer in production; H-DEFAULT stays frozen at what
  it earned.
- The calculus is still not wired into production, and nothing here changes the hub's architecture
  to make it easier to observe.
