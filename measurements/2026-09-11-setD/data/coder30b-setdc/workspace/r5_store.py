import time
import json

class Store:
    def __init__(self, now=None, max_keys=None):
        self._data = {}
        self._transactions = []
        self._now = now or time.time
        self._max_keys = max_keys
        # Stats counters
        self._stats = {
            "keys": 0,
            "sets": 0,
            "gets": 0,
            "hits": 0
        }
    
    def begin(self):
        # Always push a new transaction layer
        # This handles both first transaction and nested transactions
        if self._transactions:
            # For nested transactions, copy the top transaction
            self._transactions.append(dict(self._transactions[-1]))
        else:
            # For the first transaction, copy the main data
            self._transactions.append(dict(self._data))
    
    def commit(self):
        if not self._transactions:
            raise RuntimeError("No transaction in progress")
        
        # Pop the current transaction
        # If there's a parent transaction, merge changes into it
        # If this is the outermost transaction, apply changes to main data
        current_transaction = self._transactions.pop()
        
        # If there's still a parent transaction, merge the changes into it
        if self._transactions:
            parent_transaction = self._transactions[-1]
            # Merge the current transaction's changes into the parent
            for key, value in current_transaction.items():
                parent_transaction[key] = value
        else:
            # This was the outermost transaction, apply changes to main data
            self._data = current_transaction
    
    def rollback(self):
        if not self._transactions:
            raise RuntimeError("No transaction in progress")
        
        # Restore the previous state (or initial state if this was the first transaction)
        # When we rollback, we want to restore the state that was active before this transaction started
        # This means we pop the current transaction and restore the previous one
        self._transactions.pop()
    
    def _count_live_keys(self):
        """Count the number of live keys in the store."""
        live_keys = set()
        now = self._now()
        
        # Check main data
        for k, item in self._data.items():
            v, set_time, t = item
            if t is None or now < set_time + t:
                live_keys.add(k)
        
        # Check transaction data
        for transaction in self._transactions:
            for k, item in transaction.items():
                v, set_time, t = item
                if t is None or now < set_time + t:
                    live_keys.add(k)
        
        # Update the keys counter to match the current live key count
        self._stats["keys"] = len(live_keys)
        
        return len(live_keys)
    
    def set(self, key, value, ttl=None):
        # If we're in a transaction, modify the transaction data
        # Otherwise, modify the main data
        if self._transactions:
            # Check if this is a new key (not already in the transaction or main data)
            is_new_key = key not in self._transactions[-1] and key not in self._data
            if is_new_key and self._max_keys is not None:
                # Count current live keys
                live_key_count = self._count_live_keys()
                
                # If we're at max capacity, raise OverflowError
                if live_key_count >= self._max_keys:
                    raise OverflowError("Store is at maximum capacity")
            
            self._transactions[-1][key] = (value, self._now(), ttl)
        else:
            # Check if this is a new key (not already in the main data)
            is_new_key = key not in self._data
            if is_new_key and self._max_keys is not None:
                # Count current live keys
                live_key_count = self._count_live_keys()
                
                # If we're at max capacity, raise OverflowError
                if live_key_count >= self._max_keys:
                    raise OverflowError("Store is at maximum capacity")
            
            self._data[key] = (value, self._now(), ttl)
        
        # Increment sets counter
        self._stats["sets"] += 1
        
        # Update keys counter if this is a new key
        if is_new_key:
            self._stats["keys"] += 1
    
    def get(self, key, default=None):
        # Increment gets counter
        self._stats["gets"] += 1
        
        # If we're in a transaction, get from the transaction data
        # Otherwise, get from the main data
        if self._transactions:
            item = self._transactions[-1].get(key, None)
        else:
            item = self._data.get(key, None)
        
        if item is None:
            return default
        
        value, set_time, ttl = item
        if ttl is not None:
            if self._now() >= set_time + ttl:
                # Key has expired, remove it
                if self._transactions:
                    self._transactions[-1].pop(key, None)
                else:
                    self._data.pop(key, None)
                return default
        
        # Increment hits counter if we found a live key
        self._stats["hits"] += 1
        return value

    def incr(self, key, by=1):
        # Get current value or default to 0 if key doesn't exist
        current_value = self.get(key, 0)
        
        # Validate that current value is an integer
        if not isinstance(current_value, int):
            raise TypeError("Current value is not an integer")
        
        # Validate that increment is an integer
        if not isinstance(by, int):
            raise TypeError("Increment must be an integer")
        
        # Calculate new value
        new_value = current_value + by
        
        # Set the new value
        self.set(key, new_value)
        
        # Return the new value
        return new_value

    def keys(self):
        # Return keys that haven't expired
        current_keys = set()
        
        now = self._now()
        
        # Check main data
        for key, item in self._data.items():
            value, set_time, ttl = item
            if ttl is None or now < set_time + ttl:
                current_keys.add(key)
        
        # Check transaction data
        for transaction in self._transactions:
            for key, item in transaction.items():
                value, set_time, ttl = item
                if ttl is None or now < set_time + ttl:
                    current_keys.add(key)
        
        return list(current_keys)
    
    def count_prefix(self, prefix):
        """Return the number of live keys starting with prefix."""
        count = 0
        now = self._now()
        
        # Check main data
        for key, item in self._data.items():
            if key.startswith(prefix):
                value, set_time, ttl = item
                if ttl is None or now < set_time + ttl:
                    count += 1
        
        # Check transaction data
        for transaction in self._transactions:
            for key, item in transaction.items():
                if key.startswith(prefix):
                    value, set_time, ttl = item
                    if ttl is None or now < set_time + ttl:
                        count += 1
        
        return count
    
    def items(self, prefix=""):
        """Return a sorted list of (key, value) pairs for live keys starting with prefix."""
        result = []
        now = self._now()
        
        # Check main data
        for key, item in self._data.items():
            if key.startswith(prefix):
                value, set_time, ttl = item
                if ttl is None or now < set_time + ttl:
                    result.append((key, value))
        
        # Check transaction data
        for transaction in self._transactions:
            for key, item in transaction.items():
                if key.startswith(prefix):
                    value, set_time, ttl = item
                    if ttl is None or now < set_time + ttl:
                        result.append((key, value))
        
        # Sort by key
        result.sort(key=lambda x: x[0])
        return result

    def save(self, path):
        """Save the store data to a JSON file. Raises RuntimeError if a transaction is open."""
        if self._transactions:
            raise RuntimeError("Cannot save while a transaction is open")
        
        # Prepare data for serialization
        # We need to serialize the data in a way that preserves the structure
        # and handles expired keys properly
        data_to_save = {}
        now = self._now()
        
        # Process main data
        for key, item in self._data.items():
            value, set_time, ttl = item
            # Only save non-expired keys
            if ttl is None or now < set_time + ttl:
                data_to_save[key] = {
                    'value': value,
                    'set_time': set_time,
                    'ttl': ttl
                }
        
        # Process transaction data (if any) - but we already checked for open transactions
        # So this should be empty, but just in case, we'll process it anyway
        
        # Write to file
        with open(path, 'w') as f:
            json.dump(data_to_save, f)

    def stats(self):
        """Return statistics about the store.
        
        Returns:
            dict: A dictionary with the following keys:
                - "keys": number of live keys
                - "sets": successful set() calls
                - "gets": get() calls
                - "hits": get() calls that found a live key
        """
        return self._stats.copy()

    @classmethod
    def load(cls, path, now=time.time):
        """Load store data from a JSON file."""
        # Create a new store instance
        store = cls(now=now)
        
        # Read from file
        with open(path, 'r') as f:
            data = json.load(f)
        
        # Restore data
        for key, item in data.items():
            value = item['value']
            set_time = item['set_time']
            ttl = item['ttl']
            store._data[key] = (value, set_time, ttl)
        
        return store
# Test the Store class with TTL functionality
if __name__ == "__main__":
    import time
    
    # Test basic functionality
    store = Store()
    
    # Test setting and getting values
    store.set("key1", "value1")
    assert store.get("key1") == "value1"
    assert store.get("key2", "default") == "default"
    
    # Test TTL functionality
    store.set("key2", "value2", ttl=1)
    assert store.get("key2") == "value2"
    
    # Wait for expiration
    time.sleep(1.1)
    assert store.get("key2", "default") == "default"
    
    # Test keys() method
    store.set("key3", "value3", ttl=1)
    store.set("key4", "value4")
    keys = store.keys()
    assert "key3" not in keys  # Should be expired
    assert "key4" in keys      # Should still be valid
    
    # Test transaction with TTL
    store.begin()
    store.set("key5", "value5", ttl=1)
    assert store.get("key5") == "value5"
    store.commit()
    
    # Test nested transactions
    store.begin()
    store.begin()
    store.set("key6", "value6", ttl=1)
    assert store.get("key6") == "value6"
    store.rollback()  # Rollback inner transaction
    assert store.get("key6") == "value6"  # Should still exist
    store.rollback()  # Rollback outer transaction
    assert store.get("key6") == "value6"  # Should still exist
    
    print("All Store TTL tests passed!")
    def __contains__(self, key):
        """Check if a key exists and is live in the store."""
        # Check main data
        if key in self._data:
            value, set_time, ttl = self._data[key]
            if ttl is None or self._now() < set_time + ttl:
                return True
        
        # Check transaction data
        for transaction in self._transactions:
            if key in transaction:
                value, set_time, ttl = transaction[key]
                if ttl is None or self._now() < set_time + ttl:
                    return True
        
        return False

    def __len__(self):
        """Return the number of live keys in the store."""
        return self._count_live_keys()
    def __contains__(self, key):
        """Check if a key exists and is live in the store."""
        # Check main data
        if key in self._data:
            value, set_time, ttl = self._data[key]
            if ttl is None or self._now() < set_time + ttl:
                return True
        
        # Check transaction data
        for transaction in self._transactions:
            if key in transaction:
                value, set_time, ttl = transaction[key]
                if ttl is None or self._now() < set_time + ttl:
                    return True
        
        return False

    def __len__(self):
        """Return the number of live keys in the store."""
        return self._count_live_keys()
