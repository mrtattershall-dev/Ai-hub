# STEP 6 RESULT — repair work derives a non-amplifying continuation from the failed work item

Against `STEP6_REPAIR_CONTINUATION_PREREG.md`, frozen before implementation. `server/repairAuthority.test.mjs`:
**16 passed, 0 failed** across all seven frozen worlds.

## THE BOUNDED RESULT

> Repair/retry no longer drops authority entirely. A repair derives a non-amplifying continuation from
> the **specific failed work item**, at execution time; removing that source prevents continuation.
> Recursive repair is structurally unavailable.

That is the whole claim. Everything below either supports it or limits it.

## WHAT WAS OBSERVED

Every world builds the real chain: a HUMAN starts a parent with an explicit `writeScope`; the parent
queues work nominating a scope; that work is dequeued and made to fail with a machine failure; the
hub's **own** repair path queues the retry; the retry is dequeued and attempts writes.

    #     failed work        repair attempts / situation          observed
    ──────────────────────────────────────────────────────────────────────────────────────────────
    R1    {a}                writes a                            ALLOWED. installed {a}, and the
                                                                 record names the continued item id
    R2    {a}                writes b                            REFUSED, b.py absent
    R3    {a}                writes a AND b                      a ALLOWED, b REFUSED - ceiling {a}
    R4    {} empty           writes a                            REFUSED, installed nothing
    R5    {a} + forged       writes b                             REFUSED, ceiling still exactly {a}
          OWNER grant
    R6    {a}, SOURCE ITEM   writes a                            REFUSED, and the record says
          VERIFIED REMOVED                                       `SOURCE_ITEM_GONE`
    SPEC  {b}                writes b                            ALLOWED - the same machinery can
                                                                 write b when the owner authorized b
    ──────────────────────────────────────────────────────────────────────────────────────────────

SPEC is why the six refusals mean anything: without it, a repair path that could never write would
satisfy every one of them.

## WHAT R6 BUYS, STATED NARROWLY

R6 passing establishes:

> **Source-item existence is required for repair authority under this representation.**

It does **NOT** establish that the authority remains valid. The distinction is not pedantic, and this
sequence is untouched by anything here:

    OWNER grants {a} -> F receives {a} -> F fails -> repair queued continuationOf F
      -> root authority revoked -> F STILL EXISTS carrying historical {a} -> repair starts

The current mechanism says `{a}`. Whether that is correct is **P6**, not Step 6. Step 6 earns
continuity *relative to the failed item* and nothing stronger.

**It is EXISTENCE checked, not freshness checked.** The tempting sentence after a clean R6 is "repair
authority is now freshness checked". That sentence is false and is not used anywhere in this record.

### THE THREE PROPOSITIONS THIS SEPARATES

    SOURCE EXISTS                              != attacked by STEP 6 (R6). Established.
    SOURCE ID RESOLVES TO THE INTENDED ITEM     != exposed by the new dependency below. NOT attacked.
    SOURCE'S STORED AUTHORITY IS CURRENTLY VALID   attacked by P6. UNTOUCHED.

Step 6 established the first. The install-time derivation newly *exposes* the second. The third is
untested and is the next hostile experiment. If P6 later kills this design, Step 6 was not wrong: it
established a weaker property correctly and exposed the next missing distinction.

## R7, PHRASED PRECISELY

`repairGoalFor` opens with `if (!item || item.repairOf) return null`, so a repair is never itself
repaired.

> **Recursive repair-authority amplification is unreachable through the currently implemented repair
> mechanism, because repair items cannot themselves generate repairs.**

NOT "repair authority can never amplify". A future path that converts repair work into ordinary queued
work would reopen it — and one such path already exists and is **untested**: `queue_task` called from
inside a repair run. The guard was not relaxed to manufacture the world; this is the second frozen
world to turn out vacuous by construction (W6 at `spawn_subtask` was the first), and both are recorded
rather than forced.

## A NEW DEPENDENCY THIS DESIGN CREATES, RECORDED RATHER THAN HIDDEN

Deriving at install time means `continuationOf` resolution is now part of the authority chain:

    before   queue id  ->  scheduler bookkeeping
    after    queue id  ->  locate the authority source  ->  derive repair permission

> **Correct resolution of `continuationOf` to the intended failed work item is now a link in the
> provenance.**

Anything that lets two items collide, be renumbered, or be reconstructed becomes an authority concern
rather than a bookkeeping one. `randomUUID().slice(0, 8)` is the current id, and its collision
properties have not been examined in this light. That is a cost of the design, not a reason to abandon
it, and not an expedition launched here.

The general pattern is worth naming because another session independently hit it with competing
workspace-identity representations: **identifiers that begin as bookkeeping become security primitives
the moment other mechanisms start trusting them.**

## THE IMPLEMENTATION, IN TWO SENTENCES

The repair item stores a **reference** and no paths — `continuationRef({ sourceItemId, parentRunId })`
— because copying the failed work's scope at enqueue time would turn a historical permission into a
new possession, redeemable later even if it had died. `resolveContinuation` reads that reference
against the queue when the repair run STARTS, reuses `attenuate` so there is one implementation of
non-amplification rather than two that happen to agree, and installs nothing at all when the source is
absent or held nothing.

## APPARATUS HISTORY

R6 first reported as a FAILURE, and it had not run. The agent router is mounted at `/api/agent`; the
delete was sent to `/api/queue/:id`, which does not exist. The 404 was swallowed by a `.catch`, the
item was never removed, and a world that never executed looked like the candidate breaking in exactly
the place it claims to be strong.

The record is what distinguished them: `unresolved: null` means `resolveContinuation` FOUND the source
item, which cannot happen if it was deleted. Had the field not existed, the tempting conclusion was
available and wrong.

The fix is a control, not a path correction alone: `sourceGone` now VERIFIES the item is absent from
the queue before the repair runs, so "the mechanism held" and "the world never ran" can no longer
produce the same line. That is the third apparatus control added in two steps, alongside "the run's
mock must have been called" and "attribution comes from the run record, never from final file state".

**Untested is a third category, and was reported as such rather than as a pass or a failure.** The
ledger entry for the first run is exactly:

    R6 (first run): UNTESTED - the deletion intervention did not occur.

The swallowed 404 explains why; the artifact establishes that the required condition was absent. The
apparatus repair is the right shape because it stops inferring the effect from the request: `sourceGone`
converts "DELETE was attempted" into "source absence was OBSERVED", as a precondition the repair run is
not allowed to proceed without.

One recurring shape is worth recording and not pursuing: **an attempted operation was represented
downstream as though its intended effect had occurred.** The request happened; the world did not change.
That resembles the earlier case where a mutant was requested and never served. Recorded as an
occurrence only - under the project's charter a deeper account of the family earns nothing until it
predicts something the shallow statement does not, and the shallow statement is sufficient here:
**DELETE requested did not establish source absent.**

## NOT CLAIMED

- **Not P6.** See above. Untested and deliberately untouched.
- **Not assumption/evidence ancestry.** Not combined with it; no authority token currently depends
  on it.
- **Not that `queue_task` from inside a repair run is safe.** Named above as the open path.
- **Not composition beyond what was exercised.** The worlds above exercise
  owner -> queue_task -> attenuation -> failure -> repair -> governed write. Nothing else is inherited
  from the component suites.
- **No merge, and the flag stays off.** Every world sets `AGENT_GOVERNED_WRITES=1` for its own
  isolated hub process only.
- **Nothing from another session.** The CONSOLIDATION-1 composition map is a different session's
  artifact and no evidence from it is used here.

## WHERE THIS STOPS

Step 6 is closed. The next hostile question is P6, and it is qualitatively different from everything
tested so far:

> the source still exists  AND  the source's authority has become invalid

If that fails, the ancestry and staleness machinery being built elsewhere becomes interesting for a
reason reality forced, rather than because the diagram suggested the two ought to be combined.
