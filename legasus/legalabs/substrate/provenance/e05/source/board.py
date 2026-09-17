class Board:
    def __init__(self):
        self._pins = []

    def pin(self, item):
        self._pins.append(item)

    def unpin(self, item):
        if item in self._pins:
            self._pins.remove(item)

    def pin_count(self):
        return len(self._pins)

    def pin_report(self):
        return ", ".join(str(p) for p in self._pins)
