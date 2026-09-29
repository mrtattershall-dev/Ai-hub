# RD-001: World Representation (Closed — was provisional since the start)

**Question:** What is the world's primary representation? It has been "scene tree, provisional, only reasoned about" through every prior card. This is the first time it was measured.

**Method:** Build the SAME 10k-object world two ways; count query WORK deterministically (nodes touched), not wall-clock — same anti-noise discipline as RD-008. Load = the AI's real query mix: relationship questions (all-of-type, children-of, who-references-Z). `experiments/001_world_representation/world_representation_query.js`.

## Proven (measured)
- **Scene tree: 28,579 node-touches** for the query mix. It is O(1) for containment (children-of, which it stores directly) but **O(N) for every relationship query it lacks an index for** — all-of-type and who-references-Z each scan the whole world.
- **Indexed/graph (flat store + maintained `byType`, `childrenOf`, `referrersOf` indexes): 2,009 touches** — O(result-size) for all three queries. ~**14× fewer touches** on this mix.
- Both representations returned **identical result sets** (the sanity gate), so the speedup is real work saved, not a different answer.
- Honest cost: the indexed model pays **28,570 index writes across 10k inserts** (a one-time build / per-mutation maintenance cost) and extra memory for the indexes.

## Decision
**Hybrid: an authoritative containment tree PLUS derived, maintained indexes.**
- Keep a parent/child **tree** as the canonical structure — it's the natural authoring/containment model and it's already O(1) for containment queries. (This is also what RD-005.2's structural rules operate on.)
- Maintain **derived indexes** — at minimum `byType`, `parent→children`, and a **reverse-reference** index (`referrersOf`) — updated on mutation, so the AI's relationship queries are O(result-size) instead of O(N) scans.
- A bare scene tree is **rejected** as the sole representation: it forces O(N) scans on exactly the relationship queries the AI leans on. A bare flat store is rejected too (loses cheap containment and the structural-merge model).

This upgrades RD-001 from "provisional, only reasoned" to "measured." It also retroactively validates the early transcript instinct — *"a world model as a graph so the AI queries relationships instead of parsing the scene tree"* — now with a number: ~14× on this workload.

## Transferable principle
Pick the representation by the *query workload*, not by what's nicest to author. When authoring wants a tree but the consumer asks relationship questions, keep the tree authoritative and derive indexes for the queries — pay maintenance-on-write to buy O(result-size)-on-read.

## Open / out of scope
- Which indexes are worth their maintenance cost is workload-dependent; only three were measured. Spatial ("near X") queries were not tested and likely need a spatial index (grid/quadtree) — noted, not built.
- Index-consistency under the RD-002/003 transaction/rollback model (indexes must roll back with the data) — flagged, untested.
- The 14× is specific to this query mix; a containment-heavy workload would narrow the gap.
