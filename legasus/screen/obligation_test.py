"""Q-1..Q-5 against the replacement obligation model. Frozen predictions only."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from obligation import (Domain, Claim2, Observation, Extent, compile_obligation, compare,
                        strongest_licensed, EXISTS, FOR_ALL, NONE,
                        PARTIAL, EXHAUSTIVE, LICENSES, INCOMPARABLE)

REPO = Domain("repository")
FUNC = Domain("function_F", contained_in=("repository",))
S60 = Domain("sample_S60", contained_in=("repository",))

fails = []

# ---------------------------------------------------------------- Q-1
print("Q-1 incomparability")
a = Claim2(S60, FOR_ALL, "closure extends beyond the function body")
b = Claim2(FUNC, FOR_ALL, "closure extends beyond the function body")
ab, ba = compare(a, b), compare(b, a)
print("   sample_S60 FOR_ALL  vs  function_F FOR_ALL : %s / %s" % (ab, ba))
if not (ab == INCOMPARABLE and ba == INCOMPARABLE):
    fails.append("Q-1: sample and function were ordered (%s / %s)" % (ab, ba))

# ---------------------------------------------------------------- Q-2
print("\nQ-2 anti-refusal: one function witness licenses a REPOSITORY existential")
witness = Observation("F:line41", membership_established_in=("function_F", "repository"),
                      predicate_established=True)
ext_w = Extent(observed=[witness], coverage_of={"function_F": EXHAUSTIVE,
                                                "repository": PARTIAL})
claim_exists_repo = Claim2(REPO, EXISTS, "defect X")
r = compile_obligation(claim_exists_repo, ext_w)
print("   EXISTS over repository : passed=%s unmet=%s" % (r.passed, r.unmet))
if not r.passed:
    fails.append("Q-2: refused a legitimate repository existential")

# ---------------------------------------------------------------- Q-3
print("\nQ-3 the SAME witness must not license a repository universal or absence")
for q in (FOR_ALL, NONE):
    rr = compile_obligation(Claim2(REPO, q, "defect X"), ext_w)
    print("   %-8s over repository : passed=%s unmet=%s" % (q, rr.passed, rr.unmet))
    if rr.passed:
        fails.append("Q-3: licensed a repository %s from one witness" % q)

# ---------------------------------------------------------------- Q-4
print("\nQ-4 exhaustive coverage of a frozen sample")
obs60 = [Observation("c%d" % i, membership_established_in=("sample_S60", "repository"),
                     predicate_established=True) for i in range(60)]
ext60 = Extent(observed=obs60, coverage_of={"sample_S60": EXHAUSTIVE, "repository": PARTIAL})
r_s = compile_obligation(Claim2(S60, FOR_ALL, "beyond locality"), ext60)
r_r = compile_obligation(Claim2(REPO, FOR_ALL, "beyond locality"), ext60)
print("   FOR_ALL over sample_S60  : passed=%s" % r_s.passed)
print("   FOR_ALL over repository  : passed=%s unmet=%s" % (r_r.passed, r_r.unmet))
if not r_s.passed:
    fails.append("Q-4: refused a universal over the exhaustively covered sample")
if r_r.passed:
    fails.append("Q-4: licensed a universal over the population from a sample")

# ---------------------------------------------------------------- Q-5
print("\nQ-5 the shadow specimen: remove established membership in the claimed domain")
before, _ = strongest_licensed(claim_exists_repo, ext_w)
stripped = Observation("F:line41", membership_established_in=("function_F",),
                       predicate_established=True)
ext_s = Extent(observed=[stripped], coverage_of={"function_F": EXHAUSTIVE,
                                                 "repository": PARTIAL})
after, res_after = strongest_licensed(claim_exists_repo, ext_s)
fmt = lambda c: "None" if c is None else "%s over %s" % (c.quantifier, c.domain.name)
print("   before : %s" % fmt(before))
print("   after  : %s" % fmt(after))
print("   reason : %s" % res_after.unmet)
if before is None or after is None or before.domain.name == after.domain.name:
    fails.append("Q-5: removal was INERT, reproducing the scalar-lattice failure")
elif "membership" not in " ".join(res_after.unmet):
    fails.append("Q-5: narrowed for a reason other than the frozen one")

# ---------------------------------------------------------------- report
print()
if fails:
    print("H-EXTENT FAILED (%d)" % len(fails))
    for f in fails:
        print("   - %s" % f)
    sys.exit(1)
print("H-EXTENT: Q-1..Q-5 all hold")
