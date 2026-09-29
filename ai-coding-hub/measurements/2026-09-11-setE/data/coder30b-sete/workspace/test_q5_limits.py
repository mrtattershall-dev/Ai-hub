import time
import q5_limits

def test_sliding_window():
    # Test basic functionality
    window = q5_limits.SlidingWindow(3, 2)
    
    # First 3 calls should be allowed
    assert window.allow() == True
    assert window.allow() == True
    assert window.allow() == True
    
    # 4th call should be denied
    assert window.allow() == False
    
    # Wait for 1 second, should still be denied (still within window)
    time.sleep(1)
    assert window.allow() == False
    
    # Wait for another second (total 2 seconds), should allow a call
    time.sleep(1)
    assert window.allow() == True
    
    # Now we should be able to make 2 more calls
    assert window.allow() == True
    assert window.allow() == True
    
    # 4th call should be denied again
    assert window.allow() == False
    
    print("All SlidingWindow tests passed!")

if __name__ == "__main__":
    test_sliding_window()
def test_token_bucket_wait_time():
    # Test basic functionality
    bucket = q5_limits.TokenBucket(10, 2)  # capacity 10, refill 2/sec
    
    # Should allow first token immediately
    assert bucket.allow() == True
    assert bucket.wait_time() == 0.0
    
    # Should allow 9 more tokens (10 total)
    for i in range(9):
        assert bucket.allow() == True
    
    # Should not allow more tokens (bucket is empty)
    assert bucket.allow() == False
    # Should wait 0.5 seconds to get 1 token (2 tokens/sec, need 1)
    wait_time = bucket.wait_time()
    assert abs(wait_time - 0.5) < 0.001  # Allow small floating point tolerance
    
    # Should wait 1.0 seconds to get 2 tokens (2 tokens/sec, need 2)
    wait_time = bucket.wait_time(2)
    assert abs(wait_time - 1.0) < 0.001  # Allow small floating point tolerance
    
    # Test with cost larger than capacity (should raise ValueError)
    try:
        bucket.wait_time(15)
        assert False, "Should have raised ValueError"
    except ValueError:
        pass  # Expected
    
    # Test with cost equal to capacity (should wait 0 seconds when full)
    bucket2 = q5_limits.TokenBucket(10, 2)
    assert bucket2.wait_time(10) == 0.0
    
    # Test with cost larger than capacity (should raise ValueError)
    try:
        bucket2.wait_time(15)
        assert False, "Should have raised ValueError"
    except ValueError:
        pass  # Expected
    
    print("All TokenBucket wait_time tests passed!")

if __name__ == "__main__":
    test_sliding_window()
    test_token_bucket_wait_time()
def test_keyed_limiter():
    # Test basic KeyedLimiter functionality
    def factory():
        return q5_limits.TokenBucket(2, 1)  # capacity 2, refill 1/sec
    
    keyed_limiter = q5_limits.KeyedLimiter(factory)
    
    # Test allow with new key
    assert keyed_limiter.allow("user1") == True
    assert keyed_limiter.allow("user1") == True
    assert keyed_limiter.allow("user1") == False  # Bucket full
    
    # Test with different key
    assert keyed_limiter.allow("user2") == True
    assert keyed_limiter.allow("user2") == True
    assert keyed_limiter.allow("user2") == False  # Bucket full
    
    # Test keys() returns sorted keys
    keys = keyed_limiter.keys()
    assert keys == ["user1", "user2"]
    
    # Test reset method
    keyed_limiter.reset("user1")
    # After reset, user1 should be able to use bucket again
    assert keyed_limiter.allow("user1") == True
    assert keyed_limiter.allow("user1") == True
    assert keyed_limiter.allow("user1") == False  # Bucket full again
    
    # Test reset with unknown key (should not error)
    keyed_limiter.reset("unknown_key")
    
    print("All KeyedLimiter tests passed!")

if __name__ == "__main__":
    test_sliding_window()
    test_token_bucket_wait_time()
    test_keyed_limiter()
