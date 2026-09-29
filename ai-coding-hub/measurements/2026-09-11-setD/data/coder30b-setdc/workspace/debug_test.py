#!/usr/bin/env python3

from r5_store import Store

def test_nested_transactions():
    """Test nested transaction behavior as specified in the goal."""
    print("Testing nested transactions...")
    
    store = Store()
    
    # Set initial value
    store.set("test_key", "initial_value")
    assert store.get("test_key") == "initial_value"
    
    # Start outer transaction
    store.begin()
    store.set("test_key", "outer_value")
    
    # Start inner transaction
    store.begin()
    store.set("test_key", "inner_value")
    
    # Check that inner value is visible
    assert store.get("test_key") == "inner_value"
    
    # Commit inner transaction - should propagate to outer
    store.commit()
    assert store.get("test_key") == "inner_value"
    
    # Rollback outer transaction - should undo inner changes
    store.rollback()
    assert store.get("test_key") == "initial_value"
    
    print("✓ Nested transaction test passed")

def test_commit_inner_then_outer():
    """Test committing inner transaction, then outer transaction."""
    print("Testing commit inner then outer...")
    
    store = Store()
    
    # Set initial value
    store.set("test_key", "initial_value")
    
    # Start outer transaction
    store.begin()
    store.set("test_key", "outer_value")
    
    # Start inner transaction
    store.begin()
    store.set("test_key", "inner_value")
    
    # Commit inner transaction
    store.commit()
    assert store.get("test_key") == "inner_value"
    
    # Commit outer transaction - should keep inner changes
    store.commit()
    assert store.get("test_key") == "inner_value"
    
    print("✓ Commit inner then outer test passed")

def test_rollback_inner_then_outer():
    """Test rolling back inner transaction, then outer transaction."""
    print("Testing rollback inner then outer...")
    
    store = Store()
    
    # Set initial value
    store.set("test_key", "initial_value")
    
    # Start outer transaction
    store.begin()
    store.set("test_key", "outer_value")
    
    # Start inner transaction
    store.begin()
    store.set("test_key", "inner_value")
    
    # Rollback inner transaction
    store.rollback()
    assert store.get("test_key") == "outer_value"
    
    # Commit outer transaction - should keep outer changes
    store.commit()
    assert store.get("test_key") == "outer_value"
    
    print("✓ Rollback inner then outer test passed")

def test_multiple_nested_levels():
    """Test multiple levels of nesting."""
    print("Testing multiple nested levels...")
    
    store = Store()
    
    # Set initial value
    store.set("test_key", "initial_value")
    
    # Start level 1
    store.begin()
    store.set("test_key", "level1_value")
    
    # Start level 2
    store.begin()
    store.set("test_key", "level2_value")
    
    # Start level 3
    store.begin()
    store.set("test_key", "level3_value")
    
    # Check that level 3 value is visible
    assert store.get("test_key") == "level3_value"
    
    # Rollback level 3
    store.rollback()
    assert store.get("test_key") == "level2_value"
    
    # Rollback level 2
    store.rollback()
    assert store.get("test_key") == "level1_value"
    
    # Rollback level 1
    store.rollback()
    assert store.get("test_key") == "initial_value"
    
    print("✓ Multiple nested levels test passed")

if __name__ == "__main__":
    test_nested_transactions()
    test_commit_inner_then_outer()
    test_rollback_inner_then_outer()
    test_multiple_nested_levels()
    print("All tests passed!")