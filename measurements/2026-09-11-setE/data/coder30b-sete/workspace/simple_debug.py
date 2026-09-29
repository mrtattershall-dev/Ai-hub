import time

class TokenBucket:
    def __init__(self, capacity, refill_per_sec, now=time.monotonic):
        self.capacity = capacity
        self.tokens = capacity
        self.refill_per_sec = refill_per_sec
        self.last_refill = now()
        print(f"DEBUG: Initialized with tokens={self.tokens}, last_refill={self.last_refill}")
    
    def allow(self, cost=1):
        print(f"DEBUG: allow() called with cost={cost}")
        print(f"DEBUG: Current tokens before calculation: {self.tokens}")
        print(f"DEBUG: Last refill time: {self.last_refill}")
        
        # Calculate how many tokens to add since last refill
        current_time = time.monotonic()
        print(f"DEBUG: Current time: {current_time}")
        time_passed = current_time - self.last_refill
        print(f"DEBUG: Time passed: {time_passed}")
        tokens_to_add = time_passed * self.refill_per_sec
        print(f"DEBUG: Tokens to add: {tokens_to_add}")
        
        # Refill tokens up to capacity
        if tokens_to_add > 0:
            self.tokens = min(self.capacity, self.tokens + tokens_to_add)
            self.last_refill = current_time
            print(f"DEBUG: Refilled tokens to: {self.tokens}")
        
        # Check if we have enough tokens
        print(f"DEBUG: Available tokens before check: {self.tokens}")
        if self.tokens >= cost:
            self.tokens -= cost
            print(f"DEBUG: Spent {cost} tokens, remaining: {self.tokens}")
            return True
        else:
            print(f"DEBUG: Not enough tokens (need {cost}, have {self.tokens})")
            return False

# Test it step by step
print("Creating bucket...")
bucket = TokenBucket(10, 2)
print("Calling allow()...")
result = bucket.allow()
print(f"Result: {result}")