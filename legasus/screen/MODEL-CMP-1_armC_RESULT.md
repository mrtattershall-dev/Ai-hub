# MODEL-CMP-1 arms C and C2 — the GPU generated about ten times faster and produced the same failures. 0 of 5 accepted in all three cells. Estimated cost under $0.20 of a $2 cap.

2026-09-27. Authorized by Micheal at **$2 total including startup, idle and shutdown**, recorded in
`MODEL-CMP-1_DEFINITION.md` before deploying. Arm C is a **backend** comparison: the same 1.5B, the
same five seeds, the same weights and quantization, the same prompt, suffix, decoding, output
processing and acceptance gate. Only the hardware changed.

## The two arms

    measure                           arm A  local CPU        arm C  Modal A10G
    accepted (RETAIN)                     0 / 5                  0 / 5
    planting clause passed                0 / 5                  0 / 5
    movement preserved                    4 / 5                  4 / 5
    inserted non-comment content          2 / 5                  1 / 5
    GENERATION  mean                     16.4 s                  1.4 s
    GENERATION  throughput               10.6 tok/s            114.4 tok/s
    VERIFICATION  mean, ALL attempts          123 s               21 s
    VERIFICATION  mean, typical attempts *      15 s               21 s
    TOTAL elapsed, all five attempts           696 s              113 s
    cost                                       $0.00        under $0.10 (estimate)

    * The full elapsed account is the first row and includes everything. Arm A's five verification
      times were 19, 15, 13, **554** and 13 seconds; the typical row excludes that one attempt and
      is reported separately rather than instead. Nothing is discarded: 696 s is what the five
      attempts actually took.

    per seed, arm C   1  comments only          movement Y  PRESERVE_INCOMPLETE  1.2 s
                      2  comments only          movement Y  PRESERVE_INCOMPLETE  1.3 s
                      3  comments only          movement Y  PRESERVE_INCOMPLETE  1.3 s
                      4  13 lines of code       movement .  RESTORED             1.9 s
                      5  comments only          movement Y  PRESERVE_INCOMPLETE  1.2 s

## Arm C2: the same run with the serving version ALIGNED

Arm C shipped ollama 0.34.4 against 0.33.3 locally, so the server version moved with the hardware.
Using part of the same authorization, the container was **pinned to 0.33.3** — the version every
local record was produced with — and the five attempts were repeated unchanged. The build log shows
`OLLAMA_VERSION=0.33.3` and the server reporting `Listening on 127.0.0.1:11434 (version 0.33.3)`,
matching `curl localhost:11434/api/version` exactly. **Arm C2 is therefore a clean hardware-only
comparison**: same binary version, same digest, same quantization, same wire rendering, same options.

                             arm A  CPU 0.33.3   arm C  GPU 0.34.4   arm C2  GPU 0.33.3
    accepted                       0 / 5              0 / 5               0 / 5
    planting clause                0 / 5              0 / 5               0 / 5
    movement preserved             4 / 5              4 / 5               4 / 5
    inserted code                  2 / 5              1 / 5               1 / 5
    generation mean               16.4 s             1.4 s               2.8 s *
    output tokens                   865                787                 787

    * arm C2's first attempt spent 7.5 s loading the model into a cold container; the other four
      averaged 1.7 s. Arm C had been warmed by the digest and wire checks before its first attempt.

**Two findings the aligned cell adds.**

1. **The ollama version was not what made the text differ.** Arms C and C2 produced
   **byte-identical candidates on all five seeds** (same sha256 each time), despite 0.34.4 against
   0.33.3.
2. **The hardware alone changes the sampled text.** With the server version, digest, quantization
   and options identical, CPU and GPU still disagreed on **3 of 5 seeds** (seeds 2 and 3 matched).
   So a seed does not pin the output across devices, and per-seed pairing is unavailable for a
   reason that has nothing to do with software versions.

**And the outcome did not move anywhere: 0 accepted and 0 planting in all three cells.**

## The answer, in the terms the authorization set out

**Faster generation, same failures.** Generation went from 16.4 s to 1.4 s per attempt, a **11.9x
speed-up at 114 tok/s**, and **acceptance did not move: 0 of 5 in both arms, and the planting clause
failed in all ten attempts.** This is the speed result, and it does not touch the coding problem.
The one attempt that wrote code broke the page and was rolled back byte-exact, exactly as on CPU.

**Nothing here warrants a GPU-versus-CPU claim about quality**, because acceptance did not improve.
Had it improved, these backend differences would have had to be ruled out first, and two of them are
real:

    same weights          VERIFIED IDENTICAL: digest d7372fd828518a…, Q4_K_M, 1.5B, both sides
    same wire rendering   VERIFIED on the GPU backend: prompt+suffix renders like a hand-built
                          infilling request (26 == 26 tokens), exceeds an empty-suffix request by
                          exactly the suffix's 12 tokens, same greedy first token
    ollama version        DIFFERENT in arm C: 0.33.3 locally, 0.34.4 in the container.
                          ALIGNED in arm C2: 0.33.3 both sides, verified in the build log and by
                          the server's own startup line. Arm C2 is the version-controlled cell.
    outputs               NOT identical per seed. Same seed, same options, different backend gave
                          different text (seed 1 wrote code on CPU and comments on GPU; seed 4 wrote
                          28 non-comment lines on CPU and 13 on GPU).

CORRECTED after review: I wrote that this left "only the aggregate comparison meaningful", which
overstates it. **Differing text under matching seeds removes the PAIRING, not the comparison.** The
arms are still comparable at the level they were designed for - same task, same gate, same five
seeds, aggregate outcomes - and each seed's record still stands on its own. What cannot be done is
treating seed 3 on CPU and seed 3 on GPU as the same draw and differencing them. **And the honest
label for the whole thing is a BACKEND comparison, not a clean hardware-only experiment**, because
the ollama version moved with the hardware.

## A correction to something I reported earlier

I told you verification was about seven eighths of an attempt's clock, from arm A's 139 s mean
end-to-end against 16 s of generation. **That mean was driven by a single attempt.** Arm A's
verification times were 19, 15, 13, **554** and 13 seconds; arm C measured 17-24 s for the same
local code.

**Both numbers are reported, and the outlier is not removed from the elapsed account.** The five
attempts took 696 s in total and that is the real figure for what the run cost in time. Alongside
it, the typical attempt verifies in 13-24 s, which is the figure that should be used for planning.

**What caused the 554 s is not established.** There is a 9.5-minute gap between that attempt's start
and the next one, and this machine has a recorded history of sleeping mid-run, so sleep is a
plausible explanation - but a gap in timestamps is consistent with several causes (contention from
another process, a stalled browser, a paging storm) and nothing here distinguishes them. It is
recorded as one unexplained slow attempt, not as a diagnosed sleep.

So, for planning: **verification takes roughly 13 to 24 seconds here, with occasional attempts far
slower.** That changes the economics I offered:

    on CPU   generation 16 s vs verification 15 s (typical)   - roughly even, not 1:7
    on GPU   generation 1.4 s vs verification 21 s (typical)  - verification dominates, about 15:1
    either   a slow attempt can add nine minutes, as one of ten did, so a budget stated only in
             typical seconds will be wrong sometimes

The escalation point survives in a weaker form, and only for fast backends: once generation is on a
GPU, **the cost of an attempt is almost entirely the cost of checking it**, and that cost is the same
whichever model produced the candidate. On this laptop's CPU the two were comparable.

## Cost accounting

    arm C window          first request 03:21:35Z to stop returned 03:25:30Z = 235 s (3.9 min)
                          cold start 62 s of that; 235 s at $0.000306/s          = $0.072
    arm C2 window         03:33:57Z to stop returned 03:38:03Z = 246 s (4.1 min) = $0.075
    image builds          four in total, two of which failed early, on CPU builders  under $0.04
    TOTAL                 under $0.20 of the $2 cap
    app state after       stopped explicitly after each arm; 0 deployed legasus-ollama apps
                          remaining, verified by `modal app list`

This is an estimate from measured wall-clock and a verified unit price, **not a billing readout**.
Startup, idle and shutdown are all inside the 235 s window as the authorization required.

Two build failures cost no GPU time: ollama's installer needs `zstd`, and the Windows console could
not encode Modal's progress spinner, which aborted the client rather than the build.

## What this separates, for Legasus

    GPU acceleration          buys RESPONSIVENESS. 11.9x on generation, measured, and on the
                              product requirement of "less stutter" that is a real gain.
    feature building          still needs a GENERATION improvement. Faster hardware moved no
                              boundary that decides whether an increment is accepted.

Those are two different jobs and this run separates them cleanly. **It does not show an inherent
1.5B limit**: the interface questions are open (instruction shape alone moved code insertion from
0 of 5 to 3 of 3 in INC4-1), the serving versions differed, and one exploratory configuration with
five seeds per arm is a thin basis for any claim about the model.

## NOT established

- Anything about GPU-versus-CPU **quality**. Acceptance was 0 in all three cells. In arm C the
  versions also differed; arm C2 removes that confound and still shows no quality change.
- Any per-seed pairing. Even with the serving version aligned, the same seed produced different
  text on CPU and GPU in 3 of 5 cases. Pairing is unavailable; the aggregate comparison stands.
- That the task is unreachable for this model. Five seeds per arm, one exploratory configuration.
- Anything about a stronger model. **Arm B is still not authorized and was not run.** What arm C2
  does contribute to it: **version pinning is now verified to work**, so a stronger-model arm can be
  served on a pinned version and compared without this confound.

Records: `MODEL-CMP-1_armC2_seed1..5.json` (the version-aligned cell),
`MODEL-CMP-1_run-armC2.log`, `MODEL-CMP-1_armC2-window.log`, `MODEL-CMP-1_armC2-deploy.log`,
`MODEL-CMP-1_armC_seed1..5.json` (each with `rawReply`, `transformed`, `candidate` and its
sha256), `MODEL-CMP-1_run-armC.log`, `MODEL-CMP-1_armC-checks.log` (digest, version and wire
checks), `MODEL-CMP-1_armC-window.log` (the billing window), `MODEL-CMP-1_armC-deploy.log`,
`server/modalOllama.py`.
