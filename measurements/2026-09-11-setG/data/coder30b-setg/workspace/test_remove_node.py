#!/usr/bin/env python3

from s6_graph import Graph

def test_remove_node():
    """Test the remove_node method"""
    g = Graph()
    
    # Test removing non-existent node raises KeyError
    try:
        g.remove_node("nonexistent")
        assert False, "Should have raised KeyError"
    except KeyError:
        pass  # Expected
    
    # Test removing node with edges
    g.add_node("a")
    g.add_node("b")
    g.add_node("c")
    g.add_edge("a", "b", 5)
    g.add_edge("b", "c", 3)
    g.add_edge("a", "c", 7)
    
    # Verify initial state
    assert "a" in g.nodes_set
    assert "b" in g.nodes_set
    assert "c" in g.nodes_set
    assert g.neighbors("a") == [("b", 5), ("c", 7)]
    assert g.neighbors("b") == [("c", 3)]
    assert g.neighbors("c") == []
    
    # Remove node "b"
    g.remove_node("b")
    
    # Verify node "b" is removed
    assert "b" not in g.nodes_set
    assert g.neighbors("a") == [("c", 7)]  # Edge from a to b should be removed
    assert g.neighbors("c") == []  # No incoming edges to c
    
    # Remove node "a"
    g.remove_node("a")
    
    # Verify node "a" is removed
    assert "a" not in g.nodes_set
    assert g.neighbors("c") == []  # No incoming edges to c
    
    # Remove last node
    g.remove_node("c")
    
    # Verify all nodes are removed
    assert len(g.nodes_set) == 0
    assert len(g.edges) == 0
    
    print("All remove_node tests passed!")

if __name__ == "__main__":
    test_remove_node()
    # Test reachable function
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
    
    # Test reachable from 'c' 
    result = g.reachable("c")
    expected = []  # 'c' should not be included since it's not on a cycle
    assert result == expected, f"Expected {expected}, got {result}"
    
    # Test with cycle
    g.add_edge("c", "a", 7)
    result = g.reachable("a")
    expected = ["a", "b", "c"]  # 'a' should be included since it's on a cycle
    assert result == expected, f"Expected {expected}, got {result}"
    
    # Test with self-loop
    g2 = Graph()
    g2.add_node("x")
    g2.add_edge("x", "x", 1)
    result = g2.reachable("x")
    expected = ["x"]  # 'x' should be included since it has a self-loop
    assert result == expected, f"Expected {expected}, got {result}"
    
    # Test KeyError for unknown node
    try:
        g.reachable("nonexistent")
        assert False, "Should have raised KeyError"
    except KeyError:
        pass  # Expected
    
    print("All reachable tests passed!")
