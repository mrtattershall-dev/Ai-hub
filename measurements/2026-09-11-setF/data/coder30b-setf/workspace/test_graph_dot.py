#!/usr/bin/env python3

import sys
sys.path.append('.')

from s6_graph import Graph

def test_to_dot():
    # Create a simple graph
    g = Graph()
    
    # Add some nodes and edges
    g.add_edge('a', 'b', 2)
    g.add_edge('b', 'c', 3)
    g.add_edge('a', 'c', 1)
    g.add_node('d')  # isolated node
    
    # Test to_dot method
    result = g.to_dot()
    print("DOT output:")
    print(result)
    
    # Expected output should be:
    # digraph {
    #   a -> b [weight=2];
    #   a -> c [weight=1];
    #   b -> c [weight=3];
    #   d;
    # }
    
    expected_lines = [
        "digraph {",
        "  a -> b [weight=2];",
        "  a -> c [weight=1];",
        "  b -> c [weight=3];",
        "  d;",
        "}"
    ]
    
    expected = "\n".join(expected_lines)
    
    print("\nExpected:")
    print(expected)
    
    if result == expected:
        print("\n✅ Test passed!")
        return True
    else:
        print("\n❌ Test failed!")
        return False

if __name__ == "__main__":
    test_to_dot()