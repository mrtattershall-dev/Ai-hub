---
name: tolerant-matcher-deindents-and-destroys
description: "edit_file's tolerant path splices the model's REPLACE in verbatim, de-indenting a class method out of its class and genuinely destroying it - proven on set I goal 3, where it cost a goal the weaker model completed"
metadata:
  node_type: memory
  type: project
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-12T09:24:27.653Z
---

`edit_file`'s tolerant matcher matches on `trim()`ed lines, then splices the model's `REPLACE` into the file as a
single array element **with the model's own indentation**. When the model sends a 2-space-indented body for a file
whose class members are 4-space indented, the replacement lands at the wrong depth and the method falls **out of the
class**.

Proven pure-module on the real strings from set I goal 3 (`defNames`/`lostDefs`, path argument supplied):

    names before              [Matrix, shape]
    after the INTENDED edit   [Matrix, shape]   lost: []        <- guard would not fire
    after the TOLERANT splice [Matrix]          lost: [shape]   <- guard fires, CORRECTLY

**The destructive-write guard is the messenger, not the culprit.** It correctly refuses an edit that really would
break the class. I first recorded this as "a false positive in my own guard" and that was wrong.

The cost is real: the dense 32B wrote a stubbed skeleton, sent a correct edit to fill `shape()` in, was refused as
`would have REMOVED shape`, tried inserting the method instead, was refused as `would have DUPLICATED shape (1 -> 2)`,
retried identically four times and died on the loop guard. **The MoE 30B passed that same goal `done` with zero
errors.**

**Fix:** re-indent the replacement to the matched region's indentation before splicing. Secondary: the refusal message
never mentions indentation, so the model cannot learn what is wrong — 37 of the 39 loop-guard deaths in set H's 14B arm
had `NO CHANGE` or `DUPLICATED` as the last tool answer.

**How to apply:** an earlier note recorded that "the tolerant path discards indentation" as a CRLF-adjacent detail. It
was never connected to goal loss. When a behaviour is documented as merely *lossy*, ask what downstream guard will
later refuse the damage it causes — the two together can deadlock a legitimate edit.

Related: [[append-file-escapes-the-duplicate-guard]], [[honest-answer-can-disable-its-guard]],
[[verify-the-path-the-change-is-on]], [[seth-result-fixes-move-the-work]].
