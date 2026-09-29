import time

class Store:
    def __init__(self, now=time.time):
        self.data = {}
        self.now = now
        self.transaction_stack = []
def set(self, key, value, ttl=None):
    if self.max_keys is not None and key not in self.data and len(self.data) >= self.max_keys:
        raise OverflowError("Store is full")
    expiry = self.now() + ttl if ttl is not None else None
    self.data[key] = (value, expiry)
def get(self, key, default=None):
    value, expiry = self.data.get(key, (default, None))
    if expiry is not None and self.now() >= expiry:
        return default
    return value

    def delete(self, key):
        if key in self.data:
            del self.data[key]
            return True
        return False

    def keys(self):
        return sorted(self.data.keys())
if __name__ == "__main__":
    store = Store()
    store.set("key1", "value1")
    assert store.get("key1") == "value1"
    assert store.get("key2", "default") == "default"
    assert store.delete("key1") is True
    assert store.delete("key2") is False
    store.set("key3", "value3")
    store.set("key4", "value4")
    assert store.keys() == ["key3", "key4"]
    print("All tests passed.")
    def begin(self):
        self.transaction_stack.append(self.data.copy())
    def commit(self):
        if not self.transaction_stack:
            raise RuntimeError("No open transaction")
        self.transaction_stack = []
    def rollback(self):
        if not self.transaction_stack:
            raise RuntimeError("No open transaction")
        self.data = self.transaction_stack.pop()
    def count_prefix(self, prefix):
        return sum(1 for key in self.data if key.startswith(prefix))
    def items(self, prefix=""):
        return sorted((key, value) for key, value in self.data.items() if key.startswith(prefix))
    def set(self, key, value, ttl=None):
        expiry = self.now() + ttl if ttl is not None else None
        self.data[key] = (value, expiry)
    def set(self, key, value, ttl=None):
        expiry = self.now() + ttl if ttl is not None else None
        self.data[key] = (value, expiry)
    def set(self, key, value, ttl=None):
        expiry = self.now() + ttl if ttl is not None else None
        self.data[key] = (value, expiry)
import json
import time

class Store:
    def __init__(self, now=time.time):
        self.data = {}
        self.transactions = []
        self.now = now

    def set(self, key, value, ttl=None):
        if ttl is not None:
            expiry = self.now + ttl
        else:
            expiry = None
        self.data[key] = (value, expiry)

    def get(self, key, default=None):
        value, expiry = self.data.get(key, (default, None))
        if expiry is not None and self.now > expiry:
            return default
        return value

    def delete(self, key):
        if key in self.data:
            del self.data[key]

    def keys(self):
        return list(self.data.keys())

    def begin(self):
        self.transactions.append(self.data.copy())

    def commit(self):
        if self.transactions:
            self.transactions.pop()

    def rollback(self):
        if self.transactions:
            self.data = self.transactions.pop()

    def count_prefix(self, prefix):
        return sum(1 for key in self.data if key.startswith(prefix))

    def items(self, prefix=""):
        return {key: value for key, value in self.data.items() if key.startswith(prefix)}

    def save(self, path):
        if self.transactions:
            raise RuntimeError("Cannot save while a transaction is open")
        with open(path, 'w') as f:
            json.dump(self.data, f)

    def load(self, path, now=time.time):
        with open(path, 'r') as f:
            data = json.load(f)
        self.data = {key: (value, expiry) for key, (value, expiry) in data.items() if expiry is None or expiry > now}
        self.now = now
import json
import time

class Store:
    def __init__(self, now=time.time):
        self.data = {}
        self.transactions = []
        self.now = now

    def set(self, key, value, ttl=None):
        if ttl is not None:
            expiry = self.now + ttl
        else:
            expiry = None
        self.data[key] = (value, expiry)

    def get(self, key, default=None):
        value, expiry = self.data.get(key, (default, None))
        if expiry is not None and self.now > expiry:
            return default
        return value

    def delete(self, key):
        if key in self.data:
            del self.data[key]

    def keys(self):
        return list(self.data.keys())

    def begin(self):
        self.transactions.append(self.data.copy())

    def commit(self):
        if self.transactions:
            self.transactions.pop()

    def rollback(self):
        if self.transactions:
            self.data = self.transactions.pop()

    def count_prefix(self, prefix):
        return sum(1 for key in self.data if key.startswith(prefix))

    def items(self, prefix=""):
        return {key: value for key, value in self.data.items() if key.startswith(prefix)}

    def save(self, path):
        if self.transactions:
            raise RuntimeError("Cannot save while a transaction is open")
        with open(path, 'w') as f:
            json.dump(self.data, f)

    def load(self, path, now=time.time):
        with open(path, 'r') as f:
            data = json.load(f)
        self.data = {key: (value, expiry) for key, (value, expiry) in data.items() if expiry is None or expiry > now}
        self.now = now
    def incr(self, key, by=1):
        if not isinstance(by, int):
            raise TypeError("Increment value must be an integer")
        current_value = self.get(key, 0)
        new_value = current_value + by
        self.set(key, new_value)
        return new_value
class Store:
    def __init__(self, now=time.time):
        self.data = {}
        self.now = now
        self.transaction_stack = []
        self._keys = 0
        self._sets = 0
        self._gets = 0
        self._hits = 0

    def set(self, key, value, ttl=None):
        if self.max_keys is not None and key not in self.data and len(self.data) >= self.max_keys:
            raise OverflowError("Store is full")
        expiry = self.now() + ttl if ttl is not None else None
        self.data[key] = (value, expiry)
        self._sets += 1
        if key not in self.data:
            self._keys += 1

    def set(self, key, value, ttl=None):
        if self.max_keys is not None and key not in self.data and len(self.data) >= self.max_keys:
            raise OverflowError("Store is full")
        expiry = self.now() + ttl if ttl is not None else None
        self.data[key] = (value, expiry)
        self._sets += 1
        if key not in self.data:
            self._keys += 1

    def set(self, key, value, ttl=None):
        if self.max_keys is not None and key not in self.data and len(self.data) >= self.max_keys:
            raise OverflowError("Store is full")
        expiry = self.now() + ttl if ttl is not None else None
        self.data[key] = (value, expiry)
        self._sets += 1
        if key not in self.data:
            self._keys += 1

    def set(self, key, value, ttl=None):
        if self.max_keys is not None and key not in self.data and len(self.data) >= self.max_keys:
            raise OverflowError("Store is full")
        expiry = self.now() + ttl if ttl is not None else None
        self.data[key] = (value, expiry)
        self._sets += 1
        if key not in self.data:
            self._keys += 1

    def get(self, key, default=None):
        value, expiry = self.data.get(key, (default, None))
        if expiry is not None and self.now() >= expiry:
            return default
        self._gets += 1
        if value is not default:
            self._hits += 1
        return value

    def stats(self):
        return {
            "keys": self._keys,
            "sets": self._sets,
            "gets": self._gets,
            "hits": self._hits
        }
    def __contains__(self, key):
        return key in self.data
    def __len__(self):
        return len(self.data)
    def set(self, key, value, ttl=None):
        if self.max_keys is not None and key not in self.data and len(self.data) >= self.max_keys:
            raise OverflowError("Store is full")
        expiry = self.now() + ttl if ttl is not None else None
        self.data[key] = (value, expiry)
    def set(self, key, value, ttl=None):
        if self.max_keys is not None and key not in self.data and len(self.data) >= self.max_keys:
            raise OverflowError("Store is full")
        expiry = self.now() + ttl if ttl is not None else None
        self.data[key] = (value, expiry)
    def set(self, key, value, ttl=None):
        if self.max_keys is not None and key not in self.data and len(self.data) >= self.max_keys:
            raise OverflowError("Store is full")
        expiry = self.now() + ttl if ttl is not None else None
        self.data[key] = (value, expiry)
