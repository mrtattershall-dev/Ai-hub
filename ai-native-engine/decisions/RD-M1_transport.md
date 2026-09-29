# RD-M1 — Multiplayer transport: two clients, one world, one submit() — PINNED

**Status: INVARIANT PINNED 2026-07-16, BEFORE the transport was written**
(the RD-M0 amendment: "both clients must go through the same submit(), and the
transport is never a second path in — pinned before writing it"). Results
section appended after implementation; nothing above the Results header may be
edited after code exists.

## The pinned invariant

The transport PARSES and ROUTES; it never mutates. Exactly TWO sanctioned
channels into engine state exist, both pre-existing gates:

1. **`submit()`** — all world mutation, reached only via `stepTick(extraBatch)`
   at tick boundaries. Client txs are queued between ticks and handed to the
   next tick as extraBatch entries `{actor: <client name>, ops}` — exactly
   RD-M0's option (a).
2. **`installRule()` / `uninstallRule()`** — behavior content, the RD-B6 gate.
   A client-proposed rule goes through the same validate-before-install path
   the editor uses; a rejected rule leaves the engine untouched.

The transport introduces NO third channel. Server-side message handlers only
construct data (op lists, rule sources) and queue it; the tick loop and the
gate are the only code that touches the engine. Message hygiene (op-kind
whitelist, shape checks, size caps) REJECTS malformed input back to the sender
— it never repairs or reinterprets it, because repair is interpretation and
interpretation on the write path is a mutation policy.

## Pinned design

- **Authoritative single server process** owns the engine (HOMESTEAD world +
  oracle rules — the real game, with reap/reseed dynamics live). Thin terminal
  REPL clients. Newline-delimited JSON over local TCP (`node:net`). Zero deps.
- **Read path:** the same frozen read-only view systems get (`_systemView`),
  plus a claims listing (who holds what, until when — M2 legibility
  groundwork). Reads never go through a side door either.
- **Tick cadence:** interval-driven for human play (default 250ms); manual
  step for deterministic tests. Both call the SAME doTick().
- **Deferral visibility (BAR M1 clause):** every tick broadcast carries the
  tick's deferrals to ALL clients, not just the participants.
- **Disconnect = RD-022 `releaseActor` with grace.** A vanished client's
  claims outlive it by graceTicks, then release.
- **Per-session accounting (BAR M6 amendment, first run onward):** the session
  record reports dropped-rule-tx count with reason breakdown, alongside
  everything else — committed/rejected per client, deferrals, unsafe count,
  population range.

## Results (2026-07-16)

Implemented as pinned: `experiments/036_multiplayer/m1_server.js` (authoritative
engine, HOMESTEAD + oracle rules live, ~200 lines), `m1_client.js` (thin REPL),
`m1_test.js` (two REAL socket clients, server in-process in manual-tick mode so
same-tick contention is deterministic — the wire under test is the wire humans
use). **15/15:**

- Both clients see the same world; contested foldable field (water, max) —
  BOTH txs committed, folded losslessly to max(100,150).
- Contested non-foldable field (name) — DEFERRED, written by NEITHER, and the
  deferral (with both competing values) delivered to BOTH clients' tick
  message. No LWW anywhere.
- Claim legibility: bob's write rejected with the holder named ("claim: u1
  held by alice until tick 9"); the shared view lists who holds what until
  when.
- Live rule authoring over the wire, mid-session: bob's invalid rule rejected
  by the gate with `range_unprovable` and the world BYTE-IDENTICAL after
  (P.saveText compared); his valid rule installed and announced to alice.
- Disconnect: alice's claim survived a 2-tick grace then released; bob claimed
  the crop (RD-022 releaseActor over the wire).
- **Session record carries the BAR-M6 accounting line, and it already earned
  its keep on run one: `dropped rule txs=4 why={"claim":4}` — alice's claim
  stalling u1's per-entity rule txs, counted instead of silent.** unsafe=0.
- Full regression after: 226 core + HOMESTEAD ground truth + b5 checkpoint,
  all green. No core changes were needed for M1 (the transport is pure
  consumer — evidence the pinned invariant held in practice).

Test-bug note (honesty): the first run failed the byte-identity assertion
because the test compared `P.save()` (an object — `===` is identity) instead
of `P.saveText()`. The failure was in the test, verified by isolating the
rejected-install path engine-side; fixed to the string form. The thesis holds.

## First live human session finding (2026-07-16) — ROW EXHAUSTION KILLS A PERSISTENT WORLD

The user's first real session (two clients, ~1000 ticks at 4Hz) found what no
scripted run had: the farm died on its own at tick ~766–786. Not game
dynamics — ROW EXHAUSTION. The server used the Phase B fixture default,
`Engine(256)`; rows are never reused (RD-004.6), reseed burns 1 row / 3 ticks,
so the world fills at tick ≈ 3×(256−4) = 756. Every later spawn rejected
`world full`, the last crops matured and were reaped, pop hit 0 permanently.
Predicted death tick matches the observed collapse exactly. Phase B never saw
this because every run was 40 ticks.

Mitigation shipped: session capacity now 65536 (~13h at 4Hz), periodic
`gcTombstones()`, and a 90%-row-budget warning broadcast to all clients.
**Open design question (M3/M5, not improvised here): the real answer for a
live-forever server — periodic save/load compaction cycles (RD-019's load
compacts tombstoned rows out) vs an explicit row-reuse policy (which would
reopen RD-004.6's identity guarantees).** A finite row budget is currently a
hard session-length bound for any persistent world; that is now a named
constraint, not a surprise. Verified post-patch: tick 900, crops alive, rows
304/65536, unsafe=0, accounting line showing the drops (592 validate = the
per-entity reap-vs-write residue, counted).

## Human-session friction log (feeds M2's legibility deliverable)

- **Humans address by NAME; the wire speaks uuid.** First minutes of real play:
  the user planted "corn" then tried `claim corn` — rejected `target is
  missing`, because names are mutable labels, not identity (RD-004, by
  design). The engine was right and the ergonomics were wrong. Fix shipped
  CLIENT-SIDE only (name→uuid resolution from the last look, ambiguous names
  refused with the candidate list) — the server never accepts names as
  addresses, so the invariant is untouched and a stale cache just earns the
  engine's own localized rejection. M2 must treat addressability as part of
  claim legibility: "who holds what" is only legible if "what" is nameable.

- **The world silently eats what players make.** The user planted "corn"
  (committed, watched pop go 7→8) — the reap rule harvested it ~40 ticks later
  and NOTHING said so; pop just read 7 again. Their subsequent claim attempts
  failed "target is missing" against a crop the GAME had consumed. Every
  rejection was correct; the experience was gaslighting. M2 deliverable:
  lifecycle events for entities an actor created or claimed ("your corn was
  harvested at t501"), delivered like deferrals are — to everyone who cares.

- **Game time vs human time.** At 250ms ticks the oracle constants mature a
  fresh crop in 20 ticks = FIVE WALL-CLOCK SECONDS — the user planted corn
  twice and it was harvested before they could type the next command, twice.
  HOMESTEAD's constants were tuned for a 40-tick scripted session; real-time
  play needs either a slower tick (`node m1_server.js 4242 1000`) or content
  retuned for wall-clock. Content/pacing question, not an engine one — but the
  play surface must expose the knob.
- **Players speak verbs, the surface speaks ops.** Unprompted, the user typed
  `water corn`, `harvest`, `collect`. Client sugar added for `water`; the real
  answer is the project's own thesis pointed at the play surface: a proposer
  translating player intent ("water the corn") into gated ops is exactly the
  editor's AI loop applied to play. Flagged for M4/renderer phase, not built.
- **A claim is a stasis field (observed dynamic, M2/option-B input).** Claims
  block ALL other actors — including the rules: a claimed crop cannot be
  reaped, grown, OR drained (per-entity txs from `sys:rule:*` reject at the
  claim layer). Gameplay-legible ("claiming protects your crop") but it also
  freezes growth — claims block the WORLD, not just other players. This is
  RD-M0's option (B) question (should claims bind systems?) resurfacing as
  game semantics; it needs deciding at M2 with real play evidence.

- **Claims expire SILENTLY, and the engine default (3 ticks) is a sim-actor
  timescale.** The user claimed their corn with no duration → 3 ticks = 0.75
  wall-clock seconds at 250ms; the claim lapsed before they finished reading
  `look`, the stasis dropped, the farm reaped the corn — no expiry event, no
  warning. RD-022 exactly as designed, experientially invisible. Client now
  defaults claims to 40 ticks; M2 deliverable: claim-expiry notification (and
  arguably expiry-imminent), same delivery as deferrals.
- **`harvest` reached for three times, unprompted** — added as sugar for the
  delete op (honest: it IS the op the reap rule emits). The verb-vocabulary
  gap again; see the M4 proposer note above.

## Live third-actor session (2026-07-16, against the user's RUNNING world)

With the user's server at tick ~1889 (their session, their world, farm alive),
a scripted visitor (`m1_visit.js`) joined as a third actor over the same wire:
planted a crop, claimed it (visible in the shared claims view: holder claude,
until 1903), watered it under its own claim, had an unclamped rule REJECTED by
the gate (range_unprovable — live world untouched), installed a valid clamped
rule mid-session (announced to the user's clients), then uninstalled it and
left. Multi-actor coexistence with live rule authoring on a running,
human-owned world: exercised for real, zero incidents.

## M1 adjudication (honest)

- **Machinery over the real transport: CLOSED** — 15/15 automated (fold,
  defer-visible-to-both, claim legibility, byte-identical rejected rule,
  RD-022 grace, accounting line), plus the live third-actor session above.
- **Human timing: met to the extent one operator can.** The user drove real
  sessions (plant/claim/set with genuine timing and genuine confusion — which
  produced findings 1–3). The clause's "two people editing the same crop at
  the same time" was NOT humanly produced: at a 250ms tick, one person cannot
  contend with themselves across two windows — a structural consequence of
  the pinned M2 honesty flag (one person, two hats), now measured in practice.
  Same-tick contention coverage stands on the automated test (real sockets,
  same batch). The two-real-humans moment stays open OPPORTUNISTICALLY —
  worth doing when a second human exists, not worth blocking M2 on. (User's
  bar, user's call — recorded as their decision to make.)

**What M1 still needs (open until done): the HUMAN-TIMING session** — the
automated test proves the machinery over the real transport; BAR M1's clause
is about genuine human timing. Run it: `node
experiments/036_multiplayer/m1_server.js` then two terminals of
`node experiments/036_multiplayer/m1_client.js <name>`; both `set` the same
crop's water in one 250ms tick window (folds), both `name` it (defers,
visible to both), fight over a `claim`. The session record prints on Ctrl-C.
