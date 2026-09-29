# RD-029 — Can the AI author a NON-FARM game? (and does RD-028 actually help it?)

**Status:** ✅ DECIDED (2026-07-16) — **UPDATED after the gate-hardening rerun the
first run motivated (see RD-030/031): arm B went 1/5 → 3/5 correct with 100%
precision. H2 is now DECISIVE (signed+mul 3/5 vs unsigned 0/5), not "directional".
The first run's negative result stands as the reason the second one exists.**

Original verdict (first run, pre-hardening) below — Live Qwen2.5-Coder-32B, real
gate+repair loop, plain-English goals: **arm A (unsigned) 3/5 gated but 0/5 correct;
arm B (signed+mul) 4/5 gated but 1/5 correct.** H1 PARTIALLY REFUTED (the
schema-derived prompt was necessary — the model was previously told the world held
`crop|enemy|zone` — but NOT sufficient). H2 WEAKLY SUPPORTED (B wins every axis:
gate 4v3, correct 1v0, attempts 9v12 — direction right, magnitude unproven; two
failures with a gradient is not a victory). **H3 CONFIRMED: zero unsafe events, every
refusal left the world byte-identical — the safety boundary is not farm-shaped.**

Two systematic SAFE-but-WRONG failure modes, both captured with transcripts:
(1) **the inverted clamp** `min:[max:[e,255],0]` — identically 0, written in BOTH
arms on multiple goals; the gate accepts it because `[0,0]` really is in range;
(2) **hallucinated structure silently ignored** — the model put `of:{near:14}` at the
RULE level, where unknown keys are dropped, producing a bounce that fires every tick
regardless of paddles and *looks* right.

The scorer needed hardening too, and that is on the record: the first pass reported
A 1/5 / B 3/5 because `paddle_input` asserted only "y decreased" (passing a rule that
slams y to 0) and `paddle_bounce` tested only the positive case (passing a
reverse-every-tick rule). Controls — a step not a teleport, an idle-input paddle that
must not move, a FAR ball that must not reverse — produced the real numbers. A weak
oracle launders a wrong rule (RD-004/005's "check the test", one layer up).

Yield: **RD-030 strict-key gate** and **RD-031 degenerate-interval check** — both
target the exact errors a live model actually made, both with a captured failing
transcript as motivation. Full write-up: `experiments/043_ai_authors_pong/results.md`.

## Two claims this closes, both currently unmeasured

1. **The thesis, off the farm.** Every live-model authoring result to date (RD-B5,
   B2-LIVE, the editor's propose pane) authored FARM rules on the FARM schema. The
   project's headline claim — "an AI can safely author behavior" — has never been
   tested on a genre whose nouns and verbs the engine learned at runtime.
2. **RD-028's premise.** That card justified signed fields + `mul` with: *"a human
   found these encodings; an AI author plausibly would not."* That is an assertion
   about a model, made without asking one. It is A/B-testable, and RD-028 is exactly
   the intervention.

## The blocker found while writing this card (a real one)

`core/editor.js`'s `RULE_GRAMMAR` — the text that tells the model what it may write —
is **hardcoded farm**: `"type":"crop|enemy|zone"`, `fields: water,growth crop
(0..255); hp enemy; tally zone`, and it documents neither `mul` (RD-028), `near`
(RD-025), `subtree` (RD-B7.1), nor signed ranges. RD-024/M2 made the engine, wire,
persistence and transport schema-driven; **the AI-authoring prompt is the last place
the vocabulary is duplicated** — and it is the place that matters most for the
thesis, because a model cannot author what it is never told exists.

## Hypotheses

- **H1 (prompt was the gap):** with a SCHEMA-DERIVED grammar description, a capable
  model authors correct Pong rules through the existing gate+repair loop, on a
  vocabulary that did not exist when the engine booted.
- **H2 (RD-028 measurably helps):** given the same goals, the model succeeds more
  often / in fewer attempts with signed+`mul` available (arm B) than with an
  unsigned-only schema forcing offset encoding (arm A). If arm A and arm B tie,
  RD-028's premise was wrong and should be recorded as such.
- **H3 (safety holds off-farm):** zero unsafe events; every rejected proposal leaves
  the world byte-identical. The safety claim must not be farm-shaped either.

## Bars (pre-registered)

1. **Prompt derives from the schema** — no farm strings in the authoring path; the
   farm's own prompt text remains byte-equivalent in content for the default schema
   (compat), and the full core suite stays green.
2. **A/B, same model, same goals, same loop.** Arm A: unsigned schema (v1 style,
   offset encoding required). Arm B: signed + `mul` (v2 style). Goals stated in plain
   English, no JSON hints, no encoding hints. Report per-goal: success, attempts,
   and whether the authored rule is BEHAVIORALLY correct (run it — gated ≠ correct;
   the B2-LIVE lesson).
3. **Artifacts captured** (house rule): every raw proposal, every reject code, both
   arms, to disk — the run must be replayable without a second GPU spend.
4. **Honest scoring.** A rule that passes the gate but plays wrong counts as a FAIL
   with its transcript quoted.

## Decision rule

- Bars pass, arm B beats arm A → **H1+H2 confirmed**: the thesis extends off-farm and
  RD-028's premise was right, with a number.
- Arm B ≈ arm A → **H2 refuted**: record that the encodings did NOT block the model;
  RD-028 keeps its authoring-delta win (16→11 rules is measured) but loses its
  AI-authorability justification.
- Model fails both arms → **H1 refuted**: report whether the failure is grammar
  expressiveness, prompt legibility, or model capability — three different next cards.

## Cost + constraints

Remote model only (NEVER local — pinned laptop rule). Modal A100 endpoint already
deployed (`experiments/037_ai_native_editor/modal_endpoint.py`,
Qwen2.5-Coder-32B). ~1-2 min cold start + ~10-20 generations ≈ single-digit dollars.
