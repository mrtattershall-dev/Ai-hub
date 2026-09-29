# RD-024 — Schema authoring: the world's vocabulary as validated data

**Status:** ✅ DECIDED (2026-07-16, same day) — H1 confirmed, all three bars passed.
Bar 1 (compat): all 12 suites green UNMODIFIED after the registry refactor (integration
39, tick 29, protocol 14, ordered 20, history 26, persistence 18, tombstone 18,
live_loop 6, repair 14, editor 24, m1 15, homestead 7). Bar 2 (generality):
`experiments/039_schema_authoring/pong_vocab.js` — 26/26: paddle/ball defined at
runtime (y coexists on both types — the per-type field namespace went in during
Phase B), spawn/init, gated writes, cross-pool + range rejections, RD-005 defer on
undeclared-fold y AND additive fold on score, RD-B6 rule with the RANGE PROOF over a
runtime-born field, AI-wire validation, save/load with schemaDefs traveling in the
snapshot, rule re-running post-load, unsafe=0. Bar 3 (rejection): 6 refusal classes,
world byte-identical after all six. H2 found no leak; H3 didn't materialize (the
defineType gate was ~50 lines). The farm is now the DEFAULT SCHEMA of a general
engine, not its shape.
**Raised by:** the generalization gate (GENRE_READINESS.md critical path #1; the user's
multi-genre mandate). Today `engine.js` hardcodes TYPE={CROP,FISH,ENEMY,ZONE}, pools,
FOLD_SCHEMA, FIELD_OWNER, FIELD_RANGE — every non-farm genre is blocked on editing core.

## The claim under test

Types/fields/ranges/folds can become **runtime-defined, gate-validated, persisted
data** — authored like rules (RD-B6 pattern) — without breaking any invariant the
project has measured (RD-002/003/004/005/017/019/020/021, RD-B2).

## Enumerated touch points (measured, not guessed — grep 2026-07-16)

In `core/engine.js`: (1) TYPE/TYPE_NAME:35-36, (2) FOLD_SCHEMA:41, (3) FIELD_OWNER:53,
(4) FIELD_RANGE:59, (5) pools:118-121 + spawn-init:239-241 + field r/w:261-275,
(6) contextSlice:948-950. Consumers: behavior.js (10 refs — the rule gate's
known-field proofs), persistence.js (7), protocol.js (2). All are KEYED lookups —
no algorithm consumes the farm shape, only tables.

## Hypotheses

- **H1 (bounded registry):** converting the 6 sites to an instance `schema` registry
  (default = today's farm schema, byte-identical behavior) is a bounded refactor;
  dynamic `defineType` then composes with every existing invariant because nothing
  downstream reads anything but the registry.
- **H2 (invariant leak):** somewhere an invariant silently depends on the vocabulary
  being static — candidates: persistence identity across schema versions (load a save
  whose schema mentions a type the code no longer defines? — impossible once schema
  travels WITH the save, which is the design), fold determinism for user-declared
  folds, behavior.js range proofs against dynamic ranges, contextSlice legibility.
- **H3 (gate insufficiency):** schema definitions themselves need validation the
  current gates don't have (name collisions, reserved fields, range sanity, fold enum,
  capacity math) — i.e. a NEW gate, not a reuse; risk is scope growth.

## Falsification bars (pre-registered)

1. **Compatibility bar:** after the registry refactor, the ENTIRE existing core suite
   passes unmodified (integration 39, protocol 14, editor 24, behavior/live/persistence/
   history/ordered/tick/tombstone suites, m1 15). Any test edit = H1 weakened, report it.
2. **Generality bar:** `experiments/039_schema_authoring/` defines PONG's vocabulary at
   runtime — `paddle{y:0-255 fold:defer}`, `ball{x,y:0-255 fold:defer, score:additive}`
   — through the schema gate, then: spawns them, submits gated writes, installs a
   behavior rule over a dynamic field through the REAL RD-B6 gate, saves+loads with the
   schema traveling in the snapshot, and passes the unsafe sweep. Zero core edits beyond
   the registry refactor itself.
3. **Rejection bar:** the schema gate refuses (with localized errors, world untouched):
   duplicate type name, reserved field name, inverted range, unknown fold, and a
   post-hoc field REdefinition that would invalidate live rows.

## Decision rule

- All three bars pass → RD-024 DECIDED: schema-as-data, farm becomes "the default
  schema", generalization gate open. Next: space (x/y fields) rides the same registry.
- Bar 1 fails somewhere structural (not a test-string) → H2 wins; document the leaking
  invariant; the boundary moves (maybe schema fixed-at-boot, versioned worlds).
- Bar 3 needs >1 day of gate machinery → H3 wins on scope; ship fixed-at-boot schema
  first (still unblocks genres), authoring gate becomes its own card.

## Out of scope (deliberately)

AI-authoring the schema via NL (rides the existing propose loop AFTER this lands);
migration of existing saves between schema versions (versioned worlds are enough for
now); spatial queries (next card); renaming/deleting types with live entities.
