class Store:
    def __init__(self):
        self.data = {}

    def set(self, key, value):
        self.data[key] = value

    def get(self, key, default=None):
        return self.data.get(key, default)

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
    assert store.delete("key1") == True
    assert store.delete("key2") == False
    store.set("key3", "value3")
    store.set("key4", "value4")
    assert store.keys() == ["key3", "key4"]
    print("All tests passed.")
