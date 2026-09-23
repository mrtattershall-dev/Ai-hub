# BENCH-1 — definition, frozen before any generation

Committed before the model runs. **No comparison arm exists**: this measures what one
configuration achieved, not that it beats anything.

## Task source — external, and the 30-minute search that found it

Searched and inspected within the time bound. **QuixBugs** (github.com/jkoppel/QuixBugs,
James Koppel et al.) — 40 single-bug Python programs with reference corrections and test data,
independently authored, small enough for a 300s budget, no runtime dependencies.

Source revision: `4257f44b0ff1181dedaedee6a447e133219fcebf`
Vendored to `legasus/bench/quixbugs/` **before** the run; the worker still executes offline.

**"Independently authored" does not mean unseen.** QuixBugs is public and long-lived, so these
programs may appear in the model's training data. No public source avoids that. Recorded, not
argued away.

### Rejected alternatives
- **SWE-bench** — per-instance repo checkouts and container environments; incompatible with a
  300s task and the frozen worker.
- **HumanEval / MBPP** — function *completion*, not repair of existing behaviour, so there is
  nothing to protect.

## The adapter, recorded because it IS a change

QuixBugs' own tests are pytest modules (40 of 42) and the frozen worker has no pytest.

    PRESERVED   the upstream buggy program, the upstream correction, and the upstream test
                inputs and expected outputs (json_testcases), verbatim
    REPLACED    the pytest runner -> a plain python3 loop over the same cases

Rebuilding the worker image to add pytest would have required re-qualifying isolation. Nothing
about the programs, the bugs, or the expected outputs was changed.

## Selection — deterministic, and fixed before any model ran

Rule: **alphabetical by program name; first 15 eligible.** Eligibility is compatibility and task
shape only — never observed model success, which was unknowable at selection time because no
generation had happened.

Eligible = has a buggy program, a reference, ≥3 upstream cases, **≥1 case failing** on the seed
(real work), **≥1 case passing** (something to protect), and the reference passes all cases.

    inspected 31 · eligible 22 · selected 15 · excluded 9
      5x  could not execute under the offline harness
      3x  no case passes on the seed - nothing to protect
      1x  the upstream reference does not pass its own cases under this harness

## Two groups, reported separately

**EXTERNAL (15)** — independent bug-fix tasks, each from its own frozen seed.
  requested = every upstream case passes
  protected = the subset already passing on the buggy seed must still pass — **discovered from
  the seed, not designed**

**SEQUENTIAL (5)** — internally authored, one small ledger project, each step starting from the
previous step's **accepted** state. Step N's protected check is every earlier step's requested
check, so accumulation is measured by whether earlier work **keeps** passing. A step whose
prerequisite was not accepted is **BLOCKED**, never run from a seed.

Success on these two groups is never summed.

## Seed validation — 9/9, all positive controls passing

Every seed fails its requested check and passes its protected check; a known-good implementation
passes both. Reference solutions live outside every task workspace and are never materialised
into a container.

A chain step is validated against **the state it will actually start from**, not the base
project — validating step 2 against the base seed reported a failure that was my validation's
error, not the task's.

## Configuration — unchanged from ENDURANCE-2

Code revision: `98f738a9e8be48067865220e37e3ac172177ef44`
Model: Qwen2.5-Coder-7B-Instruct, A10G, Modal `legasus-7b`
Worker image: `sha256:fa49b576430b1288a585522bbf011fbd218cedcb379eb7bb57e3a69fec08a8c3`
worker isolation ON · route bounding ON · acceptance ON · d2 OFF · protocol controller OFF
300s per task · no retries · 2 hours total including cleanup · identical guidance on every task

## Spend bounding — $10 authorized cap

Bounded by **mechanism**, not by estimate:

1. **The only paid resource is the Modal A10G container.** At ~$1.10/hr, a 2-hour run plus
   warm-up is roughly $2–3 — an estimate, not a control.
2. **The app is stopped immediately after the run** (`modal app stop --yes`), so idle time
   cannot accrue.
3. **`scaledown_window=900`** means an idle container releases itself within 15 minutes even if
   the stop is missed.
4. **The 2-hour wall-clock budget is enforced in the runner**, which stops active work rather
   than only new starts.
5. **Balance is checked before and after**, and the delta recorded in the result.

Worst case if every control failed and the container ran continuously until scaledown: ~2.25h
≈ $2.50. The $10 cap would require roughly 9 hours of continuous GPU, which the wall-clock
budget forbids.

## What this cannot show

- No comparison arm. Nothing here says Legasus beats another framework.
- Not unseen tasks. Public benchmark, plausibly in training data.
- 15 external tasks are all **bug fixes** from one source; feature and multi-file shapes are
  covered only by the internally authored sequential group.
