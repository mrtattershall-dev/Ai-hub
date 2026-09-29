import time

class TokenBucket:
    def __init__(self, capacity, refill_per_sec, now=time.monotonic):
        self.capacity = capacity
        self.tokens = capacity
        self.refill_per_sec = refill_per_sec
        self.last_refill = now()
        print(f"Initial tokens: {self.tokens}")
        print(f"Initial last_refill: {self.last_refill}")
    
    def allow(self, cost=1):
        # Calculate how many tokens to add since last refill
        current_time = time.monotonic()
        print(f"Current time: {current_time}")
        print(f"Last refill: {self.last_refill}")
        time_passed = current_time - self.last_refill
        print(f"Time passed: {time_passed}")
        tokens_to_add = time_passed * self.refill_per_sec
        print(f"Tokens to add: {tokens_to_add}")
        
        # Refill tokens up to capacity
        if tokens_to_add > 0:
            self.tokens = min(self.capacity, self.tokens + tokens_to_add)
            self.last_refill = current_time
            print(f"Refilled tokens: {self.tokens}")
        
        # Check if we have enough tokens
        print(f"Available tokens before check: {self.tokens}")
        if self.tokens >= cost:
            self.tokens -= cost
            print(f"Tokens after spending {cost}: {self.tokens}")
            return True
        else:
            print("Not enough tokens")
            return False

# Test it
bucket = TokenBucket(10, 2)
result = bucket.allow()
print(f"First allow() result: {result}")