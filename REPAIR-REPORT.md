# Dust & Harvest — jungle debt state was not restored on load

2026-09-22. Reproduced in a running browser, repaired, verified before and after with one script.

**Revised after review.** The first version of this report stated that `_bondForeclosureFired` was
"never saved and never restored". **That was wrong** — it is saved and restored, with the same
defect, and is now fixed. See *"The claim I got wrong"* below. The patch itself was correct as far
as it went; the explanation declared a neighbouring defect absent.

## The requirement

> Loading the same save produces the same persisted debt state, regardless of what happened in the
> session before the load.

Scoped honestly: what is **verified** below is that **the three repaired flags** restore
independently of their prior session values. That is not the same as all persisted debt state being
covered — see *"Still unrepaired"*.

## The defect

The same truthy-guard mistake in **three** restores, across **two** places.

**Main loader** (`game.html:25729-25730`):

```js
if (d.jgDebtFree)                gameState._jgDebtFree       = d.jgDebtFree;
if (d.jgAltaverdeWarned)         gameState._jgAltaverdeWarned= d.jgAltaverdeWarned;
```

**A monkey-patch wrapper ~7,000 lines lower** (`game.html:32778`):

```js
if (d.jgBondForeclosureFired) _bondForeclosureFired = d.jgBondForeclosureFired;
```

All three are saved explicitly, so `false` is genuinely written to the save:

```js
jgDebtFree:        gameState._jgDebtFree        || false,     // 25330
jgAltaverdeWarned: gameState._jgAltaverdeWarned || false,     // 25331
d.jgBondForeclosureFired = _bondForeclosureFired;             // 32763
```

The truthy guard then discards that `false` on the way back in, and **the current session's value
survives the load**. Two lines above the first pair, the same file already does it correctly
(`if (d.jgDebt !== undefined)`), which is what makes the result incoherent rather than merely stale:
`jgDebt` restores, `jgDebtFree` does not.

## Reproduced in the running game

Real game, real `saveGame()` / `loadGame()`, nothing stubbed:

| | `jgDebt` | `jgDebtFree` | `jgAltaverdeWarned` | `_bondForeclosureFired` |
|---|---|---|---|---|
| saved to `localStorage` | 145000 | **false** | **false** | **false** |
| session before load | 0 | true | true | true |
| **after `loadGame()`** | 145000 ✓ | **true ✗** | **true ✗** | **true ✗** |

The loaded state is **self-contradictory**: the player owes $145,000 *and* is flagged debt-free.
The game cannot reach that state by playing.

### Two independent routes to the same suppression

`_checkBondForeclosure()` (`game.html:32715`) returns early on **either** flag:

```js
if (_bondForeclosureFired) return;      // "already fired, don't fire again"
...
if (gameState._jgDebtFree) return;      // "nothing owed"
```

With $145,000 outstanding and **three** qualifying overdue weeks, enforcement must fire. Measured on
the unpatched build:

| route | `_jgDebtFree` | latch | compliance | fired? |
|---|---|---|---|---|
| **A** stale `_jgDebtFree` | true (wrong) | false | 0 → 0 | **no** |
| **B** stale latch *alone* | **false (correct)** | true (wrong) | 0 → 0 | **no** |

**Route B is why the review catch mattered.** Fixing only the first two flags would have left a
second, independent path to the same player-facing failure: Altaverde enforcement — the jungle's
foreclosure analogue, Bond Charter Article 14 — permanently suppressed for that save.

## The repair

Three lines, two sites, matching the pattern the file already uses for `postEnding` (25547) and
`inJungle` (25712):

```js
gameState._jgDebtFree        = d.jgDebtFree        || false;
gameState._jgAltaverdeWarned = d.jgAltaverdeWarned || false;
_bondForeclosureFired        = d.jgBondForeclosureFired || false;
```

Unconditional assignment. `|| false` also gives saves that predate these fields a **deterministic**
default rather than letting them inherit whatever the session happened to hold.

**Delivered diff:** 3 lines removed, 14 added (11 comment + 3 code), **+938 bytes**, **0 line
endings altered**.

## Verification — the delivered `accept.js`, verbatim, on both builds

Fetched from disk and `eval`'d in the browser, so the attached script is exactly what ran. Every
case goes through the real `saveGame()` / `loadGame()` path.

| case | expected | ORIGINAL | PATCHED |
|---|---|---|---|
| **1** save all `false`, session all `true` | all false | `free:true latch:true` **FAIL** | all false **PASS** |
| **2** save all `true`, session all `false` | all true | all true PASS | all true **PASS** |
| **3** fields **absent** (older save) | all false | `free:true latch:true` **FAIL** | all false **PASS** |
| consequence **A** (`_jgDebtFree` route) | fires | 0 → 0, **not fired** | **0 → 2, fired** |
| consequence **B** (latch route) | fires | 0 → 0, **not fired** | **0 → 2, fired** |
| **invariant holds** | true | **false** | **true** |

Case 2 is the direction that already worked; it is included to prove the fix did not trade one
direction for the other.

### The invariant

Same save, four different prior session states, loaded four times — identical result every time:

```
{ free: false, warned: false, latch: false, debt: 145000 }
```

On the unpatched build the same four loads return `free:true, warned:true, latch:true`.

### No collateral damage

Checked `day`, `gold`, `hp`, `season`, `inJungle`, 33 stat keys, and a `day` save/load round-trip
(saved 37, session 999, loaded **37**).

## The claim I got wrong

I wrote that `_foreclosureFired` and `_bondForeclosureFired` were "never saved and never restored —
session-scoped by construction". For `_foreclosureFired` (19344, the *frontier* foreclosure) that
holds. For `_bondForeclosureFired` it was **false**, and the reviewer caught it.

Two compounding causes, both mine:

1. **A case-sensitive search.** I grepped `foreclosureFired`. That does not match
   `_bond` **`F`** `oreclosureFired`. Its six hits were all the *other* flag, and I read that as
   coverage of both.
2. **A region-scoped sweep read as a whole-file result.** My count of guarded restores ran over
   `NR>=25560 && NR<=25900` — the main loader only. It returned "2", and I reported 2 as the
   file's total. The third site is at 32778, in a monkey-patch wrapper, along with a dozen more of
   the same shape.

The patch was correct; the report asserted the absence of a defect it had not actually looked for.
A whole-file sweep, run afterwards, is what produced the *"Still unrepaired"* list below — that
sweep should have come first.

## Still unrepaired — reported, not fixed

The whole-file sweep shows the same truthy-guard shape on **five more** fields, all in the jungle
wrappers, all saving raw values so falsy ones are genuinely written:

| field | saved as | falsy value that will not restore | site |
|---|---|---|---|
| `jgBoarDomesticated` | raw boolean | `false` | 32179 |
| `jgContractStreak` | raw number | `0` (a broken streak) | 33241 |
| `jgAnimalIdCounter` | raw number | `0` | 32180 |
| `jgEnclosureIdCounter` | raw number | `0` | 32181 |
| `jgFreightWeek` | `|| 0` | `0` | 32504 |

**Not affected**, checked rather than assumed: `jgSelectedSeed` (`|| 'heartleaf'`, always truthy)
and the object/array/Set fields — `{}` and `[]` are truthy in JavaScript, so their guards pass.

These are **not fixed here**: that was not the assigned task, and each needs its own consequence
analysis before a patch is worth accepting. The ID counters look the most likely to matter — a save
with counters at `0` loaded over a session that has allocated IDs keeps the session's counters.

## A mistake in my own patch, caught and fixed

The first `patch.py` used `pathlib.read_text`/`write_text`. Python's universal-newline handling
silently rewrote **all 40,926 line endings** LF→CRLF: **+41,532 bytes, 81,859 changed lines** for a
two-line change. The game still ran and every test still passed — it was found by noticing the
output was 41 KB larger than the input, not by any test. `patch.py` now works on bytes and asserts
the source is pure-LF before touching it.

## A latent thing found on the way

`startNewGame()` does not reset `gameState.day`. **Not reachable in normal play**: every route back
to the title screen does `location.reload()` (Return to Title at 753, foreclosure new-game at
19386). It surfaced only because the harness calls `startNewGame()` directly. Recorded, not fixed.

## Files

    game.html            the patched build — the deliverable
    game.original.html   the pristine upload, byte-identical, kept for A/B
    accept.js            the acceptance script that produced the table above
    patch.py             byte-exact, re-runs from game.original.html
    serve.mjs            static server on :8137 (file:// origins restrict localStorage)

## Did Legasus earn involvement here?

**No, and it was not used.** Three lines read, three lines changed, one script across two builds.

The review finding is worth keeping, though, and it is not flattering to the framework case either:
**the patch was correct while its explanation confidently declared a neighbouring defect absent.**
Legasus governs whether evidence supports a *claim about what was verified*; nothing in it would
have caught a claim about code I never searched. Whether any mechanism could have is **untested**,
and the honest fix here is procedural: sweep the whole file before asserting a pattern's extent.
