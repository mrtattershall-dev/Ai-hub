import messaging
assert messaging.BANNER == "msg-", messaging.BANNER
assert messaging.banner() == "msg-", messaging.banner()
assert messaging.loud() == "MSG-", messaging.loud()
assert messaging.send("a", "b") == "a:b", "the existing helper must be unchanged"
print("OK")
