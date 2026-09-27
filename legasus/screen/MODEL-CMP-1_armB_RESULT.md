# MODEL-CMP-1 arm B — 0 of 5 accepted. The 7B's candidates carry a real load-time defect; after repairs I supplied by hand, three were one clause short.

2026-09-27, **$0.085** for this arm; under $0.30 for arms C, C2 and B together.

**AUTHORIZATION SCOPE, corrected.** The visible **$2 cap covered the 1.5B Modal comparison, not the
7B.** Arm B's authorization is a separate instruction from Micheal — *"Alright try 7 b now"* — given
with **no stated cap**, and recorded in `MODEL-CMP-1_DEFINITION.md` before deploying. The "$1 working
cap" I applied was **self-imposed, not authorized**, and my earlier phrasing cited the $2 cap and the
$3 hosted-7B authorization as though they covered this run. **They did not: staying under someone
else's cap for a different model is not authorization.** What is authorized here is the instruction
to try the 7B; the amount was my own restraint, and the actual spend was $0.085.

`qwen2.5-coder:7b` (digest `dae161e27b0e90dd`, Q4_K_M, 7.6B) replaced the 1.5B **in the same container image, on the same pinned ollama 0.33.3**, driven by
the same harness, site, instruction, tail trim, decoding, seeds and acceptance gate. The request's
`model` field is the only thing that changed.

## The three cells

    The "1.5B GPU" column below is **arm C2**, the version-aligned cell (ollama 0.33.3), whose
    generation mean is **2.8 s**. The 1.4 s figure reported earlier is **arm C** (ollama 0.34.4),
    a different cell. Both are real and they are not the same measurement: arm C2's first attempt
    spent 7.5 s loading the model into a cold container while arm C had been warmed by the digest
    and wire checks before its first attempt, and excluding that cold first call arm C2 averages
    1.7 s. Arm C and arm C2 produced byte-identical candidates, so the difference is startup and
    server version, not behaviour.

                                      1.5B CPU    1.5B GPU    7B GPU
    accepted                             0/5         0/5        0/5
    planting clause passed               0/5         0/5        0/5
    movement steps passed                4/5         4/5        1/5
    inserted code                        2/5         1/5        4/5
    page exposed NO state at all         0/5         1/5        4/5
    mentioned forbidden features         5/5         5/5        5/5
    hit the 1500-token ceiling           0/5         0/5        1/5
    generation mean                    16.4 s       2.8 s      9.3 s
    output tokens mean                   173         157        487

**The headline is unchanged: no accepted addition, in any cell.** But the 7B fails for a completely
different reason than the 1.5B, and the surface numbers actively mislead about it — four of five
attempts look like catastrophic regressions and are not.

## What the 7B actually wrote

It writes real, well-formed code: arrow functions, template literals, guard conditions. Every
code-bearing attempt bound the feature like this:

    document.getElementById('plant').addEventListener('click', () => {
        if (inventory.seeds > 0) {
            plantSeed();
            inventory.seeds--;
        }
    });

**There is no button with id `plant` in this page.** There is a canvas and nothing else. So
`document.getElementById('plant')` returns null, `.addEventListener` throws a TypeError at the top
level of the script, and **everything after that line never executes — including the
`window.game = ...` seam, which sits in the suffix, downstream of the edit site.** The play then
reports "no state exposed" and every step fails.

Its script **parses cleanly** in all four cases. This is a runtime grounding failure, not a syntax
failure: it edited as though a different page were in front of it, inventing a UI while correctly
reusing the page's own `plantSeed`, `inventory` and `player`.

## Two diagnostics, and what they establish

Neither changes the official verdicts; both are $0 and re-run the same play over the same candidates.

**Diagnostic 1 — neutralise only the null dereference** (a missing element returns a detached stub,
so the listener registers instead of throwing):

    seed   official play   with the shim    reading
    2      []              [1,2,3,5]        movement WORKS, planting never fires
    3      []              [1,2,3,5]        movement WORKS, planting never fires
    4      []              [1,2,3,5]        movement WORKS, planting never fires
    5      []              [1,2,3,5]        movement WORKS, planting never fires

CORRECTED after review, because the first version of this paragraph let an explanation sound like an
acquittal:

**The null dereference is a REAL APPLICATION DEFECT, not merely a collapsed instrument.** The page as
the model delivered it throws while loading and never finishes initializing. That is a broken page by
any standard, and the four rejections were correct.

**What the shim shows is narrower than "movement was never broken".** It shows that *in the modified
candidate* — the one with my shim in it — movement works. It does **not** show that the original page
worked. In the original, execution stops at the throw, so the movement listener registered earlier is
the only part that survives, and nothing downstream of the throw runs at all. The honest statement is:
**the movement code was not altered by the edit, and the delivered page still failed.**

The acceptance policy was right to restore, and the thing that needs improvement is **diagnosis, not
the verdict**: the record said "every step failed" when what happened was "the page threw at load and
the behavioural checks were never reached". Those call for different responses and were reported as
one number.

**Diagnostic 2 — also route each invented button's click to the key its id obviously meant**
(`plant`→p, `harvest`→h, `advance`→t), leaving the model's handler bodies untouched:

    seed   + logic on the right key   reading
    2      [1,2,3,5]                  planting still does not fire (it bound the page's own broken
                                      plantSeed bare, which never spends a seed)
    3      [1,2,3,4,6]                plants correctly, FAILS the negative clause (step 5)
    4      [1,2,3,4,6]                plants correctly, FAILS the negative clause (step 5)
    5      [1,2,3,4,6]                plants correctly, FAILS the negative clause (step 5)

**After a repair I supplied by hand, three of four attempts were one clause short.** That sentence
needs its conditions attached every time it is used: **the rewiring is MY work, not the model's
output.** The model's actual output binds the feature to buttons that do not exist and throws; what
was one clause short is the model's handler BODY once I had put it on the right event. Nothing in the
delivered candidates was one clause from passing.

With that said, the remaining defect is exact and diagnosable: the guard is `inventory.seeds > 0`,
and `plantSeed()` has its own internal `if (!tiles[k])` no-op, but `inventory.seeds--` sits
**outside** that no-op. So pressing p a second time on an occupied tile **spends a seed and plants
nothing** — the state changes when the task says it must not.

That is a composition error between the model's new code and the existing function it reused, not a
failure to understand planting.

## The negative clause earned its place

Without step 5, seeds 3, 4 and 5 would have passed every remaining requested step once rewired.
**The clause that says "in every other case, change nothing" is the one that caught the real
defect** — a positive-only specification would have accepted code that silently drains the
inventory. This was added at Micheal's direction, and it is the discriminating test in this run.

## An apparatus flaw this exposed

**The observability seam sits downstream of the edit site.** Any top-level throw inside the hole
therefore erases all evidence about the candidate, and the gate's verdict collapses to "everything
failed" regardless of what the edit did — indistinguishable, without this extra analysis, from a
model that destroyed the game. Four of five attempts in this arm hit exactly that.

CORRECTED after review: my first proposal was to move the state accessor earlier. That is wrong.
**Hoisting the seam would not establish that initialization completed** — it would make state
readable while later initialization could still have thrown, which is a worse instrument, not a
better one.

    what was DONE instead  the gate now classifies why a failure looks total, and the record keeps
                           the captured errors as their own field:
                             RUNTIME_EXCEPTION_AT_LOAD  the page threw; the behavioural steps were
                                                        NEVER REACHED and imply nothing
                             SEAM_MISSING               no throw, but the declared accessor is absent
                             BEHAVIOUR                  loaded and readable; the step verdicts mean
                                                        what they say
                           plus `noFailureObservedDuringInit`, which is an OPERATIONAL CHECK and not
                           proof. CORRECTED after review: a readable accessor plus no captured page
                           error establishes only that no failure was observed up to the point of
                           measurement. It would be proof of completed initialization only if
                           readiness were established explicitly, and it is not - a candidate may
                           define the accessor anywhere, throw later inside a deferred callback, or
                           swallow its own error. The record now also carries
                           `initializationCompletedIsEstablished: false` so the stronger reading
                           cannot be taken by accident. The seam still stays last; hoisting it would
                           weaken the check further.
    tested                 four shapes classify correctly (arm B's own, a missing seam with no
                           throw, a genuine behaviour failure, and a clean pass)

## Reading the model comparison honestly

- **Bigger model, different failure, same outcome.** The 1.5B stays inside the file's vocabulary and
  under-produces: it wired existing broken functions to keydown, or wrote comments only. The 7B
  produces confident, structurally sound code and invents vocabulary the page does not have. Neither
  passed. **A larger model did not solve this task in this configuration.**
- **On the substance, the 7B is much closer.** Its logic is one guard-placement bug from correct; the
  1.5B never produced planting logic at all. That is a real difference, visible only after the
  wiring is neutralised.
- **It is not simply better.** It broke the page in 4 of 5 attempts where the 1.5B broke it in 1, it
  used 3x the tokens, and it drifted into forbidden features (harvest, save, load, time) in all five
  attempts — as did the 1.5B.
- **Speed:** 9.3 s mean against the 1.5B's 2.8 s on the same GPU, both far below the 1.5B's 16.4 s on
  CPU.
- **Five seeds, one exploratory configuration.** No rate, no claim about 7B models in general, and
  the instruction shape and the seam placement are both known to matter.

## Cost

    arm B container window   03:43:22Z to stop returned 03:48:31Z = 278 s (cold start with a 4.7 GB
                             model inside it) at $0.000306/s                        = $0.085
    arms C + C2 + B          759 s of A10G + under $0.06 of CPU image builds    about $0.29
    caps                     $1 working cap for arm B, $2 authorized for the comparison
    app state after          stopped explicitly; 0 deployed legasus-ollama apps remaining

Estimates from measured wall clock and the verified $0.000306/s A10 price, not a billing readout.

## What this changes about the plan

The escalation architecture now has evidence for a specific division of labour, and it is not the
one I assumed. The 7B's remaining defect is **one line in the wrong place** and its wiring error is
**mechanically detectable** — a listener bound to an element that does not exist can be caught by a
check, and a seed spent without a tile appearing is exactly what step 5 already detects. So the
useful next move is not a larger model. It is:

1. **Classify the failure** so a load-time throw is reported as one, which is done and tested.
2. **Feed the failure back and let the MODEL propose the repair** — not me. `server/repairLoop.mjs`
   does exactly that: the untouched candidate, the captured error verbatim, the declared contract,
   and the failing step's own name and observed state; no rewiring, no corrected decrement, no hint
   that the buttons do not exist. Every round, token, second and dollar counted, gate unchanged.
   Its mechanics are pinned by `repairLoop.test` 15/15, including a correct repair reaching RETAIN
   and a damaging round being reverted rather than built on.
3. **Then re-measure.** Whether the model can act on machine-captured evidence is the capability the
   product needs, and it is untested until that loop runs.

**Not established:** that the 7B would pass with feedback; that the wiring error is representative;
anything about autonomy — the site and the step were still supplied by me, and the two diagnostics
above are my analysis, not the system's.

Records: `MODEL-CMP-1_armB_seed1..5.json` (each with `rawReply`, `transformed`, `candidate` and its
sha256), `MODEL-CMP-1_run-armB.log`, `MODEL-CMP-1_armB-window.log`, `MODEL-CMP-1_armB-deploy.log`,
and the two diagnostics `server/armBDiagnostic1.mjs`, `server/armBDiagnostic2.mjs`.
