# Awesome-list targets + GitHub repo settings

From `docs/discoverability.md`: getting into awesome-lists is confirmed distribution; real, populated GitHub topics carry search. This file is the concrete checklist — which lists to PR, the exact entry line per each list's format, and the repo metadata to set by hand.

Awesome-lists are curated and picky. Before opening any PR: read that list's CONTRIBUTING, match its exact entry format (some want a trailing period, some don't; some require the description to start with a capital and be a full phrase), and add your entry to the correct existing section (create a section only if the maintainer's guide allows it). One entry per list.

---

## 1. Target awesome-lists

Each entry below is written to that list's convention. Verify the list still exists and re-read its format rules before opening the PR — awesome-lists get archived and reorganized.

### awesome-javascript (sorrycc/awesome-javascript)

Very well known; likely a good fit under a UI / animation / "desktop utilities" style section. Check for the most fitting existing section (e.g. an "Animations" or "UI/Widgets" area) rather than inventing one.

```
* [desksprite](https://github.com/welltilln/desksprite) - Zero-dependency pixel desk-pet (sprite) for any web page; one <script>, JSON skins.
```

### awesome-canvas (raphamorim/awesome-canvas *or* the most-starred current awesome-canvas — verify list exists before PR)

There are a few "awesome canvas" lists; the HTML5-canvas one is the right home for a canvas-drawn sprite. Confirm which is actively maintained before PRing.

```
- [desksprite](https://github.com/welltilln/desksprite) — A tiny canvas-drawn pixel desk-pet (web mascot) in one file, zero dependencies.
```

### awesome-web-animation (sarahzrf / the actively-maintained awesome-web-animation — verify list exists before PR)

Animation-focused list; frame the entry around the sprite's motion (walk cycle, gravity throw). Verify the exact list and its format before PRing.

```
- [desksprite](https://github.com/welltilln/desksprite) - Animated pixel character that walks, and can be grabbed and thrown with real momentum; zero-dep canvas, JSON skins.
```

### awesome-creative-coding (terkelg/awesome-creative-coding)

Well-established; fits under a JS / toy-and-mascot flavored section if one exists. Match its `[name](url) - Description.` format (trailing period, capitalized).

```
- [desksprite](https://github.com/welltilln/desksprite) - Pixel desk-pet sprite for web pages that walks, roams, and can be thrown around; zero dependencies.
```

### awesome-vanilla-js (a "no-framework / vanilla JS" list — verify list exists before PR)

A vanilla-JS / no-dependency list is an ideal fit for a one-file, dependency-free widget. Several exist under names like `awesome-vanilla-js`; confirm the maintained one and its format before PRing.

```
- [desksprite](https://github.com/welltilln/desksprite) - No-framework, no-dependency pixel desk-pet in a single <script>; grab, throw, JSON skins.
```

**Recommended priority:** awesome-javascript and awesome-creative-coding first (largest, best-maintained, clearest fit), then awesome-canvas / awesome-vanilla-js, then awesome-web-animation. Space the PRs out; don't spam five at once.

---

## 2. GitHub repo settings (set by hand in the repo's "About" panel)

Per `docs/discoverability.md`: GitHub's repo search matches **name + description + topics** (README is only matched with `in:readme`). So the description and topics are the search levers — keep them keyword-rich and accurate.

### Description string

Paste into the repo's **About → Description** (this is the same as `package.json` `description`, kept in sync):

```
A tiny zero-dependency JavaScript desktop pet / web mascot for your web page — a pixel character sits at a desk, walks around, and you can grab, throw, and toss it back into its seat. A vanilla-JS alternative to Shimeji and oneko. One script tag, no build.
```

Also set **About → Website** to the live demo: `https://welltilln.github.io/desksprite/`

### Topics

Set exactly these topics (About → ⚙ Topics). The first five are the researched desktop-pet keyword set from `docs/discoverability.md`; the last two describe the medium:

```
desktop-pet
shimeji
oneko
desktop-mascot
virtual-pet
pixel-art
canvas
```

These match the populated, Google-indexable GitHub topic indexes (`desktop-pet` alone has hundreds of repos). Tagging adds desksprite to those indexes; it won't by itself outrank star-heavy leaders (per the research), but it's the correct, low-cost move. Keep the `package.json` `keywords` array (which already includes these plus javascript/vanilla-js/sprite) aligned so npm keyword search matches too.
