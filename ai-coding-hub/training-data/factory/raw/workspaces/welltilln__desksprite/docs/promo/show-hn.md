# Show HN draft

Paste-ready. The human posts this — pick the title, paste the body as the text (or as the first comment if submitting the URL).

**Submit URL:** https://github.com/welltilln/desksprite
**Live demo (put in the body, HN allows one URL in the post):** https://welltilln.github.io/desksprite/

---

## Title (≤ 80 chars)

```
Show HN: Desksprite – a pixel desk worker for your web page, zero deps
```

Alternates, same character:
```
Show HN: Desksprite – a tiny pixel desk pet in one <script> tag, zero deps
Show HN: Desksprite – drop a pixel sprite onto your site (one file, no deps)
```

---

## Body (6–10 lines)

```
Desksprite drops a little pixel character onto a web page. It sits working at a
tiny CRT desk, gets up to wander around on its own now and then, and eats lunch
at noon. You can grab it — it dangles from the cursor and gets visibly nervous
the higher you lift it — throw it (real gravity + momentum), and toss it back
onto the desk, where it glides into the seat and gets back to work.

It's one <script> tag, zero dependencies. It draws itself on a <canvas> and
injects its own CSS, so there's nothing to wire up: DeskSprite.start() and it's
there. If you want, setStatus() lets you point its monitor at something real —
a build, a download, whatever your app is doing.

The part I'd most like feedback on is the skin format. A skin is a single JSON
file — a palette, a size, and named pixel frames (idle / walk / held). The
engine handles the rest (walking, throwing, the scared tremble). There's a PNG
converter to turn a hand-drawn pose into frame rows, a validator, and optional
per-skin "traits" so a skin has personality — the built-in cat walks faster than
the office guy and has opinions about bugs. Two skins ship: blue-boy and a cat.

It started as a desk pet on an internal ops dashboard — something to watch while
a job ran — and grew into a skinnable little library. Honest limitation: it's
canvas pixel-art only (no SVG/HTML sprites), and it's designed for one sprite per
page. MIT.

Demo: https://welltilln.github.io/desksprite/
npm: desksprite

Would love thoughts on the skin JSON schema — is it the right shape for someone
who just wants to draw a character and drop it in?
```
