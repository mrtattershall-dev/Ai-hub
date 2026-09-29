---
name: append-file-escapes-the-duplicate-guard
description: "The hub's duplicate-definition refusal cannot see append_file (beforeSrc is captured only for write/edit) - proven in set H where 20 appended copies survived while the guard refused 27 times elsewhere in the same run"
metadata:
  node_type: memory
  type: project
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-12T08:41:24.370Z
---

The duplicate refusal added on 2026-09-12 (`defCounts` in `defNames.js`, called caller-side beside `lostDefs`) refuses
an edit that would leave a DUPLICATE of a definition the file already has. It works: in set H's 14B treatment arm it
fired **27 times**.

**It cannot see `append_file`.** `beforeSrc` is captured only for `write_file` and `edit_file`, so an append never
reaches the comparison. Live evidence: `s8_grades.py` in that same arm ended with `set_weight x20` — an *indented*
Python method, exactly the shape `defCounts` was built for (and exactly what the old column-0 `duplicateDecls` could
never see). Tool calls on that file: **`append_file` 22**, `edit_file` 20, `write_file` 1. The 30B treatment arm made
21 append calls too.

That one file is why set H's 14B treatment still shows 2 workspaces with duplicates instead of 0 — the other eight
were eliminated (`s7_cache.js` went from 1398 lines carrying `size x28, has x27, constructor x26` to absent entirely).

**How to apply:** the fix is to capture `beforeSrc` for `append_file` as well, then run the same caller-side check —
red-first with a fixture that appends a definition the file already has, then a mutant proving the test sees it.
Reproduction is already in hand: `measurements/2026-09-12-setH/runs/coder14b-sethfix/runs`, filter tool steps with
path `s8_grades.py`. More generally: when a guard is added at a shared call site, enumerate *every* tool that reaches
that site and check which ones capture the state the guard compares against — this gap was flagged in the same report
that shipped the fix, and set H turned the prediction into evidence.

Related: [[honest-answer-can-disable-its-guard]], [[seth-result-fixes-move-the-work]],
[[fix-the-deciding-path-not-the-advisory-one]].

## UPDATE 2026-09-22 — still unfixed, and now demonstrated under control

`beforeSrc` is still captured at `agent.js:3392` only for `write_file`/`edit_file` on
`/\.(py|c?js|mjs)$/i`, so **both** preservation refusals (removal and duplicate) are gated off for
`append_file`. Trunk's `agent.js:3431` comment ("append_file is an edit too, and needs the same
checks") added only `quickCheck` and `duplicateNote`, both advisory. `markerRefusal` at
`agent.js:578` guards one file, the workspace boundary marker.

Demonstrated prospectively with three controls rather than inferred from a run: same initial file,
`write_file` making `foo` go 1->2 is REFUSED and the file is unchanged; `append_file` making the
identical change LANDS (`def foo` x2); and `append_file` adding a genuinely new definition lands
cleanly. The third control is what makes it a measurement - the route is not refusing everything and
is not broken, it is *specifically blind* to the corruption the other route refuses.

Usage denominator, so the exposure is not overstated or understated: `append_file` is requested in
**856 of 17,466** recorded replies across all 24 replay scenario files, and **executed 31 times in
set G alone**. By contrast `spawn_subtask` (a total preservation bypass at `agent.js:2690`) and
`download_file` executed **zero** times in the whole corpus.

Controls committed at `benchmarks/destruction-controls/append-route.jsonl` on `fix-tolerant-indent`
(`554083e`), so this becomes a regression that can fail: if `ctl-APPEND-DUP` ever starts refusing, the
route has been brought under the predicates.

Related: [[detector-semantics-vs-route-governance]], [[replay-steps-channel-is-authoritative]].

## RESOLVED 2026-09-26 on a branch — `fix/append-preservation`, verified

`c96f21a` + `285f9db`, cut from `fix/unverified-finish-recorded` @ `c952cbc`. The change adds
`|| tool === 'append_file'` to the `beforeSrc` gate at `agent.js:3392` — nine words. **Not merged to
any mainline**; it is a verified branch awaiting the owner's decision.

Verified rather than asserted, because "one line" describes an edit and not its sufficiency:

- **9 controls, expectations written before applying the fix**, scored against ON-DISK state rather
  than counters. Baseline 6 of 9, fixed 9 of 9. Three must refuse (duplicate in .py, in .js, and an
  indented class METHOD) and **six must not** — new definition, append to a nonexistent file, a
  non-source extension, an append with no definitions at all, and the `DUPLICATE:` override, which
  proves the refusal keeps an exit and cannot become a loop.
- `ap4-NEWFILE` is the control that guards the obvious over-reach: a file that does not exist yet still
  leaves `beforeSrc` null through the existing `catch`, so create-by-append is unaffected.
- `rm=0` on every append row before and after — the now-reachable REMOVAL refusal stayed vacuous
  instead of firing falsely.
- **80 existing suites**, no failure attributable to the change. `batchActions` and `supervisorTick`
  exit 124 from a 90s cap on the UNMODIFIED tree too and reference neither changed symbol;
  `verifierInfra`'s single `rc=1` does not reproduce and passes 3/3 in isolation on both trees.

**Still not established, deliberately:** appending syntactically BROKEN content is untested, and since
the removal refusal is now reachable here it could fire where it could not before if `defNames` reads
earlier definitions as absent in an unparseable file. And that closing this route changes any SCORE is
not claimed — set G is twenty fixes that stopped destruction without raising it.

Controls live at `benchmarks-append-route/` on that branch and fail in both directions: `ap1` ceasing to
refuse means the route regressed, `ap4` starting to refuse means the fix over-reached.
