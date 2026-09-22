"""Byte-exact patch for the jungle-debt restore defects.

Operates on BYTES, and preserves the file's LF line endings exactly.

An earlier version used pathlib.read_text/write_text, whose universal-newline handling silently
rewrote all 40,926 line endings to CRLF: a 41,532-byte, 81,859-line diff for a two-line change.
The game still ran and every test still passed, which is precisely why it was worth catching —
a patch must change what it says it changes and nothing else.

THREE flags, not two. The third (_bondForeclosureFired) lives in a monkey-patch wrapper ~7,000
lines below the main loader and was missed on the first pass: the search that was supposed to
find it used the case-sensitive pattern `foreclosureFired`, which does not match the capital F in
`_bondForeclosureFired`, and the count of guarded restores was scoped to the main loader's line
range only. Found by review, not by me.
"""
import pathlib
import sys

SRC = pathlib.Path(__file__).with_name("game.original.html")
DST = pathlib.Path(__file__).with_name("game.html")

data = SRC.read_bytes()
if b"\r\n" in data:
    print("ABORT: source is not pure-LF; re-check the assumption before patching")
    sys.exit(1)

EDITS = [
    # 1. the main loader (game.html:25729) — jungle debt + Altaverde warning
    (
        b"    if (d.jgDebtFree)                gameState._jgDebtFree       = d.jgDebtFree;\n"
        b"    if (d.jgAltaverdeWarned)         gameState._jgAltaverdeWarned= d.jgAltaverdeWarned;",

        b"    // A saved `false` is a value, not an absence. The truthy guards that were here skipped the\n"
        b"    // restore whenever the save recorded false, leaving the CURRENT session's flag in place - so\n"
        b"    // loading an indebted save after clearing the Bond kept _jgDebtFree true, producing a state\n"
        b"    // that owes money and is simultaneously debt-free, and permanently suppressing\n"
        b"    // _checkBondForeclosure (it returns early on _jgDebtFree).\n"
        b"    // Assign unconditionally, as postEnding and inJungle already are above; `|| false` also\n"
        b"    // gives saves predating these fields a deterministic default rather than the session's.\n"
        b"    gameState._jgDebtFree        = d.jgDebtFree        || false;\n"
        b"    gameState._jgAltaverdeWarned = d.jgAltaverdeWarned || false;",
    ),
    # 2. the jungle save/load wrapper (game.html:32778) — the Bond foreclosure latch
    (
        b"      if (d.jgBondForeclosureFired) _bondForeclosureFired = d.jgBondForeclosureFired;",

        b"      // Same defect as the main loader, opposite consequence: this latch means \"enforcement\n"
        b"      // has already fired, do not fire again\" (_checkBondForeclosure returns early on it).\n"
        b"      // The truthy guard meant a save recording false could not clear a session's true, so a\n"
        b"      // save where enforcement had never fired inherited a spent latch and could never fire.\n"
        b"      _bondForeclosureFired = d.jgBondForeclosureFired || false;",
    ),
]

out = data
for old, new in EDITS:
    if out.count(old) != 1:
        print(f"ABORT: expected exactly 1 occurrence of {old[:60]!r}, found {out.count(old)}")
        sys.exit(1)
    out = out.replace(old, new)

DST.write_bytes(out)

print(f"bytes {len(data)} -> {len(out)}  (delta {len(out) - len(data):+d})")
print(f"CRLF introduced: {out.count(chr(13).encode())}  (must be 0)")
print(f"patched: {len(EDITS)} sites, 3 truthy-guarded restores -> unconditional assignment")
