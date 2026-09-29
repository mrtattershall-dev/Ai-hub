import time
import r5_store

# Test the Store class with TTL functionality
store = r5_store.Store()

# Test basic functionality
store.set("key1", "value1")
print("Set key1")
print("get key1:", store.get("key1"))
print("get key2 with default:", store.get("key2", "default"))

# Test TTL functionality
print("\nSetting key2 with ttl=1")
store.set("key2", "value2", ttl=1)
print("get key2:", store.get("key2"))

print("\nKeys before expiration:", store.keys())

# Wait for expiration
print("\nSleeping for 1.1 seconds...")
time.sleep(1.1)

print("get key2 after expiration:", store.get("key2", "default"))
print("Keys after expiration:", store.keys())

# Test the specific failing case
print("\nTesting keys() with expired key:")
store.set("key3", "value3", ttl=1)
print("Keys after setting key3:", store.keys())
print("key3 in keys:", "key3" in store.keys())

# Wait and check again
time.sleep(1.1)
print("Keys after expiration of key3:", store.keys())
print("key3 in keys:", "key3" in store.keys())