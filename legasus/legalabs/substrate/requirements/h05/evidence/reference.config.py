# Config assembly.

CONFIG = {"a": 1}


def _extra():
    return {"b": 2}


def get(k):
    return CONFIG.get(k)


def _more():
    return {"c": 3}


def names():
    return sorted(CONFIG)


CONFIG.update(_extra())
CONFIG.update(_more())
