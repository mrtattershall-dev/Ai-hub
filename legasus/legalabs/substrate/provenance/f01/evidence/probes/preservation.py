import notify
assert notify.valid_channels(["email", "sms"])
assert not notify.valid_channels(["carrier"])
assert notify.send("email", "hi") == "email: hi", notify.send("email", "hi")
assert notify.send("sms", "hi") == "sms: hi"
assert notify.send("carrier", "hi") == "dropped"
print("OK")
