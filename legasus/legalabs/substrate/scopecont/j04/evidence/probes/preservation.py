import messaging
assert messaging.PREFIX == "msg"
assert messaging.send("a", "b") == "a:b", messaging.send("a", "b")
assert messaging.label() == "msg"
print("OK")
