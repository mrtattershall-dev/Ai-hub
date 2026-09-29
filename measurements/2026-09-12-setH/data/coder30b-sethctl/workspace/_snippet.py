import sys
sys.path.append('.')
import s6_graph

# Test the specific functionality that was requested
g = s6_graph.Graph()
g.add_node("a")
g.add_node("b")
g.add_node("c")
g.add_edge("a", "b", 1)
g.add_edge("b", "c", 1)

print("=== Testing remove_node functionality ===")
print("Nodes before:", g.nodes())
print("Edges from a:", list(g.neighbors("a")))
print("Edges from b:", list(g.neighbors("b")))
print("Edges from c:", list(g.neighbors("c")))

# Test 1: Remove existing node
try:
    g.remove_node("b")
    print("✓ remove_node('b') succeeded")
    print("Nodes after:", g.nodes())
    print("Edges from a:", list(g.neighbors("a")))
    print("Edges from c:", list(g.neighbors("c")))
except Exception as e:
    print("✗ Error removing node:", e)

# Test 2: Try to remove non-existent node (should raise KeyError)
try:
    g.remove_node("nonexistent")
    print("✗ Should have raised KeyError")
except KeyError as e:
    print("✓ KeyError correctly raised for non-existent node:", e)
except Exception as e:
    print("✗ Wrong exception type:", e)

print("\n=== All remove_node tests completed ===")