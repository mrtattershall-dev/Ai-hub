---
name: asset-library-contract-2026-09-09
description: "The hub now has a shared asset library (13k files); the \"no assets\" training rule is lifted because verifiers serve the manifest — a missing asset must FAIL verification; two gate contracts now exist"
metadata: 
  node_type: memory
  type: project
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-10T03:17:40.902Z
---

Built 2026-09-09 at the user's direction ("build an asset section in my hub and upload
all my assets"). Design chosen by the user: **full manifest pipeline** (not inline data
URIs).

**What changed and why it is load-bearing.** The "no external assets" training rule was
never a style preference. The Chromium verifier renders code with `page.setContent()`,
so the page had no base URL, relative asset paths resolved to nothing, asset-loading
code could not be verified, so the gate had to reject it — that is why the original
4,242-row harvested Phaser slice scored 0/12. The library fixes the root: one manifest
(`assets/manifest.json`, `server/assets.js`) consumed by four things that MUST agree —
the hub (`/assets/<name>`), the agent (`list_assets` tool + a compact summary injected
per call), both verifiers (intercept `http://hub-assets.invalid/assets/*`, fulfil from
the manifest, report `assetsUsed`/`assetsMissing`/`assetVersion`), and the gate.

**Rules that must hold:**
- A missing asset FAILS verification. Phaser paints a placeholder texture for a 404 and
  renders anyway; the first e2e test came back "Runs clean" with the sprite absent.
- Two gate contracts now: `dependsOnExternalResources` still means self-contained (left
  unchanged — every assembler depends on it); `runnableWithAssets(code, manifest)` is
  what a training row should satisfy from now on. `referencedAssets` must catch
  `load.pack()` — a direct-loader-only regex called sprite-heavy games asset-free.
- The Modal verifier (`modal_chromium.py`) and local `gameVerify.js` compute the SAME
  version hash; `factory/sync_assets.py --check <url>` proves parity. Run it after any
  import, or the eval measures a different asset set than the hub.
- Licence: CraftPix/itch packs are free to USE in games, not to REDISTRIBUTE. Terms are
  in `assets/LICENSES.md`. Training rows carry paths only, never bytes — fine. Never
  publish the library itself.

**Measured facts:** the user's own game (aetherfall) is a hand-rolled canvas engine, NOT
Phaser — 5.7MB single HTML with 49 data-URI assets (23 PNG, 24 MP3, 2 TTF);
`server/extractAssets.mjs` de-inlines it. 18 asset packs → 13,052 files / 64.6MB;
`server/importAssetPacks.mjs` (content-hash dedupe collapsed 975 duplicates + 3 whole
re-uploaded packs). Naming: `<packtag>_<path>_<file>`; strip `sprites` BEFORE
`characters` or "charactersprites" → "prites".

**Canonical vocabulary (user requirement 2026-09-09: "hold all assets even if I don't have
any right now, so when trained it can technically pass").** `server/canonicalAssets.mjs`
defines 46 stable names — `assets/player.png`, `player_sheet.png`, `enemy.png`, `coin.png`,
`ball.png`, `paddle.png`, `brick.png`, `ship.png`, `bullet.png`, `platform.png`,
`tileset.png`, `background.png`, `particle.png`, `button.png`, … `jump.wav`, `hit.wav`,
`pickup.wav`, `explosion.wav`, `music_loop.wav`, `level.json` — and generates pixel-art /
synthesised placeholders (`placeholder: true` in the manifest) for any that are missing.
Uploading a real file under the same name replaces the placeholder IN PLACE (assets.add
overwrites placeholders instead of suffixing). Training rows should PREFER canonical names:
they resolve in every library; pack names do not generalise. Proven: a game using only
canonical names verifies clean locally with all 6 assets served.

**The library is entirely fantasy/RPG top-down pixel art** (user, 2026-09-09: "I only have
fantasy/rpg assets right now"). 28 packs, 13,523 files. Consequences:
- 42 canonical slots are now backed by REAL art (`server/promoteCanonical.mjs`): player/npc
  + 5 NPC trades from Franuka's character pack, enemy/orc/skeleton/gnoll/ghost/slime/rat/
  boss/golem/ent from CraftPix, 21 items from Franuka's icons, tree, tileset.
- 35 slots stay placeholders **on purpose** — ball, paddle, brick, ship, alien, asteroid and
  the world tiles have no honest fantasy equivalent. They still resolve, so a breakout game
  still verifies with stand-ins.
- Icon packs ship NUMBERED files (Franuka `1.png`, Raven `fa1.png`), so 11,000 icons were
  unsearchable — "potion" matched nothing. `server/labelIcons.mjs` applies Franuka's index
  as searchable `label`s (1,920 labelled). Raven has no index: still unlabelled.
- `server/pngTool.mjs` is a dependency-free PNG decode/crop/encode. Frame size is
  per-CREATURE not per-pack: orc/skeleton/gnoll/ghost/slime 64px, rat/golem/ent 128px.
  `detectFrame()` finds the smallest size where the sprite is not clipped at the frame edge
  — coverage cannot tell (scale-invariant); guessing gave four orcs in one frame, then a
  sliced-off golem. **Always crop and LOOK.**

**Licence reality (`assets/LICENSES.md`, rebuild with `server/rescanLicences.mjs`):** 26
CraftPix packs = use in games, NO redistribution (their License.txt is only a URL). Franuka
x2 = CC BY 4.0, **attribution required** (credit franuka.itch.io). Raven (6,579 files) and
rpgultimate (579) ship **no terms at all** — verify on the source page before shipping.

**How to apply:** rebuild run7 with `runnableWithAssets` and the eval must pin
`assetVersion`. Real-repo Phaser harvesting was structurally impossible under the old
contract (48% fragments, all real games load sprites); with the manifest it becomes
partially possible. See [[coder32b-control-2026-09-09]], [[run5-findings-2026-09-09]].
