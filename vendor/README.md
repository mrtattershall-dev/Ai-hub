# vendor/ — bundled binaries for a packaged build

The hub drives two external programs. On a developer machine they are found
automatically (Godot on PATH or in Downloads, Chromium in puppeteer's cache).
A packaged build ships them here instead, so a user who installs the hub gets a
working Game tab and Godot tab with no extra steps.

    vendor/
      godot/      godot.exe (or godot_console.exe / godot on mac+linux) + LICENSE.txt
      chromium/   the chrome-headless-shell distribution + its LICENSE

## Resolution order

Both resolvers prefer an explicit override, then this directory, then the machine.
Nothing here is required — the hub degrades to "not found" with a clear message
rather than crashing.

| binary   | resolver                | order                                                        |
|----------|-------------------------|--------------------------------------------------------------|
| Godot    | `server/godotVerify.js` | `GODOT_BIN` → `vendor/godot/` → PATH → common install dirs     |
| Chromium | `server/browser.js`     | `PUPPETEER_EXECUTABLE_PATH` → `vendor/chromium/` → puppeteer cache → installed Chrome/Edge |

## Sizes (Windows, uncompressed)

| component            | size   |
|----------------------|--------|
| Godot 4.6.3          | 164 MB |
| chrome-headless-shell| 270 MB |

## Licensing — both are redistributable, both require notices

**Godot** is MIT. Redistribution is permitted, including commercially. You MUST
include the copyright notice and licence text. The official Windows zip does NOT
contain one, so copy `LICENSE.txt` from the Godot repository into `vendor/godot/`.

**Chromium** is BSD-3-Clause plus a set of third-party notices. Ship the `LICENSE`
file that comes with the distribution you bundle — do not hand-write one, as the
third-party notices matter.

Neither licence requires you to open-source the hub itself.

## Building a bundle

1. Drop the platform's Godot binary in `vendor/godot/` alongside its `LICENSE.txt`.
2. Drop the matching `chrome-headless-shell` in `vendor/chromium/` with its `LICENSE`.
3. Package as usual. Expect roughly 700 MB uncompressed, ~450 MB compressed.

Bundle per-platform rather than shipping all three in one download — a user on
Windows has no use for the mac and linux binaries, and it triples the size.
