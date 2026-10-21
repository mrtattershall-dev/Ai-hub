# FUZZ-3 interim — the ten baseline-BROKEN seeds reached so far, traced

**Date:** 2026-10-06 · FUZZ-3 (candidate-0 @ 456156e7, PID 17900) continued UNCHANGED throughout.
Baseline: fuzz2 campaign 2026-10-01, c952cbc9 (`~/Downloads/fuzz2-snapshot-2026-10-06`). Descriptive, pending
the full 41-case comparison.

## Evidence classes — what each row stands on

| seeds | old side | new side |
|---|---|---|
| 6 persisting (500021/33/34/67/85/88) | ORIGINAL evidence (workspace, runs, traces) | ORIGINAL evidence — the campaign kept it, they were non-clean |
| 4 gone (500042/60/66/69) | ORIGINAL evidence | **REPLAY**. The campaign keeps workspaces only for non-clean iterations, so the originals' bytes were never saved. Each seed was re-run once on candidate-0 through a *copy* of the harness (`server/fuzzLoopKeep.mjs`: one line, `interesting = true`); FUZZ-3's own files untouched. **Every replay reproduced its campaign iteration exactly** — same served-reply index sequence (64 / 90 / 90 / 90), same actions, same tool results, same per-goal statuses. Evidence: `~/Downloads/fuzz3-replay-gone4/` |

Pairing note: within each pair the served-reply sequence is identical up to the shorter run's length, so a
divergence is always the HUB doing something different with the same model output, never different output.

## The four "gone" seeds

| seed | class | first divergence | tool result there | final bytes of the formerly broken file | requested work |
|---|---|---|---|---|---|
| **500060** hostile | **Broken write attempted and refused** | goal 2, `append_file q3_list.js` — the only difference in the whole iteration | old `OK: appended 150 bytes (now 1008)`; new `ERROR: this append_file would have DUPLICATED 2 definition(s) q3_list.js already has: zip (1 -> 2), range (1 -> 2). q3_list.js is UNCHANGED` | new = sha256 `f1c5989c…` = **byte-identical to the baseline's last-good version**; parses. Old `c1e0ff79…`, 1,008 B, `Unexpected token '}'` | **identical**: all 6 goals `stopped` (step budget) in both. Clean did not come from doing less |
| **500069** hostile | **Broken write attempted and refused** | goal 5, `append_file q3_list.js` — the only difference | same duplicate-definition refusal (zip, range); old `OK … now 1008 bytes` | new `f1c5989c…` = last-good, parses; old 1,008 B broken | **identical**: all 6 `stopped` in both |
| **500042** normal | **Broken bytes landed and were restored** | goal 0, `append_file p1_calc.js` → new `ERROR: … would have DUPLICATED 1 definition(s): mul (1 -> 2)`; old OK. From there the reply stream lands in different goals (new served 64 vs 53) | the **same damaging 69-byte append** (`sub: function…` after `module.exports`) was later issued and **landed OK in both** — old in goal 4, new in goal 2 (`now 341 bytes` in both). New: `p1_calc.js did not parse at the end of the run — restored the version this run committed at eb0d1e2`. Old: `does not parse and no version this run produced parses either, so it was left as the run left it` | new `708e300d…` = **byte-identical to the baseline's last-good**; parses. Old `26f44883…`, 341 B, `Function statements require a function name` | **not more work**. Old: 6/6 `done` — but goals 4–5 "done" over an unparseable file. New: `done, done, stopped (rolled back), done, done ("No work landed — not finished"), stopped`. The restore succeeded because, on the diverged path, the bad append landed in a run that had itself committed a parsing version; the restore rule is unchanged (it reaches only versions the same run committed) |
| **500066** hostile | **Write avoided because execution diverged** | goal 1 ("Add sub(a,b) to the EXISTING p1_calc.js"): old `done` after **1 model call and zero file actions**; new refused that finish — `No work landed in this run — not finished.` — and continued to the 14-call budget | the 150-byte `append_file q3_list.js` that broke the old run (old goal 5) is **never issued** on candidate-0; q3_list.js is written once (289 B) and never touched again | new `083924b3…` = baseline last-good, parses; old 440 B broken | **neither completed the goal**. Old goal 1 was a *false completion* (done, nothing written); new correctly says not finished. The clean workspace is a side effect of the reply stream shifting by 13 calls — **not protection** |

### What the "gone" four establish

- **Refused (2):** the candidate-0 **duplicate-definition guard on `append_file`** (the append-preservation
  repair) refused a write the old code let land. The parse break was a *consequence* of the duplicated
  definitions; the guard refused for duplication, not for syntax.
- **Restored (1):** the same damaging bytes landed on both versions. Candidate-0's end-of-run restore recovered
  the file because the divergence happened to put the write where a same-run parsing version existed.
- **Diverged (1):** clean by not doing the thing. The finish gate's refusal of a false completion is a real
  behavioural change, but it is not what kept the file intact.
- **Insufficiently observed:** none. All four replays reproduced exactly.

## The six persisting seeds — the mechanism, now checked rather than assumed

Checks per seed: served-reply sequence, actions, tool-result text for every write on the broken file, and the
final bytes of every `.js` file.

| seed | damaging write (identical in old and new) | candidate-0 interception | final bytes old vs new |
|---|---|---|---|
| 500021 | goal 3 `append_file p1_calc.js` — `OK: appended 69 bytes (now 236)` | none: identical args, identical result text | **sha256 identical** `dabf3ff0…` |
| 500033 | goal 2 `edit_file p1_calc.js` — `OK: edited; now 20 lines (+5)` | none on the damaging step | identical `8ff5138e…` |
| 500034 | goal 2 `edit_file p1_calc.js` — `OK … (+5)` | none on the damaging step | identical `11009ed3…` |
| 500067 | goal 5 `edit_file p1_calc.js` — `OK … (+5)` | none on the damaging step | identical `8ff5138e…` |
| 500085 | goal 5 `edit_file q3_list.js` — `OK: edited; now 14 lines` | none | identical `42fb2d42…` (the iteration also has a p1_calc.js difference, see below) |
| 500088 | goal 5 `append_file s1_stack.js` — `OK: appended 37 bytes (now 904)` | none | identical `31a204fc…` |

Result-text differences old vs new occur in 500033/34/67, and **only** in the wording of `write_file … would
have REMOVED` refusals that **both** versions issued. The damaging write's result is identical everywhere.

So for these six: **identical damaging output, landed identically, not intercepted.** After each one, both versions
decline restoration with the same rule: *"no version this run produced parses either, so it was left as the run
left it rather than reaching back past this goal"*. The damage arrives before the run has committed any
parsing version, so there is nothing the restore will reach.

500085 also differs in p1_calc.js (`c95f9bdf…` old, `28ea9130…` new): the baseline flagged an ES-module load
warning there, and candidate-0 restored it mid-iteration (`p1_calc.js did not parse at the end of the run —
restored`). The iteration is still BROKEN on q3_list.js. Not counted as either a repair or a regression here.

## Correction (2026-10-06, after the step-by-step trace in PG-TEST-1)

The table above names the damaging write correctly per seed, but the summary sentence I gave in chat ("a write in
500034") was wrong — it came from a truncated listing. Measured from the hub's own per-step snapshots: the first
broken state came from **edit_file in 4** (500033/34/67/85) and **append_file in 2** (500021/88); **write_file in 0**.
500034's two write_file calls both produced parsing files. Finding 2 below should read "edit_file and non-duplicating
append_file have no write-time parse refusal" — detection existed (per-write syntax note, verify_project, end-of-run
check); refusal at write time is what parse-gate-1 adds. See `ai-coding-hub-pgtest/PG-TEST-1_RESULT.md`.

## Two mechanism findings, kept narrow

1. **The append duplicate guard is doing measurable work on this corpus** (2 of 10 refused outright, and it
   started the divergence in a third). It does not check syntax: the 69-byte and 37-byte appends that broke files
   without duplicating anything landed on candidate-0 as on c952cbc9.
2. **`edit_file` and non-duplicating `append_file` have no parse check, and the end-of-run restore cannot reach
   past the start of the run that broke the file.** That pair is the entire mechanism in all six persisting
   cases. It is a candidate repair target, recorded here and not acted on.

Interim tally (132 paired iterations): 6 persisting / 2 refused / 1 restored / 1 diverged / 0 newly broken. Only
the 2 refused cases and the 1 restored case are protection. The diverged case must not be counted as one.
