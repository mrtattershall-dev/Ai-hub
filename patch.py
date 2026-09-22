"""Byte-exact patch for the jungle-debt restore defect.

Operates on BYTES, and preserves the file's LF line endings exactly.

An earlier version used pathlib.read_text/write_text, whose universal-newline handling silently
rewrote all 40,926 line endings to CRLF: a 41,532-byte, 81,859-line diff for a two-line change.
The game still ran and every test still passed, which is precisely why it was worth catching —
a patch must change what it says it changes and nothing else.
"""
import pathlib
import sys

SRC = pathlib.Path(__file__).with_name("game.original.html")
DST = pathlib.Path(__file__).with_name("game.html")

data = SRC.read_bytes()
if b"\r\n" in data:
    print("ABORT: source is not pure-LF; re-check the assumption before patching")
    sys.exit(1)

OLD = (
    b"    if (d.jgDebtFree)                gameState._jgDebtFree       = d.jgDebtFree;\n"
    b"    if (d.jgAltaverdeWarned)         gameState._jgAltaverdeWarned= d.jgAltaverdeWarned;"
)

NEW = (
    b"    // A saved `false` is a value, not an absence. The truthy guards that were here skipped the\n"
    b"    // restore whenever the save recorded false, leaving the CURRENT session's flag in place - so\n"
    b"    // loading an indebted save after clearing the Bond kept _jgDebtFree true, producing a state\n"
    b"    // that owes money and is simultaneously debt-free, and permanently suppressing\n"
    b"    // _checkBondForeclosure (it returns early on _jgDebtFree).\n"
    b"    // Assign unconditionally, as postEnding and inJungle already are above; `|| false` also\n"
    b"    // gives saves predating these fields a deterministic default rather than the session's.\n"
    b"    gameState._jgDebtFree        = d.jgDebtFree        || false;\n"
    b"    gameState._jgAltaverdeWarned = d.jgAltaverdeWarned || false;"
)

if data.count(OLD) != 1:
    print(f"ABORT: expected exactly 1 occurrence of the target, found {data.count(OLD)}")
    sys.exit(1)

out = data.replace(OLD, NEW)
DST.write_bytes(out)

print(f"bytes {len(data)} -> {len(out)}  (delta {len(out) - len(data):+d})")
print(f"CRLF introduced: {out.count(chr(13).encode())}  (must be 0)")
print("patched: 2 truthy-guarded restores -> unconditional assignment")
