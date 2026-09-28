class Roster:
    def __init__(self):
        self._active = []

    def join(self, name):
        if name not in self._active:
            self._active.append(name)

    def active_count(self):
        return len(self._active)

    def is_active(self, name):
        return name in self._active
