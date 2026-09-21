# D1–D4 result — all four HOLD; a caller-visible consequence is demonstrated
2026-09-21. Preregistration `D-CONSEQUENCE_PREREG.md` (929cf62). Sealed target
`harry0703/MoneyPrinterTurbo @ 919170b05831`. Raw: `legasus/out/dexp/d_experiment.json`.

## Execution boundary, as enforced

    loaded            app/services/video.py from the sealed checkout, BY FILE PATH
    REAL              PIL, unicodedata, os, functools - everything the specimen actually uses
    STUBBED (12)      moviepy.*, app.config, app.models.*, app.utils.* - so no config is read,
                      no directory created, no network, email, OAuth or MCP surface touched
    loguru            stubbed with a RECORDER, which let the except branch be OBSERVED rather
                      than inferred
    font              C:\Windows\Fonts\arial.ttf

No MoneyPrinterTurbo process was started; one module's real bytes were imported and two of its
functions called.

## Results

| | proposition | observed | verdict |
|---|---|---|---|
| **D1** | inspection completes, glyphs present → True | returned `True`, no warning logged | **HOLDS** |
| **D2** | inspection completes, glyph absent → False | returned `False`, no warning logged | **HOLDS** |
| **D3** | inspection cannot complete → True | returned `True`, **and** logged `failed to inspect subtitle font glyphs: …, cannot open resource` | **HOLDS** |
| **D4** | the warning is suppressed under D3 | see below | **HOLDS** |

### D4, with its positive control

    font missing, inspection unverifiable     warning: []                                  <- suppressed
    glyph established absent                  warning: ['Subtitle Font Does Not Support Text']  <- fires
    glyph established present                 warning: []                                  <- correctly silent

The middle row is the positive control: the warning **does** fire for an established unsupported
result, so the empty first row is a suppression rather than a warning that never fires at all.

## What is now demonstrated

> When subtitle glyph verification **cannot be completed**, `_subtitle_font_supports_sample`
> returns the same value it returns when verification **succeeds and every glyph is present**.
> A caller cannot distinguish the two, and the user-facing *"Subtitle Font Does Not Support
> Text"* warning that fires for an established unsupported font is **silent** in the
> unverifiable case.

Fail-open semantics, plus a demonstrated caller-visible consequence.

## What is still NOT demonstrated

**That this is a defect.** The fail-open is explicit in the source, the failure is logged at
warning level, and treating an uninspectable font as usable may be a deliberate product choice —
a false positive here would wrongly block a user whose font is fine. Whether the suppression is
undesired is a claim about **project intent**, which is a separate proposition with its own
evidence requirement. Nothing here establishes it.

The evidentiary ladder stays separated, as instructed:

    D1-D3                    function semantics                          established
    D4                       demonstrated downstream consequence         established
    project-authored tests   POSSIBLE independent success witness        NOT yet established
    none of the above        defect / unintended behaviour               NOT established

## Two apparatus failures, recorded

**1. A positive control that could not fire.** D2 and D4 first used `U+E000`, a private-use
codepoint. `subtitle_font_supports_text` filters out non-L/N Unicode categories, so the sample
became empty, the function returned `True` early, and the warning never fired for *any* input.
D4 reported **UNOBSERVABLE** rather than claiming suppression — the harness's own guard caught
it. Repaired with `U+10330` (GOTHIC LETTER AHSA, category Lo, absent from Latin UI fonts).

**2. A silent no-op repair that reported success.** My first attempt to fix that control used a
string replacement with **no assert**, printed "positive control repaired", and changed nothing.
Two further attempts failed on the same anchor for different escaping reasons. Only after adding
`assert old in s` did the failure become visible. This is the project's own *silent failure
reports OK* class, committed by me, inside the harness built to characterise a fail-open.

**3. Three false UNOBSERVABLEs before that**, from incomplete stubs — a missing schema name, a
non-package `app`, and a placeholder without attributes. Each was an apparatus defect, not
evidence against D1–D4, and each was fixed rather than recorded as a result. The stubs are now
permissive by construction so this failure mode cannot recur silently.

## Caution for A3, carried from the preregistration

The project's own tests (`test/services/test_video.py:1308`,
`test_subtitle_background_settings.py:129,134,139`) call these functions and `assertTrue` on
them. That is a **candidate** success witness, not an established one: `assertTrue` establishes
an expected truth value, **not** the semantic proposition "font support was successfully
verified". Under D3 this function returns `True` when verification was impossible — so a test
asserting `True` could pass on either. Establishing what condition those tests assert as
successful is prerequisite work for A3, and must not become another automatic promotion.
