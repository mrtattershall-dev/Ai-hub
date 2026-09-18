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

---

# RESULT — the scale experiment

Rule 3 verified for all three models. Contract identity verified by test before the window: 16
witnesses, including a negative control that a mutated rendering is detected. One card, one daemon,
one volume, models walked serially. Window 12:31:42Z to ~12:46Z, stopped and verified: every
`legasus` app row reads `stopped`.

    model    proposal   authorization precision   verification   sec /      refusals
             yield      [95% Wilson]              rate           verified   by reason
    1.5b     0.875      0.976  [0.945, 0.990]     0.854          1.0        shape 18, repeat 5, fn 7
    7b       0.946      0.802  [0.745, 0.848]     0.758          1.2        repeat 13
    14b      1.000      0.925  [0.885, 0.952]     0.925          1.6        none at all

    proposal yield          1.5b vs 7b  p = 0.0099     1.5b vs 14b  p = 7.1e-10
    authorization precision 1.5b vs 7b  p = 2.0e-9     1.5b vs 14b  p = 0.017    7b vs 14b p = 1.2e-4
    verification rate       1.5b vs 7b  p = 0.011      1.5b vs 14b  p = 0.019

## The architectural prediction is falsified

> *"Authorization precision stays roughly flat — this is the architectural prediction and the one I
> most want to be wrong about."*

It is not flat. It moves by 17 points and it moves **non-monotonically**: 0.976, 0.802, 0.925. The 14B
is significantly **worse** than the 1.5B (p = 0.017). Capacity does not merely raise the rate of useful
proposals; it changes the semantic quality of the proposals that pass the authority gate, and not in
the direction anyone would guess.

Proposal yield behaved exactly as predicted — 0.875, 0.946, **1.000**, with the 14B refused zero times
in 240 samples — and the refusal topology thinned in the predicted order, shape failures first.

## Why the bigger models are less precise, and it is one mechanism

    1.5b leaks    5    `n > 20` x2, `n >= 20` x2, `n > 10` x1              inversions
    7b  leaks   45    `n > 20` x14, `n > 10` x13, `n > 0 and n < 10` x9   inversions AND compounds
    14b leaks   18    `0 < n < 10` x14, `n > 0 and n < 10` x3             almost entirely compounds

**Capacity shifts realization strategy toward compound conditions, and the compound conditions are
where the semantic errors live.** The 1.5B writes `n < 10` and is usually right. The 14B writes
`0 < n < 10` — elegant, idiomatic, and wrong, because it invents a lower bound the specification never
stated and silently drops every negative input.

Realization diversity moves the same way, downward: distinct guards per cell fall from 2–5 at 1.5B to
1–3 at 14B. The larger models converge on fewer, richer, more confident realizations.

## THE FINDING THAT MATTERS MOST — the verifier nearly ranked them backwards

Attribution of every leak to the probe that caught it:

    1.5b     0 of  5 leaks caught by the NEIGHBOUR probes alone
    7b      14 of 45
    14b     17 of 18

The neighbour probes at `P+1` and `P-1` exist because a **control caught a hole before window 10 ever
opened**: the first draft of that harness verified `n < T and n != P+1`, an exclusion of the wrong
value that no probe touched.

> **Without those two probes the 14B would have scored 239/240 authorization precision and looked like
> the best model in every column.** Its dominant failure mode would have been invisible.

That is the load-bearing lesson of this window, and it is not about model size:

> **A probe set built against a small model's failure modes will silently ratify a larger model's more
> sophisticated mistakes.** The apparent capability ranking of models depends on whether the verifier
> can see the errors the larger ones actually make — and larger models make *different* errors, not
> fewer of the same ones.

Verification has to be independent of the model and stronger than the model, or it becomes a mirror.

## The rendering rules are not 1.5B-specific — they strengthen with capacity

    excludes-preserved, per 80        IMPLICIT   NAMED_EXCLUSION   RELATIONAL
      1.5b                                0             6              13
      7b                                  0            39              63
      14b                                 0            65              56

    RELATIONAL   1.5b 13 vs 7b 63   p = 8.9e-16      1.5b 13 vs 14b 56   p = 5.5e-12

`IMPLICIT` produces **zero** exclusion predicates at every capacity — 240 samples per model, 720 in
total, across four different excluded values. The render effect is not a small-model artifact; it is
four to five times larger at 7B and 14B than at 1.5B.

This is the strongest form of the `RENDER` claim available: the same deterministic compilation of the
same internal truth steers implementation strategy **across an order of magnitude of model capacity**.

## Cost

    seconds per verified change, same card, same daemon
      1.5b  1.0        7b  1.2        14b  1.6

Predicted direction, and smaller than the token-cost ratio implies, because yield rose with capacity.
On one T4 the 14B costs 1.6x per verified change and delivers 0.925 against 0.854.

## The 7B is anomalous and is reported as observed, not explained

It is worse than **both** its neighbours on authorization precision and on end-to-end verification
rate, driven by 27 outright inversions (`n > 20`, `n > 10`) that neither of the others produced in
quantity. Nothing in this design explains it. It is one checkpoint, one quantization, one temperature.

## Honest limits

- 240 samples per model. The intervals are reported because the point estimates invite over-reading.
- **32B is absent for a stated reason**: at q4 it is ~19GB and does not fit a 16GB T4. It needs a 24GB
  card at a different price, and the standing authorization is for a T4.
- One task family, one operation, one window size, one temperature, one quantization per size.
- The 7B anomaly is unexplained and may be checkpoint-specific.

## What this changes

1. **The clean story does not survive contact with scale, and the architecture is better for it.**
   "Capacity raises proposal rate while Legasus holds acceptance constant" is half right: yield rose
   monotonically to 1.000, and acceptance precision did **not** hold constant.
2. **Verification strength must scale with the models it judges.** This window's dominant finding is
   that a probe set is a model-dependent instrument unless deliberately built otherwise. Every future
   family adds probes for the failure modes of the *largest* model it will face, not the smallest.
3. **`RENDER` generalizes across capacity**, which is the strongest evidence yet that it is an
   architectural stage rather than prompt engineering.
4. The next question is no longer about size but about **whether verification can be made adversarial
   to realization strategy** — probes derived from the contract's boundary structure rather than from
   observed failures, so a novel-but-wrong realization has nowhere to hide.
