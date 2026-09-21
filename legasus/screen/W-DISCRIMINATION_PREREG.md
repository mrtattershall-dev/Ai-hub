# W0/W1/W2 — do the project's tests DISCRIMINATE, or merely pass? (frozen 2026-09-21)

## The rule this experiment tests, stated before running

> A witness is not evidence for a proposition merely because it passes when that proposition is
> true. It must **discriminate** that proposition from the relevant ways it can be false or
> unestablished. **A witness that cannot distinguish success from non-establishment cannot
> entitle success.**

D1–D4 established that `_subtitle_font_supports_sample` returns `True` both when support is
VERIFIED and when verification is UNVERIFIABLE. The project's own tests assert on these
functions and were flagged as *candidate* success witnesses. This asks whether they can tell
those two states apart.

## The three worlds

    W0  unmodified                      the function behaves as shipped
    W1  inspection forced to fail       ImageFont.truetype raises -> every call returns True
    W2  glyph established absent        every glyph reports missing  -> every call returns False

## The candidate witnesses

    T1  test/services/test_video.py :: the font-support case            assertTrue ONLY
    T2  test/services/test_subtitle_background_settings.py ::
        test_detects_font_without_chinese_glyphs                        assertFalse AND assertTrue

## Predictions

**V1.** T1 **PASSES under W1.** An assert-true-only witness cannot distinguish *verified
supported* from *verification impossible*, because the function returns `True` in both. T1
therefore does not entitle "support was verified".
FALSIFIER: T1 fails under W1.

**V2.** T1 **FAILS under W2**, so it does discriminate *verified supported* from *verified
unsupported*. Combined with V1, what T1 actually witnesses is the weaker proposition **"not
established-unsupported"**.
FALSIFIER: T1 passes under W2.

**V3.** T2 **FAILS under both W1 and W2**, because it contains an `assertFalse` that a
universally-`True` world breaks and `assertTrue`s that a universally-`False` world breaks. A
witness containing assertions in *both* directions discriminates where a one-directional witness
cannot.
FALSIFIER: T2 passes under either.

If V1–V3 hold, the discriminating property is not "is a test" but **"asserts in both
directions"**, and that is a mechanically checkable property a future A3 could consume.

## Rules

Real project test code, real project fonts, sealed commit. Interventions are applied by patching
`PIL.ImageFont` inside the loaded module's namespace — the test code itself is **not edited**. A
missing font or an import failure is UNOBSERVABLE, never evidence. No result promotes a witness
to "establishes success"; the outcome is a statement about which states each witness separates.
