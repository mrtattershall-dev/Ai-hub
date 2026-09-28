class Stack:
    def __init__(self):
        self._items = []
        self._marks = []

    def push(self, v):
        self._items.append(v)

    def pop(self):
        return self._items.pop()

    def peek(self):
        return self._items[-1] if self._items else None

    def size(self):
        return len(self._items)

    def snapshot(self):
        self._marks.append(list(self._items))

    def undo(self):
        if self._marks:
            self._items = self._marks.pop()
