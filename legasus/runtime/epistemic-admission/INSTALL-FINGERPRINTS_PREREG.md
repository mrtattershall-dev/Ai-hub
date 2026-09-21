# Installing closure fingerprints — the checkpoint is behavioural, not cosmetic
Frozen 2026-09-21, before `rules.mjs` was changed.

## The checkpoint

> **Identity tracking changed; inference behaviour did not.**

That is what a migration has to demonstrate. "New fingerprints work" is not the standard.

## Predictions

**I-1 STALENESS.** With closure fingerprints installed and the producer **not** re-pinned, every
certificate carrying an old fingerprint is refused with `RULE_DEFINITION_MOVED`. Nothing silently
falls back to the local definition.
FALSIFIER: any old certificate is still admitted.

**I-2 BEHAVIOURAL IDENTITY — the one that matters.** After an explicit re-pin, **every admission
verdict is exactly what it was before installation**. A snapshot of each fixture's admission state,
licensed relation and refusal stage is taken BEFORE the change and compared after.
FALSIFIER: any verdict differs. Identity tracking may change; what the runtime concludes may not.

**I-3 SEMANTIC CHANGE STILL MOVES IT.** After installation, changing a dependency's semantics moves
the rule identity again — the property is installed, not merely demonstrated in a side module.

**I-4 IRRELEVANT CHANGE STILL DOES NOT.** Editing unrelated code, or a comment, leaves every
installed fingerprint byte-identical.

**I-5 UNRESOLVED CANNOT BE PINNED.** A rule whose closure cannot be resolved has no fingerprint, and
`resolveRule` **refuses it** rather than falling back to any other identity.
FALSIFIER: an unresolvable rule resolves anyway.

## Rules

`legaknow` untouched. Registry stays at three rules. Rule selection stays at 0/15 over fifteen spent
declarations. The producer re-pins **explicitly**, as a recorded step, never automatically.
