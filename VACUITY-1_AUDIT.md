# VACUITY-1 — a sweep for checks that cannot fail

**Date:** 2026-09-29 · **Cost:** $0, local · **Trigger:** an audit of a sibling repo found a test that
asserted a refusal with no reachable success case — it would have passed against an implementation that
refused everything. That is a class this project has hit repeatedly (`[].every()` is vacuously true; a
repro blocked by a different guard so the code under test never ran; a proof that only tried the easy
input). So the same question was asked of this repo's own judging paths.

Every finding below was **verified directly**, not taken on report. Three were confirmed; one changed
shape on inspection.

## 1. `presentationAudit.mjs` — a tautology over its own locals. **CONFIRMED, and the result survives.**

The audit asserts six invariants that `PRESENTATION-1_DEFINITION.md` cites as the confound control: the
suffix is byte-identical across conditions, N and H carry an identical prefix, H and S differ only in
their system section, and so on.

**It builds all three wires itself**, from its own constants, then asserts over those locals. It never
reads `presentationRun.mjs` and never reads a run record. If the runner's construction had drifted from
the audit's copy, every invariant would still have printed `ok`. The runner's own comment says "the shas
are recorded so drift between the two files is detectable rather than silent" — detectable by a human
comparing hex strings; no code compared them.

**This was recoverable, and it has been recovered.** The run preserved `wireSha`, `wireBytes`,
`codePrefixSha` and `suffixSha` for every page and condition, so the comparison the audit never made can
still be made from preserved data. `server/presentationConfoundCheck.mjs` does it — by **spawning the
audit and reading its printed shas**, never by re-implementing its construction, because re-implementing
it there would reproduce the same self-certification.

    all 36 page/condition pairs compared                                    PASS
    every wire the audit describes is byte-identical to the wire sent       PASS
    CONTROL: audited N/H/S do not match each other's recorded wires         PASS
    the RECORDED suffix is identical across conditions (ae086d9e42383e98)   PASS
    the RECORDED prefix is identical for N and H (c5ac4cd6c6c5f942)         PASS

**The correct narrowing:** PRESENTATION-1's confound control **holds** — the wires were what the audit
says. But until now it held *because two files happened to agree*, not because anything checked. The
guarantee was absent; the fact was fine. Nothing in PRESENTATION-1 is rerun, revised or reinterpreted.

## 2. `obligationMutants.mjs` — obligation 1 has zero sentinels. **CONFIRMED. Narrow the claim.**

`legasus/bench/audit2/ladder-mutants.json` declares `dependsOn` for steps 2–9, and **every one of them
lists `1`**. So `dependentsOf(1)` is all eight, `candidates = all.filter(n => n !== owner &&
!expected.includes(n))` is **empty**, the sentinel loop never executes, `brokenSentinels` is `[]`, and the
verdict is `CAUGHT` — with zero sentinels checked.

**`OVER_BROAD` is structurally unreachable for the ladder root.** A mutant for obligation 1 could break
every other obligation on the ladder and still score `CAUGHT`. Its actual mutant removes a list item,
which plausibly does break many list checks.

**The narrowing:** "every obligation is independently falsifiable" is true of obligations **2–9**. For
obligation 1 only *sensitivity* was shown; its *specificity* is untestable under this ladder, because
everything depends on it. In the vocabulary now used by `graphNodeMutants.mjs`, obligation 1's edge
status is **ASSUMED**, not OBSERVED.

**Not fixed here on purpose:** `obligationMutants.mjs` is AUDIT-2 Stage-4 apparatus and is frozen. The
claim is narrowed; the code and the outcome are untouched. AUDIT-2 Stage-4's own result was a null, and
nothing about that changes.

*Related latent risk, not exercised:* a mutant may declare `"sentinels": []` and opt out of specificity
entirely while still scoring `CAUGHT`. Every real mutant leaves `sentinels` undefined, so the full
candidate set is used. Latent, not live.

## 3. `suppressionAudit.mjs` — two real gaps. **CONFIRMED and FIXED.**

- **The leak check visited three arms, the acceptance check four.** `['chat','operator','contract']`
  versus `['chat','operator','contract','manager']`. A manager run's prompt was **never leak-checked at
  all**, and the gap read as a clean pass because the arm was simply never visited.
- **Reading nothing counted as passing.** Every increment to `problems` sits inside an `existsSync`-guarded
  loop, so a wrong `--runs` path or a moved corpus produced zero iterations and printed
  `NO PROBLEMS FOUND - the result survives this check` with exit 0, over no data. The audited count was
  printed beside it, but the verdict did not depend on it and neither did the exit code.

Fixed: the manager arm is covered, and `audited === 0` now exits 2 with an explicit "this is NOT a pass".
**After the fix: 48 run records read, 12 accepted candidates audited, no problems** — so the broader
coverage surfaced no new leak. The result is unchanged and now rests on more.

## 4. Latent `[].every()` shapes — recorded, not live

`suppressionAudit.mjs`, `rescore.mjs`, `attemptRecord.mjs` and `emitTaskAuto.mjs` all contain checks that
go vacuous on `additionSteps: []` (`[].every()` is true; `Math.max(...[])` is `-Infinity`). All twelve
live tasks carry `[3,4,6]`, and `suppressionAudit` asserts non-empty per page. **Latent, not live** — but
it is the same defect that already shipped once in this project, so it is written down rather than
assumed harmless.

## Clean on inspection

`interruption.test.mjs` — its `.every()` calls are backed by `completed === 2` and `accepted === 2`,
which make an empty result fail; the kill test's pid-plus-cmdline identity assertion closes the hole its
own comment describes; the polling `catch {}` keeps polling rather than swallowing into a pass.
`rescore.mjs` fails closed on every error path and has two negative controls that separate "exists" from
"constructs". `acceptanceDecision.mjs` is sound; its limitation is reach, not correctness — the visual
contract fired live exactly once across 402 records.

## The pattern worth keeping

In all three confirmed cases the check was **structurally incapable of the failure it claimed to rule
out**, and in all three the surrounding numbers were fine. A passing count is the weakest claim: the
question is always *what input would make this false*, and if there is no answer, the check is decoration.
