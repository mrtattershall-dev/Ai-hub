import time
from r5_store import Store

# Test the Store class with TTL functionality
store = Store()

# Test setting and getting values
store.set("key1", "value1")
print("Set key1")
print("get key1:", store.get("key1"))
print("get key2 with default:", store.get("key2", "default"))

# Test TTL functionality
print("\nSetting key2 with ttl=1")
store.set("key2", "value2", ttl=1)
print("get key2:", store.get("key2"))

# Check keys before expiration
print("Keys before expiration:", store.keys())

# Wait for expiration
print("\nSleeping for 1.1 seconds...")
time.sleep(1.1)

print("get key2 after expiration:", store.get("key2", "default"))

# Check keys after expiration
print("Keys after expiration:", store.keys())

# Test keys() method with expired key
print("\nTesting keys() with expired key:")
store.set("key3", "value3", ttl=1)
print("Keys after setting key3:", store.keys())

# Wait for expiration
time.sleep(1.1)
print("Keys after expiration of key3:", store.keys())