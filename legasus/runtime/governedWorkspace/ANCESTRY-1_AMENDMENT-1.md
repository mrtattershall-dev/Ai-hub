# ANCESTRY-1 — AMENDMENT 1: the controller is routed, and one real chain is exercised

**Written 2026-09-29 after CHAIN-1 passed.** The ANCESTRY-1 prereg stated, as its first limitation,
that *nothing routes through this layer*. That limitation is now partly retired, and the exact extent
matters more than the fact.

## What changed in the controller

`server/agent.js` `governWrite()` gains one branch: when a governed workspace is installed, the write
is routed through `prepare()` / `commit()` instead of calling `governedEdit` directly. The executor is
still the only route to an effect — `commit()` calls `governedEdit`, which resolves the target once and
writes to the same resolved path it authorized against. **This adds a gate; it does not add a way to
write.**

Three holders now live beside `runAuthority`, set by the governing layer and **never read from tool
arguments**:

| holder | why it cannot be model-supplied |
|---|---|
| `runWorkspace` | a workspace the model chose could be rooted at a tree the receipts do not describe |
| `runAncestry` | a model declaring `assumedReceipts: []` **erases a condition** on its permission rather than widening a grant — worse, because it leaves no refusal to notice |
| `runValidator` | a check chosen by the party being checked is not a check |

## The claim CHAIN-1 establishes, and its exact boundary

> **Through the real agent tool dispatch, with the governed workspace installed, a write whose declared
> ancestry contains a defunct promotion receipt is REFUSED `PACKET_STALE_ANCESTRY` before the bytes
> change — and the same write with an intact ancestry promotes.**

Five tests, driven through `tools[name](args)` in a child process because `AGENT_WORKSPACE` and
`AGENT_GOVERNED_WRITES` both bind at import time:

| | |
|---|---|
| **CHAIN-1** | A promotes; A is superseded; B assuming A is refused, `b.js` bytes never change |
| **CHAIN-CONTROL** | the same B with an intact ancestry promotes — without it, CHAIN-1 could be a layer that refuses every descendant, or a controller that cannot write through the layer at all |
| **CHAIN-FORGED** | `assumedReceipts: []` and `authority: 'OWNER'` passed in tool args are ignored |
| **CHAIN-A4** | with no workspace installed, the A-4 direct-executor path is unchanged — the gate is additive |
| **CHAIN-ROOT** | a workspace rooted at another tree is refused: a receipt about the wrong tree is well-formed and false, which is worse than none |

## Falsifiability of the routing claim itself

Mutants applied to `agent.js`, not to the layer:

| mutant | result |
|---|---|
| **M5** `assumedReceipts: runAncestry` → `[]` | CHAIN-1 and CHAIN-FORGED fail, as predicted |
| **M6** `if (runWorkspace)` → `if (false)` | CHAIN-1, CHAIN-CONTROL, CHAIN-FORGED, CHAIN-ROOT fail |
| **M7** a hole added that reads `args.assumedReceipts` | **SURVIVES, as predicted** — no call site forwards `args` to `governWrite`, so the forgery is structurally unreachable rather than merely unread |

`agent.js` restored byte-identical afterwards (`7b370602…`, 405430 bytes), verified by digest.

## The default path, differentially checked against its actual parent revision

Baseline: `server/agent.js` at `5d3b2a2a` (404378 bytes) — byte-identical to the parent of this change,
confirmed because the two commits between are `COORD.md` only and touch nothing in `server/`.

**Protocol.** 152 files. Discovery pass at a 45s cap, concurrency 3, to identify anomalies cheaply — a
`PASS` there needs no baseline run. The 45 anomalies (10 FAIL, 35 TIMEOUT) then re-run **paired in
time**, treatment immediately followed by baseline, at a 120s cap. Paired because this laptop's timings
vary up to ~3x between runs and two separate sequential arms would let machine load decide a TIMEOUT
boundary. 45s was a DISCOVERY threshold; 120s is the verdict threshold.

| verdict | n |
|---|---|
| `PREEXISTING_TIMEOUT` — times out in both arms | 24 |
| `PREEXISTING` — fails identically in both arms | 13 |
| `CLEAN` — passes in both at the verdict cap | 8 |
| **`CANDIDATE_REGRESSION`** | **0** |
| **`AMBIGUOUS`** | **0** |

> **On the named `agent.js` candidate, CHAIN-1 introduced no observed regression across the classified
> 152-file population under this paired 120s protocol.**

NOT "all 152 passed". The population is CLASSIFIED: some pass, 24 time out in both arms, 13 fail in both
arms. The result is zero candidate regression and zero unresolved ambiguity.

A single `TREATMENT_BETTER` (`visualBaseline`) was resolved rather than filed: baseline passes **3/3** on
replication and failed only under concurrency 2, a render test losing a race. Not credited to CHAIN-1.

This protocol REPLACES the earlier "60 files / six failures" figure, which is withdrawn: its population
was never defined and cannot be shown to be this one.

### The instrument was wrong first, and the correction is the transferable part

The first attempt was **confounded**. A fresh `git worktree` lacks gitignored state: `server/node_modules`
(113M) and `external-linter/node_modules` (14M) were absent, so the baseline hub could not boot and
produced `ERR_MODULE_NOT_FOUND`. The classifier dutifully labelled those `AMBIGUOUS` and
`TREATMENT_BETTER`. It was caught because a 0.6s failure is too fast to be real — **not** because any
check flagged it.

Fixed by junctioning the dependency trees, COPYING the mutable runtime state so the arms cannot write
over each other, and adding an **equivalence control**: 6 treatment-passing files, including the 4
slowest, re-run in baseline — 6/6 PASS.

> **Without equivalence controls a differential cannot reliably attribute either a treatment loss or a
> treatment win.** In this instance the asymmetry surfaced as baseline-only boot failures, which made
> the treatment look BETTER; the same defect reversed would have manufactured a regression. A
> differential lacking this control can only ever exonerate the treatment.

## Still not established

- **The live hub does not do this.** `AGENT_GOVERNED_WRITES` remains off by default and **no production
  path sets it or installs a workspace.** Governance is demonstrated under a flag while the default path
  stays ungoverned. That is a limitation, not a claim.
- **The chain is DRIVEN, not discovered.** The harness decides that B assumes A. Nothing infers
  ancestry from what an agent read, and nothing proposes candidates on its own.
- **No scheduler, no queue, no automatic retry, no re-generation.** A stale descendant is refused and
  stops there; a human or a caller must reissue it.
- **One chain of depth one, through `write_file` only.** `edit_file` and `append_file` route through the
  same `governWrite` and are therefore wired, but CHAIN-1 does not exercise them; deeper chains are
  covered only by the in-isolation `AN-TRANSITIVE`.
- **`mkdirSync` BEFORE THE GATE FALSIFIES ANY GENERAL NO-EFFECT CLAIM, and this is not a footnote.**
  `agent.js:1091` runs `mkdirSync(dirname(full), { recursive: true })` at the top of `write_file`; the
  gate is ~90 lines later. So **"a refused write causes no effect" is FALSE if directories count as
  effects** — a refusal can still create directory entries and their metadata.

  CHAIN-1's claim is therefore scoped to the **exercised `write_file` CONTENT path**: the target file's
  bytes do not change. Its fixtures write into an already-existing `src/`, so no directory was created
  during the refusals it observed — which means CHAIN-1 neither establishes nor refutes directory
  containment; it simply never exercised it.

  **Before any no-effect refusal claim is made, it must assert directory bytes and metadata**, not only
  file content. Until then the honest form is "no content effect on the target", never "no effect".

## Composition status

Component evidence is NOT inherited as evidence of system composition. The assembled claim is one edge:

    PROPOSE -> GOVERN -> EFFECT -> VERIFY -> RECEIPT          exercised together (CHAIN-1)
    OBSERVE -> ADMIT -> DECIDE                                composition with the above UNESTABLISHED
    PRESERVE -> PERSIST -> RESTART -> CONTINUE                composition with the above UNESTABLISHED

266/266 and 5/5 are COMPONENT counts. They are not a system claim and must not be cited as one.

## Debt this result does not discharge

- **`acceptance` non-vacuity.** It times out in both arms at 120s, so it is not attributable here. But in
  a longer unpaired run against treatment its two POSITIVE CONTROLS failed with `EVALUATION_ERROR` — the
  controls whose own comment reads *"A policy that rejected everything would pass the t5 case and destroy
  these two."* That is evidence against Legasus even though it is not evidence against CHAIN-1.
  **It does not block this commit. It DOES block any later claim that treats `acceptance` as trustworthy
  verification, until a baseline run reproduces those errors and classifies them.**
- **Governance refusal propagation beyond the tool boundary: UNESTABLISHED.** `governWrite` returns a
  STRING on refusal and the tool hands it to the model. Whether the controller upstream distinguishes
  `REFUSED by governance` from ordinary tool output is tested nowhere. TEST-(-1) will exercise it; no
  bespoke expedition for it now.
- **The receipt contract is UNVERSIONED.** `receiptDefunct` returns `ABSENT` for an unknown digest, which
  is refusal-on-unknown for a missing ANCESTOR — but there is no field by which a consumer can detect it
  is reading a contract revision it does not understand, so missing fields read as absent facts rather
  than as unreadable ones. Recorded after reading in-toto from source: `in_toto_run(..., material_list,
  product_list, ...)` lets the CALLER declare which artifacts are recorded, `verify_match_rule` compares
  hashes read out of link metadata rather than re-hashing artifacts, and `_type` is a discriminator, not
  a version. So a versioned extend-or-refuse contract is the part the precedent LACKS, not a design to
  copy.
- 24 files time out at 120s in both arms: heavy-test condition, unresolved.

## Still not established (continued)
- Child-process writes, symlinks, Windows junctions, concurrency beyond in-process interleaving:
  unchanged and still ungoverned. E4–E9 still not built.
