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
