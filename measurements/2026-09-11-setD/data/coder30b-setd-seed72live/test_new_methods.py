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

# Test incr method
print("\nTesting incr method:")

# Test basic increment
store.set("counter", 5)
result = store.incr("counter")
print(f"incr('counter') = {result}")  # Should be 6
assert result == 6

# Test increment with custom value
result = store.incr("counter", 3)
print(f"incr('counter', 3) = {result}")  # Should be 9
assert result == 9

# Test increment with missing key (should default to 0)
result = store.incr("new_counter")
print(f"incr('new_counter') = {result}")  # Should be 1
assert result == 1

# Test increment with missing key and custom value
result = store.incr("another_new", 5)
print(f"incr('another_new', 5) = {result}")  # Should be 5
assert result == 5

# Test type validation - should raise TypeError for non-integer current value
store.set("string_value", "not_a_number")
try:
    store.incr("string_value")
    assert False, "Should have raised TypeError"
except TypeError:
    print("Correctly raised TypeError for non-integer current value")

# Test type validation - should raise TypeError for non-integer increment
store.set("int_value", 10)
try:
    store.incr("int_value", "not_a_number")
    assert False, "Should have raised TypeError"
except TypeError:
    print("Correctly raised TypeError for non-integer increment")

# Test transaction support
store.begin()
store.incr("transaction_counter", 10)
result = store.incr("transaction_counter", 5)
print(f"incr in transaction = {result}")  # Should be 15
assert result == 15

# Rollback the transaction
store.rollback()
# Value should be back to 10
assert store.get("transaction_counter") == 10
print("Transaction rollback test passed")

print("\nAll incr tests passed!")
print("Test completed successfully!")