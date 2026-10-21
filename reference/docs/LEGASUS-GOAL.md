# The defensible Legasus goal, and where today's work sits against it

Recorded 2026-09-29, after external survey. **The mission is a crowded research direction, not
untouched territory.** Every component below is actively pursued elsewhere.

## The goal, stated so it can be lost honestly

> Demonstrate that an evidence-governed controller can produce more **verified, regression-safe**
> software progress **per unit of compute** than fixed generation methods, and **improve across a
> declared stream of tasks** without hiding failures.

Not "make a 1.5B secretly as smart as a giant model." Not "build self-aware AI." Not a novelty claim of
any kind: no record in this project asserts one, and none should.

## What is already publicly pursued

| Legasus goal | status elsewhere |
|---|---|
| software evolution across many changes | actively researched; benchmarks exist and agents score far worse there than on single-bug tasks |
| agents learning from prior tasks | actively researched; needs deliberately constructed reusable-knowledge streams to be measurable |
| routing to cheaper/stronger models or representations | actively researched; trained selectors already exist for code-vs-edit format |
| agents modifying their own harness | actively researched; pipelines with evidence, temp workers, consent and rollback exist |
| verification, preservation, rollback | actively researched, and partial credit is known to be easy to fake |
| small models made cheaper and more capable by targeted training | actively researched |

**So Legasus did not invent any of these.** The only candidate contribution is the *intersection*:
self-changes tied to explicit evidence, scoped authority, independent verification and recovery —
rather than an agent judging its own rewrite. That remains a hypothesis until compared directly.

## What today actually produced, against that goal

**Instrument work** — the bulk of it, and the honest category:

- a byte-level presentation audit; a re-scorer proven against a real negative and a positive control;
  an interruption gate; a whole-app reply contract; an obligation-mutant validator; a governed
  workspace whose commit path is the existing executor

**Results:**

- free-form whole-artifact beat every constrained dialect 12-0 on one filter family (this package,
  these template paths)
- instruction **location** changed the failure mode — document-closing in 24 of 24 with inline-comment
  intent, page-aware executable code in 12 of 12 with separated intent — and changed **no** outcome
- both arms 0/5 on a farm extension; both arms 6/6 and 3/3 on stage-3/stage-4 with a 7B

**Withdrawn or falsified:**

- "the manager improves completion or preservation for a 7B on small single-page features" —
  contradicted; the control matched it at half the calls
- "narrowing produced a working artifact on the farm family" — the only acceptance fails the corrected
  error-sensitive gate; **no surviving acceptance from a narrowed interface exists on any family**
- "bounded edits won on the farm family" — no such contest was ever run; that arm was whole-artifact

## What the goal requires that does not yet exist here

- a **memory-on versus memory-off** comparison on a stream where earlier knowledge is genuinely
  reusable. Legasus has no retention at all, so both arms are currently the same system.
- a router **beating** always-whole-file and always-FIM on held-out tasks. Routing is a hypothesis;
  today's evidence says only that the right representation is task-dependent and currently unpredicted.
- the governed workspace having **any consumer**. It behaves correctly in isolation and nothing routes
  through it.

## The standing rule this produces

Any future claim gets one of four labels, and the third and fourth are not failures:
**established elsewhere · reproduced here · plausible but untested · contradicted.**
