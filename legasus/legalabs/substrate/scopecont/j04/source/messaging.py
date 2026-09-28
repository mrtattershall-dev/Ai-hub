# Messaging.

PREFIX = "msg"


def send(channel, msg):
    return str(channel) + ":" + str(msg)


def label():
    return PREFIX
