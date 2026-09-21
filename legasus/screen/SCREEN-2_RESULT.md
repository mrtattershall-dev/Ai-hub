# SCREEN-2 result — S4 FALSIFIED, and the contract's central design move is falsified with it
2026-09-21. Frozen detector (`DETECTOR-FREEZE.json`, full 64-hex digests, **verified against the
bytes on disk immediately before the run**). Sealed target `harry0703/MoneyPrinterTurbo @
919170b05831a98856ba187903234bc6957d1d66` — checked-out HEAD matched the sealed SHA exactly.
Detector not modified during the run.

## Ordering disclosure, because it matters more than the numbers

The S4 adjudication rule (*a candidate survives only if the source establishes the proposition
that invariant reports; ambiguity becomes UNKNOWN and never enters the denominator; dedup before
the denominator; dynamic evidence may not be replaced by manual plausibility*) was specified by
tatte **after the scan had run and after I had read five candidates.** It is applied from that
point, and the five are marked as **read-before-rule**. Pretending the rule was frozen first
would be exactly the post-hoc discretion it exists to remove.

## The scan

    files seen / parsed      50 / 50      unparseable 0
    INV-A2   VIOLATION 45    DISTINGUISHABLE 5    UNKNOWN 52
    INV-B2   PROVEN_FAILURE_UNREACHABLE 0    REACHABLE 11    UNKNOWN 28
    reportable candidates    45, in 14 files, no duplicate tree

## Predictions, scored

**S1 CONFIRMED** — INV-A2 produced ≥1 VIOLATION (45).
**S2 CONFIRMED** — UNKNOWN (52+28 = 80) outnumbers all reportable verdicts (45).
**S3 CONFIRMED** — INV-B2 reportable (0) < INV-A2 VIOLATION (45).
**S4 FALSIFIED**, as I predicted it would be. Adjudicated so far: **5 of 45**, of which
**4 false positives, 1 survives.** No precision figure is claimed for the other 40; adjudication
is incomplete and a rate extrapolated from five would be manufactured.

## The false positives are one structural cause, and it indicts the contract

| candidate | ordinary return that matched | why it is not a defect |
|---|---|---|
| `_normalize_allowed_origin` | `return None` for a scheme that can never match | docstring states parse failure **must** converge to None |
| `should_use_bgm` | `return False` for empty bgm_type | both mean "no BGM"; deliberate |
| `search_videos_pixabay` | `return []` after a logged non-2xx | both are failure paths |
| `cleanup_expired_material_search_cache` | `return 0` for "too soon" | both mean "0 deleted" |

In every case the exceptional return is identical to an **ordinary return that itself signals
failure or an empty result**. Identity between two failure paths is not the invariant's
proposition.

**So INV-A2's reformulation did not remove the polarity dependence — it relocated it.** The
contract claimed A2 "never asks what the value *means*" by comparing the exceptional return
against *any* ordinary return. But the proposition requires comparison against an ordinary
**success** return. Instead of needing to know which *value* means success, A2 needs to know
which *ordinary return* represents success — polarity at a different granularity, and equally
unestablished.

That is a falsification of dc4d63e's central design move, produced by a repository that
contributed nothing to its construction. It is the result of this run.

## The one candidate that survives adjudication

`app/services/video.py :: _subtitle_font_supports_sample`

```python
        for char in sample:
            ...
            if char_mask.getbbox() is None or char_signature == missing_signature:
                return False
        return True                      # <- success: every glyph is supported
    except Exception as e:
        logger.warning(f"failed to inspect subtitle font glyphs: {font_path}, {e}")
        return True                      # <- inspection FAILED, reported as supported
```

Here the matched ordinary return **is** the success return. A caller cannot distinguish *"every
glyph was verified present"* from *"the glyphs could not be inspected"*. That is precisely
INV-A2's proposition, and the source establishes it.

**What this does NOT establish.** That it is a defect. Fail-open may be deliberate — the warning
is logged, and the consequence (subtitles rendering with missing glyphs instead of triggering a
font fallback) is a *behavioural* claim requiring dynamic evidence. Under the frozen rule,
manual plausibility may not promote it. Status: **the invariant's proposition is established;
the defect claim is UNKNOWN pending dynamic confirmation.**

## What SCREEN-2 is entitled to say

> A detector frozen and hashed before the target was opened, pointed at a repository sealed
> before the detector existed, produced 45 candidates of which 5 have been adjudicated: 4 fail
> because the invariant compares against failure paths as well as success paths, and 1
> establishes the invariant's proposition in a live external codebase whose authors had no
> contact with this work.

It is **not** entitled to say a defect was found. The trophy condition requires independent
diagnosis, which has not happened, and dynamic confirmation, which has not been attempted.

## Nothing published

No issue filed, no patch proposed, no contact with the project. The finding goes to tatte only.

## Next, and the detector is not touched first

1. Adjudicate the remaining 40 under the frozen rule, dedup before the denominator.
2. Decide whether `_subtitle_font_supports_sample` warrants dynamic confirmation — and if so,
   design it before running it.
3. **A3 is a new experiment, not a patch.** The fix — compare only against ordinary returns that
   are success returns — reintroduces the polarity problem the contract tried to dissolve, and
   would need its own preregistration explaining how success is established without guessing.

## Adjudication complete — all 45, in two cohorts kept separate

    raw candidates                 45
    after dedup (before denominator)  45   (the target has no duplicated tree)

    COHORT A  read BEFORE the adjudication rule was frozen      5
              survives 1   rejected 4   unknown 0
    COHORT B  adjudicated UNDER the frozen rule                 40
              survives 0   rejected 40  unknown 0

    total: 1 survives, 44 rejected, 0 UNKNOWN     precision 1/45

**The single survivor is in cohort A** (`_subtitle_font_supports_sample`, read fifth, before
the rule existed). Re-checked against the frozen rule afterwards, it satisfies it: the matched
ordinary return is the terminal `return True` reached only after every glyph is verified — an
established success outcome, not a guard. The cohorts are not flattened into one figure, because
the survivor's provenance is pre-rule and that is part of what the number means.

**UNKNOWN was available and never needed.** Every candidate could be settled from source. That
is a fact about this cohort, not evidence that the category is superfluous.

## Instrument characterization — one failure family, not several

The question the remaining 40 were read to answer: is the early pattern one dominant structural
flaw, or does A2 contain further failure families not yet seen?

**One family. All 44 rejections share an identical cause**: the matched ordinary return is a
guard or a logged-failure path — `if not x: return None`, `logger.error(...); return []`,
`if audio_duration == 0: _mark_task_failed(...); return None, None, None`. Across 14 files, 45
candidates, 11 distinct shared values (`None`×23, `False`×6, `[]`×6, `''`×3, `0`, `0.0`, `1`,
`True`, `{}`, and two tuple shapes), **no second failure family appeared.**

So the falsification is narrow and total: A2 is wrong in exactly one way, and that way accounts
for 44 of 45 candidates. The unjustified edge in its evidence chain is precisely:

    an ordinary path exists  ->  [assumed successful]  ->  same observable result
                             ->  exception admitted as success

## The sharpened proposition this run produced

> An exceptional path is suspicious when it is observationally indistinguishable from an
> **established successful** outcome — not merely from an outcome reachable without an exception.

Equivalently, and this is the sentence the run earned:

> **Non-exceptional execution is not evidence of successful execution.**

A2 was explicitly designed to eliminate polarity assumptions, passed its frozen conformance
controls 6/6, and still embedded that assumption structurally. An independent target found it;
the author's own corpus could not.

## A3's boundary, from this result

A3 must require an **independently established success witness** — a test assertion, a caller
branch, an explicit contract, a witnessed successful execution — and must **not** infer success
from "this return did not throw". With no such witness: **UNKNOWN**.

A3 will therefore say UNKNOWN far more often than A2 and report far less. That is the intended
direction: a detector whose VIOLATION means what it claims is more useful than one that reports
45 things of which 44 are wrong.

A3 is a new experiment with its own preregistration, not a patch to a frozen detector.

## CORRECTION (appended, original wording left above)

Two overclaims in the sections above, corrected here rather than edited away.

**1. "precision 1/45" must not be read as a prospective precision estimate.** The adjudication
rule was frozen only after the first five candidates were read, so the 45 do not form one
prospectively adjudicated cohort. The defensible presentation is the split, which is *harsher*
on A2 than the flattened figure:

    cohort        candidates   survived   rejected
    pre-rule               5          1          4
    frozen-rule           40          0         40

**2. "A2 is wrong in exactly one way" is stronger than the evidence.** What is established is:
*one observed failure family explains all 44 rejected candidates in this corpus.* Unseen failure
families may exist in other code. The evidence for the family is nonetheless strong precisely
because the shared values are heterogeneous — `None`, `False`, `[]`, `''`, `0`, `0.0`, `1`,
`{}`, tuples, and even `True` all participate, so this is not an artifact of one sentinel. The
commonality is semantic, not syntactic:

> **ordinary execution ≠ successful execution**

**The result, stated at the width the evidence supports:**

> In this external prospective target, every observed false positive from INV-A2 arose from one
> unsupported inference: treating a non-exceptional return as evidence of successful execution.
