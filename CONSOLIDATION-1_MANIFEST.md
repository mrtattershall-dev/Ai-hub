# CONSOLIDATION-1 — the three-column manifest

**Date:** 2026-09-29 · read-only · baseline `consolidation/connect-components`

Three columns, because today proved one is not enough. Nearly every mistaken status statement made in
this project — including two in my own persistent memory — came from collapsing them into a single
word like "integrated", "wired" or "done".

| column | values | the question it answers |
|---|---|---|
| **COMPONENT** | ESTABLISHED / UNESTABLISHED | does the mechanism work, on its own, with evidence? |
| **REACHABILITY** | LIVE / FLAG-DEAD / TEST-ONLY / ABSENT | does the shipped product actually execute it? |
| **COMPOSITION** | ESTABLISHED / UNESTABLISHED | does it work *together with the others it depends on*? |

Two inferences are now explicitly forbidden, and both were made today:

```
component works in harness   ⇏   product uses component
components individually work ⇏   composition works
```

**A mechanism is not "live Legasus" until all three columns justify it.** At the time of writing,
**no mechanism has all three.**

## The manifest

| # | mechanism | COMPONENT | REACHABILITY | COMPOSITION | why reachability is what it is |
|---|---|---|---|---|---|
| 1 | controller / run loop | ESTABLISHED | **LIVE** | UNESTABLISHED | `index.js:472` → `agent.js:6054`, client `AgentPage.jsx:348`, no flag |
| 2 | governed writes | ESTABLISHED | **TEST-ONLY** | UNESTABLISHED | `AGENT_GOVERNED_WRITES` set only in `chain.test.mjs` + a `*-child*`; and `runAuthority` null without `setRunAuthority`, called only by two children |
| 3 | authority calculus / admission | ESTABLISHED | **TEST-ONLY** | UNESTABLISHED | `delegate` has no caller outside two `*-child*` and a `*probe*`; `observe`/`derive` have **no server caller at all**; imported at `agent.js:15`, never invoked |
| 4 | executable verification | ESTABLISHED | **LIVE** | UNESTABLISHED | `agent.js:4535` finish gate inside `drive()` |
| 5 | preservation / restore | ESTABLISHED | **LIVE** | UNESTABLISHED | `agent.js:4821` + `:5275`, unconditional in `drive()` |
| 5b | acceptance / git restore | ESTABLISHED | **FLAG-DEAD** | UNESTABLISHED | UI *offers* it (`AgentPage.jsx:341`) but `governance.js:84` returns 409 without `AGENT_WORKER_EXEC`+`AGENT_BOUND_ROUTES` |
| 6 | receipts (run/transcript/trace) | ESTABLISHED | **LIVE** | UNESTABLISHED | `drive()` finally, from `/start` |
| 6b | promotion receipts | ESTABLISHED | **TEST-ONLY** | UNESTABLISHED | `workspace.mjs:558`; no non-test caller |
| 7 | workspace identity | ESTABLISHED | **LIVE** (`workspaceStamp`) / **TEST-ONLY** (`revisionOf`, `fileScope`) | UNESTABLISHED | **two competing notions of identity**, one live, one not — a named composition risk |
| 8 | ancestry / staleness | ESTABLISHED | **TEST-ONLY** | UNESTABLISHED | all inside `if (runWorkspace)`; `setRunWorkspace` called only by `chain-child.mjs` |
| 9 | persistence / restart | ESTABLISHED | **LIVE** | UNESTABLISHED | `loadRuns()` at router construction |
| 9b | event-log restart restore | ESTABLISHED | **ABSENT** | UNESTABLISHED | nothing in the tree ever persists `ws.events()` to disk |
| 10 | LegaScreen | ESTABLISHED (in-module) | **ABSENT** | UNESTABLISHED | zero importers under `server/` or `client/` |
| 10b | host-event emit (Phase 1) | ESTABLISHED | **FLAG-DEAD** | UNESTABLISHED | called live at `agent.js:4680`, but `HOST_EVENT_LOG` unset ⇒ zero sinks ⇒ returns on line 1 and **discards its argument** |

**Row 7 is the one to watch.** Two live-vs-test notions of workspace identity is exactly the shape of
composition failure this project expects: `workspaceStamp()` is a path:size:mtime fingerprint;
`revisionOf` is a sha256 content digest. They can disagree. Nothing today makes them agree, because
they have never both been on the same path.

## The staged bridge — one boundary at a time

Not "turn Legasus on". Each layer consumes a proposition the previous one establishes, so they are
integrated in that order and no other:

```
PRODUCT-0A   ordinary path → ADMIT                              effect semantics UNCHANGED
PRODUCT-0B   ordinary path → ADMIT → AUTHORITY                  effect semantics UNCHANGED
PRODUCT-0C   ordinary path → ADMIT → AUTHORITY → GOVERN → EFFECT   ← the first step that may
                                                                     change whether a write lands
```

Three integration checkpoints, not one "turn it on" commit — so that when the assembled system fails,
which it should, the failing connection is identifiable. Each step gets a positive **and** a negative
control. **Only 0C may change whether bytes land.**

## The flags become rollout gates, not deletions

They are off deliberately — `STEP5_AUTHORITY_CONTINUITY_PREREG.md:160`: *"It does not authorize
enabling the flag anywhere."* Deleting them would discard a recorded decision. They become the gates
for 0A/0B/0C.

**And the 409 is its own boundary, with its own trap.** `AGENT_WORKER_EXEC` / `AGENT_BOUND_ROUTES` are
not switches — they assert *facts about the execution environment* that `prepareGoverned` requires.
Copying them into `start-hub.bat` to get past the 409 would assert those facts without establishing
them, which is the precise defect this whole inventory exists to catch. If the ordinary path needs
equivalent facts, they must be **established honestly at launch or run creation**.

## LegaScreen is deliberately last

Not connected merely because pass 2b found it dead. It consumes evidence and may nominate defects, and
until the product genuinely distinguishes *observation → admitted proposition → authority → governed
effect*, wiring it risks a live shortcut from `SUSPICION → "DEFECT" → WRITE`. That is the exact
inference this architecture exists to prevent.

## The research result, preserved separately from the implementation

Six hours of archaeology demonstrated that **test count is a terrible proxy for product maturity.**
Hundreds of passing tests surrounded mechanisms whose product reachability was zero. The tests were
not fake — they established their local propositions correctly. The error was entirely in the
inference drawn from them, and it is now two distinct gates rather than one.

---

# HOLD — recorded 2026-09-29, before 0A

**Nothing further is built until the active integration slice commits and releases its files.**
Written down because the failure mode here is a future session reading this manifest, feeling the
momentum, and starting 0A against a tree that is about to move.

## The line, explicitly

No new subsystem. No LegaScreen connection. **No identity reconciliation.** No production flag
activation. No generalized ADMIT design. No "while we're here" cleanup.

## Why row 7 must NOT be reconciled yet

Two implementations of identity is the shallow reading. They are potentially **two different
propositions**:

```
I_stamp(W)    = f(path, size, mtime)
I_revision(W) = sha256(content)
```

Not interchangeable. The same bytes copied elsewhere preserve `revisionOf` and change
`workspaceStamp`. A metadata change alters the stamp without touching content. Reconciling them now
would be choosing an answer before knowing whether the question is load-bearing — the disagreement is
**preregistered as a predicted composition failure**, and TEST-(-1) should be allowed to tell us
whether it ever becomes authority-bearing on the exercised path. If it doesn't, that is also a result.

## The env-fact trichotomy — the only three legitimate answers

`prepareGoverned` requires an execution worker and bound routes. There are exactly three honest
positions, and the fourth is the defect:

1. the ordinary launch already establishes those facts somehow;
2. PRODUCT-0 must **acquire or establish** them;
3. the ordinary launch **cannot** satisfy the governed contract — a finding, and a legitimate one.

**Not legitimate: asserting them because the test needs green.** That constructs
`ordinary Legasus ✗ special configuration → a perfectly functioning "production" test` and
congratulates us for proving something users cannot execute.

## How 0A gets designed, when it is time — backward, not forward

The temptation is to design generic production admission. That is **ontology design disguised as
plumbing**, and it is how a new policy enters under cover of a bridge.

Instead, derive it from the already-frozen TEST-(-1). Ask the bounded question:

> **What single proposition must be admitted for this one trivial edit to proceed?**

and trace backward from the contract that actually needs it:

```
GOVERN requires P
      ↑
AUTHORITY depends on P
      ↑
therefore ADMIT must establish P
      ↑
what observation can actually establish P?
```

That keeps 0A microscopic and stops it from becoming an ontology.

## 0A's own preregistered composition failure

**ADMIT may establish exactly the proposition its observation justifies. It does not authorize an
effect merely because a fact was admitted.**

So after 0A, behaviour must be **unchanged**. If connecting ADMIT alone suddenly allows a write, that
is an architectural collapse between epistemic and normative authority — and it would be an excellent
failure to find at the smallest possible scale rather than at 0C.

## The order, and why it is not negotiable

```
active slice commits and releases
        ↓
manifest updated FROM COMMITTED EVIDENCE   (not from a working tree, not from a message)
        ↓
smallest 0A required by the frozen TEST-(-1)
        ↓
three columns re-scored
        ↓
repeat
```

The first row to read `COMPONENT ESTABLISHED / PRODUCT LIVE / COMPOSITION ESTABLISHED` will be the
first mechanism in this project that has ever earned all three. None has today.
