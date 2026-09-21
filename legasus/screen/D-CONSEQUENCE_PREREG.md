# D1–D4 — behavioural characterisation of the sole surviving specimen (frozen 2026-09-21)

Specimen: `app/services/video.py :: _subtitle_font_supports_sample`, reached in production only
through `subtitle_font_supports_text`. The only candidate of 45 that survived adjudication.

## What is blind here and what is not — disclosed before the predictions

**D1–D3 are blind.** They concern the function's own behaviour, and nothing has been executed.

**D4 is NOT blind.** Stating a consequence claim requires knowing what the consequence would
be, so I read the sole production consumer first (`webui/Main.py:7744`). D4 is therefore a
**characterisation informed by reading the caller**, not a prediction made in ignorance of it.
Presenting it as blind would be false.

**D4's original wording was wrong for this codebase and is corrected here.** I had drafted *"the
True prevents or changes a downstream fallback"*. There is **no font fallback**. The consumer is:

```python
if (params.subtitle_enabled and subtitle_preview_text
        and not video.subtitle_font_supports_text(selected_font_path, subtitle_preview_text)):
    st.warning(tr("Subtitle Font Does Not Support Text"))
```

The consequence at stake is the **suppression of a user-facing warning**, not the prevention of
an automatic fallback. Any finding must be stated in those terms.

## The propositions

    D1  glyph inspection completes and every required glyph is present  ->  returns True
    D2  glyph inspection completes and a required glyph is absent       ->  returns False
    D3  glyph inspection cannot be completed (raises)                   ->  returns True
    D4  under D3, `subtitle_font_supports_text` returns True, so `not ...` is False and the
        "Subtitle Font Does Not Support Text" warning is NOT shown - the user is not told the
        font may be unable to render their text, and cannot distinguish that state from a
        font that was verified to support it.

## Outcomes, and what each is entitled to say

    D1-D3 hold, D4 not demonstrated   fail-open semantics established LOCALLY; no caller-visible
                                      consequence shown
    D1-D4 hold                        an unverifiable font produces a demonstrated caller-visible
                                      consequence: a warning that would otherwise fire is silent
    D1, D2 or D3 fails                the static interpretation was wrong and SCREEN-2's single
                                      survivor needs revisiting

**Even if D1–D4 all hold, the boundary stands: a demonstrated consequence is not a demonstrated
defect.** Whether suppressing that warning is undesired is a claim about project intent, and
project intent is another proposition requiring its own evidence. Nothing here establishes it.

## Execution authorisation — not assumed

D1–D3 require executing MoneyPrinterTurbo code (importing `app.services.video`, which needs
Pillow) and D4 requires exercising the Streamlit consumer or a faithful stand-in. tatte
authorised running **Odysseus's** suite; that authorisation does not transfer to a different
target. **No MoneyPrinterTurbo code has been executed and none will be without a separate
instruction.**

The static half — the caller, the absence of a fallback, the exact warning suppressed — is
established above from source alone.

## A note for A3, recorded because it was found while doing this

The repository's own tests call this function and assert on it:

    test/services/test_video.py:1308      assertTrue(vd.subtitle_font_supports_text(...))
    test/services/test_subtitle_background_settings.py:129,134,139

That is precisely the **independently established success witness** A3 is specified to require —
a test asserting the successful outcome, authored by the project rather than inferred by the
detector. It is recorded here as an observation about where such witnesses can come from, not as
a design decision; A3 remains unwritten and gets its own preregistration.
