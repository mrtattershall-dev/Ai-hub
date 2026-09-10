# 2026-09-10 — making the agent loop work on a small model

Raw logs from the day the hub stopped needing a frontier-size model. Kept because the
CONCLUSIONS were being committed while the MEASUREMENTS lived in Windows temp — 25 logs and
37 run workspaces that would have vanished on the next cleanup, leaving claims in COORD.md
with nothing behind them.

Every number below is `WORK ACTUALLY DONE` — did the file land on disk and run — scored
separately from run status. That distinction matters more than anything else here: `stopped`
routinely means "work finished correctly, model never said so", and completion rate alone
understates a small model badly.

## The headline

| config | work done | reached `done` | tool errors |
|---|---|---|---|
| 7B int4, baseline | 12/18 | 0-1/6 | — |
| 7B int4, + loop-break | 14/18 | 0/6 | 12 |
| 7B int4, **+ all fixes** | 12/18 | **0/18** | 6, 0, 0 |
| **14B int4, + all fixes** | **17/18** | **10/18** | 0, 1, 1 |

## There is a capability floor between 7B and 14B, and it is not subtle

The 7B was re-run with EVERY fix the 14B had. It scored 4/6 on all three passes - exactly
where it started this morning before any of today's work - and reached `done` **zero times
in 18 attempts**.

But its tool errors went 6 -> 0 -> 0. So the fixes DID work: the environmental failures are
gone, the marker guard fired once and held, the loop-break stopped the cascades. The hub is
no longer the bottleneck for the 7B. It simply cannot convert a clean environment into
finished work.

**The two causes are separable.** Hub bugs were costing the 14B its completions - remove
them and it goes 12/18 -> 17/18 with 10 completions. Remove the same bugs for the 7B and you
get cleaner failures at the same score with no completions at all.

Practical consequence: a local box should run ONE 14B, not several 7Bs. 14B int4 is ~9GB.

Six goal shapes × 3 passes: create, append, surgical edit, multi-site edit, python, docs.
`python` and `docs` had never passed once before the fixes; they now complete nearly always.

## What actually fixed it — three bugs, one disease

Every failure was the hub **detecting a problem precisely and then correcting it
destructively or not at all.**

1. **Advisory recovery does not work on small models.** Every recovery path in the hub was a
   sentence appended to a tool result. A nudge fired 24 times and the model repeated the
   identical failing call straight through it; tool errors went 0 → 8 and the change was
   reverted. Recovery must be MECHANICAL. Measured on the real stuck context, 5 samples:

       control (return the same result)         list_dir x5     productive 0/5
       advisory ("you already ran this")        read_file x4    productive 0/5
       MECHANICAL (substitute what it needed)   edit_file x5    productive 5/5

2. **The prompt contradicted itself on edit vs append.** The rules block said "to change an
   EXISTING file, prefer edit_file"; the tool doc said "to ADD new code use append_file".
   `append_file` exists BECAUSE edit_file FIND-misses were 81% of all wasted model calls —
   and the rules block kept steering back to the tool it replaced.

3. **The hub told the model to destroy its own workspace.** `edit_file` on package.json
   missed its FIND, and the error message said "or use write_file to replace the whole
   file" — so it did, turning the 8-line boundary marker into `{"type":"module"}`. Measured
   across four consecutive run workspaces: `type` was `module` in TWO of them, each
   internally consistent, which is why it stayed invisible for hours. A chunk of what looked
   like run-to-run model variance was the workspace silently changing module systems.

## Ruled out with data — do not re-run these

- **Sampling temperature.** Replayed the stuck context 5x per temp: 0.2 → repeated 4/5,
  0.7 → 4/5, 1.0 → 2/5. Raising temperature is not a fix and 1.0 costs code quality.
- **Context starvation.** Injected the full contents of the file the goal names into the
  opening message: 0/5 productive with AND without. Position matters — the same contents
  delivered as the NEWEST tool result scored 5/5. Recency beats volume.
- **Path separators.** Zero backslashes in any tool path across every run.

## GPU economics — price per token, never per hour

    7B bf16  / L4     11.5 tok/s  ~$0.80/hr  ~$19   per 1M output tokens
    30B      / H100    133 tok/s  ~$4/hr     ~$8    per 1M
    7B int4  / A10G   81.5 tok/s  ~$1.10/hr  ~$3.75 per 1M
    14B int4 / A10G   61.7 tok/s  ~$1.10/hr  ~$4.95 per 1M

The L4 was a false economy: cheapest per HOUR, ~2x the most expensive per TOKEN, because you
rent wall-clock while a bandwidth-starved card trickles. Decode is memory-bandwidth-bound —
predicted 6.8x from bandwidth × weight-bytes, measured 7.1x.

## Model identity is not observable from output

Three separate mechanisms served a BASE model under a fine-tune's name in one day: deploy-time
env never reaching the container (this server bakes config into the image), `enable_lora`
silently absent, and Git Bash rewriting `/adapters/run5` into `C:/Program Files/Git/adapters/
run5`. Every one produced a healthy endpoint returning plausible code.

`/api/health` now reports `lora`, and `shapes7b.mjs` hard-refuses (exit 2) when `EXPECT_LORA`
is set and the adapter is not loaded. Establish the instrument works before measuring with it.

## Files

| file | what it measures |
|---|---|
| `prove7b-20min.log`, `prove7b-index.jsonl` | first 7B window; the finish problem surfacing |
| `ab.log`, `ab2.log`, `nudge.log` | the advisory attempts — all failed, kept as the negative result |
| `fix2.log` | nothing-new nudge: WORSE (8 tool errors). Reverted. |
| `fix3.log`–`fix5.log` | mechanical loop-break, scoping the tool set (14/18) |
| `f14.log` | 14B base, loop-break only |
| `f15.log` | append-preferred — **invalid**, ran while the marker could still be destroyed |
| `f16.log` | 14B base, all fixes: **17/18 work, 10/18 done** |
| `f7b.log` | 7B, SAME fixes: 12/18 work, **0/18 done** — the capability floor |

## Caveats an honest reader needs

- **n=3 per config**, per-pass spread 2/6–6/6. Differences under ~3/18 are noise. Judge on
  tool-error counts, not completion counts alone.
- `f15.log` is retained but **must not be cited** — the workspace was mutating under the model.
- A guard refusal returns an `ERROR:` string, which made the best pass of the day report a
  tool error. If you add a guard that returns ERROR, check what your metrics do with it.

## 35-goal run — Qwen3-Coder-30B / H100 (`t35-coder3.log`)

    goals run           : 35
    status 'done'       : 32/35
    WORK ACTUALLY DONE  : 34/35
    tool errors         : 10
    total model calls   : 382
    wall clock          : 13.6 min

Sequential, not chained - a chained 35-goal run strands on the first `stopped` predecessor.
Covers create / append / surgical / multi-site / cross-file re-export / rename-with-call-sites
/ break-then-fix / docs-from-real-code / Phaser game with real assets.

**The single substantive failure is instructive.** `q4_time.py`'s `humanize()` is CORRECT.
The model then wrote seven self-checks, two of which contradict each other:

    assert humanize(120)  == "2m"       # agrees with the code
    assert humanize(3660) == "61m 0s"   # FAILS - contradicts the line above

It ran the file, saw the AssertionError, and finished anyway. The goal explicitly said
"plus asserts at the bottom. Run it with python", so verification WAS the deliverable - this
is a real miss, not a scoring artifact. Pattern worth remembering: **this model's
implementation is more reliable than its self-verification.** A green run only proves the
code and its author-written test agree; a red run does not prove the code is wrong.

**Scoring caveat, learned the hard way.** The harness marks any `.html` as `:ok` when the
file merely EXISTS. That let me call the Phaser game a stub and then call its docs
hallucinated - both WRONG. The logic was in `q10_game.js` (which is what the prompt tells the
model to do), the game had preload/create/update, arrow keys AND WASD, scoring, and
`assets/player.png` which resolves in the manifest. Verify the artifact, not the filename.

**The point of this run is what was NOT fixed.** 34/35 came out of a hub that still leaves
broken code on disk when its own syntax check flags it (10 workspaces), still discards every
action after the first (102 real responses hit it), still strands a chained queue on one
`stopped` goal, and still carries three latent parser path bugs. That score is a floor.
