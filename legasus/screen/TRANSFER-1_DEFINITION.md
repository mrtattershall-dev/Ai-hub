# TRANSFER-1 DEFINITION — does the guidance transfer to a page whose structure I have not read?

Frozen 2026-09-27, **before the page exists.** Local, **$0**. No paid run is authorized.

## Why the ordering matters, and how it is verifiable

Every result so far has been on one page whose shape I had read before writing the rules. So this
experiment's discipline is about sequence, not intention:

    1  the policy is frozen and committed, with the sha256 of every file that decides anything
    2  ONLY THEN is the page obtained
    3  the baseline is validated and the addition defined
    4  the policy runs once, untouched
    5  if it fails and I tune, that result is PRESERVED and the revision is tested on ANOTHER page

**The commit order is the evidence.** The policy's commit precedes the page's commit in the history, so
"I did not adapt the rules to this page" is checkable rather than asserted.

## The frozen policy

    server/autoGuide.mjs      the guidance: site selection, scaffold, instruction, escalation
    server/localEdit.mjs      containToSlot / containsSafely: the structural boundary
    server/judgeCandidate.mjs the shared gate tail
    server/evaluator.js       accumulated protected sequences
    server/acceptance.js      the acceptance policy
    server/playCheck.js       the declared play
    server/benchTasks.js      tasks, requirements and accumulation

Hashes are recorded in `TRANSFER-1_MANIFEST.txt` at the moment of freezing.

**Guidance and evaluation are separate, and it is checked mechanically:** the guidance functions
(`chooseSite`, `buildScaffold`, `buildInstruction`) receive only the file and the structured
requirement. A test asserts their source references no play spec, no diagnostic and no check. The
evaluation checks exist to judge, and the policy cannot read them.

## How the page is obtained

**The local 1.5B writes it, from a one-line request, with no shaping from me.** It will not be a farm
game. I will read it only to (a) validate its baseline through the full sequence and (b) write the
requested addition and its checks — both of which are the experimenter's job — and **not** to change any
rule. If a rule needs changing, that is a failure of transfer and is reported as one.

What I must NOT do, and what the record will show if I did:

    change autoGuide.mjs, localEdit.mjs or the scaffold rules after seeing the page
    add a site rule that happens to fit it
    hand the policy a hint the requirement does not contain

## What is measured, on every starting candidate

    site rule chosen, and its stated reason
    the scaffold and instruction the policy produced
    per attempt: the RAW completion and the EXTRACTED candidate, both kept
    refusals, by structural reason
    regressions produced, and whether each was restored byte-exact
    accepted additions, judged by the unchanged gate
    the accumulated protected set's verdict per sequence
    attempts, generation seconds, tokens, dollars, and interventions by me (must be 0)

## Pre-registered readings

- **Accepted, zero interventions.** The guidance transfers to a page I had not read. That is the
  strongest claim this line of work could support at this scale, and it would still be one page.
- **Declines.** The policy could not locate a site and said so. A good failure: it names what it needed.
- **Attempts and fails.** The counts localise it — no code, wrong site, uncontained output, or
  behavioural. Each points at a different missing rule.
- **A rule has to change.** Transfer failed. The result stands as recorded, the revision is made, and it
  is tested on a THIRD page that neither version has seen.

**What no outcome here can establish:** that the policy handles a language, a framework, or a failure
class outside the catalogue. One page, one model, one requirement shape.
