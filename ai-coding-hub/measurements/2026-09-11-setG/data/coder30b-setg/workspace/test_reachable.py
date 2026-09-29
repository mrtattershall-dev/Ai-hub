#!/usr/bin/env python3

from s6_graph import Graph

def test_reachable():
    """Test the reachable function"""
    print("Testing reachable function...")
    
    # Test with simple graph
    g = Graph()
    g.add_node("a")
    g.add_node("b")
    g.add_node("c")
    g.add_edge("a", "b", 5)
    g.add_edge("b", "c", 3)
    
    # Test reachable from 'a'
    result = g.reachable("a")
    expected = ["b", "c"]  # 'a' should not be included since it's not on a cycle
    assert result == expected, f"Expected {expected}, got {result}"
    print(f"Test 1 passed: reachable('a') = {result}")
    
    # Test reachable from 'c' 
    result = g.reachable("c")
    expected = []  # 'c' should not be included since it's not on a cycle
    assert result == expected, f"Expected {expected}, got {result}"
    print(f"Test 2 passed: reachable('c') = {result}")
    
    # Test with cycle
    g.add_edge("c", "a", 7)
    result = g.reachable("a")
    expected = ["a", "b", "c"]  # 'a' should be included since it's on a cycle
    assert result == expected, f"Expected {expected}, got {result}"
    print(f"Test 3 passed: reachable('a') with cycle = {result}")
    
    # Test with self-loop
    g2 = Graph()
    g2.add_node("x")
    g2.add_edge("x", "x", 1)
    result = g2.reachable("x")
    expected = ["x"]  # 'x' should be included since it has a self-loop
    assert result == expected, f"Expected {expected}, got {result}"
    print(f"Test 4 passed: reachable('x') with self-loop = {result}")
    
    # Test KeyError for unknown node
    try:
        g.reachable("nonexistent")
        assert False, "Should have raised KeyError"
    except KeyError:
        print("Test 5 passed: KeyError raised for unknown node")
    
    print("All reachable tests passed!")

if __name__ == "__main__":
    test_reachable()