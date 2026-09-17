class Tally:
    def __init__(self):
        self._counts = {}

    def add(self, key):
        self._counts[key] = self._counts.get(key, 0) + 1

    def count(self, key):
        return self._counts.get(key, 0)

    def total(self):
        return sum(self._counts.values())
