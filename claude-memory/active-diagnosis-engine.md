---
name: active-diagnosis-engine
description: 2026-09-27 - server/diagnose.mjs makes the step between detection and editing mechanical: competing explanations, the observation that separates them, elimination, bounded scope + obligations, or a refusal naming what is missing. 26/26, $0
metadata:
  type: project
---

2026-09-27, `server/diagnose.mjs` + `diagnose.test.mjs` 26/26, $0, nothing deployed.

Every earlier experiment asked a model to "fix it". The step in between was always done by a
person. This makes it mechanical:

    reproduce -> signature -> competing explanations -> the observation they name ->
    eliminate -> one survivor or DECLINE -> bounded scope + obligations + LIMITS

**CONDITIONAL DIAGNOSIS, and that is the whole claim** (corrected): one engine, one error
signature (`Cannot read properties of null`), three worlds differing only in page content ->
INTERFACE_NEVER_BUILT / LOOKUP_TOO_EARLY / WRONG_IDENTIFIER. Different answers in constructed
worlds show the answer follows the observation. They do NOT show a true cause was established,
and the "not a lookup table" framing was dropped. On the real arm B candidate it
reaches the cause the 7B got wrong, with scope line 106 and the obligation that the repair
must not depend on an absent element. Strip the DOM observation and it declines, names the
observation it needs, and lists the explanations it cannot separate.

Signatures are taken ONE AT A TIME in priority order: a script that does not parse explains
every behavioural failure after it, and a page that threw at load never reached its
behavioural checks.

**Authored vs automatic** - state this every time: the CATALOGUE is mine (which explanations
exist, which observation discriminates them, what each implies for scope and obligations);
what is AUTOMATIC is which apply, which observation to take, what it eliminates, and the
scope and obligations that follow. Selection within a declared space, not invention.

Three of my own defects, each caught by a discriminating test: predicates received the
observations flattened and one read a nonexistent field; every probe was demanded, so a
load-time failure declined for want of a state delta that cannot exist; only the FIRST
`<script>` block was syntax-checked, so a malformed later block was missed.

**Two hypotheses must never be promoted to fact:** a near id SUGGESTS a wrong identifier but
does not establish which element the program intended; an absent element establishes absence
in the OBSERVED STATES only, so "never built" needs the creation paths checked (a probe was
added, and it can support that hypothesis but never establish it). The output keeps four
things apart - observedFacts / hypothesis with its unresolved questions / a PROPOSED scope
marked as not established to be the edit site / obligations - so a consumer receives the
uncertainty rather than a hypothesis dressed as a finding.

**WIRED IN** (`repairLoop --evidence diagnosis`): the plan is recomputed per round and handed
over in those sections; the acceptance gate is untouched; and when the engine declines the run
STOPS with DIAGNOSIS_DECLINED rather than falling back to the raw error, because a silent
fallback would convert a diagnosis arm into a raw-error arm unremarked. repairLoop 46/46.

**How to apply:** what remains unmeasured is whether the guidance produces BETTER REPAIRS.
Tests support specified behaviour only - not outcomes, and not coverage of failures outside
the catalogue (an unfamiliar one yields NO_SIGNATURE_MATCHED: the right failure mode, not
coverage). The E0-vs-E2 comparison is frozen in DOM-EVIDENCE-1_DEFINITION.md and needs
authorization. And keep the standing caution: obligations are "supported by these checks", never
"correct" - see [[accepted-page-threw-during-required-behaviour]],
[[error-text-selects-a-repair-family]].
