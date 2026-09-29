class Graph:
    def __init__(self):
        self._adjacency_list = {}

    def add_node(self, n):
        if n not in self._adjacency_list:
            self._adjacency_list[n] = []

    def add_edge(self, a, b, weight=1):
        if weight <= 0:
            raise ValueError("Weight must be a positive number")
        self.add_node(a)
        self.add_node(b)
        for i, (neighbor, w) in enumerate(self._adjacency_list[a]):
            if neighbor == b:
                self._adjacency_list[a][i] = (b, weight)
                return
        self._adjacency_list[a].append((b, weight))

    def nodes(self):
        return sorted(self._adjacency_list.keys())

    def neighbors(self, a):
        if a not in self._adjacency_list:
            return []
        return sorted(self._adjacency_list[a], key=lambda x: x[0])

if __name__ == "__main__":
    g = Graph()
    g.add_node(1)
    g.add_node(2)
    g.add_edge(1, 2, 3)
    g.add_edge(2, 3, 4)
    g.add_edge(1, 3, 5)

    assert g.nodes() == [1, 2, 3]
    assert g.neighbors(1) == [(2, 3), (3, 5)]
    assert g.neighbors(2) == [(3, 4)]
    assert g.neighbors(3) == []

    g.add_edge(1, 2, 6)
    assert g.neighbors(1) == [(2, 6), (3, 5)]

    try:
        g.add_edge(1, 4, -1)
    except ValueError as e:
        assert str(e) == "Weight must be a positive number"
    else:
        assert False, "Expected ValueError for negative weight"
    def bfs(self, start):
        if start not in self._adjacency_list:
            raise KeyError(f"Start node {start} not in graph")
        visited = set()
        queue = [start]
        result = []
        while queue:
            node = queue.pop(0)
            if node not in visited:
                visited.add(node)
                result.append(node)
                queue.extend(sorted(neighbor for neighbor, _ in self._adjacency_list[node] if neighbor not in visited))
        return result
    def bfs(self, start):
        if start not in self._adjacency_list:
            raise KeyError(f"Start node {start} not in graph")
        visited = set()
        queue = [start]
        result = []
        while queue:
            node = queue.pop(0)
            if node not in visited:
                visited.add(node)
                result.append(node)
                queue.extend(sorted(neighbor for neighbor, _ in self._adjacency_list[node] if neighbor not in visited))
        return result
