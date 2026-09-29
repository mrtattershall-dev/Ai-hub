class Graph:
    def __init__(self):
        self._nodes = set()
        self.edges = {}

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
    def has_cycle(self):
        visited = set()
        rec_stack = set()

        def dfs(node):
            if node in rec_stack:
                return True
            if node in visited:
                return False

            visited.add(node)
            rec_stack.add(node)

            for neighbor, _ in self.neighbors(node):
                if dfs(neighbor):
                    return True

            rec_stack.remove(node)
            return False

        for node in self.nodes:
            if dfs(node):
                return True

        return False
