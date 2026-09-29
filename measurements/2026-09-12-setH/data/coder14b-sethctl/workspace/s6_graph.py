class Graph:
    def __init__(self):
        self.nodes = set()
        self.edges = {}

    def add_node(self, n):
        if n not in self.nodes:
            self.nodes[n] = []

    def add_edge(self, a, b, weight=1):
        if a in self.nodes and b in self.nodes:
            self.nodes[a].append((b, weight))

    def nodes(self):
        return list(self.nodes.keys())

    def shortest_path(self, start, end):
        # Placeholder for shortest_path method
        pass

    def has_cycle(self):
        # Placeholder for has_cycle method
        pass

    def dfs(node):
        # Placeholder for dfs method
        pass

    def topo_order(self):
        in_degree = {node: 0 for node in self.nodes()}
        for node in self.nodes():
            for neighbor, _ in self.nodes[node]:
                in_degree[neighbor] += 1

        queue = [node for node in in_degree if in_degree[node] == 0]
        topo_order = []

        while queue:
            node = queue.pop(0)
            topo_order.append(node)
            for neighbor, _ in self.nodes[node]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)

        if len(topo_order) != len(self.nodes()):
            raise ValueError("Graph has a cycle")

        return topo_order
        self.nodes = {}
        self.edges = {}

    def add_node(self, n):
        if n not in self.nodes:
            self.nodes[n] = []

    def add_edge(self, a, b, weight=1):
        if a in self.nodes and b in self.nodes:
            self.edges[(a, b)] = weight
            self.nodes[a].append(b)

    def nodes(self):
        return list(self.nodes.keys())

    def shortest_path(self, start, end):
        # Existing shortest_path implementation
        pass

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

            for neighbor in self.nodes[node]:
                if dfs(neighbor):
                    return True

            rec_stack.remove(node)
            return False

        for node in self.nodes:
            if dfs(node):
                return True

        return False
    def __init__(self):
        self._nodes = set()
        self.edges = {}

    def add_node(self, n):
        self._nodes.add(n)

    def add_edge(self, a, b, weight=1):
        self.edges.setdefault(a, []).append((b, weight))
        self.edges.setdefault(b, []).append((a, weight))

    def nodes(self):
        return list(self._nodes)

    def shortest_path(self, start, end):
        import heapq
        from collections import defaultdict

        if start not in self._nodes or end not in self._nodes:
            raise KeyError("Node not in graph")

        distances = {node: float('inf') for node in self._nodes}
        distances[start] = 0
        priority_queue = [(0, start)]
        previous_nodes = {node: None for node in self._nodes}

        while priority_queue:
            current_distance, current_node = heapq.heappop(priority_queue)

            if current_distance > distances[current_node]:
                continue

            for neighbor, weight in self.edges[current_node]:
                distance = current_distance + weight

                if distance < distances[neighbor]:
                    distances[neighbor] = distance
                    previous_nodes[neighbor] = current_node
                    heapq.heappush(priority_queue, (distance, neighbor))

        path = []
        current_node = end
        while current_node is not None:
            path.append(current_node)
            current_node = previous_nodes[current_node]
        path.reverse()

        if path[0] != start:
            return None

        return (distances[end], path)

    def add_node(self, n):
        self.nodes.add(n)

    def add_edge(self, a, b, weight=1):
        self.edges.setdefault(a, []).append((b, weight))
        self.edges.setdefault(b, []).append((a, weight))

    def shortest_path(self, start, end):
        import heapq
        from collections import defaultdict

        if start not in self.nodes or end not in self.nodes:
            raise KeyError("Node not in graph")

        distances = {node: float('inf') for node in self.nodes}
        distances[start] = 0
        priority_queue = [(0, start)]
        previous_nodes = {node: None for node in self.nodes}

        while priority_queue:
            current_distance, current_node = heapq.heappop(priority_queue)

            if current_distance > distances[current_node]:
                continue

            for neighbor, weight in self.edges[current_node]:
                distance = current_distance + weight

                if distance < distances[neighbor]:
                    distances[neighbor] = distance
                    previous_nodes[neighbor] = current_node
                    heapq.heappush(priority_queue, (distance, neighbor))

        path = []
        current_node = end
        while current_node is not None:
            path.append(current_node)
            current_node = previous_nodes[current_node]
        path.reverse()

        if path[0] != start:
            return None

        return (distances[end], path)

    def shortest_path(self, start, end):
        import heapq
        from collections import defaultdict

        if start not in self._nodes or end not in self._nodes:
            raise KeyError("Node not in graph")

        distances = {node: float('inf') for node in self._nodes}
        distances[start] = 0
        priority_queue = [(0, start)]
        previous_nodes = {node: None for node in self._nodes}

        while priority_queue:
            current_distance, current_node = heapq.heappop(priority_queue)

            if current_distance > distances[current_node]:
                continue

            for neighbor, weight in self.edges[current_node]:
                distance = current_distance + weight

                if distance < distances[neighbor]:
                    distances[neighbor] = distance
                    previous_nodes[neighbor] = current_node
                    heapq.heappush(priority_queue, (distance, neighbor))

        path = []
        current_node = end
        while current_node is not None:
            path.append(current_node)
            current_node = previous_nodes[current_node]
        path.reverse()

        if path[0] != start:
            return None

        return (distances[end], path)

    def add_node(self, n):
        self.nodes.add(n)

    def add_edge(self, a, b, weight=1):
        if weight <= 0:
            raise ValueError("Weight must be a positive number")
        self.add_node(a)
        self.add_node(b)
        if a not in self.edges:
            self.edges[a] = {}
        self.edges[a][b] = weight

    def nodes(self):
        return sorted(self.nodes)

    def neighbors(self, a):
        if a in self.edges:
            return sorted([(b, self.edges[a][b]) for b in self.edges[a]])
        return []

if __name__ == "__main__":
    g = Graph()
    g.add_node(1)
    g.add_node(2)
    g.add_edge(1, 2, 3)
    g.add_edge(2, 1, 4)
    assert g.nodes() == [1, 2]
    assert g.neighbors(1) == [(2, 3)]
    assert g.neighbors(2) == [(1, 4)]
    try:
        g.add_edge(1, 2, -1)
    except ValueError as e:
        assert str(e) == "Weight must be a positive number"
    print("All tests passed")