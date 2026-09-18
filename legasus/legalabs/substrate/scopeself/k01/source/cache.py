class Cache:
    def __init__(self):
        self._store = {}

    def get(self, key):
        if key in self._store:
            return self._store[key]
        return None
