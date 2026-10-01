# D-ID-1 M15 — two sessions, two results. Recorded as a disagreement, not resolved by assertion.

## The conflict

`D-ID-1_REGRESSION_RESULT.md` (88e831f1) records M15 as a **REPRESENTABILITY violation**:

> "M15: a file named `odd.` (unrepresentable on Windows) is present and an identity was RETURNED.
> The contract requires UNAVAILABLE."

`candidateIdentity.test.mjs` (this session) records M15 as **NOT_RUNNABLE**:

> the entry `"weird."` IS addressable on this machine (ordinary and extended-length reads agree),
> so its premise does not hold here. cid1 giving it an identity is CORRECT, not a defect.

Both were run on the same machine, against the same frozen prereg.

## What separates them

The prereg's example asserts the premise:

> "unreadable or unrepresentable entry (e.g. **a name ending in `.` on Windows**)"

Neither suite was obliged to check that assertion; one did and one did not. This session's row
now establishes it empirically before judging — it writes known bytes through the extended-length
prefix, then compares what the ordinary path reads against what the prefix reads:

    ordinary read == prefix read   -> the ordinary name DOES address the enumerated entry.
                                      The premise fails. Returning an identity is correct.
    ordinary read != prefix read
      or the ordinary read fails   -> the ordinary name addresses something else. The premise
                                      holds, and cid1 must report UNAVAILABLE.

The measured result on this machine is the first. So **the prereg's EXAMPLE appears false here**,
while its RULE is untouched: an entry that cannot be addressed must still fail closed.

## Which result is right

Not asserted. The two suites measured different things:

    88e831f1   "a trailing-dot entry exists and an identity was returned"      - true
    this one   "that entry is addressable, so the identity is correct"          - also true

They are consistent observations with incompatible CONCLUSIONS, and the difference is entirely
whether unaddressability was established or assumed. On the evidence here the row's premise does
not hold on this machine, so M15 cannot currently distinguish a correct implementation from a
defective one — which makes NOT_RUNNABLE the honest verdict and the REPRESENTABILITY violation
unsupported **as measured here**.

It does NOT follow that the contract's representability requirement is satisfied. cid1 implements
it (below) and the requirement is simply untested on this box.

## What cid1 actually implements, generalized away from the example

A blacklist of odd Windows names would rot and would miss the next route. The invariant is:

> **ENUMERATED IDENTITY == OPENED IDENTITY.** An entry's bytes may contribute to cid1 only when
> the entry opened by its enumerated name is demonstrably the same entry that was enumerated.

Mechanism, chosen by measurement:

    basename(realpathSync(abs)) === name     the round-trip. A name the platform strips when
                                             opening reports the stripped form and fails this.
    reserved device names                    rejected by shape (CON, NUL, COM1..9, LPT1..9)

REJECTED BY MEASUREMENT, recorded so nobody reaches for it again: comparing `lstat` of the
ordinary path against `lstat` of the extended-length path. `lstatSync('\\\\?\\' + p)` throws
ENOENT through node **even for an ordinary file** on this platform, so it would mark every entry
unavailable.

KNOWN GAP, stated rather than glossed: `realpathSync` FOLLOWS a symlink, so the round-trip cannot
be applied to links. Links fall back to the shape rule, which is a heuristic. A link whose name
is stripped by some other route is NOT detected.

## Consequence for the record

Neither result is withdrawn. M15 stays on the register as **a row whose premise is not
constructible on this machine**, and the representability requirement stays **implemented but
untested**. If a machine is found where a trailing-dot entry really is misread, the row becomes
runnable and will decide it.
