import unittest
from r5_store import Store

class TestStore(unittest.TestCase):
    def setUp(self):
        self.store = Store()

    def test_incr_existing_key(self):
        self.store.set("key1", 10)
        new_value = self.store.incr("key1", 5)
        self.assertEqual(new_value, 15)
        self.assertEqual(self.store.get("key1"), 15)

    def test_incr_missing_key(self):
        new_value = self.store.incr("key2", 3)
        self.assertEqual(new_value, 3)
        self.assertEqual(self.store.get("key2"), 3)

    def test_incr_non_int_value(self):
        self.store.set("key3", "value3")
        with self.assertRaises(TypeError):
            self.store.incr("key3", 1)

    def test_incr_with_transaction(self):
        self.store.begin()
        self.store.incr("key4", 2)
        self.store.rollback()
        self.assertEqual(self.store.get("key4"), None)

if __name__ == "__main__":
    unittest.main()
def test_set_with_max_keys(self):
    store = Store(max_keys=2)
    store.set("key1", "value1")
    store.set("key2", "value2")
    with pytest.raises(OverflowError):
        store.set("key3", "value3")
    assert store.get("key1") == "value1"
    assert store.get("key2") == "value2"
    assert store.get("key3") is None
