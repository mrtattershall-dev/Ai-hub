---
name: representation-is-not-the-property
description: "2026-09-29 CONSOLIDATION-1: a mechanism with tests but no production consumer is not live product - five of ten Legasus mechanisms are test-only on the candidate baseline"
metadata:
  type: project
---

2026-09-29, CONSOLIDATION-1 pass 2b. The rule that decided every classification, and it should decide
future ones: **a mechanism with tests but no production consumer is not LIVE PRODUCT.** Verify three
things before writing "consumer": the caller is not a `*test*`/`*child*`/`*harness*`/`*probe*` file;
the call is not behind a flag set NOWHERE (grep for the flag being SET, not read); and it is reachable
from `server/index.js`.

On `consolidation/connect-components`, **five mechanisms are live**: the `drive()` loop,
`verifyProject.verify` at the finish gate, the destructive-write refusal + end-of-run syntax rollback,
the run/transcript/trace records plus git commits, and `persist`/`loadRuns`/`queue.js` restart state.

**Test-only, with green suites and no product:** governed writes (`AGENT_GOVERNED_WRITES` set only in
a test and a `*-child*`), the authority calculus (`delegate` has no caller outside two children and a
probe; `observe`/`derive` have no server caller at all), ancestry/staleness (all inside
`if (runWorkspace)`, set only by `chain-child.mjs`), LegaScreen (zero importers under `server/` or
`client/`), and promotion receipts.

**Three more are flag-dead on a user-started hub:** a governed run returns **409 BLOCKED** because
`prepareGoverned` refuses without `AGENT_WORKER_EXEC`/`AGENT_BOUND_ROUTES` — set only by benchmark
launchers, never `start-hub.bat`; `ProtocolController` needs `AGENT_PROTOCOL`; the whole `d2.js`
preservation/quarantine/restore apparatus needs `AGENT_D2_TARGETS`.

**Why this matters more than a tidy-up:** the flags are not oversights. `STEP5_AUTHORITY_CONTINUITY_PREREG.md:160`
records the decision outright — *"It does not authorize enabling the flag anywhere."* Withholding
activation until the continuity work licensed it was good discipline. The error is only in how the
state gets described afterwards.

**How to apply:** never say "integrated", "wired" or "live" without naming the non-test caller and
checking the flag is set somewhere real. Say *present and inert* when that is what is true. Related:
[[legasus-phase1-integration-done]], [[hub-detects-but-does-not-act]], [[fix-the-deciding-path-not-the-advisory-one]].
