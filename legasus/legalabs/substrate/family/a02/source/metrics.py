class Metrics:
    def __init__(self):
        self._daily = {}

    def record_day(self, day, n):
        self._daily[day] = self._daily.get(day, 0) + n

    def day_total(self, day):
        return self._daily.get(day, 0)

    def busiest_day(self):
        if not self._daily:
            return None
        return max(sorted(self._daily), key=lambda d: self._daily[d])
