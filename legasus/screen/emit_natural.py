"""Emit the naturally-selected relation certificate, plus the ordinary case that will consume it.

The producer reports facts it already records. It does not certify the relation.
"""
import json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from entitlement_conformance import CASES
from certificate import emit, emit_relation, CONTRACT_V14
from natural_selection import relation_facts, qualifies, REQUIRED_RELATIONS

out_dir = Path(sys.argv[1]); out_dir.mkdir(parents=True, exist_ok=True)

# THE FROZEN SELECTION, re-applied rather than hard-coded, so the emitter cannot drift from it.
chosen = None
for name, (claim, ev, _) in CASES.items():
    for fact in relation_facts(name, claim, ev):
        if fact["relation"] in REQUIRED_RELATIONS and not qualifies(fact, ev):
            chosen = (name, claim, ev, fact)
            break
    if chosen:
        break

if not chosen:
    print("N8: no qualifying relation fact. Nothing emitted.")
    raise SystemExit(0)

name, claim, ev, fact = chosen

# A LIMITATION OF THE FROZEN SELECTION RULE, found by running it and recorded rather than retrofitted.
# The rule says "the first qualifying fact in fixture order". It does NOT say "a fact some consumer
# can use". F2's fact qualifies, but F2's own ordinary certificate has an OPEN derivation (census
# site #7), so it never reaches witness binding and cannot demonstrate consumption. The rule is not
# edited. Instead the first qualifying fact whose case ALSO has a closed derivation is emitted as a
# clearly labelled SECONDARY pair, so the loop can be shown end to end.
secondary = None
for n2, (c2, e2, _) in CASES.items():
    if not all(d.get("premises_decidable") and d.get("premises_settled")
               for d in e2.supporting_derivations):
        continue
    for f2 in relation_facts(n2, c2, e2):
        if f2["relation"] in REQUIRED_RELATIONS and not qualifies(f2, e2):
            secondary = (n2, c2, e2, f2)
            break
    if secondary:
        break
run_id = name.split()[0].replace("'", "p")
attribution = ("natural_selection.relation_facts[%r] -> %s recorded by %s"
               % (name, fact["relation"], fact["recorded_by"]))

rel = emit_relation(fact, ev, run_id + "-REL", ["out/natural_selection.json"], attribution)
(out_dir / "REL.json").write_text(json.dumps(rel, indent=2), encoding="utf-8")

# The ordinary certificate for the same case, unchanged in every other respect.
ordinary = emit(claim, ev, run_id, ["out/hadmission/substitution2.json"],
                version=CONTRACT_V14, attribution=attribution)
(out_dir / "ORD.json").write_text(json.dumps(ordinary, indent=2), encoding="utf-8")

print("relation certificate: %s" % rel["requested_claim"]["predicate"])
print("   quantifier %s over %s in %s" % (rel["requested_claim"]["quantifier"],
      rel["requested_claim"]["domain"]["name"], rel["measurement"]["observation"]["context"]["repository"]))
print("   rule %s" % rel["derivation"]["rule_id"])
print("   licensed_relation %s" % rel["licensed_relation"])
print("   a relation_established field? %s" % ("relation_established" in json.dumps(rel)))
print("ordinary certificate: %s (licensed %s)" % (ordinary["requested_claim"]["predicate"][:48],
      ordinary["licensed_relation"]))

if secondary:
    n2, c2, e2, f2 = secondary
    rid2 = n2.split()[0].replace("'", "p")
    attr2 = ("natural_selection.relation_facts[%r] -> %s recorded by %s"
             % (n2, f2["relation"], f2["recorded_by"]))
    rel2 = emit_relation(f2, e2, rid2 + "-REL", ["out/natural_selection.json"], attr2)
    (out_dir / "REL2.json").write_text(json.dumps(rel2, indent=2), encoding="utf-8")
    ord2 = emit(c2, e2, rid2, ["out/hadmission/substitution2.json"],
                version=CONTRACT_V14, attribution=attr2)
    (out_dir / "ORD2.json").write_text(json.dumps(ord2, indent=2), encoding="utf-8")
    print()
    print("SECONDARY (labelled): first qualifying fact whose case has a CLOSED derivation")
    print("   case     %s" % n2)
    print("   relation %s" % rel2["requested_claim"]["predicate"])
    print("   consumer %s needs %s" % (rid2, ord2["derivation"]["rule_id"]))
else:
    print()
    print("SECONDARY: none - no qualifying fact has a case with a closed derivation.")
