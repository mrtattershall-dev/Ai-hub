# Reddit drafts

Two variants, each paste-ready. The human posts. Read the per-sub norms at the top of each before posting — Reddit self-promo rules are enforced by humans, and a mismatched post gets removed.

---

## Variant A — r/webdev (technical angle)

**Sub norms:** r/webdev allows sharing your own work, but the sub is allergic to marketing. Lead with *how it works*, not *check out my thing*. Show, don't sell. No superlatives, no "revolutionary". A live demo + source link is expected. The community rewards a genuine technical explanation and answers real questions in the comments. Consider posting on the weekly "Showoff Saturday" thread if the standalone post gets flagged. Flair: `Showoff Saturday` or `Discussion`.

**Title:**
```
I built a zero-dependency pixel desk-pet for web pages — one <script>, one canvas, JSON skins
```

**Body:**
```
I wanted a little character living on a page — sits at a desk, walks around, you
can grab and throw it — but every desktop-pet thing I found was either a browser
extension or dragged in a framework. So I wrote one that's a single file with no
dependencies. Sharing the how, since a few of the pieces were more fiddly than I
expected.

The whole thing is one <script>. On start() it creates its own DOM, injects its
own class-prefixed CSS, and draws the character on a <canvas> — nothing to import,
nothing to build. `DeskSprite.start()` and it's on the page.

A few implementation notes:

- Physics: while held, the sprite tracks the cursor with a trembling offset that
  scales with how high you've lifted it (a "fear" value). On release it keeps your
  throw's momentum and falls under gravity, then walks the floor. Drop it back on
  the desk and it eases into the seat.
- Skins are pure data. A skin is one JSON file: a palette (single chars → hex or
  transparent), a frame size, an anchor (the foot point), and named pixel frames —
  idle, walk (an array the engine cycles), held, plus optional work/done/error.
  The engine owns all the behavior; the skin only supplies pixels. Swapping skins
  is a config value or a URL to fetch.
- Keeping it one file: everything behavioral (walk cadence, gravity, the frame
  picker) lives in the engine and reads from the skin, so adding a character never
  touches engine code. Skins can also ship optional "traits" (walkSpeed, frame
  timing, custom speech-bubble text) that nudge engine defaults per-key — the
  built-in cat walks a bit faster than the office guy.
- Authoring: there's a PNG-to-skin converter (draw a pose as a small PNG, it spits
  out the frame rows) and a validator so a bad skin fails loudly instead of drawing
  garbage.

Honest limitations: it's canvas pixel-art only, and it's designed for one sprite
per page. Interaction is via Pointer Events (mouse + touch).

Demo: https://welltilln.github.io/desksprite/
Source (MIT): https://github.com/welltilln/desksprite

Happy to answer anything about the canvas frame player or the skin schema.
```

---

## Variant B — r/SideProject (story angle)

**Sub norms:** r/SideProject is built for exactly this — sharing something you made. It's story-friendly: people want the origin, the "why", the honest state of it. Still no growth-hack fluff and no fake numbers. A demo link is expected. Answer comments. Flair: `Sharing my project` (or the sub's current equivalent).

**Title:**
```
My project started as a desk pet on an internal dashboard and turned into a skinnable web-mascot library
```

**Body:**
```
This started as a tiny thing I made to keep myself company on an internal ops
dashboard — a little pixel guy sitting at a CRT desk, so there was something to
glance at while a long job ran. I wired the dashboard's status into his monitor:
when a task was working he'd look busy, when it finished he'd flash a "done ✓".

It was silly and I liked it more than I expected, so I pulled it out into its own
thing. Now it's desksprite: drop one <script> on any page and you get the same
character. He sits and works, wanders off around the page on his own now and then,
eats lunch at noon, and you can grab him (he dangles from the cursor and gets
nervous the higher you lift him), throw him with real momentum, and toss him back
onto the desk where he slides into his seat.

The part that made it a "project" instead of a toy: skins. A skin is a single JSON
file — a color palette and named pixel frames — so the character isn't hardcoded.
Two ship today, a blue office guy and a cat, and each can have its own personality
(the cat walks faster and has opinions about bugs). There's a converter to turn a
drawn PNG into skin frames, so making a new character doesn't mean touching code.

It's zero-dependency, one file, MIT. Not trying to be anything huge — it's a cute,
self-contained web mascot you can actually customize. Honest limitations: it's
canvas pixel-art only, and it's one sprite per page by design.

Demo: https://welltilln.github.io/desksprite/
Code: https://github.com/welltilln/desksprite

Would genuinely love to see someone make a skin — that's the part I'm most curious
whether it lands.
```
