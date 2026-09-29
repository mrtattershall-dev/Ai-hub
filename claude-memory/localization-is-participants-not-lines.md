---
name: localization-is-participants-not-lines
description: Proven by execution — choosing WHICH participants must change carries far more information than choosing WHERE inside the parent; the whole 12-task family holds only 5.82 bits of positional information
metadata: 
  node_type: memory
  type: project
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-17T20:40:45.424Z
---

2026-09-17, Legasus. Swept every operation in the sealed 12-task provenance family across every line
boundary in its structural parent, running the delta and preservation probes at each position. An
operation is NARROWABLE when at least one position actually breaks the transaction.

    38 operations -> 26 NARROWABLE, 7 position-independent, 5 intra-line, 0 untestable
    TOTAL positional information in the entire family:  5.82 bits   (mean 0.224, max 0.58)

Against that, v5's requirement-based participant pruning on TWO tasks yielded 1.06 bits of
localization information — **equal in magnitude to 18% of the family's entire 5.82-bit
positional-narrowing capacity.** These are DIFFERENT INFORMATION SPACES (which participant vs where
inside a parent), so it is a comparison of magnitude, not a share of one total: a small amount of
semantic participant selection carries information on the same order as a substantial fraction of
everything exact placement has to offer.

> The difficult part of localization is determining which semantic participants require modification,
> not choosing an exact textual insertion boundary once those participants are known.

**Why:** it explains why candidate inflation mattered, why the ownership graph mattered, and why exact
line matching kept producing strange measurement questions. It also reinterprets v5's 1/19 information
gain — most of those zeros were correct answers, not failures to understand the program. See
[[dev-set-win-on-unexercised-mechanism]].

**How to apply:** invest in WHICH-participant decisions (concern resolution, required-vs-excluded with
witnesses), not in squeezing exact-line selection. What a model needs is *"this is the participant,
this is its role, these are its dependencies, this is your legal region, and you have no authority
outside it"* — canonical realization absorbs the rest, because the rest is measurably small. Never
average narrowing across site kinds: STRUCTURAL_INSERTION, EXPRESSION_EDIT, REPLACEMENT_REGION and
TRANSACTION_PARTICIPANT do not share a coordinate system, and forcing them into one produced a
"0 of 27 passing" result that was an instrument artifact.

Apparatus hazards for this work are catalogued in `legasus/legalabs/HAZARDS.md`, each marked MECHANIZED
or RULE ONLY. Related: [[silent-failures-are-the-class]], [[goal-coupling-wrong-denominator]],
[[measure-the-thing-itself]], [[windows-bash-edit-gotchas]].
