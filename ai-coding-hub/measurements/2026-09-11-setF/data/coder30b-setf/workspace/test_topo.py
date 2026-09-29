from s6_graph import Graph

# Test topo_order with a simple DAG
g = Graph()
g.add_node("A")
g.add_node("B")
g.add_node("C")
g.add_edge("A", "B")
g.add_edge("B", "C")
g.add_edge("A", "C")

print("Testing topo_order on simple DAG:")
try:
    result = g.topo_order()
    print("Topo order:", result)
    print("Expected: ['A', 'B', 'C'] or ['A', 'C', 'B'] (both valid)")
except Exception as e:
    print("Error:", e)

# Test topo_order with cycle
print("\nTesting topo_order with cycle:")
g2 = Graph()
g2.add_node("A")
g2.add_node("B")
g2.add_edge("A", "B")
g2.add_edge("B", "A")

try:
    result = g2.topo_order()
    print("Topo order:", result)
except Exception as e:
    print("Error (expected):", e)

# Test topo_order with multiple valid orders
print("\nTesting topo_order with multiple valid orders:")
g3 = Graph()
g3.add_node("A")
g3.add_node("B")
g3.add_node("C")
g3.add_edge("A", "B")
g3.add_edge("A", "C")

try:
    result = g3.topo_order()
    print("Topo order:", result)
    print("Expected: ['A', 'B', 'C'] or ['A', 'C', 'B'] (both valid)")
except Exception as e:
    print("Error:", e)
# Test remove_node method
print("\nTesting remove_node method:")
g4 = Graph()
g4.add_node("A")
g4.add_node("B")
g4.add_node("C")
g4.add_edge("A", "B")
g4.add_edge("B", "C")
g4.add_edge("A", "C")

print("Before removal - nodes:", g4.nodes())
print("Before removal - neighbors of A:", g4.neighbors("A"))
print("Before removal - neighbors of B:", g4.neighbors("B"))

try:
    g4.remove_node("B")
    print("Removed node B successfully")
    print("After removal - nodes:", g4.nodes())
    print("After removal - neighbors of A:", g4.neighbors("A"))
    print("After removal - neighbors of C:", g4.neighbors("C"))
except Exception as e:
    print("Error removing node:", e)

# Test removing non-existent node
print("\nTesting removal of non-existent node:")
try:
    g4.remove_node("X")
    print("Unexpectedly removed non-existent node")
except KeyError as e:
    print("Correctly raised KeyError:", e)
except Exception as e:
    print("Unexpected error:", e)
