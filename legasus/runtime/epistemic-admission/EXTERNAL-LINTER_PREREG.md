# External applicability, installation experiment — F1..F7. Frozen 2026-09-21.

*(A SEPARATE experiment. `EXTERNAL-APPLICABILITY_PREREG.md` and its null result stand unchanged:
under that rule, no eligible **installed** candidate existed. This one authorizes installation and
keeps **source code** as the object being judged.)*

## Eligibility, frozen

A candidate qualifies if and only if all hold:

1. **independently maintained** — not authored or modified by me, this project, or the hub, and not a
   fork or vendored copy of anything here;
2. **a source-code linter** — the item it judges is **source code**, not a JSON document, a git
   object, a test outcome or a build artefact;
3. **machine-readable rule identifiers** — each finding carries a stable rule id, code or name, not
   free prose;
4. **locally runnable** — offline, on a file supplied to it, after installation;
5. **has at least one existing rule addressing a SEMANTIC CORRECTNESS issue** — a rule about what
   the code *does* or *means*, not purely formatting, naming or style. The rule must exist in the
   tool already; it may not be written for this experiment.

## Selection, frozen

- **Candidate order:** alphabetical by the package name as installed.
- **Tie-breaker:** if two packages sort equally, the one whose published rule list is longer; if
  still tied, the one whose name is shorter; if still tied, the experiment stops and records the tie.
- **Installation budget: three attempts, total.** An attempt is one `npm install` or `pip install`
  of one package. When the budget is exhausted the experiment proceeds with whatever qualified, or
  records that none did.
- **Exclusions and installation failures are recorded**, with the reason, in the result.
- **Ranking by apparent ease of mapping into Legasus is forbidden.** The order is alphabetical; how
  hard a rule looks to express plays no part in choosing it.

## The obligation, frozen

From the selected tool, take the **first rule in the tool's own documented order** that satisfies
eligibility clause 5 (semantic correctness). If the tool documents no order, alphabetical by rule
id. **Not** a rule chosen by me.

## Development and evaluation, frozen

- **Development:** the adapter or registry extension is built against **one** qualifying rule and a
  **declared subset of examples**, listed by name in the result before any evaluation case is run.
- **Evaluation:** on **untouched** cases, reserved before development and not looked at during it,
  containing **both** a legitimate acceptance and a legitimate refusal.
- **Recorded for every case:** the linter's decision and rule id; Legasus's decision and reason;
  **translation effort**; **human assistance** (every point where I chose something the frozen rules
  did not determine); **unsupported translations**; **discrepancies** in either direction.

## Failure conditions, frozen

- **Inability to express the selected obligation is a RESULT**, recorded as such.
- **Switching rules because another maps more conveniently is forbidden.** If the selected rule
  cannot be expressed, that is the finding, and the experiment does not go shopping.
- A favourable result is not the goal. **One external obligation evaluated honestly is the goal.**

## Predictions, committed now

- I expect the registry, **as it stands**, not to express the selected rule — the three authored
  rules are about existential and universal claims over a sampled domain with coverage witnesses,
  and a linter's semantic rule is unlikely to be one of those.
- I expect the **translation** to be where the work is, and I expect to be tempted to steer. Every
  instance is recorded.
- I expect a **legitimate acceptance (E5-equivalent) to be easier than a consequential refusal**.

## Untouched

The **0/15** result is about fifteen historical declarations from this project's own past. Nothing
here changes it, this experiment is reported separately, and a success here is never added to that
denominator. **S6, F2, `COMPLETE`, `INVALIDATE`** untouched.
