# Magic Maze — Future Ideas

Enhancements that aren't in Kent Dahl's 1994 Pascal source but could land in
later passes. Anything here is *post-port polish* — not bugs, not Pascal
fidelity, just nice-to-haves.

## Audio

- **Death sound.** When `pEnergy < 1`, play something distinct (currently the
  `argh` sample fires only when *monsters* die). Reuse `argh` at lower pitch,
  or layer with a low drone.
- **Level-exit sound.** When the player walks onto an exit tile, play a
  triumphant chime before the transition. Could synthesize a short arpeggio
  via OscillatorNode rather than adding a new WAV.
