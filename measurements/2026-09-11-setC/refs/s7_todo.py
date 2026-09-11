# Reference solution (final state of chain 7) - used only to prove checks-C.mjs can pass.
import json
from datetime import date


class TodoList:
    def __init__(self):
        self._items = {}
        self._next = 1

    def add(self, title, priority=0, due=None):
        if due is not None:
            if not isinstance(due, str):
                raise ValueError("due must be an ISO date string")
            date.fromisoformat(due)
        item_id = self._next
        self._next += 1
        self._items[item_id] = {"id": item_id, "title": title, "done": False, "priority": priority, "due": due}
        return item_id

    def done(self, item_id):
        if item_id not in self._items:
            raise KeyError(item_id)
        self._items[item_id]["done"] = True

    def remove(self, item_id):
        if item_id not in self._items:
            raise KeyError(item_id)
        del self._items[item_id]

    def pending(self):
        items = [x for x in self._items.values() if not x["done"]]
        items.sort(key=lambda x: (-x["priority"], x["id"]))
        return [x["title"] for x in items]

    def overdue(self, today):
        t = date.fromisoformat(today)
        items = sorted(self._items.values(), key=lambda x: x["id"])
        return [x["title"] for x in items if not x["done"] and x["due"] and date.fromisoformat(x["due"]) < t]

    def save(self, path):
        with open(path, "w", encoding="utf-8") as f:
            json.dump({"next": self._next, "items": list(self._items.values())}, f)

    @classmethod
    def load(cls, path):
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        t = cls()
        t._next = data["next"]
        for x in data["items"]:
            t._items[x["id"]] = x
        return t
