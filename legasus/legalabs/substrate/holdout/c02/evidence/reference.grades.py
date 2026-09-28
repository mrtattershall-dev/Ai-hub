class Grades:
    def __init__(self):
        self._scores = {}
        self._attempts = {}

    def record(self, student, score):
        self._scores[student] = self._scores.get(student, 0) + score

    def score_of(self, student):
        return self._scores.get(student, 0)

    def record_attempt(self, student, n):
        self._attempts[student] = self._attempts.get(student, 0) + n

    def attempts_of(self, student):
        return self._attempts.get(student, 0)

    def best(self):
        if not self._scores:
            return None
        return max(sorted(self._scores), key=lambda s: self._scores[s])

    def most_attempts(self):
        if not self._attempts:
            return None
        return max(sorted(self._attempts), key=lambda s: self._attempts[s])
