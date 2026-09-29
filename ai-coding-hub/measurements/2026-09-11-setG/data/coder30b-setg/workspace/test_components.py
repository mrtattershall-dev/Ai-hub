#!/usr/bin/env python3

from s6_graph import Graph

def test_components():
    """Test the components method"""
    print("Testing components method...")
    
    # Test with empty graph
    g = Graph()
    result = g.components()
    expected = []
    assert result == expected, f"Expected {expected}, got {result}"
    print(f"Test 1 passed: empty graph components = {result}")
    
    # Test with single node
    g.add_node("a")
    result = g.components()
    expected = [["a"]]
    assert result == expected, f"Expected {expected}, got {result}"
    print(f"Test 2 passed: single node components = {result}")
    
    # Test with disconnected nodes
    g.add_node("b")
    g.add_node("c")
    result = g.components()
    expected = [["a"], ["b"], ["c"]]
    assert result == expected, f"Expected {expected}, got {result}"
    print(f"Test 3 passed: disconnected nodes components = {result}")
    
    # Test with connected components
    g.add_edge("a", "b", 1)
    g.add_edge("b", "c", 1)
    result = g.components()
    expected = [["a", "b", "c"]]
    assert result == expected, f"Expected {expected}, got {result}"
    print(f"Test 4 passed: connected components = {result}")
    
    # Test with multiple disconnected components
    g2 = Graph()
    g2.add_node("x")
    g2.add_node("y")
    g2.add_node("z")
    g2.add_edge("x", "y", 1)
    g2.add_edge("z", "x", 1)
    result = g2.components()
    expected = [["x", "y", "z"]]  # All nodes in one component due to weak connectivity
    assert result == expected, f"Expected {expected}, got {result}"
    print(f"Test 5 passed: weakly connected components = {result}")
    
    # Test with more complex graph
    g3 = Graph()
    g3.add_node("a")
    g3.add_node("b")
    g3.add_node("c")
    g3.add_node("d")
    g3.add_node("e")
    g3.add_edge("a", "b", 1)
    g3.add_edge("b", "c", 1)
    g3.add_edge("d", "e", 1)
    result = g3.components()
    expected = [["a", "b", "c"], ["d", "e"]]  # Two components
    assert result == expected, f"Expected {expected}, got {result}"
    print(f"Test 6 passed: multiple components = {result}")
    
    # Test with self-loops
    g4 = Graph()
    g4.add_node("a")
    g4.add_node("b")
    g4.add_edge("a", "a", 1)  # Self-loop
    g4.add_edge("b", "b", 1)  # Self-loop
    result = g4.components()
    expected = [["a"], ["b"]]  # Each node in its own component
    assert result == expected, f"Expected {expected}, got {result}"
    print(f"Test 7 passed: self-loops components = {result}")
    
    print("All tests passed!")

if __name__ == "__main__":
    test_components()