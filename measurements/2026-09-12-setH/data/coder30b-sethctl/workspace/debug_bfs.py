from s6_graph import Graph

# Test the specific failing case
g = Graph()
g.add_node("c")
g.add_node("b") 
g.add_node("a")
g.add_node("d")

# Add edges to create a specific traversal order
g.add_edge("a", "d", 1)  # d comes after b in sorted order
g.add_edge("a", "b", 1)
g.add_edge("b", "c", 1)

print("Nodes:", g.nodes())
print("Neighbors of a:", g.neighbors("a"))
print("Neighbors of b:", g.neighbors("b"))
print("Neighbors of c:", g.neighbors("c"))
print("Neighbors of d:", g.neighbors("d"))

print("BFS from a:", g.bfs("a"))