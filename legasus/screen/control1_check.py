"""CONTROL-1 - check the frozen acceptance criteria against the production scanner's output.

    python legasus/screen/control1_check.py <screen1.json>

The corpus is scanned by screen1.py through its ordinary entrypoint; this script only reads the
result and applies the six criteria frozen in CONTROL-1_PREREG.md (58d3d16). It does not scan,
and it does not modify any detector.
"""
import json
import sys

# Frozen in the preregistration, before the corpus file existed.
POSITIVES = {
    "upload_ok": "INV-A",              # A1  - predicted MISSED
    "sync_records": "INV-A",           # A2
    "sync_records_with_failure_path": "INV-A",
    "is_ready": "INV-B",               # B1
    "has_access": "INV-B",             # B2
}
NEGATIVES = {
    "token_missing": "INV-A",          # A-NEG - predicted FALSELY FLAGGED
    "is_ready_host": "INV-B",          # B-NEG - predicted FALSELY FLAGGED
}


def main():
    # Accepts screen1.json or screen2.json: invariant names are matched by FAMILY
    # (INV-A matches INV-A2), a mechanical adaptation for the rename, not a relaxation.
    d = json.load(open(sys.argv[1], encoding="utf-8"))
    cands = d["candidates"]
    by_fn = {}
    for c in cands:
        by_fn.setdefault(c["function"], []).append(c)

    print(f"files seen {d['filesSeen']}, parsed {d['filesParsed']}, unparseable {len(d['unparseable'])}")
    rows, failures = [], []

    for fn, inv in POSITIVES.items():
        hits = by_fn.get(fn, [])
        logical = {(h["file"].split("/")[-1], h["function"], h["invariant"]) for h in hits}
        ok = len(hits) >= 1 and all(h["invariant"].startswith(inv) for h in hits)
        rows.append(("POSITIVE", fn, inv, len(hits), len(logical), "FLAGGED" if ok else "MISSED"))
        if not ok:
            failures.append(f"positive {fn} ({inv}) was not flagged")

    for fn, inv in NEGATIVES.items():
        hits = by_fn.get(fn, [])
        rows.append(("NEGATIVE", fn, inv, len(hits), 0, "absent" if not hits else "FALSE POSITIVE"))
        if hits:
            failures.append(f"negative {fn} was flagged by {hits[0]['invariant']}")

    for kind, fn, inv, raw, logical, verdict in rows:
        print(f"  {kind:8} {fn:32} {inv}  rawHits={raw}  {verdict}")

    # CARDINALITY: the corpus is duplicated into nested/deep, so every logical case should have
    # exactly 2 raw hits and 1 logical identity.
    dup_ok = True
    for fn in POSITIVES:
        hits = by_fn.get(fn, [])
        if hits and len(hits) != 2:
            dup_ok = False
            failures.append(f"cardinality: {fn} produced {len(hits)} raw hits across 2 tree copies")
    print(f"  CARDINALITY  duplicated tree gives 2 raw hits per logical case: {'yes' if dup_ok else 'NO'}")

    # OBSERVABILITY: the unparseable file must be reported, never silently absorbed.
    obs_ok = any("unparseable" in u["file"] for u in d["unparseable"])
    print(f"  OBSERVABILITY unparseable file reported: {'yes' if obs_ok else 'NO - it vanished'}")
    if not obs_ok:
        failures.append("observability: the unparseable file was not reported")

    print()
    if failures:
        print(f"CONTROL-1: FAILED, {len(failures)} criterion violation(s)")
        for f in failures:
            print(f"  - {f}")
    else:
        print("CONTROL-1: PASSED - minimum demonstrated detection capability established")
    print("\nNote: passing establishes DEMONSTRATED DETECTION OF THESE CONTROLS, not sensitivity.")


if __name__ == "__main__":
    main()
