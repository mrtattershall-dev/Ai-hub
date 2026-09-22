# Containing the positional misattachment — C1..C5. Frozen 2026-09-21, before the change.

## What is being contained, and what is not being fixed

P2 demonstrated that continuity transfer can attach to the **wrong** byte-identical history when the
merger assigns origins by position. `INVALIDATE` cannot catch it: its trigger is *unattached*
governance, and here the governance attaches — confidently, to the wrong subject.

**This change contains the known failure. It does not solve it.** The missing input P5 names is
still missing, and no identifier is invented here.

## The rule, stated so a machine can apply it

The runtime cannot know that origins were derived from position. What it *can* observe is when the
**origin is the only thing selecting among claimants**:

> If **more than one claimant** record has content equal to the authorized `successorContent`, then
> nothing but the merger-assigned origin distinguishes them. **Refuse the transfer**, naming that
> the inputs cannot distinguish the intended history.

That is exactly "attachment depends solely on positional origin and content", expressed in terms the
runtime has.

## The cost, accepted in advance

**This sacrifices legitimate transfers.** P1's case — stable, hand-chosen origin labels, two
byte-identical histories, one authorized — is a transfer the governor genuinely intended, and it
will now be refused. C2 exists to record that cost rather than to hide it. The alternative is
keeping a path that attaches an obligation to the wrong history and reports it as authorized.

## The specimen is preserved, not repaired

`resolveContinuity` is kept **byte-unchanged** as the specimen exhibiting the failure, exported under
a name that says so, and **never called by the live path**. The same discipline as `legacyDigestOf`
and the deliberate Python specimens: a failure that is repaired everywhere stops being evidence.
P1..P5 continue to measure the specimen and must keep failing in the same way.

## The arms

| arm | required observation |
|---|---|
| **C1** the contained default refuses P2's scenario | with two claimants sharing the authorized content, transfer is refused — **identically under both input orders** — and the refusal names the indistinguishability |
| **C2** the accepted cost | P1's legitimate transfer is **also** refused. Recorded as a cost, not hidden |
| **C3** the capability survives | where exactly **one** claimant has the authorized content, transfer still works. Containment must not be a disguised removal of the feature |
| **C4** the specimen is intact | the uncontained function still exhibits P2's failure when called directly, and the live path never calls it |
| **C5** the refusal is consequential | under the frozen `INVALIDATE` default, a refused transfer leaves the obligation unattached and the **run refuses** — the containment is not a diagnostic |

## Predictions, committed now

- **C1, C2, C3, C5** I expect to hold; the rule is mechanical.
- **C4** is the one that can quietly rot: if a later edit "fixes" the specimen, P2 stops being
  evidence of anything. C4 asserts the specimen still fails, which makes that rot loud.
- I expect **no arm of the existing 164 to change**, because every existing continuity fixture has
  exactly one claimant at the authorized content — except P1 and P2, which are about this. If
  anything else moves, the rule is broader than intended and that must be reported, not tuned away.

## Forbidden in this run

No new identifier, label, nonce or signature to make legitimate transfers survive — that is the next
research question, not this change. No registry rules added or changed (still **3 authored, 0/15**).
`COMPLETE` stays unsatisfied. **S6 untouched.** No repair of the F2 boundary. `INVALIDATE` is not
weakened. **The specimen is not repaired.**

## The research question this leaves open, stated but not attempted

> What **governor-controlled** information binds an authorization to the intended journal **before
> the merger assigns positions**?

It must survive reordering, distinguish separate byte-identical histories, and **a claimant copying
its serialized label must not thereby acquire the binding**. This can remain inside the carelessness
threat model; signatures are not automatically required.
