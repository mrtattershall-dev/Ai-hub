# MODEL-CMP-1 arm C — the GPU generated 12 times faster and produced the same failures. 0 of 5 accepted, both arms. Estimated cost under $0.10 of a $2 cap.

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
    VERIFICATION  mean (runs locally)      15 s *                21 s
    cost                                  $0.00          under $0.10 (estimate)

    * arm A's five verification times were 19, 15, 13, 554 and 13 seconds. See the correction below.

    per seed, arm C   1  comments only          movement Y  PRESERVE_INCOMPLETE  1.2 s
                      2  comments only          movement Y  PRESERVE_INCOMPLETE  1.3 s
                      3  comments only          movement Y  PRESERVE_INCOMPLETE  1.3 s
                      4  13 lines of code       movement .  RESTORED             1.9 s
                      5  comments only          movement Y  PRESERVE_INCOMPLETE  1.2 s

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
    ollama version        DIFFERENT: 0.33.3 locally, 0.34.4 in the container
    outputs               NOT identical per seed. Same seed, same options, different backend gave
                          different text (seed 1 wrote code on CPU and comments on GPU; seed 4 wrote
                          28 non-comment lines on CPU and 13 on GPU). So the arms are NOT paired
                          seed by seed, and only the aggregate comparison is meaningful.

## A correction to something I reported earlier

I told you verification was about seven eighths of an attempt's clock, from arm A's 139 s mean
end-to-end against 16 s of generation. **That was driven by a single outlier.** Arm A's verification
times were 19, 15, 13, **554** and 13 seconds: excluding the 554 s row the mean is **15 s**, and arm
C measured 21 s for the same local code. The 554 s row matches a 9.5-minute gap between that
attempt's start and the next one, and this machine has a recorded history of sleeping mid-run.

So the honest version: **verification takes roughly 13 to 24 seconds here.** That changes the
economics I offered:

    on CPU   generation 16 s vs verification 15 s   - roughly even, not 1:7
    on GPU   generation 1.4 s vs verification 21 s  - verification dominates, about 15:1

The escalation point survives in a weaker form, and only for fast backends: once generation is on a
GPU, **the cost of an attempt is almost entirely the cost of checking it**, and that cost is the same
whichever model produced the candidate. On this laptop's CPU the two were comparable.

## Cost accounting

    container window      first request 03:21:35Z to stop returned 03:25:30Z = 235 s (3.9 min)
    cold start            62 s of that, inside the window, weights baked into the image
    A10G seconds          235 s at the verified $0.000306/s                      = $0.072
    image builds          three, two of which failed early on CPU builders       under $0.02
    TOTAL                 under $0.10 of the $2 cap
    app state after       stopped explicitly, 0 tasks, verified by `modal app list`

This is an estimate from measured wall-clock and a verified unit price, **not a billing readout**.
Startup, idle and shutdown are all inside the 235 s window as the authorization required.

Two build failures cost no GPU time: ollama's installer needs `zstd`, and the Windows console could
not encode Modal's progress spinner, which aborted the client rather than the build.

## NOT established

- Anything about GPU-versus-CPU **quality**. Acceptance was 0 in both arms, and the ollama versions
  differ, so a difference would not have been attributable anyway.
- Any per-seed pairing. The same seed produced different text on the two backends.
- That the task is unreachable for this model. Five seeds per arm, one exploratory configuration.
- Anything about a stronger model. **Arm B is still not authorized and was not run.**

Records: `MODEL-CMP-1_armC_seed1..5.json` (each with `rawReply`, `transformed`, `candidate` and its
sha256), `MODEL-CMP-1_run-armC.log`, `MODEL-CMP-1_armC-checks.log` (digest, version and wire
checks), `MODEL-CMP-1_armC-window.log` (the billing window), `MODEL-CMP-1_armC-deploy.log`,
`server/modalOllama.py`.
