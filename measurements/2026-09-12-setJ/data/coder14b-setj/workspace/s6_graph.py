class Graph:
    def __init__(self):
        self.nodes = set()
        self.edges = {}

    def bfs(self, start):
        if start not in self._nodes:
            raise KeyError(f"Node {start} not in graph")
        
        visited = set()
        queue = deque([start])
        result = []

        while queue:
            node = queue.popleft()
            if node not in visited:
                visited.add(node)
                result.append(node)
                for neighbor in sorted(self.neighbors(node)):
                    if neighbor not in visited:
                        queue.append(neighbor)

        return result

    def add_node(self, n):
        self.nodes.add(n)

    def add_edge(self, a, b, weight=1):
        pass

    def nodes(self):
        return sorted(self.nodes)

    def neighbors(self, a):
        pass

if __name__ == "__main__":
    # Test cases
    g = Graph()
    g.add_node(1)
    g.add_node(2)
    g.add_edge(1, 2, 3)
    assert g.nodes() == [1, 2]
    assert g.neighbors(1) == [(2, 3)]