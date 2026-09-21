"""W0/W1/W2 - does a project-authored test DISCRIMINATE, or merely pass?

    python legasus/screen/w_experiment.py <target-root> <out-dir>

Frozen in W-DISCRIMINATION_PREREG.md. Uses the project's real functions and real fonts at the
sealed commit. The tests' ASSERTIONS are reproduced verbatim from the project's source; the
project's test code is not edited and its heavy test harness is not imported.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from d_experiment import build_stubs, load_module, _Recorder  # noqa: E402  same frozen harness


def main():
    target_root, out_dir = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
    os.makedirs(out_dir, exist_ok=True)
    rec = _Recorder()
    build_stubs(rec)
    vd = load_module(target_root)
    from PIL import ImageFont

    fonts = os.path.join(target_root, "resource", "fonts")
    CJK = "人工智能"          # the Chinese text the project's test uses
    LATIN = "Artificial intelligence"
    missing = [f for f in ("BeVietnamPro-Bold.ttf", "MicrosoftYaHeiBold.ttc", "MicrosoftYaHeiNormal.ttc")
               if not os.path.exists(os.path.join(fonts, f))]
    if missing:
        json.dump({"verdict": "UNOBSERVABLE", "reason": f"fonts absent: {missing}"},
                  open(os.path.join(out_dir, "w_experiment.json"), "w"), indent=2)
        print(f"UNOBSERVABLE - fonts absent: {missing}")
        return

    real_truetype = ImageFont.truetype

    class _AlwaysMissingFont:
        """W2: every glyph reports absent, so the function's own comparison yields False."""

        def getmask(self, ch):
            class _M:
                size = (0, 0)

                def getbbox(self):
                    return None

                def __bytes__(self):
                    return b""
            return _M()

    def set_world(world):
        vd._subtitle_font_supports_sample.cache_clear()
        if world == "W0":
            ImageFont.truetype = real_truetype
        elif world == "W1":
            def boom(*a, **k):
                raise OSError("forced: inspection cannot be completed")
            ImageFont.truetype = boom
        elif world == "W2":
            ImageFont.truetype = lambda *a, **k: _AlwaysMissingFont()

    # The assertions, transcribed from the project's own tests.
    def T1():
        """test_video.py: assertTrue ONLY."""
        assert vd.subtitle_font_supports_text(os.path.join(fonts, "MicrosoftYaHeiNormal.ttc"), CJK) is True

    def T2():
        """test_subtitle_background_settings.py::test_detects_font_without_chinese_glyphs."""
        assert vd.subtitle_font_supports_text(os.path.join(fonts, "BeVietnamPro-Bold.ttf"), CJK) is False
        assert vd.subtitle_font_supports_text(os.path.join(fonts, "MicrosoftYaHeiBold.ttc"), CJK) is True
        assert vd.subtitle_font_supports_text(os.path.join(fonts, "BeVietnamPro-Bold.ttf"), LATIN) is True

    results = {}
    for name, fn in (("T1 (assertTrue only)", T1), ("T2 (assertFalse + assertTrue)", T2)):
        results[name] = {}
        for world in ("W0", "W1", "W2"):
            set_world(world)
            try:
                fn()
                results[name][world] = "PASS"
            except AssertionError:
                results[name][world] = "FAIL"
            except Exception as e:  # noqa: BLE001
                results[name][world] = f"UNOBSERVABLE ({type(e).__name__}: {e})"
    ImageFont.truetype = real_truetype

    def discriminates(row, a, b):
        return row[a] != row[b] and "UNOBSERVABLE" not in (row[a] + row[b])

    summary = {}
    for name, row in results.items():
        summary[name] = {
            "W0_vs_W1_verified_vs_unverifiable": "DISCRIMINATES" if discriminates(row, "W0", "W1") else "CANNOT DISTINGUISH",
            "W0_vs_W2_verified_vs_unsupported": "DISCRIMINATES" if discriminates(row, "W0", "W2") else "CANNOT DISTINGUISH",
        }
    out = {"sealedTarget": target_root, "results": results, "discrimination": summary}
    json.dump(out, open(os.path.join(out_dir, "w_experiment.json"), "w"), indent=2)
    for name, row in results.items():
        print(f"  {name:32} W0={row['W0']:>4}  W1={row['W1']:>4}  W2={row['W2']:>4}")
        for k, v in summary[name].items():
            print(f"        {k}: {v}")
    print(f"-> {os.path.join(out_dir, 'w_experiment.json')}")


if __name__ == "__main__":
    main()
