Preregister ACTION-GOVERNANCE-1: freeze the epistemic-to-normative join before building it

Authorized 2026-09-28: attempt ACTION-governance (not belief-only), built against the frozen tag
controller-bridge-input (cccb6a1). This file freezes predictions and controls BEFORE the wire exists,
because the join it crosses is the one the runtime layer deliberately left open, and inventing an
authority model unproven is the exact failure this project is built to refuse.

THE SEAM, MEASURED. calculus.commit({authority, action, requires}) consumes a NORMATIVE authority token
and calls tracesToIndependentRoot; admission.admit(cert) produces an EPISTEMIC result and admits
KNOWLEDGE only. An admitted certificate is therefore a PREMISE, never the authority. Action-governance
is not "connect admit() to commit()" - that would be a category error the calculus already refuses. It
is: a controller edit may commit ONLY WHEN (a) an epistemic certificate that the change is justified is
ADMITTED, AND (b) a normative DELEGATE grant permits this actor to make this class of change, reaching an
independent root. commit() consumes (b); (a) is a required premise of (b).

THE NOVEL CLAIM UNDER TEST, stated so it can fail: an epistemic admission can legitimately GATE whether a
normative authority applies, without the belief itself becoming permission. If that join cannot be built
without letting a certificate mint authority, ACTION-GOVERNANCE-1 FAILS and belief-governance is the
honest ceiling. That outcome is recorded, not engineered around.

FROZEN PREDICTIONS (against controller-bridge-input @ cccb6a1):
  A1 a controller edit with an ADMITTED certificate AND a valid DELEGATE grant COMMITS
  A2 NON-BYPASS: an edit with an admitted certificate but NO delegate grant is REFUSED - belief is not
     permission; the refusal names the missing authority, not a missing fact
  A3 NON-BYPASS: an edit with a delegate grant but an UNADMITTED/refused certificate is REFUSED - the
     grant's premise is unmet; commit() never sees an authority whose premise failed
  A4 a bare epistemic token presented directly to commit() is REFUSED (unchanged; the pre-existing guard)
  A5 STRUCTURAL: the controller has NO path to commit that bypasses both gates - proven by attempting a
     direct tools[...] edit and asserting it cannot reach persistence without a token
  A6 RESTORE: a refused edit leaves the tree at the verified checkpoint's content digest
  A7 TRACE: every outcome records observed -> admitted/refused -> delegate present/absent -> committed/
     restored, and WHY, as one record

CONTROLS, each fault injected and shown to be caught:
  - a certificate with requires:[] must NOT satisfy a nonempty consumer obligation (the v1.2 defect)
  - a delegate grant that does NOT reach an independent root is refused (L6 / no self-ratification)
  - the positive control A1 must genuinely commit, or the suite proves only that everything is refused

NOT CLAIMED: that this generalizes beyond the frozen controller point; that the cross-language seam
(Python screen -> JS authority) is proven - if the slice needs it, that is its own later claim; that
physical-action governance follows - it does not, a rollback cannot undo a collision.

BUILD ORDER once this is frozen: A4 first (already holds, confirms the guard), then A2/A3 (refusals are
cheaper and safer to get right than A1), then A1, then A5 structural, then A6/A7. No result is read
before all predictions are committed.
