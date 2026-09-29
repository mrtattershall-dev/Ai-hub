# desksprite Packs (Phase 2.1) — The Stuff Basket — Design

> **STATUS: PARKED (2026-07-03).** Designed and kept for the day users ask for it.
> We chose to ship and promote Phase 1 first (npm publish, README GIF, promo posts)
> instead of building more architecture for zero users yet. Two pieces were extracted
> and shipped immediately in the existing single-file skin format: the `blue-boy`
> rename and `traits` (walkSpeed / walkFrameMs / messages) — see
> `docs/plans/2026-07-03-ship-v2.1.md`. Everything else here (folder-per-skin,
> smart discovery, multi-sprite cast) waits for demand.

**Goal:** A site owner keeps one *pack folder* ("the basket") in their static assets. Every character folder dropped into it **comes alive on the page — all of them at once**. Drop `blue-boy/` and `cat/` → two sprites walking around. No names typed anywhere; the system discovers the basket's contents itself where the web allows, with an auto-generated manifest as the safety net. Also: rename the default skin `office-worker` → `blue-boy`.

```
เว็บของคุณ/
├── index.html                 ← the structure: one line points at the basket
└── my-pack/                   ← the basket
    ├── blue-boy/{skin,frames,traits}.json    ← a character → walks
    └── cat/{skin,frames,traits}.json         ← another character → also walks
```

```html
<script src="desksprite.js"></script>
<script>DeskSprite.start({ pack: './my-pack/' });</script>
```

**Non-goals (later phases):** widget folders (office/calendar as `<desksprite-spot>` mounts — Phase 2.2), behavior plugin folders (Phase 2.3), zip packs, visitor-side drag-drop.

## Global constraints (carried forward from Phase 1)

- Zero runtime dependencies; sync drop-in. Only pack/skin URL loading is async (`fetch`).
- Packs and skins load **data, never code** (JSON only; no `eval`/`Function`).
- Anything invalid/unreachable → fall back + `console.warn`; **never throw**.
- Backward compatible: every Phase 1 call (`start()`, `start({skin})`, `start({skinUrl})`) behaves exactly as before — single sprite, unchanged.
- All `.js`/`.json` files LF, UTF-8. Node-builtin-only tooling.

## 1. Character folder format (unchanged from the approved earlier draft)

One folder per character, three fixed filenames:

- **`skin.json`** (required) — identity: `{ "name", "author", "palette", "size", "anchor" }`
- **`frames.json`** (required) — poses, same frame grammar as Phase 1: `{ "idle", "walk": [..], "held", …optional work/done/error/eat/carry/fall }`
- **`traits.json`** (optional file) — personality: `{ "walkSpeed", "walkFrameMs", "messages" }`

**Assembly:** loader merges `{...skin.json, frames, traits}` into a Phase 1 skin object → existing `validateSkin` (schema unchanged; `traits` is an ignored-by-validation optional key, leniently type-checked at use). `skin.json`/`frames.json` missing → that character fails (warn, skipped). `traits.json` 404 → silent defaults.

## 2. How the engine learns what's in the basket

Two mechanisms, tried in order — both invisible to the site owner:

1. **Smart Discovery (dev magic):** `GET <pack>/` — many dev servers (`python -m http.server`, nginx autoindex, Live Server) answer with a directory-listing HTML page. The engine parses anchor hrefs ending in `/` (excluding parent links), treats each as a candidate, and confirms a candidate by fetching `<pack>/<candidate>/skin.json`. Confirmed candidates are the characters. Drop a folder, refresh, it's there. Candidate cap: 24 folders (warn if exceeded).
2. **Manifest fallback (production net):** if the listing GET fails or yields no confirmed characters, fetch `<pack>/pack.json` — `{ "name": …, "skins": ["blue-boy", "cat"] }` — **auto-generated, never hand-written**: `tools/make-pack.mjs <dir>` scans the real folder (on the machine where looking IS possible) and writes it. Strict hosts (GitHub Pages, Netlify, Vercel) disable listings, so deploys rely on this snapshot.
3. Both fail → `console.warn` + fall back to the built-in `blue-boy`, single sprite. Never throw.

Notes: same-origin relative URLs are the intended use; `file://` cannot fetch at all (Phase 1 caveat, documented). Discovery results are used as-is per page load (no caching layer).

## 3. Multi-sprite engine

Everything discovered spawns — the basket is a cast, not a menu.

- **Instances:** each character = its own free-roaming canvas + pet state (position, velocity, fear, frame), all driven by ONE shared rAF loop. Grab/throw/physics work per sprite (pointer events already target the touched canvas). Sprites do not collide with each other (they pass; simplicity + charm).
- **Sprite cap:** 8 live sprites; extras are skipped with a warn (performance guard).
- **The one desk:** `desk: true` still creates a single desk. The seat holds **at most one sprite**:
  - Initially the first character in the discovered/manifest list order sits; the rest spawn roaming.
  - Throwing any sprite onto the desk seats it; the previous occupant pops out and roams (eviction, the cute kind).
  - The seated sprite does desk things (status frames, noon lunch). Roamers just live their lives.
  - An empty seat (occupant grabbed off) renders the desk with no character — monitor stays on.
- **Traits drive variety:** each sprite's own `walkSpeed`/`walkFrameMs`/`messages` apply — the basket feels like a little population, not clones.
- **Status API:** `setStatus()` targets the seated sprite (that is what status means today); `say()` also the seated one. With an empty seat, `setStatus` still updates the monitor readout and `say()` is a no-op. Controller additionally exposes `sprites` (array of per-sprite `{name, say(text)}`) for playful use — nothing more (YAGNI).
- **Phase 1 compat:** without `pack`, exactly one sprite (current behavior, untouched). `prefers-reduced-motion` and hidden-tab pause apply to the whole loop as today.

## 4. Engine API

```js
DeskSprite.start({ pack: './my-pack/' });              // everything in the basket, alive
DeskSprite.start({ pack: './my-pack/', desk: false }); // a crowd of walkers, no desk
DeskSprite.start({ pack: packObject });                // inline basket, no hosting:
// packObject = { name, skins: { "blue-boy": <assembled skin object>, … } } — all spawn
```

- `pack` URL string: trailing slash optional (normalized). Loading is async; `start()` returns immediately with the built-in `blue-boy` seated (sync render), then the basket's cast replaces/joins it when discovery resolves (the Phase 1 hot-swap seam, extended: first character swaps into the seat, the rest spawn roaming).
- Option precedence: `pack` present → it is the source; `skin`/`skinUrl` alongside `pack` are ignored with a warn. Without `pack` → Phase 1 semantics untouched.
- Per-character failure during load (bad JSON, fails validation) → warn + skip that character; the rest still spawn.

## 5. Traits v1

| trait | meaning | default |
|---|---|---|
| `walkSpeed` | multiplier on roam velocity | `1.0` |
| `walkFrameMs` | ms between walk-frame flips | engine's current constant |
| `messages` | per-skin bubble text (`working`/`done`/`error`/`seat`), merged key-by-key | engine defaults |

Precedence per key: site owner's `start()` config > skin traits > engine defaults. Lenient validation: non-numeric/≤0/NaN ignored with a warn; unknown keys ignored silently.

## 6. Repo restructure + rename

- **`office-worker` → `blue-boy` everywhere:** built-in const, `SKINS` registry key, fallback warns, docs, demo, verifier tools (`gen/legacy/verify-office-worker.cjs` → `*-blue-boy.cjs`, still proving byte-identity with the legacy render). Clean rename, no alias (pre-publish, no consumers). Compat nuance (accepted): `resolveSkin('office-worker')` → warn + `blue-boy` (identical pixels, so identical render; only the warn is new).
- **`skins/` becomes the official basket:** `skins/blue-boy/…`, `skins/cat/…`, `skins/_template/…` (underscore folders are ignored by tools and discovery-confirm), plus a generated `skins/pack.json` so the folder works as a pack on strict hosts. Single-file `skinUrl` JSON stays supported (Phase 1 compat); repo no longer ships single-file examples.
- Community contribution = PR one folder; `make-pack` regenerates the snapshot; CI-style validation via the test suite.

## 7. Tooling

- **`tools/make-pack.mjs <pack-dir>`** — scans subfolders (skips `_*`), requires `skin.json`+`frames.json`, assembles + `validateSkin`s every character (fails loudly listing every invalid one), writes/updates `pack.json` (preserves an existing `name` field). Run before deploying to a strict host; never needed during dev-with-listings.
- **`tools/png-to-skin.mjs --folder <out-dir>`** — emits the three-file folder skeleton (`skin.json`, `frames.json` with the decoded pose as idle/held/walk[0], default `traits.json`). Existing single-file output unchanged.

## 8. Docs + demo

- `docs/SKIN_FORMAT.md`: new **Packs — the basket** section (folder layout, three files, discovery vs pack.json + when each applies, multi-sprite behavior, desk-seat rules, traits table, file:// caveat).
- `CONTRIBUTING.md`: PR-a-folder workflow + `make-pack` validation.
- README: `pack` option row + a "Packs" subsection (the drop-a-folder story).
- Demo: served demos show the official basket live (all characters); on `file://` falls back to built-ins. Picker becomes "who sits at the desk" (click to seat a character) — exercising the eviction rule.

## 9. Testing

- **Pure units (Node, DOM-free):** pack logic lives in exported helpers — `assembleSkin(skinJson, framesJson, traitsJson)`, `parseListing(html)` (anchor extraction), `discoverPack(baseUrl, {fetchFn})` → Promise<string[] names>, `loadPackSkins(packSource, {fetchFn})` → Promise<skin[]> (assembled+validated, failures skipped with warn), `traitValue(cfg, skin, key)`. `start()` only consumes these + the swap seam. Tested in `tools/test-skin.cjs` with stub `fetchFn`s: listing happy path, listing-then-confirm filtering, no-listing → pack.json, both-fail → empty, per-character skip, traits precedence, cap enforcement.
- **Multi-sprite state:** extract the seat-ownership rule (`claimSeat(state, spriteId)` → previous occupant evicted) as a pure helper and unit-test it; full multi-canvas rendering is validated in the demo (documented manual check, as Phase 1 did for visuals).
- **make-pack round-trip:** temp dir → folders → generate → members validate → pack.json content exact.
- **Regression:** all four existing suites stay green; renamed verifier still proves blue-boy ≡ legacy render.

## 10. Version

`package.json` → **2.1.0** (additive: `pack` option, traits, multi-sprite; rename is pre-publish).
