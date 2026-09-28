class Grades:
    def __init__(self):
        self._scores = {}

    def record(self, student, score):
        self._scores[student] = self._scores.get(student, 0) + score

    def score_of(self, student):
        return self._scores.get(student, 0)

    def best(self):
        if not self._scores:
            return None
        return max(sorted(self._scores), key=lambda s: self._scores[s])
