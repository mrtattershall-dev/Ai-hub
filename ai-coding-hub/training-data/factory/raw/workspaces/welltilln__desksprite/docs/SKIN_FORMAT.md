# Skin format

A skin is a single JSON file that tells the engine what the sprite looks like. The engine handles everything else — walking, throwing, gravity, the scared tremble. You just supply pixel frames.

---

## Schema

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | yes | Identifier shown in error messages. |
| `author` | string | no | Credit. |
| `palette` | object | yes | Map of single characters → `"#RRGGBB"` or `null` (transparent). `"."` must map to `null`. |
| `size` | `{w, h}` | yes | Frame dimensions in pixels. Every frame must fit within this box. |
| `anchor` | `{x, y}` | yes | Foot point — where the sprite's feet are, measured from the top-left corner. **Currently used only by the desk-seat calculation** (see below). Reserved for future use elsewhere. |
| `frames` | object | yes | Named frame slots (see below). |
| `traits` | object | no | Optional personality hints — `walkSpeed`, `walkFrameTicks`, `messages`. See [Traits](#traits). |

### `frames` slots

| Slot | Type | Required? | Fallback if absent |
|---|---|---|---|
| `idle` | `string[]` | **required** | — |
| `held` | `string[]` | **required** | — |
| `walk` | `string[][]` | **required** | — (array of 1+ frames; 2 recommended for a natural stride) |
| `fall` | `string[]` | optional | falls back to `held` |
| `work` | `string[]` | optional | falls back to `idle` |
| `done` | `string[]` | optional | falls back to `idle` |
| `error` | `string[]` | optional | falls back to `idle` |
| `eat` | `string[]` | optional | reserved — not yet used by the engine |
| `carry` | `string[]` | optional | carry overlay drawn on top of the sprite while it walks with status `working` |

A **frame** (`string[]`) is an array of equal-length strings, one string per row. Every character is a palette key. Rows and columns must not exceed `size.h` and `size.w` respectively.

`walk` is an array of frames — the engine cycles through them while the sprite is roaming. Two frames give a classic two-step walk.

---

## Transparency

Two characters mean "draw nothing here":

- `"."` — the canonical transparent pixel; must be in the palette as `"."` → `null`.
- `" "` (space) — also treated as transparent; useful for readability in dense rows.

Any palette character mapped to `null` is also transparent. An unrecognised character (not in the palette at all) falls through as transparent.

---

## `size` and `anchor`

`size` declares the bounding box. Every frame must fit inside it — the validator rejects frames that are wider or taller than `size.w` / `size.h`.

`anchor` marks where the sprite's feet are, in pixels from the top-left of the frame. The engine currently uses `anchor.y` to calculate the desk seat position: the sprite is placed so its feet land at the desk surface. `anchor.x` is stored but **not yet consumed** by the engine — treat it as reserved.

---

## Desk-seat crop (important for skin authors)

When the sprite sits at the desk, the engine **crops the last `DESK_LEG_ROWS = 2` rows** of the idle frame before drawing it. This hides the legs behind the desk surface. Your sprite's legs appear in the idle frame (for walking), but they are invisible when seated.

Design for this: keep leg detail in the bottom 2 rows, but don't rely on those rows being visible in the seated pose.

---

## Engine overlays

Three visual effects are drawn *on top of* the skin frame by the engine, not from skin data:

- **Scared sweat drop** — a small blue droplet (`#9FE0FF`) drawn when the sprite is held or falling and its height-based `fear` value exceeds 0.45. The skin author doesn't need to add this.
- **Carry overlay** — if `frames.carry` is defined, the engine draws it over the sprite while it walks with status `working`. This is for a carried item (like a clipboard or bag). It is drawn at the base position, unaffected by the walk-bob offset.
- **Error droop** — when status is `error`, the engine shifts the whole sprite frame 2 pixels downward. If your art sits flush against the bottom of the bounding box, leave a little bottom margin or expect the sprite to dip below the floor line during errors.

---

## Frame player — how the engine picks a frame

```
state = held     → frames.held
state = falling  → frames.fall  (or frames.held if absent)
state = walk     → cycles frames.walk[counter % length]
status = working → frames.work  (or frames.idle if absent)
status = done    → frames.done  (or frames.idle if absent)
status = error   → frames.error (or frames.idle if absent)
default          → frames.idle
```

The sprite is "walking" (`state = walk`) only when roaming the page. In all other states — including while seated at the desk — the frame is picked by the table above. This means a skin that defines `work`, `done`, or `error` frames will show them while seated too; a skin that defines none of those (like the built-in blue-boy) always shows `idle` while seated.

---

## Full annotated example — cat skin (excerpt)

```json
{
  "name": "cat",
  "author": "welltilln",
  "palette": {
    ".": null,      <- transparent
    "B": "#1A1A1A", <- darkest fur
    "b": "#2E2E2E",
    "G": "#4A4A4A",
    "g": "#6A6A6A",
    "W": "#F0F0F0", <- white chest patch
    "P": "#FF9EAD", <- pink nose
    "N": "#1A1A2E"  <- dark eye
  },
  "size": { "w": 13, "h": 13 },
  "anchor": { "x": 6, "y": 13 },  <- feet at row 13 (bottom edge), centered

  "frames": {
    "idle": [
      ".B.........B.",  <- ear tips (row 0)
      "BB.........BB",
      "BBBbBBBBBbBBB",
      ".BBBNgGgNBBB.",  <- face / eyes
      ".BBBggPggBBB.",  <- nose
      ".BBBBBBBbBBB.",
      ".BWWWBBBBBB..",  <- white chest patch
      ".BWWWbBBBBB..",
      ".BBBBBBBBBB..",
      "..BBBBBBBB...",
      "..BBBBBBBB...",
      "..BB....BB...",  <- legs (row 11–12 = last 2 rows, cropped when seated)
      "..BB....BB..."
    ],

    "held": [
      ".B.........B.",
      "BB.........BB",
      "BBBbBBBBBbBBB",
      ".BBBWGBGWBBB.",  <- wide eyes (scared expression)
      ".BBBggPggBBB.",
      ".BBBBBBBbBBB.",
      ".BWWWBBBBBB..",
      ".BWWWbBBBBB..",
      ".BBBBBBBBBB..",
      "..BBBBBBBB...",
      "..BBBBBBBB...",
      ".............",  <- legs retracted (blank — cat pulls legs up when grabbed)
      "............."
    ],

    "walk": [
      [                 <- walk frame A (left foot forward)
        ".B.........B.",
        ...
        ".......BB....",  <- right leg back
        "..BB....BB..."
      ],
      [                 <- walk frame B (right foot forward)
        ".B.........B.",
        ...
        "..BB.........",  <- left leg back
        "..BB....BB..."
      ]
    ]
  }
}
```

The full file is at [`skins/cat.json`](../skins/cat.json).

---

## Traits

A skin can ship an optional `traits` object that nudges the engine's defaults. Traits are **suggestions, not contracts** — any missing or invalid value silently falls back to the engine default. The precedence is resolved **per key at use-time**, so a runtime skin swap changes personality too:

> **site owner config** beats **skin traits** beats **engine defaults**

| Trait | Type | Engine default | What it does |
|---|---|---|---|
| `walkSpeed` | `number > 0` | `1` | Multiplied into the base walk velocity (the base is `1.5` while working, `0.7` idle). The cat ships `1.35` — it pads around a bit faster than blue-boy. |
| `walkFrameTicks` | `number > 0` | `9` | Walk-frame flip interval in ticks (one tick ≈ one animation frame at ~60fps; default 9 ≈ 150 ms). Smaller = faster stride animation. |
| `messages` | `object` | see below | Per-key speech-bubble text. Each key (`working`, `done`, `error`, `seat`) is resolved independently, so you can override only the ones that fit the sprite's personality. |

Default engine messages (used when neither site config nor skin traits provide an override):

```
working: "on it!"   done: "done ✓"   error: "uh oh…"   seat: "back to work!"
```

**Bad values fall back silently.** `traitNumber` (exported as `DeskSprite.traitNumber`) returns the fallback for any value that is `0`, negative, non-finite, or not a number. A `traits` value that is not a plain object (e.g. a string or array) is rejected by `validateSkin`.

---

## PNG-to-skin workflow

The fastest way to draw a new skin is to pixel-art each pose in an image editor (Aseprite, Photoshop, etc.), export each pose as a small PNG, and run the converter:

```bash
# Step 1 — convert the idle pose; this produces a complete, loadable skin
node tools/png-to-skin.mjs idle.png --name mypet > skins/mypet.json

# Step 2 — extract rows for the held pose
node tools/png-to-skin.mjs held.png --frame-only
# Output: [ ".XXX.", "X...X", ... ]  — copy this array

# Step 3 — extract rows for each walk frame
node tools/png-to-skin.mjs walk-a.png --frame-only
node tools/png-to-skin.mjs walk-b.png --frame-only

# Step 4 — paste the held and walk arrays into skins/mypet.json by hand
```

**`--frame-only` palette caveat.** When you run `--frame-only`, the converter assigns palette characters fresh from the source PNG — it knows nothing about the characters already in your base skin. If your held PNG uses the same colour as the idle PNG's `"B"`, the `--frame-only` output might call it `"A"` instead. After pasting, merge the palettes manually: unify the character assignments so every frame uses the same palette map.

**PNG requirements.** The converter supports non-interlaced, 8-bit depth, colour types RGB (2) and RGBA (6). It rejects interlaced, 16-bit, palette-indexed, and grayscale PNGs with a clear error message. Alpha < 128 is treated as transparent (`.`).

**Colour limit.** Up to 62 distinct opaque colours per skin (the palette-char sequence A–Z, a–z, 0–9). Pixel art well within that range.

---

## Validation

```bash
node -e "
const DS = require('./desksprite.js');
const skin = require('./skins/mypet.json');
const r = DS.validateSkin(skin);
console.log(r.ok ? 'valid' : 'INVALID: ' + r.errors.join(', '));
"
```

Or use the dedicated test runner (covers all built-ins too):

```bash
node tools/test-skin.cjs
```
