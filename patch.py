import pathlib, sys

p = pathlib.Path(r"C:\Users\tatte\Projects\dust-harvest-repair\game.html")
s = p.read_text(encoding="utf-8")

OLD = """    if (d.jgDebtFree)                gameState._jgDebtFree       = d.jgDebtFree;
    if (d.jgAltaverdeWarned)         gameState._jgAltaverdeWarned= d.jgAltaverdeWarned;"""

NEW = """    // A saved `false` is a value, not an absence. The truthy guards that were here skipped the
    // restore whenever the save recorded false, leaving the CURRENT session's flag in place — so
    // loading an indebted save after clearing the Bond kept _jgDebtFree true, producing a state
    // that owes money and is simultaneously debt-free, and permanently suppressing
    // _checkBondForeclosure (it returns early on _jgDebtFree).
    // Assign unconditionally, as postEnding and inJungle already are above; `|| false` also gives
    // saves that predate these fields a deterministic default instead of inheriting the session.
    gameState._jgDebtFree        = d.jgDebtFree        || false;
    gameState._jgAltaverdeWarned = d.jgAltaverdeWarned || false;"""

if s.count(OLD) != 1:
    print(f"ABORT: expected exactly 1 occurrence, found {s.count(OLD)}")
    sys.exit(1)

p.write_text(s.replace(OLD, NEW), encoding="utf-8")
print("patched: 2 truthy-guarded restores -> unconditional assignment")
