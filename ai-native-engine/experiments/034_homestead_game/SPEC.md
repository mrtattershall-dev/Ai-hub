# B0 — HOMESTEAD: the game, committed before touching the editor

**Purpose (Phase B):** the first thing that tests "builds a game = success" for
real — an actual game, authored through `core/editor.js`, on rules validated
before they run, nothing corrupting. This doc is the pre-registration: the
game, its world, and its win/lose bar are fixed HERE, before any rule is
authored, so B5's verdict cannot be fitted to whatever the rules happened to do
(the same discipline as RD-B5's `checkFarmObservable`).

## Why this game (risk-reduction, not laziness)

HOMESTEAD extends the crop/zone world that is already **proven safe** — fuzzed
(RD-021/024), composition-tested (RD-B5), and shown zero-unsafe across ~200 live
rule proposals. A brand-new domain would mean re-discovering opposed-fold-shaped
surprises in fields that have never been fuzzed. Reusing proven ground keeps the
Phase-B risk on the ONE new thing being tested: authoring a real *game* (a thing
with a goal you can win or lose) through the editor.

## The game

**HOMESTEAD** — keep a farm alive and productive. The "player" is the AI author;
the "move" is authoring the rule-set. A well-authored set sustains and scores;
a poorly-authored one dies off or under-produces. The tension is real because
water is a **depleting resource**: crops grow only while watered, so without
replanting the farm winds down.

- **World / entity types** (all already-decided types — no new pools):
  - one `zone` — "the field", its `tally` field = the cumulative harvest score.
  - `crop`s — `water` (depletes) and `growth` (accumulates toward harvest).
- **Dynamics the authored rules must create (the 5-rule loop):**
  1. **grow** — watered crops (`water > 0`) gain growth each tick, clamped ≤255.
  2. **drain** — every crop loses 1 water/tick, clamped ≥0. *(water is the
     resource that creates the tension — a crop that runs dry stops growing.)*
  3. **reap** — a crop that reaches `growth ≥ 100` is harvested (deleted).
  4. **score** — the field accumulates `tally += count(crops with growth≥100)`,
     clamped ≤ its uint32 max. *(cumulative production; uses the RD-B4 `count`
     aggregation + exact `match.uuid` zone scope.)*
  5. **reseed** — the field spawns a fresh crop (`water:25, growth:0`) every 3rd
     tick, `cap:1`. *(restock — the thing that keeps the loop alive.)*

## Starting world (B1 authors this through the editor)

- one zone `field`, `tally:0`.
- three crops, all `water:25`, growth staggered `70 / 40 / 0` — so the first
  harvests happen early (the growth-70 crop matures in ~6 ticks) and production
  is visible before tick 40.

## Win / lose — the temporal observable (pinned; B3 makes it code)

Session length **M = 40 ticks.** `checkHomesteadObservable(trace)` = WIN iff ALL:

| clause | meaning | bar |
|---|---|---|
| `safe` | the unconditional gate held | 0 unsafe events, every tick |
| `alive` | the farm never died off | live-crop population ≥ 1 at **every** tick |
| `thriving` | sustained healthy population | population ≥ **3** for the whole last third (ticks 27–40) |
| `productive` | the farm actually harvests | ≥ **4** reaps total |
| `scored` | cumulative production target | zone `tally` ≥ **6** by tick 40 |

**WIN** = all five. **LOSE** = any one fails.

### Why this is a game and not just a simulation (the losable bar)

The bar is genuinely losable with plausible-but-wrong rule-sets — pre-registered
so B5 can't move the goalposts:
- **drop `reseed`** → crops reap without replacement → population craters →
  `alive`/`thriving` fail (die-off). *(the RD-B5 missing-link shape, now a LOSS.)*
- **drop `score`** → `tally` stays 0 → `scored` fails (runs, but wins nothing).
- **drop `drain`** → no resource tension; still may WIN, but the game is trivial
  (a degenerate sim) — noted, not a loss, but it is why `drain` is in the spec.
- **unclamped grow / capless reseed** → rejected at authoring (never runs) — the
  editor's boundary turns these into repair prompts, not losses.

The oracle (all five, correctly authored) must WIN; that is proven in
`homestead.js` as ground truth (the goal is achievable in the decided grammar),
exactly as RD-B5's oracle proved its loop achievable before any live authoring.

## Success checkpoint (B5, stated now so it isn't moved later)

**Does HOMESTEAD build — end to end, authored through the editor, on rules
validated before execution, with nothing corrupting — and does a real play
session WIN its pre-registered observable?** If yes: the Phase-B milestone is
met. Everything past B5 (renderer, input, assets, the tycoon/MMO framing,
multiplayer) is explicitly **out of scope for "success"** — B6+ gravy only.

## Sequenced deliverables

- **B0** this doc. ✅
- **B1** author the starting world via `editor.js` spawn/edit; save/load survives.
- **B2** author the 5 rules via `editor.js rule` + the real repair loop, with the
  win/lose goal as the authoring target; all install or honestly quarantine,
  zero unsafe. *(Flagged risk point: first time editor × multi-rule × real-goal
  authoring compose — expect one composition surprise.)*
- **B3** `checkHomesteadObservable` in `homestead.js`, pinned to the table above.
- **B4** a real play session — ticks, save mid-run, reload, continue, undo/redo —
  watched via console trace, confirmed to READ as a game.
- **B5** the checkpoint above: WIN or not, milestone or not.

---

## B2-LIVE — a CAPABLE MODEL authors HOMESTEAD (Modal H100, 2026-07-15)

The one honest caveat on the milestone was that B2's authoring proposer was
deterministic (it emitted the *measured* failure classes so the editor's real
gate + repair loop were genuinely exercised, but it was not a live model). This
closes it: **Qwen2.5-Coder-32B**, served on an H100, authored the 5-rule game
through `editor.js`'s real gate + repair loop, from the win/lose goals; the
authored game was then played and adjudicated. Apparatus `b2_live.js` +
`modal_homestead.py`; logs `b2_live_run*.log`, in-volume
`results/homestead_*.json`. Total spend ≈ $1 of the user's credits.

### Results (two runs — the honest arc)

| run | goals | wins | unsafe | note |
|---|---|---|---|---|
| 1 | terse | **0/3** | **0** | all 5 rules installed every session, but LOST |
| 2 | unambiguous + rule-body capture | **2/3** | **0** | correct grow/drain/harvest/**accumulate-score**/reseed |

### What it establishes

1. **SAFETY IS UNCONDITIONAL — validated under a live model on a whole game.**
   Across both runs (6 sessions, ~40+ live rule proposals), **zero unsafe
   events.** Every rule the model wrote installed only after passing the gate;
   the world never corrupted, hung, or desynced. This is the load-bearing
   result and it is clean.
2. **A capable live model CAN author a WINNABLE game through the editor.**
   Run 2, 2/3 wins with correct rules — including the novel `count` aggregation
   (the accumulating score) AND RD-B4 entity-scoping (the model copied the
   field's uuid `u0` from the world slice to scope its zone rules). The whole
   thesis works end to end with a real model, not just a scripted one.
3. **SAFE ≠ CORRECT — and the observable is what catches the difference.**
   Run 1 (0/3): the model authored valid, gated, SAFE rules that *ran cleanly
   and lost* — it read the terse "score the number of ready crops" as a
   snapshot (`set tally = count`, always 0–1), not an accumulation. The gate had
   nothing to object to (in range, well-formed); the temporal **observable**
   caught the goal-miss. This is exactly the H1 role RD-B5 landed on: the
   boundary guarantees nothing corrupts; achieving the *goal* is a separate axis
   the observable measures.
4. **Two characterized failure modes (from the captured rule bodies):**
   - *Goal-spec ambiguity* (run 1 → 2): clarifying "ACCUMULATE a running total"
     moved score from 0/3 to correct. Part of run 1's loss was the prompt, not
     the model.
   - *Malformed JSON on the most-nested rule* (run 2, session 1): the model never
     emitted parseable JSON for the accumulate-score rule in 4 attempts, so that
     one rule failed to install and the game lost on `scored` — a formatting
     failure on the hardest rule, not a semantic one. The repair loop rescued
     most malformed-JSON cases (clean on attempt 2) but not this one.

### Honest bottom line

The Phase-B milestone (B5) stands: HOMESTEAD builds end to end, on rules
validated before execution, nothing corrupting, winning its pre-registered
observable. B2-LIVE upgrades the "authored through the editor" claim from a
deterministic proposer to a **real model that authored a winnable game 2/3 of
the time with zero unsafe events** — and precisely characterizes the residual
gap (goal-spec clarity + occasional malformed JSON on deeply-nested rules), the
RD-B5 GPU follow-up now answered for this game.

## B6 (gravy) — play-UI / renderer

`homestead_ui.html` — a self-contained, animated replay of a real 40-tick
HOMESTEAD session (crops grow → ripen → harvest → reseed, score climbing, WIN
verdict), with playback transport (play/pause/scrub/speed). Every frame is real
committed engine state, exported by `b6_export_trace.js` → `trace.json` and
inlined. Botanical-almanac visual treatment, theme-aware. Published as an
Artifact. Functionally verified (frame 0: 3 crops; tick 20: 8 crops/score 2;
tick 40: WIN/score 8 — matches the trace).

---

## ADDENDUM (2026-07-16) — F2 retro-check: Phase B numbers were DEPRESSED by a granularity bug; no verdict flips

RD-M0 (multiplayer spine) found that Phase B ran under whole-tx rule
granularity: when reap deleted a crop, every rule tx that also wrote that crop
that tick was rejected WHOLE — silently stalling grow/drain world-wide on
harvest ticks (F2; `validate: cannot write growth of a destroyed object`).
Fixed by RD-M0.1 (one tx per matched entity, user-decided).

Retro-audit of every replayable decided verdict under both granularities
(`experiments/036_multiplayer/f2_retrocheck.js`, 16/16):
- **No decided verdict flips.** Oracle still WINS, all named near-misses still
  LOSE, B2-LIVE run-2 sessions replay byte-exact from captured bodies
  (lose/WIN/WIN reproduced) and hold under the fix.
- **But the margin was thinner than anyone knew:** F2 cost the oracle game 16
  stalled rule txs / 130 dropped ops = 2 reaps + 2 tally per 40-tick game
  (true finals: 10 reaps / 10 tally, not the published 8/8). The scored bar
  was 6; the published 8 had margin 2 — exactly F2's bite. A scored>=9 bar
  would have flipped B4/B5. The win survived by bar looseness, not by design.
- The safety claim is untouched (0 unsafe under both granularities, always).
- NOT replayable (rule bodies never captured — same lesson as rejectCodes):
  B2-LIVE run 1 (terse 0/3), the b3_rescue model runs, the follow-ups. Their
  control and treatment arms SHARED the F2 regime, so directional findings are
  not confounded between arms; absolute win rates could shift under the fix.

**Regime labeling (so no future reader conflates which regime produced which
number):** the retro-check ran on the POST-FIX engine. Its "WHOLE" arm
re-enables the historical granularity via the same `registerSystem`
txPerEntity flag the fix introduced — and that emulation is VALIDATED by its
byte-exact reproduction of the published finals (pop 9 / tally 8 / reaps 8,
and B2-LIVE run-2's lose/WIN/WIN). So: every 8/8 number in this SPEC above
this addendum is the honest PRE-FIX historical record (measured live under
whole-tx granularity in Phase B); every 10/10 number is POST-FIX (per-entity,
RD-M0.1). The engine as it now stands produces the 10/10 behavior.
