# Magic Maze Web

> A simple, low-tech, monster-bashing maze game — now playable in your browser.
> Originally inspired by Gauntlet II on the Atari ST, where Kent first started
> building it as a 12-year-old in 1990.

This is a faithful HTML5 Canvas port of [Kent Dahl](https://github.com/kentdahl)'s
*Magic Maze* — a maze game with a 30+ year history across four implementations,
three languages, and one stubborn idea that wouldn't let go.

**Play it:** [Coming soon — link will go here]

**Not to be confused with** [the 2017 cooperative board game of the same name](https://boardgamegeek.com/boardgame/209778/magic-maze) by Kasper Lapp. Different game, same name.

---

## What is Magic Maze?

You play an old wizard searching the dungeon-tower of an evil demon to rescue a
captive maiden. Walk through the maze, fight (or flee from) monsters, collect
keys to open colored doors, find treasure, manage your energy and mana, and
make it to the exit on each of the ten increasingly nasty levels.

It's tile-based. It's top-down. It's pixel art. It runs at 320×200. The view is
five tiles by five tiles. There are spells. There are potions. There is a
chunky death sound when you finally lose your last hit point. The whole thing
fits the entire spirit of early-90s home computer gaming into about 1,400 lines
of code.

---

## A brief history

**1990–91 — Atari ST.** Kent, age 12, starts building Magic Maze on his Atari
ST after spending too much time playing Gauntlet II. One playable level
exists. The disk goes missing somewhere along the way and is presumed lost in
an attic.

**1994–96 — DOS / Turbo Pascal.** Kent rebuilds the game from scratch in Turbo
Pascal 7.0 for DOS. Mode 13h VGA graphics, Gravis Ultrasound for audio,
custom sprite and map formats, a built-in map editor. Released as freeware in
1996. The original Pascal source and a playable Win98-compatible binary are
still archived at:
[https://www.pvv.ntnu.no/~kentda/ancient/geocities/coding/mmaze/](https://www.pvv.ntnu.no/~kentda/ancient/geocities/coding/mmaze/)

**2004–2024 — Ruby / SDL2.** Kent ports the game to Ruby with SDL2 bindings,
adds modernized PNG sprite art, a TrueType font (Fraktur Modern), proper
joystick support, and command-line options for fullscreen, scaling, and
sound. Maintained on GitHub:
[https://github.com/kentdahl/magic_maze](https://github.com/kentdahl/magic_maze)

The Ruby port gets packaged for Debian by Joe Nahmias and Petter Reinholdtsen
and ships in every Debian release from buster through sid:
[https://packages.debian.org/sid/magicmaze](https://packages.debian.org/sid/magicmaze)
(also available on Ubuntu — see the
[Ubuntu manpage](https://manpages.ubuntu.com/manpages/bionic/man6/magicmaze.6.html)).

Kent also archives historical builds (OLPC XO-1, 32-bit Windows, original
Turbo Pascal) on itch.io:
[https://menthal.itch.io/magic-maze](https://menthal.itch.io/magic-maze)

**2026 — HTML5 / JavaScript.** This repo. A web port by Kent's brother
([Daniel Dahl](https://danieldahl.com)), who was the level designer and
tester for the original 1996 game and the 2004 Ruby port. Built with the
help of [Claude](https://claude.ai) by reverse-engineering the original
Pascal source, extracting the original sprites, sounds, and level files, and
re-implementing the game logic in vanilla JavaScript with HTML5 Canvas.

---

## Project goals

This port aims for **faithfulness over modernization**. The game looks, feels,
and plays the way the 1996 version did — same 320×200 resolution, same chunky
pixel art, same sounds, same level layouts, same monster AI, same UI.
Modernization is limited to what's needed to make it run in a browser:
- Canvas 2D instead of mode 13h VGA
- Web Audio instead of Gravis Ultrasound
- ES modules instead of Turbo Pascal units
- localStorage instead of `MM_SAV.GAM`
- CSS scaling so it fills modern displays at integer multiples (2x, 3x, 4x, 5x)

No new content. No reworked graphics. No "remastered" anything. Just the same
game, on a more modern platform.

---

## How it works

The repo contains:

```
magic-maze-web/
├── index.html            Entry point
├── style.css             Page chrome
├── main.js               Bootstrap & asset loading
├── engine.js             Game state, update logic, monster AI
├── render.js             Canvas drawing
├── input.js              Keyboard handler with isPressed() / lastPress
├── audio.js              Web Audio: SFX playback
├── levels.js             Level loading & tile parsing
├── assets.js             Sprite sheet & palette
├── assets/               Game art and sound (extracted from 1996 originals)
├── levels/               Ten levels, parsed from MM_MAP.001..010
├── tools/
│   └── extract_assets.py Reproducible asset extraction from the 1996 game
├── reference/
│   ├── MMAZE.PAS         Kent's original Turbo Pascal source (1996)
│   ├── MMMAPED.PAS       The map editor source
│   └── BRIEF.md          Architectural notes from the porting process
└── README.md
```

Vanilla JavaScript. Native ES modules. No build step. No dependencies. Drop
the folder on any static host (or open `index.html` over `file://` once browsers
allow that for local module loading) and it runs.

### Asset extraction

The art, sounds, and levels you play with are bit-for-bit the originals from
1996, just transcoded into modern container formats (PNG, WAV, JSON). The
extraction is fully reproducible — `tools/extract_assets.py` reads the
original Turbo Pascal binaries (`MM_SPR.DAT`, `MM_*.GRA`, `MM_MAP.001..010`,
`MM_SAM.001..004`) and emits the assets used by the engine.

If you want to verify the assets match the original game, grab `mm_src.zip`
and `mmaze.zip` from
[Kent's PVV page](https://www.pvv.ntnu.no/~kentda/ancient/geocities/coding/mmaze/),
extract them next to the script, and re-run it.

---

## Controls

| Action | Key |
|---|---|
| Move / turn | Arrow keys |
| Cast spell | Ctrl |
| Cycle attack spell | Alt |
| Heal | H (hold — drains mana) |
| Summon mana | N (hold — drains energy) |
| Magic map | M |
| Look ahead | L |
| Restart level | F9 |
| Save game | F2 |
| Load game | F3 |
| Pause | P |
| Sound on/off | S |
| Volume | PgUp / PgDn |
| Help | F1 |
| Quit | Esc |

Touch controls for mobile are planned for a future iteration.

---

## Building & running locally

There's nothing to build. To run locally:

```sh
git clone https://github.com/[username]/magic-maze-web.git
cd magic-maze-web
python3 -m http.server 8000
# Then open http://localhost:8000 in a browser
```

A local HTTP server is needed because ES modules don't load over `file://` in
most browsers.

---

## Credits

**Original game design, artwork, sounds, and code:** Kent Dahl
([@kentdahl](https://github.com/kentdahl)) — across all four implementations
(Atari ST 1990–91, Turbo Pascal 1994–96, Ruby/SDL2 2004–2024, and assets
re-used here).

**Level design (1996):** Kent Dahl, with one level co-designed by Daniel Dahl,
per the original `README.TXT`.

**Game testing:** Per Ejnar Thomsen (Pascal original), Randi Rørvik (Ruby port),
Daniel Dahl (Pascal original and Ruby port).

**Debian packaging of the Ruby port:** Joe Nahmias, Petter Reinholdtsen.

**Web port (this repo):** [Daniel Dahl](https://danieldahl.com), with
[Claude](https://claude.ai) as a pair-programming and reverse-engineering
assistant.

**Font (planned):** Fraktur Modern by Robert Pfeffer (free), as used in the Ruby
port.

---

## Related Magic Maze resources

- **Original Pascal source & DOS binary (1996):** [pvv.ntnu.no/~kentda/ancient/geocities/coding/mmaze](https://www.pvv.ntnu.no/~kentda/ancient/geocities/coding/mmaze/)
- **Ruby/SDL2 port (2004–present):** [github.com/kentdahl/magic_maze](https://github.com/kentdahl/magic_maze)
- **itch.io (multiple historical builds):** [menthal.itch.io/magic-maze](https://menthal.itch.io/magic-maze)
- **Debian package:** [packages.debian.org/sid/magicmaze](https://packages.debian.org/sid/magicmaze)
- **Ubuntu manpage:** [manpages.ubuntu.com/.../magicmaze.6](https://manpages.ubuntu.com/manpages/bionic/man6/magicmaze.6.html)
- **Le Bottin des Jeux Linux (FR):** [download.tuxfamily.org/.../Magic_Maze](https://download.tuxfamily.org/sdtraces/BottinHTML/Bottin_K-O_files/Magic_Maze-11845.html)
- **uvlist.net entry:** [uvlist.net/game-183221](https://www.uvlist.net/game-183221-Magic+Maze)

---

## License

MIT. See [LICENSE](./LICENSE).

The original game's freeware terms apply to the 1996 binary distribution. The
Ruby port is dual-licensed under GPL v2 / Ruby's license. This web port is
released under MIT with Kent's blessing — he gave the green light to do
"whatever I wanted" with it.

---

*Magic Maze is a simple and low-tech monster-bashing maze game. It was
originally inspired by playing Gauntlet II on the Atari ST.* — the official
tagline, unchanged across every port since 2004.
