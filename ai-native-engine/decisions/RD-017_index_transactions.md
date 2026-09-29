# RD-017: Index Consistency Under Transactions (Closed)

**Project:** AI-native engine editor (research phase)
**Bridges:** RD-001 (authoritative data + derived indexes) × RD-002/003 (transactional Claim→Schedule→Validate→Commit/Reject). Both were proven in isolation; this is the first card that runs them **together**.

**Question:** When a transaction rolls back, do the derived indexes (byType, childrenOf, referrersOf) roll back **atomically with the data** — or do they leak stale entries and silently desync?

**Why it's the dangerous case:** an index that disagrees with the data is *invisible*. The data stays correct; only the AI's relationship queries are wrong, and wrong **silently** — "who references Z?" returns a row that no longer exists; "all crops" omits one that does. Same failure class as RD-002 immediate-mutation corruption, RD-005 LWW, RD-004.6 freelist: not a crash, a quiet lie the model then reasons over.

## Method
Three rival index/transaction couplings, each run against a **ground-truth oracle** (indexes rebuilt from scratch from committed data) after every step. Index-write work counted deterministically (not wall-clock), same anti-noise discipline as RD-001/008. `experiments/017_index_transactions/index_transactions.js`, zero deps, `node <file>`.

- **EAGER** — mutate data *and* indexes in place as each op runs; on a mid-transaction reject, restore the data snapshot but leave the index writes (the naive author remembered data, forgot indexes).
- **REBUILD** — apply ops to a scratch data copy; on commit, swap data in and rebuild every index from scratch.
- **STAGED** — stage both data and index deltas; nothing touches the live world until every op validates; a reject applies nothing.

## Proven (measured — the FAILs are the finding)
- **EAGER is INADMISSIBLE.** It passes on a fully-committed tx (P1) but on a rejected tx (P2) it leaks the aborted ops' index entries: the reverse-reference query `who references 1?` returns a **stale-index lie** vs ground truth, and in the 200-tx stress mix (P3) it **diverges at the very first rejected transaction**. This is the concrete disproof of "just maintain the index inline."
- **REBUILD is ADMISSIBLE** — indexes are a pure function of committed data, so they can't desync. Cost: **O(N) index work every commit** regardless of change size (measured 7 writes = full object count for a 1-object create; grows with the world).
- **STAGED is ADMISSIBLE and the winner** — data and index commit as one unit, so a reject applies neither; correct on P1/P2/P3 **and** O(change-size) (measured 3 index writes for the same 1-object create, matching EAGER's cost without EAGER's corruption).

Result: 14 passed / 4 failed; the 4 failures are all EAGER, all on rollback consistency.

## Decision
- **Derived indexes are transactional state, staged and committed atomically with the data.** The unit of atomicity is (data delta + index delta) together, never data alone.
- **Eager in-place index maintenance is forbidden** wherever a transaction can reject after touching an index — it reproduces the project's core silent-corruption failure at the index layer.
- Full-rebuild-on-commit is an acceptable *fallback* (correct, trivially so) but not the default: it pays O(N) for O(1) changes and doesn't scale to the SoA 50k-entity world from the RD-006/008 capstone.

## Transferable principle
A derived index is only trustworthy if it shares the data's commit boundary. Anything that can make the data and its indexes disagree — even briefly, even on an error path — turns every relationship query into a silent lie. Atomicity is not just for the data; it's for everything derived from it.

## What remains open
- Ordered-list index positions under concurrent reorder (ties into the still-open ordered-list conflict card from RD-005.2).
- Staged deltas assume single-writer commit; interaction with the claim/scheduler layer under genuinely concurrent commits is untested here (this card tested one transaction at a time against the oracle).
- Not yet wired into the SoA packed world — STAGED was proven on the Map-based RD-001 index shapes; porting the staging discipline onto typed-array indexes is the integration move.
