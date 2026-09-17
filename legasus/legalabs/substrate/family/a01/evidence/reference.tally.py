class Tally:
    def __init__(self):
        self._counts = {}
        self._weights = {}

    def add(self, key):
        self._counts[key] = self._counts.get(key, 0) + 1

    def count(self, key):
        return self._counts.get(key, 0)

    def total(self):
        return sum(self._counts.values())

    def add_weighted(self, key, amount):
        self._weights[key] = self._weights.get(key, 0) + amount

    def weighted_count(self, key):
        return self._weights.get(key, 0)

    def weighted_total(self):
        return sum(self._weights.values())
