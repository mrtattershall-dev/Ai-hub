"""Contract validation, including the adversarial cases the seam exists to refuse.

Uses jsonschema (Draft 2020-12), not a hand-rolled checker, so the measure does
not carry its own semantics. A positive control (all emitted certificates
validate) guards against the schema being a refusal machine.
"""
import copy, json, sys
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker

sys.path.insert(0, str(Path(__file__).parent))
import obligation as O
from shadow_substitution import dom

HERE = Path(__file__).parent
SCHEMA = json.loads((HERE.parent / "contracts" / "entitlement-certificate.schema.json")
                    .read_text(encoding="utf-8"))
V = Draft202012Validator(SCHEMA, format_checker=FormatChecker())
CERT_DIR = HERE.parent / "out" / "certificates"

fails = []


def valid(doc):
    return not list(V.iter_errors(doc))


def first_error(doc):
    errs = list(V.iter_errors(doc))
    return errs[0].message[:90] if errs else "(none)"


# ---------------- positive control: every emitted certificate validates ----------------
certs = {p.stem: json.loads(p.read_text(encoding="utf-8")) for p in sorted(CERT_DIR.glob("*.json"))}
print("=== positive control: emitted certificates ===")
for name, c in certs.items():
    ok = valid(c)
    print("   %-6s %s  licensed=%-10s collateral=%d" % (name, "VALID" if ok else "INVALID",
                                                        c["licensed_relation"],
                                                        len(c["collateral_observations"])))
    if not ok:
        fails.append("positive control: %s invalid: %s" % (name, first_error(c)))
if not certs:
    fails.append("no certificates emitted")


# ---------------- semantic cross-check: the relation proof is real ----------------
def to_claim(j):
    return O.Claim2(O.Domain(j["domain"]["name"], tuple(j["domain"]["contained_in"])),
                    j["quantifier"], j["predicate"])

print("\n=== relation proof cross-check against the model ===")
for name, c in certs.items():
    if c["licensed_claim"] is None:
        continue
    req, lic = to_claim(c["requested_claim"]), to_claim(c["licensed_claim"])
    rel = "EQUIVALENT" if req == lic else O.compare(req, lic)
    print("   %-6s certificate says %-10s model says %s" % (name, c["licensed_relation"], rel))
    if rel not in ("EQUIVALENT", O.LICENSES):
        fails.append("%s: licensed slot holds a claim the request does not license" % name)

# the A8 knowledge must be KEPT, off the licensed slot: F1 supports a function-level
# existential the program-level request does not license
f1 = certs.get("F1")
if f1 is not None:
    kept = [x for x in f1["collateral_observations"]
            if x["relation_to_request"] == "STRONGER_THAN_REQUEST"]
    print("   F1 collateral STRONGER_THAN_REQUEST entries: %d" % len(kept))
    if not kept:
        fails.append("F1: the supported function-level existential was thrown away")


# ---------------- adversarial: what the schema must REFUSE ----------------
base = copy.deepcopy(next(iter(certs.values())))
lic_base = copy.deepcopy(certs["F4"])           # has a non-null licensed_claim

def mutated(doc, path, value):
    d = copy.deepcopy(doc)
    cur = d
    for k in path[:-1]:
        cur = cur[k]
    cur[path[-1]] = value
    return d

ADVERSARIAL = [
    ("top-level authorized: true",         mutated(base, ["authorized"], True)),
    ("top-level authority object",         mutated(base, ["authority"], {"minted": True})),
    ("top-level grant",                    mutated(base, ["grant"], ["commit"])),
    ("top-level kind: NORMATIVE",          mutated(base, ["kind"], "NORMATIVE")),
    ("top-level isAuthority: true",        mutated(base, ["isAuthority"], True)),
    ("top-level OWNER",                    mutated(base, ["OWNER"], "tatte")),
    ("nested authority in requested_claim", mutated(base, ["requested_claim", "authority"], True)),
    ("top-level cause",                    mutated(base, ["cause"], "instrument")),
    ("top-level root_cause",               mutated(base, ["root_cause"], "O")),
    ("reason inside a frontier item",      mutated(mutated(base, ["frontier"], [
        {"gate": "M", "unmet": "x", "reason": "because"}]), ["contract_version"],
        "1.0.0-frozen-2026-09-21")),
    ("licensed_claim set but relation NONE",
        mutated(lic_base, ["licensed_relation"], "NONE")),
    ("licensed_claim null but relation LICENSES",
        mutated(mutated(base, ["licensed_claim"], None), ["licensed_relation"], "LICENSES")),
    ("collateral claiming LICENSES",       mutated(base, ["collateral_observations"], [
        {"claim": base["requested_claim"], "relation_to_request": "LICENSES",
         "established_by": ["x"]}])),
    ("unknown top-level field",            mutated(base, ["extra"], 1)),
    ("wrong contract_version",             mutated(base, ["contract_version"], "0.9")),
    ("derivation alternative with no premises",
        mutated(base, ["derivation", "alternatives"], [
            {"premises": [], "relation_witnesses": [], "closed": True}])),
    ("instrument digest not sha256",
        mutated(base, ["measurement", "instrument", "version_digest"], "abc")),
    ("provenance with no evidence refs",
        mutated(base, ["provenance", "evidence_refs"], [])),
]

print("\n=== adversarial: must be REFUSED ===")
for label, doc in ADVERSARIAL:
    ok = valid(doc)
    print("   %-42s %s" % (label, "REFUSED" if not ok else "ACCEPTED  <-- HOLE"))
    if ok:
        fails.append("schema accepted: %s" % label)

print()
if fails:
    print("CONTRACT TEST FAILED (%d)" % len(fails))
    for f in fails:
        print("   - %s" % f)
    sys.exit(1)
print("CONTRACT TEST PASSED - %d certificates valid, %d adversarial cases refused, relation "
      "proofs cross-checked" % (len(certs), len(ADVERSARIAL)))
