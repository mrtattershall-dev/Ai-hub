import time
class TokenBucket:
    def __init__(self, capacity, refill_per_sec, now=time.monotonic):
        if capacity <= 0:
            raise ValueError("capacity must be a positive number")
        if refill_per_sec <= 0:
            raise ValueError("refill_per_sec must be a positive number")
        self.capacity = capacity
        self.refill_per_sec = refill_per_sec
        self.tokens = capacity
        self.last_refill = now

    def allow(self, cost=1):
        now = time.monotonic()
        time_passed = now - self.last_refill
        self.tokens += time_passed * self.refill_per_sec
        self.tokens = min(self.tokens, self.capacity)
        self.last_refill = now
        return self.tokens >= cost

    def wait_time(self, cost=1):
        if cost > self.capacity:
            raise ValueError("Cost larger than capacity")
        if self.tokens >= cost:
            return 0.0
        needed_tokens = cost - self.tokens
        return needed_tokens / self.refill_per_sec

    def tokens(self):
        now = time.monotonic()
        time_passed = now - self.last_refill
        self.tokens += time_passed * self.refill_per_sec
        self.tokens = min(self.tokens, self.capacity)
        return self.tokens
        now = time.monotonic()
        time_passed = now - self.last_refill
        self.tokens += time_passed * self.refill_per_sec
        self.tokens = min(self.tokens, self.capacity)
        self.last_refill = now
        print(f"Tokens before: {self.tokens}, Cost: {cost}")
        if self.tokens >= cost:
            self.tokens -= cost
            print(f"Tokens after: {self.tokens}")
            return True
        print(f"Not enough tokens: {self.tokens}")
        return False

if __name__ == "__main__":
    import time

    # Test case 1: Basic functionality
    bucket = TokenBucket(5, 1, time.monotonic())
    assert bucket.allow(3) == True
    assert bucket.allow(2) == False
    time.sleep(1)
    assert bucket.allow(2) == True

    # Test case 2: Refill to capacity
    bucket = TokenBucket(5, 5, time.monotonic())
    assert bucket.allow(5) == True
    assert bucket.allow(1) == False
    time.sleep(1)
    assert bucket.allow(5) == True

    # Test case 3: Allow zero cost
    bucket = TokenBucket(5, 1, time.monotonic())
    assert bucket.allow(0) == True
    assert bucket.tokens == 5

    # Test case 4: Negative cost
    bucket = TokenBucket(5, 1, time.monotonic())
    assert bucket.allow(-1) == False
    assert bucket.tokens == 5

    print("All tests passed!")
class SlidingWindow:
    def __init__(self, limit, window_sec, now=time.monotonic):
        if not isinstance(limit, int) or limit <= 0:
            raise ValueError("limit must be a positive integer")
        if window_sec <= 0:
            raise ValueError("window_sec must be a positive number")
        self.limit = limit
        self.window_sec = window_sec
        self.call_times = []
        self.now = now

    def allow(self):
        now = time.monotonic()
        self.call_times = [t for t in self.call_times if now - t <= self.window_sec]
        if len(self.call_times) < self.limit:
            self.call_times.append(now)
            return True
        return False
class KeyedLimiter:
    def __init__(self, factory):
        self.factory = factory
        self.limiters = {}

    def allow(self, key, cost=1):
        if key not in self.limiters:
            self.limiters[key] = self.factory()
        return self.limiters[key].allow(cost)

    def keys(self):
        return sorted(self.limiters.keys())

    def reset(self, key):
        if key in self.limiters:
            del self.limiters[key]
def test_KeyedLimiter():
    factory = lambda: TokenBucket(10, 1)
    limiter = KeyedLimiter(factory)

    # Test with a new key
    assert limiter.allow('key1')
    assert not limiter.allow('key1')

    # Test with a different key
    assert limiter.allow('key2')
    assert not limiter.allow('key2')

    # Test keys method
    assert limiter.keys() == ['key1', 'key2']

    print("All tests passed.")

if __name__ == "__main__":
    test_KeyedLimiter()
    def stats(self):
        return {key: {"allowed": limiter.allow(0), "denied": limiter.tokens()} for key, limiter in self.limiters.items()}
    def test_KeyedLimiter():
        factory = lambda: TokenBucket(10, 1)
        limiter = KeyedLimiter(factory)
        
        limiter.allow("key1")
        limiter.allow("key2")
        limiter.allow("key1")
        
        stats = limiter.stats()
        assert stats == {"key1": {"allowed": 2, "denied": 0}, "key2": {"allowed": 1, "denied": 0}}
        
        print("All tests passed.")
class RateLimited(Exception):
    pass
def limited(limiter):
    def decorator(func):
        def wrapper(*args, **kwargs):
            if not limiter.allow():
                raise RateLimited("Function call rate exceeded")
            return func(*args, **kwargs)
        return wrapper
    return decorator
class Limiter:
    def __init__(self, max_calls, period):
        self.max_calls = max_calls
        self.period = period
        self.calls = 0
        self.start_time = time.time()

    def allow(self):
        current_time = time.time()
        if current_time - self.start_time > self.period:
            self.calls = 0
            self.start_time = current_time
        if self.calls < self.max_calls:
            self.calls += 1
            return True
        return False

def test_limiter():
    limiter = Limiter(3, 1)
    for i in range(5):
        try:
            result = limited(limiter)(lambda: "Allowed")(i)
            print(f"Call {i}: {result}")
        except RateLimited as e:
            print(f"Call {i}: {e}")

if __name__ == "__main__":
    test_limiter()
