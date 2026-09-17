# Transaction substrate — task schema

**Frozen before any task is authored.** This is the substrate's constitution. Construction rules live in
[`../../../LEGASUS_V4.md`](../../../LEGASUS_V4.md) (fourteen rules, amendments A and B).

## The boundary, made physical

    task/
      task.json                    PROMPT-VISIBLE
      source/                      starting program, prompt-visible
      evidence/
        oracle.json                NEVER prompt-visible
        reference.patch            NEVER prompt-visible
        probes/                    NEVER prompt-visible
        omitted-op-variants/       NEVER prompt-visible

Separate directories, not a convention. Crossing the boundary requires deliberately reading from
`evidence/`, which `validate-task.mjs` and any runner can refuse to do.

### LegaLabs doctrine

> **Specification tells the system what must become true.
> Evaluation knows how you established that it became true.
> These are not the same artifact.**

This is permanent doctrine, not a substrate-local rule. The contaminated-contract defect of 2026-09-13
happened because one artifact fed both the prompt and the checker; results were quarantined as VOID. The
boundary exists so that cannot recur by convenience.

## `task.json` — prompt-visible

Only what a legitimate task specification could contain.

    {
      "task_id":        "t01",
      "goal":           "<the requested behaviour, in the same register as a real user request>",
      "lead":           "s4_markdown.py",
      "language":       "py",
      "run_with":       "python",
      "analogy":        "<optional: the relation, ONLY when genuinely part of the task>",
      "interface":      { "<permitted interface information>": "..." }
    }

**Forbidden in `task.json`:** sites, anchors, insertion points, operation order, operation count,
dependency edges, reference identifiers, implementation hints, or any text derived from the reference
patch. `validate-task.mjs` enforces this, including a substring-leakage check against the reference.

The `analogy` field is permitted **only** when the analogy is genuinely part of the request — goal 64's
"written like the unordered lists" is a real user-level statement. It may name a relation; it may not
name a site.

## `evidence/oracle.json` — evaluator-only

    {
      "task_id": "t01",
      "analogy_class": "analogy_specified | no_supported_analogy",
      "analogy_justification": "<the relation named, OR why no supported relation is present>",
      "transaction": {
        "operation_count": 3,
        "operations": [ { "id": "op1", "intent": "...", "site_hint": "..." } ],
        "dependency_edges": [ ["op1", "op2"] ],
        "permitted_orders": [ ["op1","op2","op3"] ],
        "transaction_length": 3
      },
      "complexity": { "structural_class": "...", "affected_region_lines": 18 },
      "reference": {
        "source_hash": "...", "reference_hash": "...",
        "changed_sites": [ ... ], "implementation": "reference.patch"
      },
      "witnesses": {
        "noop_fails_delta": true,
        "each_operation_omitted_fails_delta": [true, true, true],
        "reference_preserves_old_behavior": true,
        "reference_passes_delta": true
      },
      "sealing": { "authored_commit": "...", "evidence_commit": "...", "pre_generation": true }
    }

`analogy_justification` exists so the classification cannot be retroactively changed when LegaParse
disagrees with it. For analogy tasks it records the relation the task names; for non-analogy tasks, why
no supported relation is present under the frozen applicability definition.

`sealing.pre_generation` asserts that no model generation was run against this task before the evidence
was sealed. A task without it is not admissible.

## Temporal authoring rule

**Author the entire family, seal every evidence package, check the class/complexity matching, freeze the
substrate — and only then let the model or the applicability detector see any of it.**

Running generations while authoring would let task 7 be unconsciously shaped by what happened on tasks
1-6, without anyone deciding to tune anything. The hazard is temporal, not technical.

## Sealing

Rule 14 asserts `sealing.pre_generation`. An assertion is a claim; a hash is evidence. `seal.mjs`
produces `MANIFEST.sealed.json` with three separate hashes per task:

    task_sha       task.json     what the model is allowed to see
    source_sha     source/       the starting program, also prompt-visible
    evidence_sha   evidence/     what the model must never see

Kept separate so a later audit can show the CONTRACT was unchanged even if the evaluator gained a probe
— and, more importantly, detect the reverse.

    node seal.mjs seal   <familyDir>     # author -> validate -> SEAL
    node seal.mjs verify <familyDir>     # before and after any run

Verified by `seal.test.mjs` against six mutation classes: contract edited, source edited, evidence
edited, task added, task removed, and an untouched family that must still verify.

## The sequence, once authoring begins

    author all tasks
      -> run validate-task.mjs
      -> seal.mjs seal
      -> freeze the substrate
      -> freeze the applicability detector
      -> only then run anything

No peeking, no tuning, no "small cleanup" after the first outputs.
