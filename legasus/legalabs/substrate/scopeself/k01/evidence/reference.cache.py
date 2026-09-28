class Cache:
    def __init__(self):
        self._store = {}
        self._defaults = {}

    def get(self, key):
        if key in self._store:
            return self._store[key]
        if key in self._defaults:
            return self._defaults[key]
        return None
