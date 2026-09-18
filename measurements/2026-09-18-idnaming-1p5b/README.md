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

---

# RESULT — which property of the sentence does it?

Rule 3 verified. All controls passed, including the arm-diff assertion and the premise check that
`FULL` shows the function name. GPU window 10:58:30Z to ~11:04Z, stopped and verified: six
`legasus-1p5b` rows, **zero** not `stopped`.

    window  arm            PRIMARY repeated-fixed   verified   fn-name in output
    W1      OFF                   4/40               20/40           0/40
    W1      FACT                  7/40               21/40           0/40
    W1      TARGET_ID             4/40               23/40           0/40
    W1      NONTARGET_ID          4/40               25/40           0/40
    W1      NEUTRAL               4/40               26/40           0/40
    FULL    OFF                   5/40               32/40           0/40
    FULL    FACT                 19/40               17/40           4/40
    FULL    TARGET_ID            18/40               18/40           0/40
    FULL    NONTARGET_ID         15/40               22/40           1/40
    FULL    NEUTRAL              14/40               20/40           1/40

## The answer is the hypothesis I ranked last, and it corrects window 7

**All four sentence arms moved at `FULL`:**

    OFF  5/40  ->  FACT         19/40      p = 1.2e-3
    OFF  5/40  ->  TARGET_ID    18/40      p = 2.6e-3
    OFF  5/40  ->  NONTARGET_ID 15/40      p = 1.9e-2
    OFF  5/40  ->  NEUTRAL      14/40      p = 3.4e-2

    FACT 19 vs NEUTRAL      14             p = 0.36     not distinguishable in this run
    TARGET_ID 18 vs NONTARGET_ID 15        p = 0.65     not distinguishable

**The identifier hypotheses are not supported.** Naming a token the fragment must contain and naming
one it must not are indistinguishable, and both are indistinguishable from a sentence naming no
identifier at all. The direct mechanism readout agrees: naming the function did **not** pull the
function's name into the output (`NONTARGET_ID` 1/40 against `OFF` 0/40, p = 1.00).

> **Window 7's conclusion that "this is not simply one more sentence" was underpowered and is
> corrected here.** Its `NEUTRAL` arm sat at 10/40 against `OFF` 5/40, p = 0.25, and I read a null as
> evidence of no effect. With 40 more samples `NEUTRAL` moves clearly.

## What survives pooling, and why pooling is legitimate *here*

`OFF`, `FACT` and `NEUTRAL` at `FULL` are **byte-identical conditions** in windows 7 and 8 — same
sentences, same window, same model, temperature, token budget and acceptance policy. Pooling them is a
replication, not the confounded cross-run comparison this project rightly refused earlier (that one
crossed runs *and* differed in the variable of interest).

    per 80, windows 7 and 8 pooled
      OFF 10  ->  NEUTRAL 24        p = 1.1e-2
      OFF 10  ->  FACT    41        p = 1.9e-7
      FACT 41  vs NEUTRAL 24        p = 9.8e-3

So both effects are real and they are additive rather than alternative:

    ANY extra sentence raises reproduction of forbidden code          NEUTRAL, p = 0.011
    AN OBLIGATION-SHAPED one raises it further                        FACT over NEUTRAL, p = 0.0098

Window 7 had the second and missed the first. This run has the first and, within itself, cannot see
the second. Only the pooled replicate shows both.

## The interaction reconfirms, now with five sentences

    W1     4, 7, 4, 4, 4  out of 40        no arm differs from OFF (p = 0.52 at worst)
    FULL   5, 19, 18, 15, 14 out of 40

**Nothing any of these sentences does survives a small window.** That is the same result window 7
produced with two sentences, and it is the strongest structural claim in this line of work: the effect
of model-facing wording is not a property of the wording. It is a property of the wording *together
with* the code surface beside it.

## Length is ruled out, and it had to work backwards to be ruled in

    TARGET_ID     25 chars   moved to 18/40
    NONTARGET_ID  31 chars   15/40
    FACT          42 chars   19/40
    NEUTRAL       55 chars   14/40

The shortest sentence produced nearly the largest effect and the longest produced the smallest. Prompt
length does not order these.

## Commit integrity

    authorized  225      verified  224      P(correct | authorized) = 0.996

    cumulative across six families:   463 authorized, 460 verified   = 0.994

The single leak is `if n > 0: return "small"` — **the same fragment that leaked in window 7**, again in
case A. Both are well-formed, in-vocabulary, correctly shaped, and destroy a preserved behaviour, and
both were caught by execution verification.

Case A's delta reads *"For other values below 10, return small."* Two leaks now share one reading: the
model appears to take **"other values"** to mean *the remaining positive ones* and encodes that as
`n > 0` while dropping the bound entirely. That is a hypothesis about delta phrasing with n = 2 behind
it, recorded for a later single-variable test, not a finding.

## Honest limits

- `NEUTRAL` is still one sentence, not a class. "Any extra sentence" is supported by one exemplar of
  "no identifier" and three of "identifier"; a proper test needs several exemplars per level.
- The `FACT`-over-`NEUTRAL` excess rests on pooling two runs. The pooling is defensible because the
  conditions are byte-identical, but it is still not a single preregistered contrast.
- `FULL/OFF` at 32/40 here against 34/40 in window 7 is the cleanest replication in the family and
  gives a sense of the true cell noise at n = 40: about ±2.
- One task family, one function, one model, one temperature.

## What this changes

1. **The design rule is simpler and stronger than window 7 suggested.** It is not "avoid
   obligation-shaped redundancy" — it is **do not add sentences to a model-facing prompt that the
   window already answers**, whatever they say. Obligation-shaped ones are worse, but inert ones are
   not free.
2. **The identifier-priming line of enquiry is closed** by a direct readout, not by inference from
   success rates.
3. The open question moved to the delta: two of three observed authorization leaks are the same
   misreading of the word *"other"*. That is now the cheapest available experiment and it is about how
   Legasus phrases the requested behaviour — the same model-facing-representation surface, one layer up.
