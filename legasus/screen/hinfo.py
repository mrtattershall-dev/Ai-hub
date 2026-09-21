"""H-INFO vs H-RICH - do more values buy entitlement, or does preserving the right distinction?

    python legasus/screen/hinfo.py <target-root> <out-dir>

Frozen in H-INFO_PREREG.md (bd50cde). The three states are produced by real interventions on the
real sealed subject; each representation is then computed from the SAME executions, so the
comparison is between representations and nothing else.
"""
import itertools
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from d_experiment import build_stubs, load_module, _Recorder  # noqa: E402

STATES = ("SUPPORTED", "UNSUPPORTED_ALL", "UNSUPPORTED_PARTIAL", "UNVERIFIABLE")


def entitlement(observations, p_true_states):
    """Can ANY witness over this representation separate the P-true states from the P-false ones?

    Decidable by enumeration: if two states on opposite sides of P share a representation value,
    no predicate over the representation can separate them.
    """
    collisions = []
    for a, b in itertools.combinations(STATES, 2):
        if (a in p_true_states) != (b in p_true_states) and observations[a] == observations[b]:
            collisions.append((a, b, observations[a]))
    return {"holds": not collisions, "collisions": collisions,
            "distinctValues": len(set(map(repr, observations.values())))}


def main():
    target_root, out_dir = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
    os.makedirs(out_dir, exist_ok=True)
    build_stubs(_Recorder())
    vd = load_module(target_root)
    from PIL import ImageFont

    fonts = os.path.join(target_root, "resource", "fonts")
    GOOD, NO_CJK = os.path.join(fonts, "MicrosoftYaHeiBold.ttc"), os.path.join(fonts, "BeVietnamPro-Bold.ttf")
    CJK = "人工智能"          # all four glyphs absent from the Latin font
    MIXED = "人工Ab"        # two absent, two present -> a PARTIAL state
    real_truetype = ImageFont.truetype

    def observe(state):
        """Run the REAL subject under an intervention realising `state`; return rich facts."""
        vd._subtitle_font_supports_sample.cache_clear()
        text = CJK
        if state == "UNVERIFIABLE":
            def boom(*a, **k):
                raise OSError("forced")
            ImageFont.truetype = boom
            font, expect_completed = GOOD, False
        elif state == "SUPPORTED":
            ImageFont.truetype = real_truetype
            font, expect_completed = GOOD, True
        elif state == "UNSUPPORTED_ALL":
            ImageFont.truetype = real_truetype
            font, expect_completed = NO_CJK, True
        else:   # UNSUPPORTED_PARTIAL - some glyphs present, some absent
            ImageFont.truetype = real_truetype
            font, expect_completed, text = NO_CJK, True, MIXED
        shipped = vd.subtitle_font_supports_text(font, text)
        # count missing glyphs independently, using the real font machinery
        missing = 0
        completed = True
        try:
            f = real_truetype(font, 30) if state != "UNVERIFIABLE" else ImageFont.truetype(font, 30)
            ref = f.getmask("\U0010ffff")
            refsig = (ref.size, ref.getbbox(), bytes(ref))
            for ch in text:
                m = f.getmask(ch)
                if m.getbbox() is None or (m.size, m.getbbox(), bytes(m)) == refsig:
                    missing += 1
        except Exception:  # noqa: BLE001
            completed = False
        ImageFont.truetype = real_truetype
        return {"shipped": shipped, "missing": missing, "completed": completed,
                "intervention_realised": completed == expect_completed}

    facts = {s: observe(s) for s in STATES}
    if not all(f["intervention_realised"] for f in facts.values()):
        json.dump({"verdict": "APPARATUS FAILURE", "facts": facts},
                  open(os.path.join(out_dir, "hinfo.json"), "w"), indent=2)
        print("APPARATUS FAILURE - an intervention did not realise its state; G1/G2 may not be read")
        return

    # P = "glyph inspection completed" -> true for SUPPORTED and UNSUPPORTED, false for UNVERIFIABLE
    P_TRUE = {"SUPPORTED", "UNSUPPORTED_ALL", "UNSUPPORTED_PARTIAL"}

    # R_rich: 4 distinct values available, but UNVERIFIABLE is reported as "ok" like SUPPORTED.
    def r_rich(f):
        # More distinct values than R_poor by construction, and still collapses SUPPORTED with
        # UNVERIFIABLE onto "ok" - which is the entire point of the comparison.
        return "ok" if f["shipped"] else f"missing:{f['missing']}"

    # R_poor: 2 values, but exactly the distinction P needs.
    def r_poor(f):
        return f["completed"]

    # R_shipped: the actual exported representation (the must-fire control).
    def r_shipped(f):
        return f["shipped"]

    reps = {"R_rich": r_rich, "R_poor": r_poor, "R_shipped(control)": r_shipped}
    results = {}
    for name, fn in reps.items():
        obs = {s: fn(facts[s]) for s in STATES}
        results[name] = {"observations": obs, **entitlement(obs, P_TRUE)}

    richer = results["R_rich"]["distinctValues"] > results["R_poor"]["distinctValues"]
    g1 = results["R_rich"]["holds"] is False
    g2 = results["R_poor"]["holds"] is True
    g3 = results["R_shipped(control)"]["holds"] is False
    verdict = ("APPARATUS FAILURE - R_rich is not richer than R_poor on the tested states, so the "
               "comparison the predictions rest on did not occur" if not richer
               else "APPARATUS FAILURE - the control did not reproduce the real case" if not g3
               else "H-INFO DISCRIMINATED from H-RICH" if (g1 and g2)
               else "H-RICH is the better account" if (not g1 and not g2)
               else "MIXTURE - neither discriminated")

    out = {"P": "glyph inspection completed", "facts": facts, "results": results,
           "G1_rich_fails": g1, "G2_poor_holds": g2, "G3_control_reproduces": g3, "R_rich_actually_richer": richer, "verdict": verdict}
    json.dump(out, open(os.path.join(out_dir, "hinfo.json"), "w"), indent=2)
    for name, r in results.items():
        print(f"  {name:20} values={r['distinctValues']}  entitlement={'HOLDS' if r['holds'] else 'FAILS'}"
              f"  {'collisions: ' + str(r['collisions']) if r['collisions'] else ''}")
    print(f"\nG1 rich fails: {g1}\nG2 poor holds: {g2}\nG3 control reproduces the real case: {g3}")
    print(f"=> {verdict}")
    print(f"-> {os.path.join(out_dir, 'hinfo.json')}")


if __name__ == "__main__":
    main()
