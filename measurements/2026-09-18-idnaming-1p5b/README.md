# PREREGISTRATION — which property of the sentence does it?

**Committed before the GPU window opens. Nothing below is adjusted after seeing a result.**

## What window 7 established, and what it could not say

One semantically redundant sentence took reproduction of forbidden code from 5/40 to 22/40 at `FULL`
(p = 1.1e-4) and did nothing at all at `W1` (p = 1.00). `NEUTRAL` moved it far less than `FACT`
(p = 0.012), so it is not simply sentence count.

It had **one** identifier-bearing arm, so it could not say *which property* of that sentence mattered.

## Five arms

| Arm | Sentence | What it is |
|---|---|---|
| `OFF` | — | baseline |
| `FACT` | *The function takes one parameter, named n.* | window 7's arm, replicated |
| `TARGET_ID` | *The parameter is named n.* | names a token the fragment **must** contain |
| `NONTARGET_ID` | *The function is named classify.* | names a token the fragment **must not** contain |
| `NEUTRAL` | *The function is defined at the top level of its module.* | no identifier at all |

    only TARGET_ID moves                   -> output-token priming or salience
    TARGET_ID and NONTARGET_ID both move   -> naming any code identifier amplifies reproduction
    neither moves but FACT still does      -> the planning/obligation content of that sentence
    all move together                      -> sentence count after all, and window 7's NEUTRAL was noise

## Length runs counter to the hypothesis, which is the point

    OFF            (none)
    TARGET_ID       25 chars,  5 words      predicted to move MOST
    NONTARGET_ID    31 chars,  5 words
    FACT            42 chars,  7 words
    NEUTRAL         55 chars, 11 words      moved LEAST in window 7

If the shortest sentence moves most and the longest moves least, prompt length cannot be the
explanation — it would have to work backwards. Recorded mechanically by the harness, not asserted.

## A declared asymmetry, not a flaw to be papered over

**`W1` does not show the function name.** So `NONTARGET_ID` is a different condition at each window:

    at FULL    names a token that IS visible and must not be emitted
    at W1      names a token that is NOT visible and must not be emitted

That is stated here rather than silently averaged. It makes `W1`'s `NONTARGET_ID` a fifth condition in
its own right, and it is the one cell whose cross-window comparison is not like-for-like.

## Primary endpoint, again a failure mode and not a pass rate

> **repeated-a-forbidden-line refusal rate**, pooled across cases, per window.

Verified rate is secondary. A third, direct mechanism readout is recorded: **does the function name
appear in the output at all**, measured on every sample including refused ones. If naming a token pulls
it into the output, that column sees it without any inference from success rates.

## No mechanism is claimed

This measures a behavioural interaction between redundant wording and visible source. *Priming*,
*salience* and *attention* are names for hypotheses in this document and will not appear in the result
as explanations. Nothing in this design can see inside the model.

## Windows and power

`W1` and `FULL`, with `W1` as the **interaction control** — the strongest part of window 7's design.
The question is not whether wording changes behaviour but whether the same wording's effect depends on
the code surface beside it.

5 arms x 2 windows x 2 cases x 20 samples = **400 generations**, 40 per arm per window.

## Controls

Sufficiency, endpoint reachability, assembler, inversion, off-by-one, and the arm-diff assertion that
each arm differs from `OFF` by exactly one line which is exactly its sentence. Plus a premise check
that `FULL` really does show the function name, so `NONTARGET_ID` means there what it claims. All pass.

## Prediction, written before running

> `FACT` reproduces its window-7 effect at `FULL` — that is a replication and I expect it.
>
> Beyond that I favour **`TARGET_ID` and `NONTARGET_ID` both moving**, over the token-specific reading,
> because window 7's effect appeared exactly where there was visible code to copy and the simplest
> account is that naming *any* identifier from that code raises the chance of reproducing it. I hold
> this weakly.
>
> `W1` stays flat on every arm.

**Falsified if** `FACT` does not replicate — in which case window 7's headline is a single-run result
and must be reported as such, which would be the most consequential outcome here. Also notable if
`NEUTRAL` moves this time, since it would put window 7's three-arm separation in doubt.

**No arm is predicted to win.** Commit integrity is expected near 0.99; the authorization gate is now
known to leak, so a leak is no longer surprising and its rate is what is being accumulated.

## Cost and safety

Same T4 app under tatte's standing authorization in `COORD.md`. `scaledown_window` 5 minutes,
`min_containers` 0, hard 30-minute cap, AC power confirmed, stop with `--yes` and verify. **Rule 3**
before any generation.
