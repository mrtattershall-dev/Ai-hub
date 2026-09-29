#!/usr/bin/env python3

from r5_store import Store

def test_store_operators():
    # Create a store instance
    store = Store()
    
    # Test len() on empty store
    print(f"Empty store length: {len(store)}")
    assert len(store) == 0
    
    # Test 'in' operator on empty store
    print(f"'a' in empty store: {'a' in store}")
    assert 'a' not in store
    
    # Set a key
    store.set('a', 'value_a')
    print(f"After setting 'a': len={len(store)}, 'a' in store={ 'a' in store}")
    assert len(store) == 1
    assert 'a' in store
    
    # Set another key
    store.set('b', 'value_b')
    print(f"After setting 'b': len={len(store)}, 'b' in store={ 'b' in store}")
    assert len(store) == 2
    assert 'b' in store
    
    # Test with expired key
    store.set('c', 'value_c', ttl=0.1)  # Very short TTL
    print(f"After setting 'c' with TTL: len={len(store)}, 'c' in store={ 'c' in store}")
    assert len(store) == 3
    assert 'c' in store
    
    # Wait for key to expire
    import time
    time.sleep(0.2)
    
    # Check that expired key is no longer counted
    print(f"After expiration: len={len(store)}, 'c' in store={ 'c' in store}")
    assert len(store) == 2  # Should be 2 now (a and b)
    assert 'c' not in store  # Should not be in store anymore
    
    print("All tests passed!")

if __name__ == "__main__":
    test_store_operators()