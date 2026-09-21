"""D-COMP-1 - attack the seven-element evidence decomposition (prereg 1870c50).

    python legasus/screen/dcomp1.py <target-root> <out-dir>

Uses the real sealed subject (MoneyPrinterTurbo's subtitle font functions) plus a small local
metrics helper, so the constructions are not pure fiction. Every relation the decomposition
defines is evaluated and reported; the question is whether they can all hold while the
entitlement is false.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from d_experiment import build_stubs, load_module, _Recorder  # noqa: E402


def main():
    target_root, out_dir = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
    os.makedirs(out_dir, exist_ok=True)
    build_stubs(_Recorder())
    vd = load_module(target_root)
    from PIL import ImageFont

    fonts = os.path.join(target_root, "resource", "fonts")
    GOOD = os.path.join(fonts, "MicrosoftYaHeiBold.ttc")
    NO_CJK = os.path.join(fonts, "BeVietnamPro-Bold.ttf")
    CJK = "人工智能"
    corrupt = os.path.join(out_dir, "corrupt.ttf")
    with open(corrupt, "wb") as f:
        f.write(b"this is not a font")

    real_truetype = ImageFont.truetype

    def metrics_width(font_path, text):
        """An unrelated helper the witness also observes.

        Binds the REAL truetype at definition time, so a patch aimed at the subject does not
        reach it. Without this, I-prime would break the metrics clause too and the whole witness
        would fail under I-prime - which would NOT satisfy F1 as frozen. Fixing the
        CONSTRUCTION, never the criterion.
        """
        return real_truetype(font_path, 30).getlength(text)

    def clear():
        vd._subtitle_font_supports_sample.cache_clear()

    # ---- X1: discrimination real, but not via the proposition ---------------------------------
    # P  : "font support for CJK was VERIFIED for this font"
    # C  : UNVERIFIABLE (inspection cannot be completed)
    # W  : asserts supports(...) is True AND metrics_width(...) > 0
    # I  : use a corrupt font file        -> realises C, and ALSO breaks metrics_width
    # I' : patch truetype to raise        -> realises C, touches nothing else
    def W_x1(font_path):
        clear()
        assert vd.subtitle_font_supports_text(font_path, CJK) is True
        assert metrics_width(font_path, CJK) > 0

    def realizes_unverifiable(font_path):
        """Intervention witness: the subject's own except branch must have been taken."""
        clear()
        try:
            ImageFont.truetype(font_path, 30)
            return False                     # inspection completed - contrast NOT realised
        except Exception:
            return True

    x1 = {}
    # baseline
    try:
        W_x1(GOOD); x1["W_under_W0"] = "PASS"
    except Exception as e:  # noqa: BLE001
        x1["W_under_W0"] = f"FAIL ({type(e).__name__})"
    # I : corrupt font
    x1["realizes_I_C"] = realizes_unverifiable(corrupt)
    try:
        W_x1(corrupt); x1["W_under_I"] = "PASS"
    except Exception as e:  # noqa: BLE001
        x1["W_under_I"] = f"FAIL ({type(e).__name__})"
    # I': truetype raises, nothing else touched
    def boom(*a, **k):
        raise OSError("forced: inspection cannot be completed")
    ImageFont.truetype = boom
    x1["realizes_Iprime_C"] = realizes_unverifiable(GOOD)
    try:
        W_x1(GOOD)          # the WHOLE witness, which is what F1 as frozen requires
        x1["W_under_Iprime"] = "PASS"
    except Exception as e:  # noqa: BLE001
        x1["W_under_Iprime"] = f"FAIL ({type(e).__name__})"
    ImageFont.truetype = real_truetype

    x1["discriminates_W_P_C_I"] = x1["W_under_W0"] == "PASS" and x1["W_under_I"].startswith("FAIL")
    x1["F1_entitlement_false"] = (x1["discriminates_W_P_C_I"]
                                  and x1["realizes_Iprime_C"]
                                  and x1["W_under_Iprime"] == "PASS")

    # ---- X2: contrast coverage ----------------------------------------------------------------
    # P  : "font support for CJK was VERIFIED"
    # C  : declared class {UNSUPPORTED, UNVERIFIABLE}
    # W  : assertTrue only - the real T1 shape
    # I2 : UNSUPPORTED via a font genuinely lacking the glyphs (no patching at all)
    # I3 : UNVERIFIABLE via truetype raising
    def W_x2(font_path):
        clear()
        assert vd.subtitle_font_supports_text(font_path, CJK) is True

    x2 = {}
    try:
        W_x2(GOOD); x2["W_under_W0"] = "PASS"
    except AssertionError:
        x2["W_under_W0"] = "FAIL"
    clear()
    x2["realizes_I2_UNSUPPORTED"] = vd.subtitle_font_supports_text(NO_CJK, CJK) is False
    try:
        W_x2(NO_CJK); x2["W_under_I2_unsupported"] = "PASS"
    except AssertionError:
        x2["W_under_I2_unsupported"] = "FAIL"
    ImageFont.truetype = boom
    x2["realizes_I3_UNVERIFIABLE"] = realizes_unverifiable(GOOD)
    try:
        W_x2(GOOD); x2["W_under_I3_unverifiable"] = "PASS"
    except AssertionError:
        x2["W_under_I3_unverifiable"] = "FAIL"
    ImageFont.truetype = real_truetype

    x2["discriminates_W_P_UNSUPPORTED"] = x2["W_under_I2_unsupported"] == "FAIL"
    x2["F2_entitlement_false"] = (x2["discriminates_W_P_UNSUPPORTED"]
                                  and x2["realizes_I3_UNVERIFIABLE"]
                                  and x2["W_under_I3_unverifiable"] == "PASS")

    out = {"stage": "A - adversarial constructed cases, same author as the model",
           "X1_causally_irrelevant_discrimination": x1,
           "X2_contrast_coverage": x2,
           "Y1_counterexample": bool(x1["F1_entitlement_false"]),
           "Y2_counterexample": bool(x2["F2_entitlement_false"])}
    json.dump(out, open(os.path.join(out_dir, "dcomp1.json"), "w"), indent=2)
    for k, v in x1.items():
        print(f"  X1 {k}: {v}")
    print()
    for k, v in x2.items():
        print(f"  X2 {k}: {v}")
    print(f"\nY1 counterexample (F1): {out['Y1_counterexample']}")
    print(f"Y2 counterexample (F2): {out['Y2_counterexample']}")
    print(f"-> {os.path.join(out_dir, 'dcomp1.json')}")


if __name__ == "__main__":
    main()
