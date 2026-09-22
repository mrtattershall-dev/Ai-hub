# Is there a real consumer of separately-sourced evidence that struggles to enforce its requirements?

Asked as a practical question, answered from the code rather than from memory. 2026-09-21.

## Short answer

**Yes — one, named and located.** And the honest qualifier arrives with it: its producers are
**separately deployed and independently versioned, not separately owned**. There is no
genuinely separately-*owned* producer anywhere in this environment.

## The consumer

**`ai-coding-hub/training-data/factory/score_run.mjs`** — the scorer that produces the comparative
model results this project has been publishing all along (`run5 vs base`, `14B vs 32B`, set F/G/H).

## Its producers, and how separate they actually are

| producer | separation |
|---|---|
| the **Modal chromium verifier** (`mr-tattershall--chromium-verify-verifier-web.modal.run`) | separate host, separate deployment, separate release cycle — **same owner** |
| the **local hub verifier** (`server/gameVerify.js`) | in-process |
| the **asset library** | changes underneath both as packs are imported |

**Same owner, different deployments.** That is version drift between components, not two mutually
distrusting parties. It is weaker than the case the multi-party machinery was built for, and calling
it "separately controlled producers" would be overstating it.

## Its requirement, in its own words

From `score_run.mjs:62`:

> *"Every distinct asset-library version the verifier reported while scoring. More than one means the
> library changed mid-run and the Phaser column is not internally comparable."*

and at line 138:

> *"A Phaser score is only comparable across runs if the code loaded the same bytes, and the library
> changes as packs are imported — so an unpinned score silently compares two different worlds."*

The requirement is explicit and correct: **verdicts being compared must come from the same asset
library.**

## How it currently enforces that requirement — it doesn't

`score_run.mjs:465`:

```js
if (ASSET_VERSIONS.size === 1) {
  console.log(`  asset library: ${[...ASSET_VERSIONS][0]}`);
} else if (ASSET_VERSIONS.size > 1) {
  console.log(`  !! asset library CHANGED during scoring (...)`);
  console.log('     the phaser column is not internally comparable - rescore.');
}
console.log(`COMPARABLE — the ${shared.length} prompts every variant answered`);
```

**It detects the violation, prints a warning, and then prints the comparison table anyway** — under
a heading that says `COMPARABLE`. Nothing blocks, nothing is withheld, and the numbers go into a
report that a human then quotes.

This is the exact pattern already in this project's own record: *the detection fires and nothing is
wired to it.*

The one place version equality **is** actually checked —
`training-data/factory/verify_remote_assets.mjs:43`, *"verifier and hub report the same asset
version"* — is a **separate manual script** that the scorer never consults.

## Why this candidate is genuinely different from the workflow just tested

The value comparison tested **currency of one source across a restart**. This is a different shape:
several verdicts from **several producer runs**, which must be shown to come from **one world**
before they may be **combined into a comparison**. Agreement between sources, not freshness of one.

That is nearer to what merge, multiplicity and world identity were built for — which makes it a
**reasonable place to test the hypothesis**, not evidence that the hypothesis is true.

## And the reason to be sceptical, stated now

**The obvious fix is about five lines**: refuse to print the comparison when `ASSET_VERSIONS.size > 1`,
or carry the version into the comparable-subset computation. A hardened baseline would very likely
win this one too, exactly as it won the last.

**The TC control must be applied again**: strip Legasus out and keep the surrounding checks. Any
claimed benefit that survives that removal is real; any that disappears belongs to the surrounding
code, not to Legasus.

## Recommendation

1. **Adopt the practical outcome already reached**: the hardened baseline is the tool for the
   eslint/reuse workflow. Legasus is not used for it.
2. **Fix the scorer regardless of Legasus.** It is a five-line defect in live measurement tooling
   that has been silently producing "COMPARABLE" tables across possibly-divergent worlds. That fix
   should not wait on a framework evaluation, and crediting it to Legasus would be wrong.
3. **Only then**, if the comparison is still wanted: have the scorer's requirements written down
   first, build a hardened baseline and a Legasus arm against them, and run the TC control.

**My expectation, recorded before any of that:** the baseline wins again. The shape is closer to
Legasus's strengths, but "closer" is not "close enough to justify 3.4× the code", and the multi-party
property Legasus was built for — *mutually distrusting owners* — **is not present in this
environment at all.**

## The honest bottom line

The user's question was: *can you name a real consumer who needs evidence from separately controlled
sources and currently struggles to enforce its requirements?*

**A consumer that struggles: yes, precisely located.**
**Separately *controlled* sources: no — separately deployed, same owner.**

On that reading the condition for evaluating the multi-party hypothesis is **not met by this
environment**, and the disciplined conclusion is the one already on the table: **retain Legasus as an
experimental framework, and use the simpler baseline in production.**
