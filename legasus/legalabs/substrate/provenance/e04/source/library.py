class Library:
    def __init__(self):
        self._borrowed = {}

    def borrow(self, title, n):
        self._borrowed[title] = self._borrowed.get(title, 0) + n

    def borrowed_count(self, title):
        return self._borrowed.get(title, 0)

    def total_borrowed(self):
        return sum(self._borrowed.values())
