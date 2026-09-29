# RD-M2 — Transport validates against the runtime schema

**Status:** ✅ DECIDED (2026-07-16, same day) — hypothesis confirmed on all four
criteria. `m2_schema_transport_test.js` 9/9: paddle defined at runtime on the server,
created + written through the ordinary TCP grammar (committed, state correct
server-side); unknown type refused at the transport with the identical message;
dynamic-field misuse hit the SAME pipeline rejections as single-player (range,
cross-pool); `m1_test.js` 15/15 UNMODIFIED; the only protocol delta is `schemaDefs`
riding in the existing view (no new message types). Implementation was one line of
duplication removed (`sanitizeOps` takes the world's schema, module table stays as
back-compat default) + the view field. Hypothesis and criteria framed by the user.
**Raised by:** RD-024's honest gap — `m1_server.js sanitizeOps` still resolves entity
types against the module-level farm `TYPE_NAME`, the one remaining place the
vocabulary is effectively duplicated. Until the transport consults the runtime
schema, multiplayer cannot carry arbitrary projects.

## Hypothesis (user's, verbatim)

The transport layer can validate runtime-defined schemas using the persisted
vocabulary without reducing the safety guarantees established by RD-024.

## Success criteria (pre-registered)

1. **Dynamic types replicate correctly** — a type defined on the server engine is
   creatable/writable through the wire (`{t:'tx'}` createChild/setfield) and its
   state reaches clients through the same broadcasts.
2. **Malformed schema ops reject identically to single-player** — unknown type over
   the wire gets the same localized refusal as before; dynamic-field misuse falls
   through to the SAME pipeline rejections (cross-pool, range) proven in RD-024.
3. **Existing farm multiplayer tests remain green** — `m1_test.js` 15/15 unmodified.
4. **No protocol changes beyond transmitting schema definitions (or references)** —
   the message grammar is unchanged except the welcome/view carrying `schemaDefs`.

## Scope note (capability vs proof artifact — per the same user guidance)

This card measures the TRANSPORT capability only. Editor-UI generalization
(rendering arbitrary schemas instead of crop cards) is renderer work, a separate
card; the farm UI remaining farm-shaped does not fail this RD.

## Result

(to be filled by the run)
