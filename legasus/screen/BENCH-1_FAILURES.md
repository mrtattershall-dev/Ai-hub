# BENCH-1 — the 13 external failures, by first evidenced obstacle

No model calls. Classified from the run records (what the model did), the terminal workspaces
(what it left), and a re-run of the frozen checks on those workspaces (why they still fail).
`server/benchClassify.mjs`, confirmed across the group by `server/benchStall.mjs`.

## Tally

    10   NO_EDIT_ATTEMPTED      no write ever targeted the file
     1   EDIT_BLOCKED           one edit, REPLACE identical to FIND -> no-op; then looped
     1   EDIT_WRONG             an edit landed, left the file unparseable; caught and restored
     1   BUDGET_EXHAUSTED       300s limit, target unchanged
     0   EVAL_OR_INTERPRETATION
     0   UNCERTAIN              two were uncertain on the first pass; both resolved from steps

## The ten: one mechanism, evidenced in every case

The sequence is the same every time:

1. The model's own plan schedules **"outline the file, then read it."**
2. `outline_file` on a ~30-line single-function file returns **one line**:
   `[pascal.py — 34 lines, 1 declarations] 2: def pascal(n):`
3. The next reply is **byte-identical** to the previous one — same THOUGHT, same
   `ACTION: outline_file`. It never advances to the read its own plan called for.
4. The hub's repeat guard warns *"You already ran this exact outline_file"*; the model ignores
   it; after three identical replies the run is stopped.

**Nine of the ten never executed `read_file`.** The tenth (`next_palindrome`) did read the file —
and then repeated the **read** verbatim until the guard stopped it: the same loop, one step
later. So the invariant across all ten is not "never read" but **"never advanced past a
read-only tool to an edit."** The two successes (`flatten`, `gcd`) both went
`outline → read → … → edit → test`.

Verified by `benchStall.mjs` before this was committed — and the first draft of this file said
"not one of the ten ever read", which the check contradicted:

    read_file executed              1 / 10
    guard warned "already ran"     10 / 10
    stopped by the repeat guard    10 / 10
    byte-identical consecutive     10 / 10
      replies (from transcripts)

The identical-replies figure first came back **0/10** from a parser that read the wrong field
of the transcript (`role`/`content`; the model's text is under `reply`). A check that returns
zero for everything looks like a finding. It was a bug in the check.

This is the obstacle described at the start of this project: *"repeatedly requesting an outline
despite already having the contents."* It is now measured — 10 of 15 external tasks stalled on a
read-only tool with verbatim-repeated replies — and it precedes any question of coding ability,
because no code was ever attempted.

## The other three

- **`find_in_sorted` — EDIT_BLOCKED.** One `edit_file` whose REPLACE equalled its FIND: a no-op.
  Then six `run_python` calls with the **filename passed as the code** (`find_in_sorted.py` →
  SyntaxError), until the repeat guard stopped it. A tool-interface misuse, after a malformed edit.
- **`kth` — EDIT_WRONG.** An edit landed (+2 lines) and left the file unparseable; a second edit's
  FIND was not found; two identical re-reads; stopped. The unparseable candidate failed protected
  behaviour and was **captured and restored** — the one regression the acceptance policy caught.
- **`get_factors` — BUDGET_EXHAUSTED.** 2 tool calls in 300s, target unchanged. The record shows
  the limit, not what consumed it; kept as budget, with the note that it may also be a stall.

## What this points at, and what it does not settle

The measured system is model + prompts + tool interface + guards + limits + evaluator adapter.
The evidence localises the dominant failure to the **loop's behaviour after an uninformative tool
result**: a one-line outline, followed by verbatim repetition. That is consistent with several
causes — the model, the prompt architecture, the outline tool's output shape, the repeat guard's
message not registering — and this classification does not distinguish among them.

It **does** rule some things out for these ten: not the evaluator (no candidate was ever
produced to evaluate), not the adapter (same reason), not the budget (all ten stopped early on
repetition, well inside 300s), and not coding ability in any direct sense (no code was written).

## Candidate next steps, ranked by what the evidence supports — not by preference

1. **Test the stall directly, scripted, no GPU.** Feed the exact one-line outline result and
   confirm the model re-emits its previous turn; then vary one thing at a time (the outline's
   output shape; whether the guard's warning is in the prompt; the plan text). Cheap, decisive.
2. **Only then** decide between changing the execution workflow and testing a stronger model.
   Ten stalls before any edit is a workflow signal; whether a larger model stalls the same way
   is a separate, paid question.

A note recorded rather than claimed: the PROTOCOL controller's OBSERVE phase admits `read_file`
and refuses `outline_file` — in PROTOCOL-1 it refused `outline_file` three times. Whether that
would have moved these ten past step 2 is a **hypothesis the existing records cannot test**. It
is listed so it is not quietly rediscovered later, not as a recommendation to redesign the
controller.

## Operational corrections carried from the result

- Reporting was **automatic, then corrected**: `BLOCKED` false-alarmed the integrity check.
  Every emitted status now has a reporting contract, enumerated from the source and tested in
  both directions (`statusContract.test.mjs`, 29/29).
- The GPU app is confirmed **`stopped`, Tasks 0** — not `stopping...`. Cost remains
  **estimated** (~17 GPU minutes, under $1 at the A10G rate) until reconciled against billing.
