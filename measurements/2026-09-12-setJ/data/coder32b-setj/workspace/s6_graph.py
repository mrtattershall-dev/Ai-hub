class Graph:
    def bfs(self, start):
        if start not in self._nodes:
            raise KeyError(f"Start node {start} not in graph")
        
        visited = set()
        queue = [start]
        result = []
        
        while queue:
            node = queue.pop(0)
            if node not in visited:
                visited.add(node)
                result.append(node)
                queue.extend(sorted(self.neighbors(node) - visited))
        
        return result
    def __init__(self):
        self._nodes = set()
        self._edges = {}

    def add_node(self, n):
        self._nodes.add(n)

    def add_edge(self, a, b, weight=1):
        if weight <= 0:
            raise ValueError("Weight must be a positive number")
        self.add_node(a)
        self.add_node(b)
        if a not in self._edges:
            self._edges[a] = {}
        self._edges[a][b] = weight

    def nodes(self):
        return sorted(self._nodes)

    def neighbors(self, a):
        if a not in self._edges:
            return []
        return sorted((b, self._edges[a][b]) for b in self._edges[a])

if __name__ == "__main__":
    g = Graph()
    g.add_node(1)
    g.add_node(2)
    g.add_edge(1, 2, 3)
    assert g.nodes() == [1, 2]
    assert g.neighbors(1) == [(2, 3)]
    assert g.neighbors(2) == []
    g.add_edge(1, 2, 5)
    assert g.neighbors(1) == [(2, 5)]
    try:
        g.add_edge(1, 3, -1)
    except ValueError as e:
        assert str(e) == "Weight must be a positive number"
    else:
        assert False, "Expected ValueError"
    print("All tests passed.")