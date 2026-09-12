# Set H result — the hub fixes change the work, not just the reporting

Four arms, one variable: the hub. Same 100 goals (`goals-H.json`, sha `1f29e971e72f9461`), same checker
(`checks-H.mjs`, sha `ea0d8b53535313ef`), same models, same caps, fresh workspace each. Verified **by hash**, because
the arm logs name the wrong commit (see "Provenance" below).

| arm | model | hub | attempted | **score** | duplicated-def files |
|---|---|---|---|---|---|
| `coder14b-sethctl` | 14B | control (unpatched) | 50 | **2/100** | 10 |
| `coder14b-sethfix` | 14B | **treatment** (`eaa70c1`) | 52 | **7/100** | 2 |
| `coder30b-sethctl` | 30B | control (unpatched) | 59 | **30/100** | 0 |
| `coder30b-sethfix` | 30B | **treatment** (`eaa70c1`) | 54 | **39/100** | 0 |

## The measured noise, which is what makes the rest readable

Each control is a replication of set G on a byte-identical hub, so the pair gives this rig its **first run-to-run
spread**:

    14B : set G  4/100 at 58 attempted  ->  set H  2/100 at 50 attempted    spread 2 points,  8 goals
    30B : set G 29/100 at 78 attempted  ->  set H 30/100 at 59 attempted    spread 1 point,  19 goals

**Score is reproducible; throughput is not.** The 30B moved one point across two identical runs while attempting 19
fewer goals. So score comparisons carry weight and goals-attempted comparisons mostly cannot.

## Against that noise

- **14B: 2 → 7 (+5)** against a measured score spread of 2 — outside the noise.
- **30B: 30 → 39 (+9)** against a measured score spread of 1 — outside the noise.

This is the first evidence that the fixes change the work on disk rather than how runs report themselves.

**Composition matters, and it cuts differently for each arm.** The 30B gained across four projects (s1 1→5, s5 0→4,
s8 3→4, s10 2→4) and lost one (s9 4→2) — broad, not carried by a single file. The 14B's gain came from two projects
(s3 0→3, s7 0→4) while the two that previously scored fell to zero. At the 14B's floor, *which* project scores is close
to arbitrary — set G scored s7 3/s9 1, the set H control s8 1/s9 1, on an identical hub. So the 30B's +9 is the stronger
claim; the 14B's +5 is real on totals but fragile in composition.

## Predictions, judged

- **1 + 2 (replication and variance): HELD.** Both controls landed inside the pre-registered bands, and the spread is
  now measured rather than assumed.
- **3 (treatment attempts more goals): UNDECIDABLE.** 14B +2, 30B −5, against spreads of ±8 and ±19. Forecast recorded
  at 03:04, before either treatment arm finished. The extra goals were never the mechanism; the quality of what landed
  was. The pre-registered "75+" threshold was superseded by the measured spread — changed while both arms were still
  scoreless, with the original number still printed.
- **4 (no duplicated definitions): HELD on the arm that had the pathology.** 14B: 10 files → 2, with the worst case
  eliminated — `s7_cache.js` went from 1398 lines carrying `size x28, has x27, keys x27, constructor x26` to absent.
  The 30B never had duplicates either way.
- **5 (a flat score would still be a real result):** not needed — the score moved.

## What the fixes did NOT catch, with a live reproduction

`s8_grades.py` in the 14B treatment workspace still holds `set_weight x20` — an **indented** Python method, exactly the
shape the new `defCounts` refusal was built for. The records say why: that file took **22 `append_file` calls**, and
`append_file` is outside the guard's view because `beforeSrc` is captured only for write and edit. The guard itself
works — it fired **27 `DUPLICATED` refusals** elsewhere in the same arm. This was flagged as a known gap when the fix
landed; set H turned it from a prediction into evidence.

## Provenance — do not read the hub commit off the arm logs

`trialH.mjs:109` hardcodes `git -C <main checkout> rev-parse HEAD`, so every arm logs the *main checkout's* head at its
own launch time, whatever hub `HUB_ENTRY` actually spawned. The controls say `47b05b3`, the treatments `cb1f8ce`;
neither ran. Ground truth is `server/agent.js` md5:

    controls    cf2336b17238  == dae46b2 cf2336b17238   -> unpatched, the hub set G measured
    treatments  6647c9479311                            -> patched (eaa70c1: three fixes)

## Caveats

Each comparison is one arm against one control, and the spread is estimated from two runs, not a distribution. "Outside
the measured noise" is not "statistically established". The checker is deterministic (an independent offline recompute
of the 30B control workspace returned 30/100 with identical per-project splits), so the instrument is stable even where
throughput is not.
