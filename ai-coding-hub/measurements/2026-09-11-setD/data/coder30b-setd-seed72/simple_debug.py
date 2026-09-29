from r5_store import Store

def debug_test():
    print("Debug test...")
    store = Store()
    store.set("test_key", "initial_value")
    print(f"After initial set: {store.get('test_key')}")
    
    # Test nested transactions
    store.begin()
    print(f"After begin(): {store.get('test_key')}")
    store.set("test_key", "outer_value")
    print(f"After outer set: {store.get('test_key')}")
    
    store.begin()  # This should create a nested transaction
    print(f"After nested begin(): {store.get('test_key')}")
    store.set("test_key", "inner_value")
    print(f"After inner set: {store.get('test_key')}")
    
    print(f"Transaction stack size: {len(store._transactions)}")
    print(f"Transaction data: {store._transactions}")

if __name__ == "__main__":
    debug_test()