---
name: no-damage-is-not-restore-failed
description: 2026-09-26 - acceptance reported RESTORE_FAILED ("damage detected and NOT undone") when the START state had never satisfied the protected spec; new NO_VERIFIED_BASELINE disposition
metadata:
  type: feedback
---

2026-09-26 (hub 5944875): a probe started farm-i2 from an empty workspace, so the
protected steps had never passed. `applyAcceptance` restored startRef byte for byte, saw
the protected check still failing, and reported **RESTORE_FAILED - "damage detected and
NOT undone, must halt"**. No damage existed; the caller had violated startRef's
documented precondition that it be a state already verified for that task.

Fixed: `DISPOSITION.NO_VERIFIED_BASELINE` fires when the bytes ARE the start commit's and
the protected check still fails. It still halts and promotes nothing, but names the real
condition; RESTORE_FAILED now means only "the bytes on disk are NOT the verified start's".
The campaign summary counts no-baseline on its own line. acceptance.test cell 5 pins it.
No earlier result changed: no stored record holds a RESTORE_FAILED disposition.

**Why:** the error direction was SAFE (it halted) but the diagnosis was wrong, and a
recovery controller reading RESTORE_FAILED goes hunting for a regression to undo when
what it actually lacks is a baseline. A wrong diagnosis that happens to halt is still a
wrong diagnosis.

**How to apply:** when a guard fires, ask whether its stated REASON is the true one, not
just whether the outcome was safe. Where a rollback's success is judged by re-checking a
spec, distinguish "the check never passed" from "the check stopped passing" - they demand
opposite next actions. Related: [[silent-failures-are-the-class]],
[[fix-the-deciding-path-not-the-advisory-one]], [[measure-the-thing-itself]].
