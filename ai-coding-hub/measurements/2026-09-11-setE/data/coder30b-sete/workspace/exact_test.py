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

# Exact test from the problem
bucket = TokenBucket(10, 2)  # capacity 10, refill 2/sec

# Should allow first token
print("Testing first allow()...")
result = bucket.allow()
print(f"First allow() result: {result}")
print(f"Expected: True")
print(f"Match: {result == True}")

# Should allow second token
print("\nTesting second allow()...")
result2 = bucket.allow()
print(f"Second allow() result: {result2}")
print(f"Expected: True")
print(f"Match: {result2 == True}")