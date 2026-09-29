---
name: anchor-protocol-edit-site-failure
description: INC3-1 2026-09-26 - under the tested anchor block protocol this 1.5B selected no useful edit site in 10 attempts (copied the whole file into FIND, deleting the page); given a site it sometimes wrote code; 0/20 implemented the feature
metadata:
  type: project
---

2026-09-26, INC3-1 ($0, local qwen2.5-coder:1.5b, 20 attempts, four cells): asked for a
bounded edit to the accepted increment-1 page instead of a replacement file.

- **anchor** (model chooses the site), 5 seeds plus a replicate that reproduced it
  exactly: every attempt copied the ENTIRE 115-line file into the FIND slot. Three
  finished and replaced it with the literal `=======` separator or a paragraph of the
  instruction text, so the applied edit DELETED the page. Two were still copying when
  the reply ended. **No anchor attempt inserted JavaScript.**
- **fim, harness-chosen 42-line region**: 3/5 contained real code; the best required a
  tile to already hold a crop, and wandered into increments 3 and 4 unprompted.
- **fim, corrected 5-line region**: protected 5/5 and **0/5 inserted any code** - four
  filled the 4000-token ceiling with one self-contradictory comment repeated (up to
  20,570 chars, 7 min).
- E4 changed-the-program went 0/5 -> 3/5 -> 5/5, but **E7 requested is 0/20**.

**Why:** the copying behaviour of [[whole-file-return-echoes-the-input]] is not about the
whole-file interface. It follows whatever slot is offered. The finding, stated at the width
the evidence supports: **this 1.5B failed to select useful edit sites under the tested
anchor protocol** (one block format, one system prompt, temperature 0.2, one file, five
seeds plus a replicate), and it sometimes wrote code when a site was supplied. That is NOT
a property of the model or of its size - a different edit format, decoding setting or way
of presenting the file is untested. The edit interface was also SLOWER (5.5-7 min runaway
generations against ~80 s for a whole-file reply), so it fails the cost and stutter
requirements too. A hand-written positive control shows a region PERMITS a solution; it
does not isolate model capability from prompt format, decoding or interface fit.

**How to apply:** never read "changed the program" as "made a localized change" - measure
findFractionOfFile and whether the FIND is the whole file. Never read a perfect protected
score without checking that work happened; twice now (INC2-1, INC3-1 5-line) the
protection looked flawless because nothing was done. Next untried step is a smaller unit
with its target named (one key handler), not a bigger model. See
[[protocol-not-capability-ceiling]], [[runaway-generation-capped-by-maxlen]],
[[tolerant-matcher-deindents-and-destroys]] (why no fuzzy matching, ever).
