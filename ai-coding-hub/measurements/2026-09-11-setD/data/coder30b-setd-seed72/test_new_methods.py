import sys
sys.path.append('.')
from r5_store import Store

# Test the new methods
store = Store()

# Set some test data
store.set("apple", "red")
store.set("apricot", "orange")
store.set("banana", "yellow")
store.set("cherry", "red", ttl=1)  # This will expire

# Test count_prefix
print("Testing count_prefix:")
print(f"count_prefix('ap'): {store.count_prefix('ap')}")  # Should be 2
print(f"count_prefix('b'): {store.count_prefix('b')}")   # Should be 1
print(f"count_prefix('c'): {store.count_prefix('c')}")   # Should be 1 (but expired)
print(f"count_prefix('z'): {store.count_prefix('z')}")   # Should be 0

# Test items
print("\nTesting items:")
print(f"items('ap'): {store.items('ap')}")  # Should be [('apricot', 'orange'), ('apple', 'red')]
print(f"items('b'): {store.items('b')}")   # Should be [('banana', 'yellow')]
print(f"items('c'): {store.items('c')}")   # Should be [] (expired key not included)
print(f"items(): {store.items()}")         # Should be all non-expired keys

# Wait for expiration
import time
time.sleep(1.1)

# Test after expiration
print("\nAfter expiration:")
print(f"count_prefix('c'): {store.count_prefix('c')}")  # Should be 0
print(f"items('c'): {store.items('c')}")   # Should be []

print("Test completed successfully!")