---
name: silent-failures-are-the-class
description: "tatte's standing lens for the hub - the bugs that matter report SUCCESS while work is lost or wrong; hunt the silence, not the error messages"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-12T01:30:31.689Z
---

tatte, repeatedly and again on 2026-09-11: **remember silent failures.** The bugs that cost long runs do not throw.
They return `OK`, or say nothing at all, while work is destroyed or a verdict is wrong.

Every expensive bug found in this hub has that shape:

- `read_file` assembled a header, a body and a "… N more lines below" notice, then sliced the whole string to 14,000
  chars — **the truncation deleted its own warning**. The model was told "lines 1-240 of 240", handed 183 lines cut
  mid-token, and rewrote the file from the fragment.
- A write that deleted six working methods answered `OK: wrote N bytes`, with a warning the model ignored 7 times out
  of 8. See [[fix-the-deciding-path-not-the-advisory-one]].
- The finish gate ran an unrelated leftover `.js` and recorded ``Verified (node): `node q1_stock.js` ran and exited
  cleanly`` — a true sentence about the wrong file.
- `run.callLog` was a `Map`, which persists as `{}`; a resumed run threw on its first tool call, and because the throw
  happened while status was still `running`, the teardown skipped the trace, the index row, the escalation and the
  repair goal. **The failure erased its own evidence.**
- Three identical *tool refusals* were reported as "the model produced the same response 3 times without making
  progress" — the wrong party blamed, which then picked the wrong repair.
- My own test convention: a case labelled `(known)` prints `KNOWN`, the file exits 0, and the suite counts it green.
  A harness that reports success over documented failures is the same bug in the tooling.

**How to apply.** For any tool or gate: ask what it returns when it half-succeeds, and whether anything downstream
can tell that from success. Grep for `^OK`, for `catch {}` with an empty body, for `.slice(` applied after a notice is
appended, for a regex over a string another layer formatted, and for a verdict computed from an exit code the model
itself produced. Prefer a refusal that restores state over a sentence in a tool result — advisory protection does not
protect ([[advisory-vs-mechanical-recovery]]). And never let a test report green while a known failure sits inside it.

Related: [[hub-destroys-a-third-of-working-code]], [[mutant-escaped-means-check-the-expectation]],
[[long-run-accuracy-north-star]].

**2026-09-17, a new member of the class:** `node long-job.mjs | head -8`. head closed the pipe, node
died on EPIPE, and the shell reported the PIPELINE's exit code - head's 0. A sweep that finished a
quarter of the way through printed partial output, no error, and no summary, and reported success.
Long sweeps write to a file; never head/tail/grep a job whose completion matters. Catalogued with the
other apparatus hazards in `legasus/legalabs/HAZARDS.md`, where each entry is marked MECHANIZED or
RULE ONLY - because the ledger exists precisely because written reminders failed four times.

