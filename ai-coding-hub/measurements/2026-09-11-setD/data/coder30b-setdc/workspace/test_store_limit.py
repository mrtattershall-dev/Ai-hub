import time
import r5_store

def test_store_limit():
    # Test with max_keys=2
    store = r5_store.Store(max_keys=2)
    
    # Add two keys - should work
    store.set("key1", "value1")
    store.set("key2", "value2")
    
    # Try to add a third key - should raise OverflowError
    try:
        store.set("key3", "value3")
        assert False, "Should have raised OverflowError"
    except OverflowError:
        pass  # Expected
    
    # Update existing key - should work
    store.set("key1", "updated_value1")
    assert store.get("key1") == "updated_value1"
    
    # Add another key after updating - should still raise OverflowError
    try:
        store.set("key4", "value4")
        assert False, "Should have raised OverflowError"
    except OverflowError:
        pass  # Expected
    
    # Test with None max_keys (unlimited)
    store_unlimited = r5_store.Store(max_keys=None)
    store_unlimited.set("key1", "value1")
    store_unlimited.set("key2", "value2")
    store_unlimited.set("key3", "value3")  # Should work with unlimited
    assert store_unlimited.get("key3") == "value3"
    
    # Test with no max_keys parameter (should be unlimited)
    store_default = r5_store.Store()
    store_default.set("key1", "value1")
    store_default.set("key2", "value2")
    store_default.set("key3", "value3")  # Should work with default
    assert store_default.get("key3") == "value3"
    
    # Test with TTL - expired keys should not count toward limit
    store_ttl = r5_store.Store(max_keys=1)
    store_ttl.set("key1", "value1", ttl=0.1)  # Expire quickly
    store_ttl.set("key2", "value2")  # This should work since key1 is expired
    
    # Wait for expiration
    time.sleep(0.2)
    
    # Now we should be able to add another key since the first expired
    store_ttl.set("key3", "value3")  # Should work now
    assert store_ttl.get("key3") == "value3"
    
    print("All tests passed!")

if __name__ == "__main__":
    test_store_limit()