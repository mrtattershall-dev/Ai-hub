import time

class TokenBucket:
    def __init__(self, capacity, refill_per_sec, now=time.monotonic):
        self.capacity = capacity
        self.tokens = capacity
        self.refill_per_sec = refill_per_sec
        self.last_refill = now()
    
    def allow(self, cost=1):
        # Calculate how many tokens to add since last refill
        current_time = time.monotonic()
        time_passed = current_time - self.last_refill
        tokens_to_add = time_passed * self.refill_per_sec
        
        # Refill tokens up to capacity
        if tokens_to_add > 0:
            self.tokens = min(self.capacity, self.tokens + tokens_to_add)
            self.last_refill = current_time
        
        # Check if we have enough tokens
        if self.tokens >= cost:
            self.tokens -= cost
            return True
        else:
            return False

    def tokens(self):
        # Refill tokens up to capacity and return current count
        current_time = time.monotonic()
        time_passed = current_time - self.last_refill
        tokens_to_add = time_passed * self.refill_per_sec
        
        if tokens_to_add > 0:
            self.tokens = min(self.capacity, self.tokens + tokens_to_add)
            self.last_refill = current_time
        
        return self.tokens

if __name__ == "__main__":
    # Test cases
    bucket = TokenBucket(10, 2)  # capacity 10, refill 2/sec
    
    # Should allow first token
    assert bucket.allow() == True
    # Should allow second token
    assert bucket.allow() == True
    # Should allow 8 more tokens (10 total)
    for i in range(8):
        assert bucket.allow() == True
    # Should not allow more tokens (bucket is empty)
    assert bucket.allow() == False
    # Wait a bit and refill some tokens
    time.sleep(1)
    # Should allow 2 tokens (2 refilled)
    assert bucket.allow(2) == True
    # Should not allow 3 tokens (only 2 available)
    assert bucket.allow(3) == False
    # Should allow 1 token (1 available)
    assert bucket.allow() == True
    print("All tests passed!")