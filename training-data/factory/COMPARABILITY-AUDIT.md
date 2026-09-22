# Comparability audit — the asset-version gate, and which historical reports it touches

2026-09-22. A measurement-tool defect, fixed on its own merits. No framework is involved.

## The defect

A Phaser or Godot verdict depends on the asset library the verifier served: a game that loads a
sprite passes or fails on whether *that* library has it, and the library changed as packs were
imported (13k files, 2026-09-09). So two runs are comparable on those axes only if every verdict in
both was produced against the same library version.

`score_run.mjs` knew this — its own comments say so twice — and enforced it like this:

```js
} else if (ASSET_VERSIONS.size > 1) {
  console.log(`  !! asset library CHANGED during scoring (...)`);
  console.log('     the phaser column is not internally comparable - rescore.');
}
console.log(`COMPARABLE — the ${shared.length} prompts every variant answered`);
```

Three separate holes, each found by reading the code rather than remembering it:

1. **Warn, then print anyway.** The comparison table followed the warning under a heading that
   said `COMPARABLE`.
2. **The warning was unreachable in the normal case.** The whole block sat inside
   `if (differs)` — the branch taken only when the *prompt sets* differ. For same-set comparisons
   (run5 vs base, run6 vs run5) neither the version line nor the warning could ever print.
3. **Missing evidence read as agreement.** `if (j.assetVersion) SET.add(...)` — a verdict whose
   verifier reported no version contributed nothing, so a run with no version evidence at all
   looked like `size === 1`.

And a fourth, on the other asset axis: **`scoreGodot` discarded the version entirely.**
`verifyGodotFiles` returns `assetVersion` and `assetsMissing` (a missing asset *fails* Godot
verification), and the scorer threw it away — the Godot column had the same dependency with no
tracking and no warning.

**Consequence:** no scorer output — stdout or otherwise — ever carried a per-verdict asset version,
and the scorer persisted nothing to disk. That is why the historical audit below can only ever say
*unestablished*.

## The fix

Comparability is now an **enforced precondition**, decided by a pure module and applied to every
table the scorer prints.

`comparability.mjs` — `assetComparability(rowsByRun)` over the verdicts of one axis, all runs
together:

| status | meaning | table |
|---|---|---|
| `COMPARABLE` | every verdict carries a version and all are identical | numbers shown |
| `MISMATCH` | two or more distinct versions | `BLOCKED: mixed libraries - RESCORE` |
| `UNESTABLISHED` | any verdict carries no version | `WITHHELD: comparability unestablished` |

Rows scored `?` (harness failure) are not verdicts and are excluded. **Missing evidence is never
agreement.** An axis with no verdicts at all is not gated — it stays the pre-existing `0/0 (n?)`
row, and the `?` warning at the foot of the report already covers it (found and fixed during this
work: godot, never scored, came out `WITHHELD`).

`score_run.mjs`:
- the version is recorded **per verdict** for both Phaser (`j.assetVersion ?? null`) and Godot
  (`v.assetVersion ?? null`), and kept on the per-row records;
- the gate is computed once, before any table, and applied to **both** tables — the shared-prompt
  comparison *and* the per-variant table, which is the only table when prompt sets match and is
  read side by side exactly as a comparison;
- the `TOTAL` row excludes gated axes and says how many prompts it excluded;
- per-prompt lines show the version (`[v7]` / `[no asset version]`);
- **raw verdicts are preserved**: every scoring run now writes
  `eval/scores-<runs>-<timestamp>.json` with every verdict, its version, the comparability decision
  per axis, the model id and which verifier answered. Until now the scorer wrote nothing.

**Scope:** only the asset-dependent axes (`phaser`, `godot`) are gated. `code`, `structured` and
`interpret` do not consume the library and remain comparable; the smoke asserts the code axis is
never blocked.

## Verification

`comparability.test.mjs` — **8/8** — including the three required cases and the two ways missing
evidence used to pass as agreement (a run with no versions beside a run with them; one missing row
among many; an empty-string version).

`comparability.smoke.mjs` — runs the **real scorer** end to end, three times, against a stub
verifier that decides the version it reports from a marker in the submitted code:

```
PASS  matching known versions     phaser 2/2  2/2      COMPARABLE
PASS  mismatched versions         phaser BLOCKED: mixed libraries - RESCORE     MISMATCH
PASS  missing version evidence    phaser WITHHELD: comparability unestablished  UNESTABLISHED
```

Each case also asserts the code axis printed numbers and the raw file carried a version field on
every Phaser verdict.

*The smoke's first version deadlocked its own stub (a synchronous spawn blocked the process that
served the stub), read every phaser row as `?`, and was measuring itself. Rewritten to spawn
asynchronously. Recorded because it is the same class of mistake as the defect being fixed: a
harness that cannot tell "no verdict" from "verdict".*

## Which historical reports are demonstrably affected

**Rule applied:** the code defect establishes that misleading output was *possible*, not that any
comparison was wrong. A confirmed mismatch would require rescore; missing evidence is
*comparability unestablished*. **No historical run has version evidence, so no mismatch is
confirmed anywhere, and nothing is marked "requires rescore".** Everything below is
*unestablished*.

Context that makes the risk real rather than theoretical: these runs were scored 2026-09-09 to
2026-09-10, the window in which the 13k-file asset library was being imported and the
"no assets" rule lifted.

| record | affected rows | status | what survives |
|---|---|---|---|
| **run5 vs base** (`run5-findings-2026-09-09`) — 32 prompts | `phaser 1/6 0/6 4/6 <- genuine win (+3)`; `godot 0/3 0/3 0/3` | **unestablished** | `code 7/9 3/9 5/9` (the fine-tune-hurts-code finding), `structured`, `interpret` — independent axes, unaffected |
| **32B size control** (`coder32b-control-2026-09-09`) — 18 shared prompts | `phaser 1/6 4/6 4/6 2/6 <- the 14B FINE-TUNE BEATS a 2.3x larger model`; `godot 0/3 0/3 1/3 2/3`; own-set `phaser 6/15`, `godot 6/15` | **unestablished** | `code 7/9 5/9 3/9 8/9` and `interpret`. **This is the record whose headline rests on the affected axis**: "the Phaser result is the finding" |
| **run6 vs run5** (`run6-result-keep-run5`) — 18 shared prompts | `phaser 1/6 4/6 4/6 <- held`; `godot 0/3 0/3 1/3`; "Godot 3/15 on the full set" | **unestablished** | **the decision itself stands**: *keep run5* was driven by `code 7/9 → 5/9 → 3/9`, an independent axis |

**Not affected:** `measurements/2026-09-10-small-model-loop/README.md` and
`training-data/DATASETS.md` mention Phaser only as a task name and a dataset row count, not as an
axis score.

**What "unestablished" changes in practice.** The 32B-control memory's conclusion — *reach for the
adapter for Phaser* — currently rests on a 4/6-vs-2/6 whose comparability cannot be shown. It is not
shown to be wrong. It is shown to be unshown. A rescore of `basefull run5 run6 coder32b` under the
fixed scorer, against one pinned library, would settle it either way; until then the claim should be
quoted with that qualifier attached.

## Not done here

- No historical run was rescored. That is a GPU-window decision.
- The remote Modal verifier reports `assetVersion` on `/api/game/verify` (same source as
  `gameVerify.js:250`), so real runs *will* carry per-verdict versions — but the gate will correctly
  land on `UNESTABLISHED` for any run scored against a verifier build that predates that field.
- `verify_remote_assets.mjs` still checks hub-vs-verifier version equality as a **separate manual
  step**. The gate now makes that check unnecessary for *comparability* — a mismatch shows up in the
  verdicts themselves — but the manual script remains the way to check the verifier is serving the
  whole library.
