import time

class TokenBucket:
    def __init__(self, capacity, refill_per_sec, now=time.monotonic):
        self.capacity = capacity
        self.tokens = capacity
        self.refill_per_sec = refill_per_sec
        self.last_refill = now()
        print(f"DEBUG INIT: capacity={capacity}, tokens={self.tokens}, last_refill={self.last_refill}")
    
    def allow(self, cost=1):
        print(f"DEBUG ALLOW: cost={cost}")
        print(f"DEBUG ALLOW: tokens before={self.tokens}")
        print(f"DEBUG ALLOW: last_refill={self.last_refill}")
        
        # Calculate how many tokens to add since last refill
        current_time = time.monotonic()
        print(f"DEBUG ALLOW: current_time={current_time}")
        time_passed = current_time - self.last_refill
        print(f"DEBUG ALLOW: time_passed={time_passed}")
        tokens_to_add = time_passed * self.refill_per_sec
        print(f"DEBUG ALLOW: tokens_to_add={tokens_to_add}")
        
        # Refill tokens up to capacity
        if tokens_to_add > 0:
            old_tokens = self.tokens
            self.tokens = min(self.capacity, self.tokens + tokens_to_add)
            self.last_refill = current_time
            print(f"DEBUG ALLOW: refilled from {old_tokens} to {self.tokens}")
        else:
            print("DEBUG ALLOW: no tokens to add")
        
        # Check if we have enough tokens
        print(f"DEBUG ALLOW: available tokens={self.tokens}")
        if self.tokens >= cost:
            self.tokens -= cost
            print(f"DEBUG ALLOW: spent {cost}, remaining={self.tokens}")
            return True
        else:
            print(f"DEBUG ALLOW: not enough tokens (need {cost}, have {self.tokens})")
            return False

# Test the exact scenario
print("Creating bucket...")
bucket = TokenBucket(10, 2)  # capacity 10, refill 2/sec

print("\nCalling allow()...")
result = bucket.allow()
print(f"Result: {result}")
print(f"Expected: True")