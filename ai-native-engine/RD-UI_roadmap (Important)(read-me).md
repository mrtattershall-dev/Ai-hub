# Addendum (round 2) — Intent confirmation, grounding, contextual UX, and project intelligence

This addendum revises UI1–UI4 and introduces UI5–UI10. These are planning notes only and inherit the same RD discipline as the rest of the document: every feature must begin with a hypothesis, a falsifiable experiment, and an honest measured write-up before becoming core behavior.

---

# Cross-cutting principle — Read Path vs Write Path

The engine now has two fundamentally different responsibilities.

**Write path**

The AI proposes changes.

The engine validates.

The sandbox simulates.

The user approves.

The engine commits.

Safety comes from preventing invalid writes.

**Read path**

The AI explains.

The AI searches.

The AI teaches.

The AI answers.

There is no commit step.

Therefore the safety property is different.

The read path must be **grounded**.

Every factual statement must be traceable to retrieved engine state.

Examples:

- rule source
- manifest entry
- entity metadata
- dependency graph
- history log
- profiler output
- asset manifest

If an answer cannot be grounded, it must be clearly presented as:

- inference
- estimate
- suggestion
- possibility

Never as established fact.

Every read-only feature below should include a falsifiable evaluation:

> Did the assistant ever confidently state something that was not supported by retrieved project data?

---

# RD-UI1 — Ghost Mode (revised)

Addition:

Before simulation runs, the AI should explicitly state how it interpreted the user's request.

Flow becomes:

Natural Language

↓

Intent Confirmation

↓

Sandbox Simulation

↓

Ghost Preview

↓

Install

Example:

"I interpreted your request as:

• add wind shader

• attach ambient rustling

• fade by listener distance

• apply only to selected tree"

Correct?

This catches semantic mistakes before sandbox execution.

## Ghost Timeline

Split into two experiments.

### Tick Timeline

Cheap.

Use existing sandbox.

Store snapshots instead of only final state.

Allow timeline scrub:

- 0s
- 1s
- 5s
- 30s

### Simulation Timeline

Blocked until authored simulation systems exist.

Examples:

- seasons
- weather
- economy
- crop growth

Ghost Mode should not invent systems merely to preview them.

---

# RD-UI2 — Context Prompt (expanded)

Prompt scope becomes explicit.

Examples:

Project

Scene

Region

Selection

Object

Component

Scope should affect:

- confirmation weight
- review UI
- blast radius messaging

A project-wide operation deserves more friction than a single-object edit.

Prompt color, iconography, and confirmation should communicate scope before execution.

---

# RD-UI3 — Dream Mode (expanded)

Dream Mode remains read-only.

No writes.

No hidden proposals.

Output type:

Dream Report

Possible lenses:

- Performance
- Economy
- Visual Polish
- Accessibility
- Audio
- Progression
- NPCs
- Tutorials
- Asset Organization

Dream conversations remain read-only.

Any requested action must intentionally hand back into the standard proposal pipeline.

---

# RD-UI4 — Story View (formerly History)

Story becomes a presentation layer.

Never a second source of truth.

Story should derive from:

- proposal history
- install history
- explain.js
- undo history
- original natural-language request

Whenever possible.

Story entries must never invent motivation.

Good:

"Added wind after request:
'Make the forest feel alive.'"

Bad:

"Wind was added because nearby trees already moved."

Unless that reasoning was actually recorded.

---

# RD-UI5 — Explain Mode

Purpose:

Increase understanding.

Never modify.

Examples:

Why is this shader here?

Why is this NPC never spawning?

Why is this quest unreachable?

Why does this building feel empty?

Answers must be grounded in retrieved project state.

Performance explanations remain a separate research task requiring profiling instrumentation.

---

# RD-UI6 — Ask the World

Natural-language search across the project.

Examples:

Where is gold generated?

Show all farming systems.

Which crops use fertilizer?

Which entities reference this sprite?

Camera should optionally navigate to matching results.

Results should remain grounded.

---

# RD-UI7 — Relationship View

Visualize project relationships.

Examples:

Object

↓

Components

↓

Rules

↓

Assets

↓

Dependencies

↓

References

This is a renderer over existing indexes.

No new backend architecture.

---

# RD-UI8 — Workspace Awareness

Hypothesis:

The teammate should understand what the developer is currently working on.

Examples:

Current scene

Current camera

Current selection

Recently edited files

Recent prompts

Visible viewport

Suggestions become contextual rather than global.

Example:

"I noticed you're decorating the forest.

Several nearby trees have no collision."

Rather than:

"You have 400 issues."

Measure:

Does contextual awareness improve acceptance rate compared to global suggestions?

---

# RD-UI9 — Project Brain

Hypothesis:

Imported assets become persistent knowledge.

Import flow:

Import

↓

Analyze

↓

Describe

↓

Tag

↓

Hash

↓

Index

↓

Never re-analyze unless changed

Knowledge should continuously enrich over time.

Example:

Originally:

Tree sprite

Later:

Used in biome

Used by NPC

Referenced by quest

Missing collision

Unused variant

Identity should be UUID-based rather than filename-based.

Manifest entries update in place.

No duplicate knowledge.

---

# RD-UI10 — Universal Command Surface

Every editor surface exposes the same interaction.

Objects.

Scenes.

Audio.

Materials.

Animations.

Shaders.

Dialogue.

Tilemaps.

UI.

Everything.

Click.

Tiny prompt.

"What would you like to change?"

The difference is context, not interface.

The teammate automatically understands what is selected.

---

# Long-term UX Principle

The editor should not ask users to learn multiple interfaces.

Natural language.

Ghost previews.

Story.

Relationship graphs.

Explain mode.

Visual cards.

All are simply different representations of the same deterministic underlying project state.

The engine should increase understanding before increasing automation.

---

# Updated sequencing

Build immediately

- UI1 Ghost Mode
- UI2 Context Prompt
- UI7 Relationship View

Second wave

- UI3 Dream Mode
- UI4 Story
- UI5 Explain
- UI6 Ask the World

Research cards

- UI8 Workspace Awareness
- UI9 Project Brain

Long-term UX vision

- UI10 Universal Command Surface
