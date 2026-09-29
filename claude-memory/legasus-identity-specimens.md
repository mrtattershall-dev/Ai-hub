---
name: legasus-identity-specimens
description: Two Legasus harness defects are deliberately UNREPAIRED specimens; fixing them destroys the only prospective evidence for H-REFUSAL
metadata: 
  node_type: memory
  type: project
  originSessionId: 84a10d37-807c-4f1e-91a9-791e4112e34d
  modified: 2026-09-21T09:18:19.792Z
---

2026-09-21. In `ai-coding-hub/legasus/screen/`, two known defects are **left broken on purpose**
and must not be "fixed" by a later session:

- `reach1.py` — `TRUSTED_TAILS = {"get"}` treats any attribute named `get` as a trusted primitive,
  so `ContextVar.get` and `requests.get` are classified as admitted ground. False merge.
- `hadmission.py` — `is_in_domain_const` requires `ast.Constant`, and Python has no empty-set
  literal, so `set()` / `frozenset()` can never be admitted. False split, structural.

**Why:** they are the scored specimens of `H-REFUSAL_RESULT.md` (e689640), the only prospective
evidence the identity line produced. Repairing them destroys it. See `IDENTITY-CENSUS.md`.

**How to apply:** if a task touches these lines, record the defect and leave it; do not repair
without tatte's decision. The census also found that `screen2.py`'s `resolve()` is the branch's one
equivalence relation carrying a refusal state (`UNRESOLVED`), written long before this line of work
and never generalized to the other harnesses.

Related: [[legasus-discovery-charter]], [[legasus-location-and-discipline]],
[[silent-failures-are-the-class]]

**2026-09-21 addition:** `legasus/screen/entitlement.py` now implements three peer gates —
obligation, derivation, measurement — with a passing conformance suite. It is **built and NOT
installed**: no detector consults it. Site #7 is case F2 and is load-bearing for four results now.
Ablation shows each gate is non-redundant against a real retracted conclusion. See
`ENTITLEMENT-GATES.md`.

**Protection is now MECHANICAL.** `legasus/screen/specimens_test.py` fails if any deliberate
specimen is repaired (site #7's bare-name `TRUSTED_TAILS`, site #10's `ast.Constant` keying, or the
`SAMPLE`-below-`FUNCTION` scope inversion) or if the result documents scoring them are altered.
Verified with a negative control. Run it before any "cleanup" of `legasus/screen`.

**Bridges (2026-09-21, indent worktree, branch `fix-tolerant-indent`).** Four semantic bridges exist
under `legasus/legascreen/bridges/` (measurement-observe, derivation-derive, obligation-covers,
licensed-narrowing) with fixtures and `entitlement-bridges.test.mjs`. They are comparison instruments,
NOT transport, and import no calculus. licensed-narrowing is deliberately DEMOTED (containment is
unrepresentable to the calculus); measurement-observe's restricted domain is empty because contract
v1.0.0 lacks `attribution`. Do not "fix" either by widening a domain. Branches are NOT merged; the
Python side is on `fix/unverified-finish-recorded`. Result: `ENTITLEMENT-BRIDGES_RESULT.md` there.

**Integration branch (2026-09-21).** `integration/epistemic-admission` exists as its own worktree at
`~/Projects/ai-coding-hub-integration`, based on `fix-tolerant-indent`. It holds the frozen contract
(v1.0.0 + v1.1) and `legasus/runtime/epistemic-admission/` — legaknow's FIRST production consumer.
Epistemic only: no `delegate`, no `commit`. The Python producer was deliberately NOT imported; the
seam is data. Three worktrees are now in play — Python producer on `fix/unverified-finish-recorded`,
bridges on `fix-tolerant-indent`, consumer on the integration branch. Nothing is merged.

**Contract v1.2 + rule registry (2026-09-21).** `legasus/runtime/epistemic-admission/rules.mjs` owns
what each inference rule REQUIRES; the certificate carries only `rule_id` + `rule_digest` + the
witnesses it established. There is deliberately NO `requires` field in the contract — do not add one,
it would let the producer choose its own burden of proof. A digest mismatch is `RULE_DEFINITION_MOVED`.
Consequence worth keeping: Stage B's case 3 (EXISTS over PROGRAM from FUNCTION evidence) is now
refused by `derive()` as a missing MEMBERSHIP witness. Three suites, 36 tests, all green on
`integration/epistemic-admission`.

**Registry adequacy + a fourth specimen (2026-09-21).** The three admitted rules recognise ZERO
inference obligations they did not author (0 correspondence over 15 pre-registry declarations).
**Do not expand the registry to improve that number** — it is the measured finding, recorded in
`REGISTRY-ADEQUACY_RESULT.md`. The fourth specimen (a `COVERAGE` witness about a different domain still
minting) was **repaired in contract v1.3**: obligations now carry matchers owned by the rule, and an
unbound candidate is never forwarded to `derive()`. `derive()` itself still matches by name — that is
a fact about the calculus and is NOT repaired, by design. The three deliberate specimens in
`legasus/screen/` remain broken and protected by `specimens_test.py`.

**v1.4 evidence roots (2026-09-21).** A relation witness is now a REFERENCE to established authority:
`evidence_root` must resolve in an authority store to a calculus-minted token whose claim IS
`RELATION(subject, object)`, in the right world, not circular. The matcher never inspects a payload.
**Rule selection is still unattacked and the fifteen pre-registry declarations are SPENT** — all
inspected, so they are historical adversarial examples, not held-out material. Prospective evidence
for selection needs derivations that did not exist when the semantics were written.

**Recurring apparatus bug, five instances:** a measure reading something other than what it meant to.
The worst is that `s.split('\n').map(l => l.replace(/\/\/.*$/, ''))` **does not strip comments on
CRLF files** — JS `.` does not match `\r`. Any independence check using it reads comment prose as
code. Strip `\r` first.

**Authority lineage closed (2026-09-21).** `integration/epistemic-admission` now has a real loop:
one admission creates authority a later independent admission consumes, via opaque store HANDLES.
Persistent artefact is an admission RECORD, never a serialized token — after a restart, regaining
authority costs re-execution. Invalidation propagates to dependents; re-establishing does NOT restore
them. **S8 answered:** a retained direct token alias survives store revocation (invalidate returns a
NEW token), so revocation is a property of the STORE, not the token — but the bypass is unreachable
through the certificate seam.

**S5 CLOSED in v1.4.** World identity was SEARCHED, not chosen: the unique minimal subset is
`{repository, claim_domain}`. Extent is ORDERED (never equality, or it refuses legitimate narrowing);
procedure is provenance only. Contract v1.4 requires `observation.context.repository`.

**R-W4 REPAIRED but NOT INSTALLED.** `fingerprint.mjs` derives a rule's semantic dependency closure
mechanically (never a declared list) and covers it, so a change two calls away moves the fingerprint
while unrelated code in the same module does not. The kernel is inside the closure. Unresolvable
dependencies yield `FINGERPRINT_UNRESOLVED`, never a partial hash. **`rules.mjs` still uses the old
`digestOf`** — swapping it changes every rule identity and forces a producer re-pin, so it needs its
own frozen prediction.

**Known and deliberately unsolved:** a call-closure includes helpers that cannot affect the decision
(e.g. logging), so fingerprints churn on irrelevant changes. Establish whether that matters by
observing churn, not by narrowing the notion in advance.

**Apparatus species, now SIX instances:** a measure reading something other than what it meant to.
Latest three are all in one lexical scanner — a `function name(` header, a prose fragment in an error
string, and a COMMENT — and the comment case again needed `` stripped first.
