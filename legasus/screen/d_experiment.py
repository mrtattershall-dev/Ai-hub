"""D1-D4 - behavioural characterisation of MoneyPrinterTurbo's _subtitle_font_supports_sample.

    python legasus/screen/d_experiment.py <target-root> <out-dir>

Frozen in D-CONSEQUENCE_PREREG.md (929cf62). Executes the REAL source of the sealed commit.

EXECUTION BOUNDARY, enforced here and recorded in the result:
  * the module under test is loaded from the sealed checkout by file path
  * modules the specimen does NOT use (moviepy, app.config, app.models.*, pydantic) are STUBBED,
    so no configuration is read, no directory created, no network touched
  * loguru is stubbed with a recorder, which also lets the except branch be OBSERVED rather than
    inferred
  * PIL and unicodedata - the only things the specimen actually uses - are REAL
  * any missing dependency or import failure is recorded UNOBSERVABLE, never as evidence
    against D1-D4
"""
import json
import os
import sys
import types


STUBBED = []


class _PermissiveMeta(type):
    """A placeholder class whose attributes are themselves placeholders.

    Module-level code in the real file reads constants off stubbed types (e.g.
    ``VideoFitMode.cover``). A bare placeholder would raise, producing a FALSE UNOBSERVABLE about
    a name the specimen never touches.
    """

    def __getattr__(cls, item):
        if item.startswith("__"):
            raise AttributeError(item)
        return placeholder(item)


def placeholder(name):
    return _PermissiveMeta(name, (), {})


class _PermissiveModule(types.ModuleType):
    """Any attribute resolves to a placeholder type.

    Enumerating every name a stubbed module exports is an apparatus chore, and an incomplete
    enumeration would surface as a FALSE UNOBSERVABLE - the experiment failing for a reason that
    has nothing to do with the specimen. Permissive stubs remove that failure mode. The specimen
    itself touches none of these names.
    """

    def __getattr__(self, item):
        if item.startswith("__"):
            raise AttributeError(item)
        return placeholder(item)


def stub(name, attrs=None):
    m = _PermissiveModule(name)
    m.__path__ = []                      # treat every stub as a package
    for k, v in (attrs or {}).items():
        setattr(m, k, v)
    sys.modules[name] = m
    STUBBED.append(name)
    return m


STUB_ROOTS = ("app.", "moviepy.")


class _StubFinder:
    """Auto-create a permissive stub for ANY submodule under a stubbed root.

    Same reasoning as the permissive attributes: an unstubbed submodule would surface as a FALSE
    UNOBSERVABLE about the specimen, which touches none of them. Every module created this way is
    recorded in `stubbed`, so the deviation from the real tree is visible in the result.
    """

    def find_module(self, fullname, path=None):
        return self if fullname.startswith(STUB_ROOTS) else None

    def find_spec(self, fullname, path=None, target=None):
        if not fullname.startswith(STUB_ROOTS):
            return None
        import importlib.machinery
        return importlib.machinery.ModuleSpec(fullname, self)

    def create_module(self, spec):
        m = _PermissiveModule(spec.name)
        m.__path__ = []
        STUBBED.append(spec.name + " (auto)")
        return m

    def exec_module(self, module):
        return None


class _Recorder:
    def __init__(self):
        self.calls = []

    def _mk(self, level):
        def f(msg, *a, **k):
            self.calls.append((level, str(msg)))
        return f

    def __getattr__(self, item):
        return self._mk(item)


def build_stubs(rec):
    sys.meta_path.insert(0, _StubFinder())
    stub("loguru", {"logger": rec})
    mv = stub("moviepy")
    for n in ("AudioFileClip", "ColorClip", "CompositeAudioClip", "CompositeVideoClip",
              "ImageClip", "TextClip", "VideoFileClip", "afx", "concatenate_videoclips", "vfx"):
        setattr(mv, n, object)
    stub("moviepy.video")
    stub("moviepy.video.tools")
    stub("moviepy.video.tools.subtitles", {"SubtitlesClip": object})
    stub("app")
    stub("app.config", {"config": types.SimpleNamespace(app={}, ui={})})
    stub("app.models")
    stub("app.models.const")
    schema = stub("app.models.schema")
    for n in ("MaterialInfo", "SubtitlePosition", "VideoAspect", "VideoConcatMode",
              "VideoParams", "VideoTransitionMode"):
        setattr(schema, n, placeholder(n))
    stub("app.utils")
    stub("app.utils.utils", {"storage_dir": lambda *a, **k: ".", "font_dir": lambda *a, **k: "."})


def load_module(target_root):
    import importlib.util
    path = os.path.join(target_root, "app", "services", "video.py")
    spec = importlib.util.spec_from_file_location("mpt_video_under_test", path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules["mpt_video_under_test"] = mod
    spec.loader.exec_module(mod)
    return mod


def find_font():
    for p in (r"C:\Windows\Fonts\arial.ttf", r"C:\Windows\Fonts\segoeui.ttf", r"C:\Windows\Fonts\tahoma.ttf"):
        if os.path.exists(p):
            return p
    return None


def main():
    target_root, out_dir = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
    os.makedirs(out_dir, exist_ok=True)
    rec = _Recorder()
    result = {"sealedTarget": target_root, "stubbed": None, "real": ["PIL", "unicodedata", "os", "functools"],
              "results": {}, "notes": []}
    try:
        build_stubs(rec)
        result["stubbed"] = list(STUBBED)
        vd = load_module(target_root)
    except Exception as e:  # noqa: BLE001
        result["results"]["ALL"] = {"verdict": "UNOBSERVABLE", "reason": f"{type(e).__name__}: {e}"}
        json.dump(result, open(os.path.join(out_dir, "d_experiment.json"), "w"), indent=2)
        print(f"UNOBSERVABLE - the module could not be loaded: {type(e).__name__}: {e}")
        return

    font = find_font()
    if not font:
        result["results"]["ALL"] = {"verdict": "UNOBSERVABLE", "reason": "no system TrueType font found"}
        json.dump(result, open(os.path.join(out_dir, "d_experiment.json"), "w"), indent=2)
        print("UNOBSERVABLE - no font available")
        return
    result["fontUsed"] = font

    def run(label, font_path, sample):
        rec.calls.clear()
        try:
            got = vd._subtitle_font_supports_sample(font_path, sample)
            return {"returned": got, "loggedWarnings": list(rec.calls), "error": None}
        except Exception as e:  # noqa: BLE001
            return {"returned": None, "loggedWarnings": list(rec.calls), "error": f"{type(e).__name__}: {e}"}

    # D1 - inspection completes, glyphs present
    d1 = run("D1", font, "abc")
    result["results"]["D1"] = {**d1, "proposition": "inspection completes, glyphs present -> True",
                               "verdict": "HOLDS" if d1["returned"] is True and not d1["loggedWarnings"] else "FAILS"}

    # D2 - inspection completes, a glyph absent.
    # U+E000 was used first and was WRONG for D4: subtitle_font_supports_text filters out
    # non-L/N Unicode categories, so a private-use char leaves an EMPTY sample and the positive
    # control cannot fire. A Gothic letter is category Lo, passes that filter, and is absent from
    # ordinary Latin UI fonts. If this font happens to contain it, the result is UNOBSERVABLE.
    ABSENT_LETTER = "\U00010330"
    d2 = run("D2", font, ABSENT_LETTER)
    if d2["error"]:
        result["results"]["D2"] = {**d2, "verdict": "UNOBSERVABLE", "proposition": "inspection completes, glyph absent -> False"}
    else:
        result["results"]["D2"] = {**d2, "proposition": "inspection completes, glyph absent -> False",
                                   "verdict": "HOLDS" if d2["returned"] is False else
                                              ("UNOBSERVABLE" if d2["loggedWarnings"] else "FAILS")}

    # D3 - inspection cannot complete: the font path does not exist, so truetype() raises.
    missing = os.path.join(target_root, "no-such-font-9f3a2b.ttf")
    d3 = run("D3", missing, "abc")
    result["results"]["D3"] = {**d3, "proposition": "inspection cannot complete -> True",
                               "verdict": "HOLDS" if d3["returned"] is True and d3["loggedWarnings"] else "FAILS"}

    # D4 - the smallest faithful consumer, preserving the real condition from webui/Main.py:7744
    warnings_shown = []

    def consumer(subtitle_enabled, subtitle_preview_text, font_path):
        if (subtitle_enabled and subtitle_preview_text
                and not vd.subtitle_font_supports_text(font_path, subtitle_preview_text)):
            warnings_shown.append("Subtitle Font Does Not Support Text")

    warnings_shown.clear(); consumer(True, "abc", missing)
    unverifiable_shown = list(warnings_shown)
    warnings_shown.clear(); consumer(True, ABSENT_LETTER, font)
    established_unsupported_shown = list(warnings_shown)
    warnings_shown.clear(); consumer(True, "abc", font)
    supported_shown = list(warnings_shown)

    result["results"]["D4"] = {
        "proposition": "under D3 the warning that fires for an established unsupported result is suppressed",
        "warningWhenUnverifiable": unverifiable_shown,
        "warningWhenEstablishedUnsupported": established_unsupported_shown,
        "warningWhenSupported": supported_shown,
        "verdict": "HOLDS" if (not unverifiable_shown and established_unsupported_shown and not supported_shown)
                   else ("UNOBSERVABLE" if not established_unsupported_shown else "FAILS"),
        "note": "if no warning fires even for an established unsupported font, the comparison has no "
                "positive control and D4 is UNOBSERVABLE rather than demonstrated",
    }
    json.dump(result, open(os.path.join(out_dir, "d_experiment.json"), "w"), indent=2)
    for k, v in result["results"].items():
        print(f"  {k}: {v['verdict']}  returned={v.get('returned')} warnings={v.get('loggedWarnings') or v.get('warningWhenUnverifiable')}")
    print(f"-> {os.path.join(out_dir, 'd_experiment.json')}")


if __name__ == "__main__":
    main()
