# Contributing a skin

The easiest contribution is a new `skins/<name>.json` — a pixel sprite the world can use. Here's how.

---

## 1. Draw your sprite

You have two options: start from the template, or draw in a pixel-art editor and run the converter.

### Option A — edit the template directly

Copy `skins/_template.json` and fill in the frames by hand. The template is a tiny 5×5 placeholder that already passes `validateSkin`, so you can test at any point.

```bash
cp skins/_template.json skins/mypet.json
# open skins/mypet.json in your editor and draw
```

Each frame is an array of equal-length strings. Use any single character as a palette key (except `.` and space, which are always transparent):

```json
"idle": [
  ".XXX.",
  "X...X",
  "X.X.X",
  "X...X",
  ".XXX."
]
```

See [`docs/SKIN_FORMAT.md`](docs/SKIN_FORMAT.md) for the full schema, the state/frame contract, and the desk-seat crop rule.

### Option B — PNG converter

Draw each pose in Aseprite (or any pixel-art editor), export as a small PNG, and convert:

```bash
# Convert the idle pose to a full skin JSON
node tools/png-to-skin.mjs idle.png --name mypet > skins/mypet.json

# Extract rows for additional poses
node tools/png-to-skin.mjs held.png --frame-only    # copy the printed array
node tools/png-to-skin.mjs walk-a.png --frame-only  # walk frame A
node tools/png-to-skin.mjs walk-b.png --frame-only  # walk frame B

# Paste the held/walk arrays into skins/mypet.json by hand,
# then unify the palette (see docs/SKIN_FORMAT.md → --frame-only palette caveat)
```

---

## 2. Validate

```bash
node -e "
const DS = require('./desksprite.js');
const skin = require('./skins/mypet.json');
const r = DS.validateSkin(skin);
console.log(r.ok ? 'valid' : 'INVALID: ' + r.errors.join(', '));
"
```

Or run the full test suite (covers all built-ins too):

```bash
node tools/test-skin.cjs
node tools/test-png-to-skin.mjs
```

Both should print all-green before you open a PR.

---

## 3. Test it live in the demo

Open `demo/index.html` in a browser (file:// is fine). Use the skin picker to load the built-in skins and confirm your sprite looks right once you wire it up temporarily:

```js
// Paste into the browser console to test before committing
DeskSprite.start({ mount: '#deskhome', skin: { ...yourSkinObject... } });
```

Or add a quick `DeskSprite.start({ skinUrl: 'path/to/mypet.json' })` call and reload.

---

## 4. Open a PR

The PR should contain **one file**: `skins/<name>.json`. No code changes needed.

- Name the file after the skin: `skins/cat.json`, `skins/robot.json`, etc.
- Keep the `"name"` field in the JSON matching the filename (without `.json`).
- Fill in `"author"` with your name or handle.
- A short description in the PR body is welcome (inspiration, colour palette story, anything).

That's it. The engine picks up any valid skin automatically — no registry edit required for external skins loaded via `skinUrl`. If you want it bundled as a named built-in (loadable by `start({ skin: 'mypet' })`), say so in the PR and we can add it to the `SKINS` registry in `desksprite.js`.
