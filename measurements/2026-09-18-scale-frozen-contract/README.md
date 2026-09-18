# PREREGISTRATION — the scale experiment: one frozen contract, one variable

**Committed before the GPU window opens. Nothing below is adjusted after seeing a result.**

## The question has changed

    not   "does the bigger model work?"
    but   "does capacity mainly raise the RATE of useful proposals while Legasus keeps the
           ACCEPTANCE CRITERION invariant?"

That is the architectural claim stated as something falsifiable:

> **Rendering controls the distribution of proposals. Authorization controls admissible form.
> Verification controls truth.**

If capacity moves proposal yield and cost while leaving authorization precision roughly flat, the
model is behaving as a stochastic implementation backend and Legasus is behaving as the thing that
decides what becomes real. If capacity instead moves authorization precision, then acceptance quality
depends on the model after all, and the separation is weaker than claimed.

## What is frozen, and how that is checkable rather than promised

Everything except model capacity: the four tasks, the renderer, the authority envelope, the verifier
and its probe set, the sampling protocol, the endpoints, the cell list, the controls.

`run-scale.mjs` is a **mechanical transform** of `run-exclusion-1p5b.mjs`, the harness that produced
the window-10 measurement. `contract-identity.test.mjs` compares the two files region by region —
`TASKS`, `RENDERINGS`, `sourceFor`, `plan`, `promptFor`, `normalize`, `accept`, `conditionOf`,
`exclusionFamily`, `build`, `evaluate`, `CELLS`, `control` — and fails if anything outside the declared
diff has moved. It carries a **negative control**: a mutated rendering must be detected.

    THE DECLARED DIFF, and nothing else
      the model id becomes a parameter, and several may be run in one pass
      the per-cell key and summary carry the model
      seconds-per-verified-change is recorded

One app, one card, one daemon, one volume, one request path, `max_inputs 1`,
`OLLAMA_MAX_LOADED_MODELS 1`, models walked serially. Two containers on two cards would add a second
variable for free.

## Endpoints, separated rather than collapsed

    PROPOSAL YIELD             authorized / samples          how often a usable candidate appears
    AUTHORIZATION PRECISION    verified / authorized         semantic quality AMONG admitted proposals
    VERIFICATION RATE          verified / samples            end to end
    REFUSAL TOPOLOGY           by reason                     WHICH failure mode capacity removes
    REALIZATION DIVERSITY      distinct guards per cell      does capacity change HOW it solves it
    COST PER VERIFIED CHANGE   seconds / verified

Plus the window-10 primary carried over unchanged, so the **render effect itself** can be checked at
each capacity: `excludes-preserved` by rendering, per model.

## The ladder, and where it stops

    qwen2.5-coder:1.5b     ~1GB at q4
    qwen2.5-coder:7b       ~4.7GB
    qwen2.5-coder:14b      ~9GB

12 cells x 20 samples x 3 models = **720 generations.**

**32B is not in this window and the reason is money, not oversight.** At q4 it is ~19GB and does not
fit a 16GB T4. It needs a 24GB card — a different GPU at a different price — and tatte's standing
authorization is for a T4. That needs its own ask, so it gets one.

Samples are 20 rather than window 10's 40, because a 14B on a T4 is slow and the window has a hard
cap. The 1.5B arm is therefore **re-run at n = 20** rather than compared across sample sizes.

## Prediction, written before running

> **Proposal yield rises with capacity** and the refusal topology shifts: the shape failures
> (`returned a function`, `not exactly one guard and one return`) should thin out first, since they are
> instruction-following rather than reasoning.
>
> **Authorization precision stays roughly flat** — this is the architectural prediction and the one I
> most want to be wrong about, because a clear rise would mean acceptance quality tracks the model and
> the layer separation is doing less work than claimed.
>
> **Seconds per verified change rises with capacity on a T4**, since a 14B generates far slower than a
> 1.5B and the yield gain is unlikely to pay for it. If the larger models are *cheaper* per verified
> change despite being slower per token, that is a strong practical result and I am not predicting it.
>
> **The render effect persists at every capacity.** If `IMPLICIT` stops producing zero exclusions at
> 14B, the rendering rules are 1.5B-specific and must be re-scoped.

**No model is predicted to "win".** A flat authorization precision with rising yield is the
architecturally interesting outcome; a rising authorization precision is the more consequential one.

## Power

20 samples x 12 cells = 240 per model. Pooled endpoints are readable; per-cell differences at n = 20
are not, and will be reported as inconclusive. A 14B failing to differ from a 1.5B on authorization
precision at this sample is **not** proof of invariance — it is consistent with it, and the honest
statement is a confidence interval, not a claim of equality.

## Cost and safety

T4 under tatte's standing authorization in `COORD.md`. `scaledown_window` 5 minutes,
`min_containers` 0, AC power confirmed, stop with `--yes` and verify. **First boot downloads ~15GB**
across the three tags and commits them to the volume; that is a one-time cost on this window.
**Rule 3** checks every model named before any generation.
