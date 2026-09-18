# ABLATING CONSTRAIN — is the authority envelope redundant with the verifier?

**Offline audit on recorded artifacts. No GPU time. No preregistration required because no new
generation was performed — every output replayed was already on disk, and the question is about the
apparatus rather than about a model.**

## The question

The ordering ablation cost nothing and produced the largest separation in the project — 105 verified
under the derived order, 0 under presentation order. `CONSTRAIN` had never had that treatment. Its
value had only ever been shown by **accident**: an envelope defect that refused `elif` and suppressed
yield across every model at once.

So, for every output the envelope refused: **what would have happened if it had not?**

    PROVE_WOULD_CATCH   a permissive envelope admits it, the contract probes reject it
                        -> redundant but cheap: CONSTRAIN catches early what PROVE catches late
    PROVE_WOULD_MISS    a permissive envelope admits it, the contract probes ACCEPT it
                        -> CONSTRAIN refused a SEMANTICALLY CORRECT program: over-constraint
    UNASSEMBLABLE       no guard and return can be extracted at all
                        -> CONSTRAIN caught something PROVE could not be pointed at

Extracting a fragment from a refused output is **not** a proposal to repair unauthorized output. This
project refuses repair, because repairing moves authority back to the apparatus. It is a measurement of
what the refused outputs *contained*.

## The instrument validated itself, blind

Run against the **old** envelope's refusals — the shapes window, before the `elif` repair:

    reason                                refused   CATCH   MISS   unassemblable
    not exactly one guard and one return     61        8     45          8
    repeated a fixed line                    23       23      0          0
    returned a function                       5        5      0          0
    TOTAL                                    89       36     45          8

    the 45 MISSes, by extracted fragment
      37x  if n < 10: return "small"
       8x  if n > 100: return "big"

**Forty-five semantically correct programs discarded**, and the raws are unambiguous:

    ```python
        elif n < 10:
            return "small"
    ```

The ablation **rediscovered the `elif` defect from historical data without being told it existed.** It
was built to answer a different question and found a known defect on its own — which is the strongest
evidence available that it is measuring something real rather than confirming what it was shown.

## Under the repaired envelope, zero over-constraint

    reason                                refused   CATCH   MISS   unassemblable
    repeated a fixed line                    15       15      0          0
    returned a function                      10       10      0          0
    not exactly one guard and one return      3        0      0          3
    TOTAL                                    28       25      0          3

**Not one refused output would have verified.** Every refusal is either something `PROVE` would also
have caught, or something `PROVE` could not have been run on at all.

## The deflationary finding, recorded as one

> In this data, **`CONSTRAIN` is not adding safety beyond `PROVE`.** 25 of 28 refusals would have been
> caught anyway. Its measured value is **cost** — rejecting early instead of assembling, executing and
> probing — plus the 3 outputs `PROVE` could not be pointed at.

That is a weaker claim for the authority envelope than the architecture's framing implies, and it is
the claim the data supports. It does **not** contradict the standing result that *authorization is a
strong filter and not a sufficient one* — that remains true, and is why `PROVE` exists. What is new is
the converse: in this family, authorization is also **not necessary for safety**, only for efficiency.

**The scope of that is narrow and load-bearing.** It is measured against a **contract-derived** probe
set, which is unusually strong: boundary triples around every bound the contract names, every existing
behaviour's bound, and deep interiors into every open end. Against a weaker verifier — a handful of
hand-chosen probes, or a regression suite — `CONSTRAIN` would be carrying real safety rather than
overlapping with it. **The envelope looks redundant precisely because the verifier is good.**

## What this changes

1. **`CONSTRAIN`'s justification is cost and unrunnability, not safety** — in this family, against this
   verifier. That belongs in `LEGASUS.md` as a measured qualification rather than being left to the
   architectural diagram to imply.
2. **Ablation has now found a defect it was not built to find.** It is no longer just an instrument for
   confirming a component matters; it is a way of auditing components that have never been questioned.
3. The natural next ablation is `RENDER`, and it is the one that **cannot** be done offline — a
   rendering change requires regeneration. That is a real asymmetry between the stages and worth
   stating: `DECIDE` and `CONSTRAIN` can be ablated on recorded artifacts; `RENDER` and `PROPOSE`
   cannot.
