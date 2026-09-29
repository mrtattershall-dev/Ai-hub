# RD-007 / RD-003 (partial): Serialization for AI Context (Closed for the AI-facing side)

**Question:** The stated goal — make what the AI reads (world state, files, tool defs) as small as possible ("quantized to the bit"). How small, and in what representation?

**Method:** Encode the same 5,000-entity world four ways; measure bytes (exact) and tokens (a vocab-agnostic PROXY — a real BPE tokenizer needed for exact counts) and tag legibility. `experiments/011_quantized_context/quantized_serialization.js`.

## Test-integrity note (the recurring lesson, again)
The first proxy tokenizer treated any letter-run as one token, so a 20,000-char base64 blob scored an absurd ~5,110 "tokens" and the run *contradicted* the hypothesis. That was a test bug, not a finding. Fixed the proxy to charge ~1 token per 4 chars of any alphanumeric run. It ALSO corrected an over-claim of mine: base64 is not token-*worse* — it is token-competitive. Its real disqualifier is legibility, not size.

## Proven (measured)
- **bytes ≠ tokens ≠ legibility** — three independent axes. base64 is smallest in BOTH bytes (4.0 B/entity) and proxy-tokens (~5.5k) — and is still the wrong choice, because the model cannot reason over it without a decode step it can't reliably perform. **Size alone would have selected the unusable option.**
- Among **legible** encodings the model can read directly, **columnar text** (one row per field, small integers, schema header, id implicit as row index) wins both bytes (9.1 B/entity) and tokens (~30k) — **~5× smaller than verbose "dump the scene as JSON" in both**, still fully legible.
- **Retrieval dominates compression.** A queried slice (214 of 5,000 entities) was **~28× smaller in tokens** than the full world. Encoding buys ~5×; not sending irrelevant state buys far more.

## Decision
**Split serialization by audience — do not conflate storage with context:**
- **On-disk / in-memory storage** (spine #3, still partly open): byte-optimal binary / SoA packing is fine — the model never reads it. This is where the 7–18 B/entity SoA work lives.
- **AI-facing context** (spine #7): **legible columnar text of a RETRIEVED SLICE**, not the whole world, not binary. Small integers, schema header, implicit ids. Legibility is a hard gate; base64/binary are rejected for context regardless of size.
- **The dominant lever is retrieval, not compression.** Deliver context by querying RD-001's indexes and emitting only the slice that answers the question. "Read all files" is the anti-pattern; "retrieve the minute relevant slice" is the pattern.

## Transferable principle
For anything an LLM must *reason over*, optimize tokens-under-a-legibility-constraint, not raw bytes — they diverge, and the byte-minimum is often unreadable. And before compressing a payload, ask whether it should be in the payload at all: retrieval beats encoding by an order of magnitude.

## Open / out of scope
- On-disk format specifics (spine #3): binary layout, event-log vs snapshot — not yet decided, only that it's a *separate* representation from AI context.
- Real BPE token counts (this used a proxy); tool-definition and file-content encoding (only world state was measured).
- How the retrieval slice is specified/requested — ties to spine #4 (AI↔engine protocol), untouched.
