import texttools
assert texttools.shout("ab") == "AB!", texttools.shout("ab")
assert texttools.shout_twice("a") == "A!A!", texttools.shout_twice("a")
assert texttools.plain(" b ") == "b", "the existing helper must be unchanged"
print("OK")
