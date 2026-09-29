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

    def wait_time(self, cost=1):
        """Return how many seconds to wait until allow(cost) would succeed.
        
        Args:
            cost: The number of tokens to check for (default 1)
            
        Returns:
            float: Seconds to wait (0.0 if allow would succeed now)
            
        Raises:
            ValueError: If cost is larger than capacity
        """
        if cost > self.capacity:
            raise ValueError("Cost cannot exceed capacity")
            
        # Calculate current tokens (refill if needed)
        current_time = time.monotonic()
        time_passed = current_time - self.last_refill
        tokens_to_add = time_passed * self.refill_per_sec
        
        current_tokens = self.tokens if tokens_to_add == 0 else min(self.capacity, self.tokens + tokens_to_add)
        
        # If we have enough tokens, no wait needed
        if current_tokens >= cost:
            return 0.0
            
        # Calculate how long until we have enough tokens
        # We need (cost - current_tokens) more tokens
        # At refill_per_sec rate, this takes (cost - current_tokens) / refill_per_sec seconds
        needed_tokens = cost - current_tokens
        wait_seconds = needed_tokens / self.refill_per_sec
        
        return wait_seconds

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

class SlidingWindow:
    def __init__(self, limit, window_sec, now=time.monotonic):
        self.limit = limit
        self.window_sec = window_sec
        self.now = now
        self.calls = []
    
    def allow(self):
        current_time = self.now()
        # Remove calls that are outside the window
        self.calls = [call_time for call_time in self.calls if call_time > current_time - self.window_sec]
        # If we haven't exceeded the limit, allow this call
        if len(self.calls) < self.limit:
            self.calls.append(current_time)
            return True
        else:
            return False
class KeyedLimiter:
    def __init__(self, factory):
        self.factory = factory
        self.limiters = {}
    
    def allow(self, key):
        if key not in self.limiters:
            self.limiters[key] = self.factory()
        return self.limiters[key].allow()
    
    def keys(self):
        return sorted(self.limiters.keys())
    
    def reset(self, key):
        if key in self.limiters:
            del self.limiters[key]
