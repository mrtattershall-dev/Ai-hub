# INTEGRATION-PLAN-1 — three tracks, inventoried before anything is changed

**Date:** 2026-10-05 · tatte's scope ruling: hub governance integration, the harness memory-injection
defect, and the memory-system follow-ons — all three, deliberately paced. **This document changes nothing.**
Every finding below is from reads of the live trees; decision points are marked for tatte.

---

## Track A — hub governance integration (CONSOLIDATION-1)

### What the inventory found

| | finding | evidence |
|---|---|---|
| A1 | **The hold's release condition appears met on disk.** The manifest holds "until the active integration slice commits and releases its files." `server/agent.js` is clean in both repos; its last consolidation commit is `710645dc` **CONT-2, 2026-10-01, tatte** — two days after the hold was written. No uncommitted *source* exists anywhere: consolidation's 72 dirty files are 70 `.git-cmsg-*` ledger artefacts and 2 `.md`. | `git status`, `git log -- server/agent.js` |
| A2 | **One peer Desktop session is busy right now.** Three are idle, one is busy; I cannot see which repo it is in. The hold exists precisely to avoid building against a tree about to move. | `ListAgents` |
| A3 | **The ordinary launch and the governance tree have diverged.** `start-hub.bat` `cd`s into `ai-coding-hub` and runs `npm start` there. That repo's `agent.js` is 4,766 lines (last change 09-12, 60 commits); consolidation's is 6,733 lines (10-01, 104 commits). The manifest's reachability column cites `agent.js:6054`, `:4535`, `:4821` — lines that do not exist in the file the ordinary launch executes. | `wc -l`, `sha256`, `git log` on both |
| A4 | **The coordination channel has fragmented.** 23 worktrees each carry a `COORD.md`; they have **nine different digests**. The "OPEN ASK … (3)" shown in all of them dates from ~2026-09-12 and concerns an `agent.js` split since committed. The file cannot function as the single ledger its header claims to be. | `md5sum */COORD.md` |
| A5 | `start-hub.bat` sets **no** environment variables. The governed path requires `AGENT_WORKER_EXEC` + `AGENT_BOUND_ROUTES` (`governance.js:84` → 409). Of the manifest's env-fact trichotomy, the ordinary launch is position 3 as it stands: *it cannot satisfy the governed contract*. | `start-hub.bat` lines 1–23 |

### What A3 means for TEST-(-1)

TEST-(-1) is frozen as *one ordinary user-started hub, one trivial edit, the path actually executed*. Run
honestly today it exercises `ai-coding-hub`'s `agent.js`, which predates most of the governance work. Two
readings, and the manifest's own rule picks the second:

- *rebase the ordinary launch onto consolidation first* — that is "merging the governance half for
  convenience", which the standing constraints forbid; or
- **run TEST-(-1) against the ordinary launch as it is**, and record what it finds. The predicted outcome is
  `NOT_EVALUATED` for every governance transition because the mechanisms are not present on the path. That is
  not a failed test; it is the manifest's "mechanism with tests but no production consumer" measured at the
  system level, and it is a legitimate result under the frozen definition.

**No change to the sealed predictions.** The seal is intact (`verifySeal.mjs` exit 0 throughout).

### Proposed sequence — nothing started

```
A-0  tatte confirms whether the hold's release condition is met              DECISION
      evidence: A1. counter-evidence: A2 (a busy peer). I have not messaged it.
A-1  manifest updated FROM COMMITTED EVIDENCE, per its own order             read-only re-score
      re-derive every reachability line ref against BOTH trees; record A3
A-2  TEST-(-1) run against the ordinary launch, as frozen, $0                 first real run
      expected NOT_EVALUATED on governance rows; seal verified before and after
A-3  smallest 0A derived backward from TEST-(-1)'s result                     only after A-2
      behaviour must be unchanged; the single admitted proposition named first
A-4  three columns re-scored                                                   after A-3
```

**Standing constraints preserved throughout:** nothing merged, `main` not moved, no worktree deleted, no
history rewritten, no identity reconciliation (row 7), no flag activation, no `AGENT_*` vars in
`start-hub.bat`, no paid compute.

**Decision for tatte:** A-0, and whether I may message the busy peer session to ask what it holds.

---

## Track B — the harness memory-injection defect

### Fully characterised; cannot be fixed from here

| | finding | evidence |
|---|---|---|
| B1 | Every in-session subagent — and the remote route as available — receives **exactly one file**: `MEMORY.md`. No topic files, no `CLAUDE.md`. Delivered under a system reminder headed "Codebase and user instructions." | scope probe, 8 items |
| B2 | The version delivered is **the snapshot captured at the parent session's start**, not the live file: it reads "SPECIFIED AND NOT STARTED", ~197 lines, ~150 entries; it lacks "FRESH-1", "Hierarchy DONE", "TWO HOPS NOW". | scope probe items 1–5 |
| B3 | The parent **conversation** is not inherited. Session-only facts (a commit hash, a control token, an R3c result) → "cannot know"; index canaries → answered. | reverse discriminator |
| B4 | The source is therefore the injection itself: `Stored ≠ Delivered` inside the tool. | B2 + B3 |

### Consequences and the design rule

- **No experiment in this setup may depend on subagent blindness to project memory** until a route passes
  `ISOLATION-PROBE.md` under the judges' own configuration. RETRIEVAL-1 stays blocked.
- Judge-based results so far: contaminated where a launch record shows it, **isolation unverified** otherwise
  (CONTAMINATION-1, narrowed).
- The defect is the harness's; the fix is not mine to make. What is mine: the reproduction is now
  documented to the item, and the gate exists.

**Untested inference, stated as such:** a judge launched from a *fresh* parent session would carry the
live hierarchical root — blind to the pre-hierarchy routing but not to the current one. Still no clean
PRE/POST.

**Open:** the bundled CLI in an isolated directory remains the only candidate route, blocked on
authentication only tatte can perform.

---

## Track C — memory-system follow-ons

| | item | measured | proposed action |
|---|---|---|---|
| C1 | **Stale prose in the root.** "Blocked on another session finishing the controller-to-governance crossing" — contradicted by CONT-2 (10-01) and a clean `agent.js`. FRESH-1's checker is numeric by design and **cannot see this**; it is the predicted gap, instantiated in the root itself. | root L27–29 | **fixed in this commit** — in-place, same line count, FRESH-1-compliant, worded to the evidence and not beyond it |
| C2 | 65 `## Index hook, verbatim` sections carry stale claims; all 65 have the identical heading. (The 66th grep hit is the root's own Rules text quoting the phrase.) | grep | relabel the heading to state status explicitly, e.g. *"Index hook as it stood on 2026-10-01 — historical, may be superseded; see Claim status"*. One mechanical pass, R1-safe (adds words, deletes none). **Not done — for a ruling.** |
| C3 | 43 of 164 topic titles assert a conclusion ("Authorization is not verification", "Hub detects but does not act"). Titles are routing text; FRESH-1 left them as names. | grep | leave. A title that names a lesson is routing by the lesson's name; the staleness risk is in *numbers*, which FRESH-1 removed. Revisit only if RETRIEVAL-1 shows a title misrouting. |
| C4 | Root headroom: 61/64 lines, 5958/6400 bytes. | `memoryCapacity` | leave. Three lines is deliberate slack for domains, not entries. |
| C5 | DELIVERY-1 has **one** real consumer (`memoryReachability.mjs`); the other four importers are its own tests and controls. | grep | the next genuine completeness-dependent consumer is the loader's own catalog/description reader, if one is ever built; nothing in this repo qualifies today. Leave until one exists. |
| C6 | R3a validated only by a contaminated judge. | CONTAMINATION-1 | subsumed by RETRIEVAL-1, blocked with it. |

---

## Cross-track finding

A3 and C1 are the same shape. The ordinary launch runs a tree the manifest no longer describes; the root
describes a hold whose condition has since been met. **Both are routing layers asserting a state that the
canonical evidence has moved past** — one in code (`start-hub.bat` → stale `agent.js`), one in prose. FRESH-1
fixed the numeric form of this in memory. The prose form and the code form remain, and neither has a
mechanical check.

---

## Addendum — A3 sharpened by a line-reference check, 2026-10-05

Each `agent.js` line the manifest's reachability column cites was checked in **both** trees, and the
mechanism symbols were counted:

| | hub (ordinary launch, 4,766 lines) | consolidation (6,733 lines) |
|---|---|---|
| `agent.js:4821`, `:5275`, `:6054` | **ABSENT** (file ends at 4,766) | present, as described |
| `agent.js:15`, `:4535`, `:4680` | line exists, **different content** | as described |
| `prepareGoverned` / `runAuthority` / `setRunAuthority` | **0 / 0 / 0** | 3 / 8 / 3 |
| `setRunWorkspace` / `emitHostEvent` / `revisionOf` | **0 / 0 / 0** | 1 / 3 / 2 |
| `server/governance.js` (the 409 at line 84) | **file does not exist** | exists |
| `workspaceStamp` | 3 | 5 |

**So the correct reachability column for the user path is not FLAG-DEAD or TEST-ONLY. It is ABSENT**, for
every governance mechanism except `workspaceStamp` and the finish gate. The manifest describes the
consolidation tree; the product the user starts is a different program. Nothing in the manifest is *wrong*
about consolidation — it is scoped to a tree that `start-hub.bat` never runs.

**This revises the predicted TEST-(-1) outcome.** Not `NOT_EVALUATED` because mechanisms are present but
unexercised — rather, every governance transition is **unreachable on the exercised path because the code is
not there**. World 5 (the positive control) would still run and bytes would still change — through the
ungoverned editor. Worlds 1–4 would have no layer to refuse at. Under the frozen recording rules that is a
run with a clear result: *the governance path a user's run actually takes does not exist yet*. The seal is
untouched; this is an outside observation about the trees, not a change to the predictions.

**Consequence for A-1.** Re-scoring the manifest from committed evidence must now carry **two reachability
columns, one per tree**, or it keeps describing a program users do not launch.

**Two more rows, same direction.** The hub tree *contains* a `legasus/` directory but `server/` imports from
it **0** times (consolidation: 42) — the research corpus is present in the user-launched tree and uncalled,
which is `representation-is-not-the-property` at the repository level. And the client differs: `AgentPage.jsx`
is 712 lines in the hub, 746 in consolidation; the manifest's `:341` is `try {` in one and `let governed =
null;` in the other. The divergence is not confined to `agent.js`.

---

## Track C addendum — a live drift event, 2026-10-05

| | finding |
|---|---|
| C1 (done) | root prose refreshed; snapshots bracket it; diff shows `MEMORY.md` only |
| **drift event** | `index-working-discipline.md` gained `monitor-every-terminal-state` (session `d0547f16`, 2026-10-04 16:06Z — the LIVE-TEXT-1 / PARSE-GATE-1 session). The root said 19, the file had 20. The count-drift check **fired and bound** (exit 1); root updated under exception E1; snapshots bracket it; reachability 164 → 165, 0 orphans |
| **my reading error** | the drift existed when I ran `memoryCapacity` at 03:46, but my `grep … \| head -3` let the `FREEZE  lines <=` line match `lines ` and displace the `STALE COUNTS` line. The detector was right; I truncated its output. Same class as the `--list` 90-char cut that hid a topic id during FRESH-1 — **a verifier's output must not be trimmed before it is read** |
| **C7 — new gap** | each domain index's own `description` also carries the count: *"Domain index (19 entries): …"* — still 19 after the file reached 20. The drift check reads **only the root's** counts. So the count lives in **two** routing places and only one is checked. `freshCheck` passes because a bare "19" is not a measurement token. Options: (a) extend the drift check to domain descriptions, or (b) drop the count from the 11 descriptions — *facts once* — leaving the root as the single checked copy. **(b) is FRESH-1-consistent; not done, for a ruling** |

---

## Track A status, 2026-10-05 (later)

```
A-0  CONFIRMED by tatte - hold's release condition met
A-1  DONE, read-only - A1_RESCORE.md: two reachability columns; governance ABSENT on the launched tree;
     flags set by ten experiment launchers, by nothing on the ordinary launch
A-2  RUN 2026-10-05, $0, tatte's go - A2_RESULT.md. Ordinary launch, no env; one goal; run 31ccad68
     status error after exactly one model call (404 modal-http: invalid function call), 8.7 s; TASKS.md
     byte-identical; worlds 1-5 all NOT_EVALUATED; sealed predictions MISS x5 (not instantiated) with one
     UNANTICIPATED event: the hub wrote ESCALATIONS.md into the user's workspace on the failed run.
     Seal verified exit 0 before and after. Composition still UNESTABLISHED, now: path ends before PROPOSE.
A-3  PREPARED, FROZEN, NOT RUN - A3_DEFINITION.md + server/a3Run.mjs + server/settledState.mjs. Direction
     (tatte, relaying, 2026-10-05): local Ollama, configured integration test on the consolidation tree, A-2
     preserved as the ordinary-launch baseline, ESCALATIONS.md writer traced (ESCALATION-WRITE-TRACE.md),
     settled-state defined; no paid deployment. Amendments 1-2 recorded (scoring controls; supervision is
     off by scratch settings, not by the env flag). Review cleared 2026-10-05: no preparation blocker. Runs on
     tatte's go. KEPT SEPARATE from the LIVE-2 watchdog repair (another question, another record).
     RUN 2026-10-05 on tatte's go - A3_RESULT.md: items 1-3 ESTABLISHED on candidate-0 (retain / refuse out-of-
     scope / restore, controls met); item 4 unestablished at both boundaries (missing check == failing
     check); item 5 FAILS on every run - four hub writers inside the governed workspace, incl. host
     py_compile after finish and ESCALATIONS.md after settlement. M0 (1.5B): PRESERVE_INCOMPLETE, correct.
A-4  DONE as reconciliation, 2026-10-05 - A4_RECONCILIATION.md: 13 hub writers classified (one governed class,
     one authorized restore, the rest unauthorized and unrecorded; two MODEL tools bypass governWrite);
     terminal boundary ruled on paper; evaluator infrastructure failure EXERCISED at both boundaries (E1
     409 WorkerUnavailable, E2 EVALUATION_ERROR -> HELD); row 7 adjudicated on content: schemes agree at
     start, no git tree names the judged subject at conclusion; two cid1 modules on candidate-0.
     NO CODE CHANGED. Next: owner's ruling on the item-1/2 proposals, then the milestone run (scripted).
A-5  DONE as record + two measurements, 2026-10-06 - A5_RULING.md. Ruling RECORDED as recommended, not issued.
     Tightening 1: effectAccounting.mjs - complete pre-vs-post against authorized effects, applied to all 7
     recorded runs; only the RESTORED case accounts for everything, and only because nothing survived.
     Tightening 2: continuation after HELD is NOT blocked - the held tree is committed as the next run's
     verified baseline, 5/5 against a pre-written prediction. Identity canon = cid1.mjs; the two schemes
     share one equivalence relation (A-4's hazard wording corrected). Repair pass R1-R8 specified, NOT
     applied: ruling not issued AND every target file is under another session's active COORD claim.
     -> A-6: ruling ISSUED and the pass EXECUTED on repair-r1-r8 @ 45d866df + F1-F4; reviewed A7_REVIEW-RESULT.md: all
        retained checks pass. NOT merged; landing = holders (LANDING-PROPOSAL-1.md). This A-5 line is history.
A-6  DONE 2026-10-06, ruling ISSUED (Micheal via tatte) - A6_REPAIR-PASS_RESULT.md. R1-R8 on worktree
     ../ai-coding-hub-repair branch repair-r1-r8 @ 9f66ef07 (from 456156e7; no claimed file touched; FUZZ-3
     untouched). Regression 16 suites green. Milestone AFTER: P0 ACCOUNTED with the improvement surviving; P1/P2/
     P4/E2 ACCOUNTED; 0 post-terminal target mutations; HELD -> next start REFUSED unless owner reconciliation,
     recorded, predecessor receipt unchanged; judged subject differs from HEAD^{tree} by the model's edit only.
     NOT merged, NOT pushed. Review follow-ups DONE (A6 Amendment 1): restoredTo on the receipt and equal to the
     pre-model start subject; reconciliation requires the owner's verified hub token (measured both ways); a
     refused start leaves the target unchanged incl. .git; /workspace/TASKS.md + ESCALATIONS.md served from
     META_DIR so the client needs no edit. NEXT: coordinated landing prep; FUZZ-3 on its own branch, untouched.
A-7  DEFINED 2026-10-06, NOT RUN - A7_NEXT-MILESTONE_DEFINITION.md, from the integration research assessment
     (memo cited, not on this machine). M1: the A-6 contract through start-hub.bat + owner interface incl.
     RECOVERY (predicted MISS: R8's predecessor check is memory-only across a restart). M2: integrated hub vs an
     Agentless-shaped baseline, same model + budget, refusals and damage reported separately. BLOCKED on three
     owner decisions: which tree the launcher runs (+ landing), which model answers (+ cap), owner token.
A-8  DONE 2026-10-06 - A8_PRODUCT-PATH_RESULT.md. Integration owner 784f5dee on ai-coding-hub-product1 branch product-
     path-1 @ b81231b5 (9 separate commits: launcher, repairs 1-3, defects 4-7, gitignore). Demo-W attempt 2 (frozen
     DEMO-W_DEFINITION.md, re-frozen after attempt 1 found defect 7): 11/11 PASS through start-hub-governed.bat, the
     browser UI, the owner token, a real restart and a worker outage; env unchanged. UNCOVERED: page-load ledger 401
     race; governedRun 127 unexplained; scripted proposals only. NEXT: 29f669 review, then landing (holders).
```

**A-2 update:** the configured Modal `coder14b` endpoint is **not deployed** (only `coder7b-a10` is). The
ordinary launch cannot complete an edit today as configured — a precondition finding, recorded in
`A2_DESIGN.md`, not repaired. Option (a) is now $0; the spend decision dissolves; the go/no-go is about
starting a server and browser on this machine.

---

## Launch-path checklist, 2026-10-06 06:45 (read-only preparation, tatte instruction)

`LAUNCH-PATH-CHECKLIST.md`: what landing the repaired governance (`repair-r1-r8 @ 9f66ef07`) in the program
`start-hub.bat` actually runs requires. It covers the exact commit (9f66ef07 alone is not landable: tracked repairs 1-3 are
outside R1-R8), flags and Docker checks, the client `/meta` switch, the local endpoint for a $0 demonstration, a reversible
launcher, acceptance checks L1-L10 and ordering. **The hold stays.** Next decision **D1: which session owns the landing.**
