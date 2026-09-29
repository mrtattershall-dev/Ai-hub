# RD-B6 — Rule lifecycle & persistence (MEASURED)

**Decision: installed rules persist as SOURCE JSON (authored content, never the
compiled fn), and load RE-RUNS the wire (`installRule`) against the RELOADED
world. Reinstall failures land in a persisted, surfaced QUARANTINE — no rule
ever authored can silently vanish or silently no-op.** Plus lifecycle verbs:
`uninstallRule`, and `installRule(..., {replace:true})` versioning with
validate-before-swap.

Evidence: `experiments/030_rule_persistence/rule_persistence.js` — 28/28,
`node <file>` → ALL PASS. Full regression green after the change (all 8 core
suites + 026/027/029 experiments).

## The hole (confirmed before designing anything)

Probe: install `rule:reap`, `saveText` → `loadText` → `systems: []`. Installed
rules lived outside the RD-019 snapshot. For a project whose thesis is *the
model authors logic*, a reload losing the authored logic means there is no
game, only a demo that resets. **[measured T1]** the status-quo control: after
an old-schema reload the world is FROZEN — crops stop growing, no error, no
signal. The D&H silent-loss shape, at the logic layer.

## Rivals

| shape | verdict | why **[measured]** |
|---|---|---|
| persist compiled `fn` | non-starter, not run | closures don't serialize; anything that rehydrates one is `eval` — RD-B1 already rejected emitted code at the boundary |
| NC-A: status quo (no rules in snapshot) | INADMISSIBLE | T1: silent world freeze on reload; back-compat kept (old saves still load, empty report) |
| NC-B: blind reinstall (skip revalidation) | INADMISSIBLE | T5: a `match.uuid` rule whose target died reinstalls without complaint and runs forever matching NOTHING — a **permanent silent no-op**; the author believes the behavior exists |
| **source + revalidate + quarantine** | **ADMISSIBLE** | everything below |

## What the winner guarantees (each clause a test)

- **Round-trip fidelity** [T2]: save mid-run, fork; original and reloaded
  branches byte-identical for 5 further ticks; systems restored in install
  order; indexes consistent (RD-019's rebuild discipline extends to rules:
  the compiled fn is DERIVED state, rebuilt from authoritative source).
- **Identity-scoped rules re-resolve through RD-004.6** [T3/T4]: live target →
  reinstalls, still fires on exactly its target. Dead target → NOT reinstalled,
  quarantined with the explicit answer (`u1 is deleted`) in a load report the
  author can act on. Revalidation is the load-bearing move NC-B skips.
- **No silent loss, ever** [T7]: quarantine is itself persisted; a quarantined
  rule survives save→load→save→load with its localized reason intact.
- **Versioning** [T6]: `{replace:true}` swaps atomically; **a bad revision can
  never uninstall a good rule** (new rule validates before the old is removed);
  duplicate install stays a localized `duplicate_name` error (RD-B2 actor
  identity); uninstall persists; double-uninstall is an error, not a throw.
- **GC interplay, honest degradation** [T8]: rule→uuid references are an
  EXTERNAL ref class (RD-019.1's known open item) — refcount GC doesn't see
  them, so a GC'd tombstone degrades the quarantine reason `deleted`→`missing`.
  Absence stays explicit; it can never resolve to a wrong live entity (uuids
  never recycle). Retain-flag for rule-held refs is future work, now with a
  test documenting the exact cost of not having it.

## Implementation (small, in-pattern)

- `core/behavior.js`: `installRule` retains the canonical parsed source in
  `engine.ruleSources` (deep-copied; a rule IS its JSON); `uninstallRule`;
  `parseRule` additionally returns the parsed `rule` (non-breaking).
- `core/persistence.js`: `save()` emits `rules` (install order) +
  `rulesQuarantined`; `load()` reinstalls each through the real wire, builds
  `g.ruleLoadReport` (every outcome) and `g.ruleQuarantine` (failures, with
  errors). Old saves without the fields load unchanged.

## Open

- Retain-flag so rule-held uuid refs keep tombstone metadata through GC (T8's
  documented degradation).
- Rule persistence × RD-B5 sessions: when the live multi-rule run lands, add a
  mid-SESSION save/load replica arm (the RD-B2 fuzz discipline) so authoring
  sessions are provably resumable.
