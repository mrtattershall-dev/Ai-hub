import notify
assert notify.valid_channels(["push"]), "the new channel must be admitted"
assert notify.send("push", "hi") == "push: hi", notify.send("push", "hi")
assert notify.send("email", "hi") == "email: hi", "existing channels unchanged"
print("OK")
