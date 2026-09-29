import r5_store
import time

# Test the exact scenario from the failing test
print("Creating store with max_keys=1")
store_ttl = r5_store.Store(max_keys=1)
print(f"Store created: {store_ttl}")
print(f"Store data: {store_ttl._data}")
print(f"Store transactions: {store_ttl._transactions}")

print("\nSetting key1 with ttl=0.1")
store_ttl.set("key1", "value1", ttl=0.1)
print(f"Store data after key1: {store_ttl._data}")
print(f"Store transactions: {store_ttl._transactions}")

print("\nSetting key2 (should work since key1 is expired)")
try:
    store_ttl.set("key2", "value2")
    print("Success: key2 set")
    print(f"Store data after key2: {store_ttl._data}")
except Exception as e:
    print(f"Error: {e}")
    print(f"Store data after error: {store_ttl._data}")