# Dust & Harvest — jungle debt state was not restored on load

2026-09-22. Reproduced in a running browser, repaired, verified before and after with one script.

## The requirement

> Loading the same save produces the same persisted debt state, regardless of what happened in the
> session before the load.

## The defect

`game.html:25729-25730`, in `loadGame()`:

```js
if (d.jgDebtFree)                gameState._jgDebtFree       = d.jgDebtFree;
if (d.jgAltaverdeWarned)         gameState._jgAltaverdeWarned= d.jgAltaverdeWarned;
```

The save records both values explicitly (`game.html:25330-25331`):

```js
jgDebtFree:        gameState._jgDebtFree        || false,
jgAltaverdeWarned: gameState._jgAltaverdeWarned || false,
```

So `false` is genuinely written to the save — and then the truthy guard discards it on the way
back in. When the saved value is `false`, the assignment is skipped and **the current session's
value survives the load**.

The two lines immediately above it already do this correctly:

```js
if (d.jgDebt !== undefined)      gameState._jgDebt          = d.jgDebt;
if (d.jgDebtStartDay != null)    gameState._jgDebtStartDay   = d.jgDebtStartDay;
```

That asymmetry is what makes the result incoherent rather than merely stale: `jgDebt` restores,
`jgDebtFree` does not.

## Reproduced in the running game

Real game, real `saveGame()` / `loadGame()`, nothing stubbed:

| | `jgDebt` | `jgDebtFree` | `jgAltaverdeWarned` |
|---|---|---|---|
| saved to `localStorage` | 145000 | **false** | **false** |
| session before load (Bond cleared) | 0 | true | true |
| **after `loadGame()`** | 145000 ✓ | **true ✗** | **true ✗** |

The loaded state is **self-contradictory**: the player owes $145,000 *and* is flagged debt-free.
The game cannot reach that state by playing.

### The gameplay consequence

`_checkBondForeclosure()` (`game.html:32710`) opens with `if (gameState._jgDebtFree) return;`.

With the stale flag, $145,000 outstanding and **three** qualifying overdue weeks:

```
enforcementShouldFire : true      (3 overdue weeks, threshold is 2)
complianceBefore      : 0
complianceAfter       : 0
enforcementActuallyFired : false
```

Altaverde enforcement — the jungle's foreclosure analogue, Bond Charter Article 14 — is
**permanently suppressed for that save**. The player can ignore the Bond forever with no escalation.

## The repair

One edit, two lines, matching the pattern the file already uses for `postEnding` (25547) and
`inJungle` (25712):

```js
gameState._jgDebtFree        = d.jgDebtFree        || false;
gameState._jgAltaverdeWarned = d.jgAltaverdeWarned || false;
```

Unconditional assignment. `|| false` also gives saves that predate these fields a **deterministic**
default rather than letting them inherit whatever the session happened to hold — which is what the
requirement demands.

## Verification — identical script, both builds

`accept.js`, run in the browser against each build in turn. Every case goes through the real
`saveGame()` / `loadGame()` path.

| case | expected | ORIGINAL | PATCHED |
|---|---|---|---|
| **1** save `false`, session `true` | `free:false` | `free:true` **FAIL** | `free:false` **PASS** |
| **2** save `true`, session `false` | `free:true` | `free:true` PASS | `free:true` **PASS** |
| **3** fields **absent** (older save) | `free:false` | `free:true` **FAIL** | `free:false` **PASS** |
| consequence: owes 145000, 3 overdue | enforcement fires | contradiction `true`, compliance 0 → 0, **did not fire** | contradiction `false`, compliance **0 → 2**, **fired** |

Case 2 is the direction that already worked; it is included to prove the fix did not trade one
direction for the other.

### The invariant, stated as the requirement states it

Same save, four different prior session states, loaded four times:

```
prior free:true  warned:true   ->  {free:false, warned:false, debt:145000}
prior free:false warned:false  ->  {free:false, warned:false, debt:145000}
prior free:true  warned:false  ->  {free:false, warned:false, debt:145000}
prior free:false warned:true   ->  {free:false, warned:false, debt:145000}
```

Identical every time. **The load no longer depends on what preceded it.**

### No collateral damage

The rest of the load path is unaffected — checked `day`, `gold`, `hp`, `season`, `inJungle`, 33
stat keys, and a `day` save/load round-trip (saved 37, session 999, loaded **37**).

## Two things I did *not* accept at face value

**The foreclosure flag is not this bug.** The brief expected the same pattern there. It is not:
`_foreclosureFired` (19344) and `_bondForeclosureFired` (32705) are module-level `let`s that are
**never saved and never restored** — session-scoped by construction. Different shape, not the
truthy-guard defect, and not touched here.

**A latent thing found on the way.** `startNewGame()` does not reset `gameState.day` — it resets
gold, inventory, chest, stats, jungle and mine state, then calls `tickSeason(gameState.day)` on
whatever day is already loaded. **This is not reachable in normal play**: every route back to the
title screen does `location.reload()` (the Return to Title button at 753, foreclosure new-game at
19386), which resets `day` to its initial value. It surfaced only because my harness called
`startNewGame()` directly. Reported as latent, **not fixed** — it was not the assigned task and it
cannot currently bite a player.

## Files

    game.html            the patched build — this is the deliverable
    game.original.html   the pristine upload, byte-identical, kept for A/B
    accept.js            the acceptance script; run `await __DH_ACCEPT()` in the console
    serve.mjs            static server on :8137 (file:// origins restrict localStorage)

## Did Legasus earn involvement here?

**No, and it was not used.** The whole job was: read two lines, reproduce in a browser, change two
lines, run one script against two builds. Ordinary browser verification produced observable
before/after evidence and a stated invariant. Adding admission, provenance or replay would have
added machinery to a repair whose entire evidence base fits in one table. Consistent with the value
comparison already on record — Legasus stays experimental.
