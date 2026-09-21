"""H-ORTHO: are O, D and M independent gates?

Three predicates over structured case records. Each gate reads DIFFERENT fields;
a gate that rejects outside its family had enough input to do another's job.
Case fields are quoted from the result documents and fixed before any gate runs.
"""
import json, sys

# ---- case records: fields quoted from the result documents, fixed in advance ----
CASES = {
    "F1 StageB case3 validate_cuda": dict(
        family="O",
        # O inputs
        claim_form="EXISTENTIAL",
        claimed_scope="PROGRAM",          # "this decision can be wrong in this program"
        evidence_scope="FUNCTION",        # "this function can be wrong for an input"
        domain_stated=True, coverage_stated=True,
        # D inputs
        supporting_derivations=[dict(premises_decidable=True, premises_settled=True)],
        # M inputs
        positive_control_fired=True,
        verdict_as_stated="wrong entitlement demonstrated for this program",
    ),
    "F2 REACH-1 get_path (site #7)": dict(
        family="D",
        claim_form="EXISTENTIAL",
        claimed_scope="FUNCTION_PARAMETER",
        evidence_scope="FUNCTION_PARAMETER",
        domain_stated=True, coverage_stated=True,
        supporting_derivations=[dict(premises_decidable=False, premises_settled=False)],
        positive_control_fired=True,
        verdict_as_stated="REACHABLE",
    ),
    "F3 SCREEN-1 zero findings": dict(
        family="M",
        claim_form="EXISTENTIAL_NEGATIVE_SCOPED",   # "zero findings ... nothing about Odysseus"
        claimed_scope="THIS_RUN",
        evidence_scope="THIS_RUN",
        domain_stated=True, coverage_stated=True,
        supporting_derivations=[dict(premises_decidable=True, premises_settled=True)],
        positive_control_fired=False,               # CONTROL-1 failed 4 of 6
        verdict_as_stated="zero findings, precision 0/3",
    ),
    "F4 REACH-1 R2 (59/60 beyond locality)": dict(
        family="none",
        claim_form="UNIVERSAL_OVER_SAMPLE",
        claimed_scope="SAMPLE",
        evidence_scope="SAMPLE",
        domain_stated=True, coverage_stated=True,
        supporting_derivations=[dict(premises_decidable=True, premises_settled=True)],
        positive_control_fired=True,                # calibration reproduced 3 known verdicts
        verdict_as_stated="closure extends beyond the function body in 59/60",
    ),
}


def gate_O(c):
    """Reads claim form, scope and evidence domain. Nothing about premises or instruments."""
    if c["claimed_scope"] != c["evidence_scope"]:
        return False, "claimed scope %s exceeds evidence scope %s" % (
            c["claimed_scope"], c["evidence_scope"])
    if c["claim_form"].startswith("UNIVERSAL") or c["claim_form"] == "ABSENCE":
        if not (c["domain_stated"] and c["coverage_stated"]):
            return False, "universal/absence claim without stated domain and coverage"
    return True, "evidence topology licenses the claim as stated"


def gate_D(c):
    """Reads only the supporting derivations."""
    ok = [d for d in c["supporting_derivations"]
          if d["premises_decidable"] and d["premises_settled"]]
    if not ok:
        return False, "no supporting derivation with settled, decidable premises"
    return True, "%d supporting derivation(s) fully settled" % len(ok)


def gate_M(c):
    """Reads only whether the instrument demonstrated capability."""
    if not c["positive_control_fired"]:
        return False, "instrument capability not demonstrated"
    return True, "positive control fired"


if __name__ == "__main__":
    rows, cross = [], 0
    print("%-34s %-6s %-6s %-6s %-6s %s" % ("case", "family", "O", "D", "M", "entitled"))
    for name, c in CASES.items():
        o, ro = gate_O(c)
        d, rd = gate_D(c)
        m, rm = gate_M(c)
        failed = [g for g, v in (("O", o), ("D", d), ("M", m)) if not v]
        off = [g for g in failed if g != c["family"]]
        cross += len(off)
        print("%-34s %-6s %-6s %-6s %-6s %s" % (name[:34], c["family"],
              "PASS" if o else "FAIL", "PASS" if d else "FAIL",
              "PASS" if m else "FAIL", o and d and m))
        if failed:
            for g, r in (("O", ro), ("D", rd), ("M", rm)):
                if g in failed:
                    print("        %s: %s%s" % (g, r, "   <-- OFF-DIAGONAL" if g in off else ""))
        rows.append(dict(case=name, family=c["family"], O=o, D=d, M=m,
                         entitled=bool(o and d and m), off_diagonal=off))

    print()
    diag = all((r["family"] == "none" and r["entitled"]) or
               (r["family"] != "none" and not r["entitled"] and not r["off_diagonal"])
               for r in rows)
    print("T-1  each case fails exactly its own gate, F4 passes all : %s" % diag)
    print("T-2  cross-detection count                               : %d" % cross)
    json.dump(dict(rows=rows, cross_detection=cross, t1=diag),
              open(sys.argv[1], "w", encoding="utf-8"), indent=2)
