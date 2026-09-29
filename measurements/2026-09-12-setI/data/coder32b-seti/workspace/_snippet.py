from s6_graph import Graph

g = Graph()
g.add_edge(1, 2)
g.add_edge(1, 3)
g.add_edge(2, 4)
g.add_edge(2, 5)
g.add_edge(3, 6)
g.add_edge(3, 7)

print(g.bfs(1))  # Expected output: [1, 2, 3, 4, 5, 6, 7]