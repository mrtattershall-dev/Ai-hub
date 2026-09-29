class Graph:
    def __init__(self):
        self.nodes = set()
        self.edges = {}
        self.visited = {}
        self.rec_stack = set()

    def remove_node(self, n):
        if n not in self.nodes:
            raise KeyError("Unknown node")
        self.nodes.remove(n)
        edges_to_remove = [edge for edge in self.edges if n in edge]
        for edge in edges_to_remove:
            del self.edges[edge]

    def add_node(self, n):
        self.nodes.add(n)

    def add_edge(self, a, b, weight=1):
        if a in self.nodes and b in self.nodes:
            self.edges[(a, b)] = weight
            self.nodes.add(b)
            self.nodes.add(a)

    def nodes(self):
        return list(self.nodes)

    def neighbors(self, a):
        return self.edges.get(a, [])

    def bfs(self, start):
        visited = set()
        queue = [start]
        while queue:
            node = queue.pop(0)
            if node not in visited:
                visited.add(node)
                queue.extend(self.neighbors(node))
        return visited

    def shortest_path(self, a, b):
        if a not in self.nodes or b not in self.nodes:
            raise KeyError("Unknown node")

        if a == b:
            return (0, [a])

        import heapq
        priority_queue = [(0, [a])]
        visited = set()

        while priority_queue:
            cost, path = heapq.heappop(priority_queue)
            node = path[-1]

            if node in visited:
                continue

            visited.add(node)

            if node == b:
                return (cost, path)

            for neighbor in self.neighbors(node):
                if neighbor not in visited:
                    new_cost = cost + self.edges.get((node, neighbor), float('inf'))
                    new_path = path + [neighbor]
                    heapq.heappush(priority_queue, (new_cost, new_path))

        return None

    def has_cycle(self):
        visited = set()
        rec_stack = set()

        def dfs(node):
            visited.add(node)
            rec_stack.add(node)

            for neighbor in self.neighbors(node):
                if neighbor not in visited:
                    if dfs(neighbor):
                        return True
                elif neighbor in rec_stack:
                    return True

            rec_stack.remove(node)
            return False

        for node in self.nodes:
            if node not in visited:
                if dfs(node):
                    return True
        return False

    def topo_order(self):
        visited = set()
        order = []

        def dfs(node):
            visited.add(node)
            for neighbor in self.neighbors(node):
                if neighbor not in visited:
                    dfs(neighbor)
            order.append(node)

        for node in self.nodes:
            if node not in visited:
                dfs(node)

        return order[::-1]

    def add_node(self, n):
        self.nodes.add(n)

    def add_edge(self, a, b, weight=1):
        if a in self.nodes and b in self.nodes:
            self.edges[(a, b)] = weight
            self.nodes.add(b)
            self.nodes.add(a)

    def nodes(self):
        return list(self.nodes)

    def neighbors(self, a):
        return self.edges.get(a, [])

    def bfs(self, start):
        visited = set()
        queue = [start]
        while queue:
            node = queue.pop(0)
            if node not in visited:
                visited.add(node)
                queue.extend(self.neighbors(node))
        return visited

    def shortest_path(self, a, b):
        if a not in self.nodes or b not in self.nodes:
            raise KeyError("Unknown node")

        if a == b:
            return (0, [a])

        import heapq
        priority_queue = [(0, [a])]
        visited = set()

        while priority_queue:
            cost, path = heapq.heappop(priority_queue)
            node = path[-1]

            if node in visited:
                continue

            visited.add(node)

            if node == b:
                return (cost, path)

            for neighbor in self.neighbors(node):
                if neighbor not in visited:
                    new_cost = cost + self.edges.get((node, neighbor), float('inf'))
                    new_path = path + [neighbor]
                    heapq.heappush(priority_queue, (new_cost, new_path))

        return None

    def has_cycle(self):
        visited = set()
        rec_stack = set()

        def dfs(node):
            visited.add(node)
            rec_stack.add(node)

            for neighbor in self.neighbors(node):
                if neighbor not in visited:
                    if dfs(neighbor):
                        return True
                elif neighbor in rec_stack:
                    return True

            rec_stack.remove(node)
            return False

        for node in self.nodes:
            if node not in visited:
                if dfs(node):
                    return True
        return False

    def topo_order(self):
        visited = set()
        order = []

        def dfs(node):
            visited.add(node)
            for neighbor in self.neighbors(node):
                if neighbor not in visited:
                    dfs(neighbor)
            order.append(node)

        for node in self.nodes:
            if node not in visited:
                dfs(node)

        return order[::-1]
        for node in self.nodes:
            if not self.visited.get(node, False):
                if self._dfs(node):
                    return True
        return False

    def _dfs(self, node):
        self.visited[node] = True
        self.rec_stack.add(node)

        for neighbor in self.neighbors(node):
            if not self.visited.get(neighbor, False):
                if self._dfs(neighbor):
                    return True
            elif neighbor in self.rec_stack:
                return True

        self.rec_stack.remove(node)
        return False

    def add_node(self, n):
        self.nodes.add(n)

    def add_edge(self, a, b, weight=1):
        if a in self.nodes and b in self.nodes:
            self.edges[(a, b)] = weight
            self.nodes.add(b)
            self.nodes.add(a)

    def nodes(self):
        return list(self.nodes)

    def neighbors(self, a):
        return self.nodes.get(a, [])

    def bfs(self, start):
        visited = set()
        queue = [start]
        while queue:
            node = queue.pop(0)
            if node not in visited:
                visited.add(node)
                queue.extend(self.neighbors(node))
        return visited

    def shortest_path(self, a, b):
        if a not in self.nodes or b not in self.nodes:
            raise KeyError("Unknown node")

        if a == b:
            return (0, [a])

        import heapq
        priority_queue = [(0, [a])]
        visited = set()

        while priority_queue:
            cost, path = heapq.heappop(priority_queue)
            node = path[-1]

            if node in visited:
                continue

            visited.add(node)

            if node == b:
                return (cost, path)

            for neighbor in self.neighbors(node):
                if neighbor not in visited:
                    new_cost = cost + self.edges.get((node, neighbor), float('inf'))
                    new_path = path + [neighbor]
                    heapq.heappush(priority_queue, (new_cost, new_path))

        return None
    def __init__(self):
        self.nodes = set()
        self.edges = {}

    def add_node(self, n):
        self.nodes.add(n)

    def add_edge(self, a, b, weight=1):
        if a in self.nodes and b in self.nodes:
            self.edges[(a, b)] = weight
            self.nodes.add(b)
            self.nodes.add(a)

    def nodes(self):
        return list(self.nodes)

    def neighbors(self, a):
        return self.nodes.get(a, [])

    def bfs(self, start):
        visited = set()
        queue = [start]
        while queue:
            node = queue.pop(0)
            if node not in visited:
                visited.add(node)
                queue.extend(self.neighbors(node))
        return visited

    def shortest_path(self, a, b):
        if a not in self.nodes or b not in self.nodes:
            raise KeyError("Unknown node")

        if a == b:
            return (0, [a])

        import heapq
        priority_queue = [(0, [a])]
        visited = set()

        while priority_queue:
            cost, path = heapq.heappop(priority_queue)
            node = path[-1]

            if node in visited:
                continue

            visited.add(node)

            if node == b:
                return (cost, path)

            for neighbor in self.neighbors(node):
                if neighbor not in visited:
                    new_cost = cost + self.edges.get((node, neighbor), float('inf'))
                    new_path = path + [neighbor]
                    heapq.heappush(priority_queue, (new_cost, new_path))

        return None
    def __init__(self):
        self.nodes = set()
        self.edges = {}

    def add_node(self, n):
        self.nodes.add(n)

    def add_edge(self, a, b, weight=1):
        if a in self.nodes and b in self.nodes:
            self.edges[(a, b)] = weight
            self.nodes.add(b)
            self.nodes.add(a)

    def nodes(self):
        return list(self.nodes)

    def neighbors(self, a):
        return self.nodes.get(a, [])

    def bfs(self, start):
        visited = set()
        queue = [start]
        while queue:
            node = queue.pop(0)
            if node not in visited:
                visited.add(node)
                queue.extend(self.neighbors(node))
        return visited

    def shortest_path(self, a, b):
        if a not in self.nodes or b not in self.nodes:
            raise KeyError("Unknown node")

        if a == b:
            return (0, [a])

        import heapq
        priority_queue = [(0, [a])]
        visited = set()

        while priority_queue:
            cost, path = heapq.heappop(priority_queue)
            node = path[-1]

            if node in visited:
                continue

            visited.add(node)

            if node == b:
                return (cost, path)

            for neighbor in self.neighbors(node):
                if neighbor not in visited:
                    new_cost = cost + self.edges.get((node, neighbor), float('inf'))
                    new_path = path + [neighbor]
                    heapq.heappush(priority_queue, (new_cost, new_path))

        return None
    def __init__(self):
        self.nodes = set()
        self.edges = {}

    def add_node(self, n):
        self.nodes.add(n)

    def add_edge(self, a, b, weight=1):
        if a in self.nodes and b in self.nodes:
            self.edges[(a, b)] = weight
            self.nodes.add(b)
            self.nodes.add(a)

    def nodes(self):
        return list(self.nodes)

    def neighbors(self, a):
        return self.nodes.get(a, [])

    def bfs(self, start):
        visited = set()
        queue = [start]
        while queue:
            node = queue.pop(0)
            if node not in visited:
                visited.add(node)
                queue.extend(self.neighbors(node))
        return visited

    def shortest_path(self, a, b):
        if a not in self.nodes or b not in self.nodes:
            raise KeyError("Unknown node")

        if a == b:
            return (0, [a])

        import heapq
        priority_queue = [(0, [a])]
        visited = set()

        while priority_queue:
            cost, path = heapq.heappop(priority_queue)
            node = path[-1]

            if node in visited:
                continue

            visited.add(node)

            if node == b:
                return (cost, path)

            for neighbor in self.neighbors(node):
                if neighbor not in visited:
                    new_cost = cost + self.edges.get((node, neighbor), float('inf'))
                    new_path = path + [neighbor]
                    heapq.heappush(priority_queue, (new_cost, new_path))

        return None
    def __init__(self):
        self.nodes = set()
        self.edges = {}

    def add_node(self, n):
        self.nodes.add(n)

    def add_edge(self, a, b, weight=1):
        if a in self.nodes and b in self.nodes:
            self.edges[(a, b)] = weight
            self.nodes.add(b)
            self.nodes.add(a)

    def nodes(self):
        return list(self.nodes)

    def neighbors(self, a):
        return self.nodes.get(a, [])

    def bfs(self, start):
        visited = set()
        queue = [start]
        while queue:
            node = queue.pop(0)
            if node not in visited:
                visited.add(node)
                queue.extend(self.neighbors(node))
        return visited

    def shortest_path(self, a, b):
        if a not in self.nodes or b not in self.nodes:
            raise KeyError("Unknown node")

        if a == b:
            return (0, [a])

        import heapq
        priority_queue = [(0, [a])]
        visited = set()

        while priority_queue:
            cost, path = heapq.heappop(priority_queue)
            node = path[-1]

            if node in visited:
                continue

            visited.add(node)

            if node == b:
                return (cost, path)

            for neighbor in self.neighbors(node):
                if neighbor not in visited:
                    new_cost = cost + self.edges.get((node, neighbor), float('inf'))
                    new_path = path + [neighbor]
                    heapq.heappush(priority_queue, (new_cost, new_path))

        return None
    def __init__(self):
        self.nodes = set()
        self.edges = {}

    def add_node(self, n):
        self.nodes.add(n)

    def add_edge(self, a, b, weight=1):
        if a in self.nodes and b in self.nodes:
            self.edges[(a, b)] = weight
            self.nodes.add(b)
            self.nodes.add(a)

    def nodes(self):
        return list(self.nodes)

    def neighbors(self, a):
        return self.nodes.get(a, [])

    def bfs(self, start):
        visited = set()
        queue = [start]
        while queue:
            node = queue.pop(0)
            if node not in visited:
                visited.add(node)
                queue.extend(self.neighbors(node))
        return visited

    def shortest_path(self, a, b):
        if a not in self.nodes or b not in self.nodes:
            raise KeyError("Unknown node")

        if a == b:
            return (0, [a])

        import heapq
        priority_queue = [(0, [a])]
        visited = set()

        while priority_queue:
            cost, path = heapq.heappop(priority_queue)
            node = path[-1]

            if node in visited:
                continue

            visited.add(node)

            if node == b:
                return (cost, path)

            for neighbor in self.neighbors(node):
                if neighbor not in visited:
                    new_cost = cost + self.edges.get((node, neighbor), float('inf'))
                    new_path = path + [neighbor]
                    heapq.heappush(priority_queue, (new_cost, new_path))

        return None
    def __init__(self):
        self.nodes = set()
        self.edges = {}

    def add_node(self, n):
        self.nodes.add(n)

    def add_edge(self, a, b, weight=1):
        if a in self.nodes and b in self.nodes:
            self.edges[(a, b)] = weight
            self.nodes.add(b)
            self.nodes.add(a)

    def nodes(self):
        return list(self.nodes)

    def neighbors(self, a):
        return self.nodes.get(a, [])

    def bfs(self, start):
        visited = set()
        queue = [start]
        while queue:
            node = queue.pop(0)
            if node not in visited:
                visited.add(node)
                queue.extend(self.neighbors(node))
        return visited

    def shortest_path(self, a, b):
        if a not in self.nodes or b not in self.nodes:
            raise KeyError("Unknown node")

        if a == b:
            return (0, [a])

        import heapq
        priority_queue = [(0, [a])]
        visited = set()

        while priority_queue:
            cost, path = heapq.heappop(priority_queue)
            node = path[-1]

            if node in visited:
                continue

            visited.add(node)

            if node == b:
                return (cost, path)

            for neighbor in self.neighbors(node):
                if neighbor not in visited:
                    new_cost = cost + self.edges.get((node, neighbor), float('inf'))
                    new_path = path + [neighbor]
                    heapq.heappush(priority_queue, (new_cost, new_path))

        return None
    def __init__(self):
        self.nodes = set()
        self.edges = {}

    def add_node(self, n):
        self.nodes.add(n)

    def add_edge(self, a, b, weight=1):
        if a in self.nodes and b in self.nodes:
            self.edges[(a, b)] = weight
            self.nodes.add(b)
            self.nodes.add(a)

    def nodes(self):
        return list(self.nodes)

    def neighbors(self, a):
        return self.nodes.get(a, [])

    def bfs(self, start):
        visited = set()
        queue = [start]
        while queue:
            node = queue.pop(0)
            if node not in visited:
                visited.add(node)
                queue.extend(self.neighbors(node))
        return visited

    def shortest_path(self, a, b):
        if a not in self.nodes or b not in self.nodes:
            raise KeyError("Unknown node")

        if a == b:
            return (0, [a])

        import heapq
        priority_queue = [(0, [a])]
        visited = set()

        while priority_queue:
            cost, path = heapq.heappop(priority_queue)
            node = path[-1]

            if node in visited:
                continue

            visited.add(node)

            if node == b:
                return (cost, path)

            for neighbor in self.neighbors(node):
                if neighbor not in visited:
                    new_cost = cost + self.edges.get((node, neighbor), float('inf'))
                    new_path = path + [neighbor]
                    heapq.heappush(priority_queue, (new_cost, new_path))

        return None
    def __init__(self):
        self.nodes = set()
        self.edges = {}

    def add_node(self, n):
        self.nodes.add(n)

    def add_edge(self, a, b, weight=1):
        if a in self.nodes and b in self.nodes:
            self.edges[(a, b)] = weight
            self.nodes.add(b)
            self.nodes.add(a)

    def nodes(self):
        return list(self.nodes)

    def neighbors(self, a):
        return self.nodes.get(a, [])

    def bfs(self, start):
        visited = set()
        queue = [start]
        while queue:
            node = queue.pop(0)
            if node not in visited:
                visited.add(node)
                queue.extend(self.neighbors(node))
        return visited

    def shortest_path(self, a, b):
        if a not in self.nodes or b not in self.nodes:
            raise KeyError("Unknown node")

        if a == b:
            return (0, [a])

        import heapq
        priority_queue = [(0, [a])]
        visited = set()

        while priority_queue:
            cost, path = heapq.heappop(priority_queue)
            node = path[-1]

            if node in visited:
                continue

            visited.add(node)

            if node == b:
                return (cost, path)

            for neighbor in self.neighbors(node):
                if neighbor not in visited:
                    new_cost = cost + self.edges.get((node, neighbor), float('inf'))
                    new_path = path + [neighbor]
                    heapq.heappush(priority_queue, (new_cost, new_path))

        return None
    def __init__(self):
        self.nodes = set()
        self.edges = {}

    def add_node(self, n):
        self.nodes.add(n)

    def add_edge(self, a, b, weight=1):
        if a in self.nodes and b in self.nodes:
            self.edges[(a, b)] = weight
            self.nodes.add(b)
            self.nodes.add(a)

    def nodes(self):
        return list(self.nodes)

    def neighbors(self, a):
        return self.nodes.get(a, [])

    def bfs(self, start):
        visited = set()
        queue = [start]
        while queue:
            node = queue.pop(0)
            if node not in visited:
                visited.add(node)
                queue.extend(self.neighbors(node))
        return visited

    def shortest_path(self, a, b):
        if a not in self.nodes or b not in self.nodes:
            raise KeyError("Unknown node")

        if a == b:
            return (0, [a])

        import heapq
        priority_queue = [(0, [a])]
        visited = set()

        while priority_queue:
            cost, path = heapq.heappop(priority_queue)
            node = path[-1]

            if node in visited:
                continue

            visited.add(node)

            if node == b:
                return (cost, path)

            for neighbor in self.neighbors(node):
                if neighbor not in visited:
                    new_cost = cost + self.edges.get((node, neighbor), float('inf'))
                    new_path = path + [neighbor]
                    heapq.heappush(priority_queue, (new_cost, new_path))

        return None
    def __init__(self):
        self.nodes = set()
        self.edges = {}

    def add_node(self, n):
        self.nodes.add(n)

    def add_edge(self, a, b, weight=1):
        if a in self.nodes and b in self.nodes:
            self.edges[(a, b)] = weight
            self.nodes.add(b)
            self.nodes.add(a)

    def nodes(self):
        return list(self.nodes)

    def neighbors(self, a):
        return self.nodes.get(a, [])

    def bfs(self, start):
        visited = set()
        queue = [start]
        while queue:
            node = queue.pop(0)
            if node not in visited:
                visited.add(node)
                queue.extend(self.neighbors(node))
        return visited

    def shortest_path(self, a, b):
        if a not in self.nodes or b not in self.nodes:
            raise KeyError("Unknown node")

        if a == b:
            return (0, [a])

        import heapq
        priority_queue = [(0, [a])]
        visited = set()

        while priority_queue:
            cost, path = heapq.heappop(priority_queue)
            node = path[-1]

            if node in visited:
                continue

            visited.add(node)

            if node == b:
                return (cost, path)

            for neighbor in self.neighbors(node):
                if neighbor not in visited:
                    new_cost = cost + self.edges.get((node, neighbor), float('inf'))
                    new_path = path + [neighbor]
                    heapq.heappush(priority_queue, (new_cost, new_path))

        return None
    def __init__(self):
        self.nodes = set()
        self.edges = {}

    def add_node(self, n):
        self.nodes.add(n)

    def add_edge(self, a, b, weight=1):
        if a in self.nodes and b in self.nodes:
            self.edges[(a, b)] = weight
            self.nodes.add(b)
            self.nodes.add(a)

    def nodes(self):
        return list(self.nodes)

    def neighbors(self, a):
        return self.nodes.get(a, [])

    def bfs(self, start):
        visited = set()
        queue = [start]
        while queue:
            node = queue.pop(0)
            if node not in visited:
                visited.add(node)
                queue.extend(self.neighbors(node))
        return visited

    def shortest_path(self, a, b):
        if a not in self.nodes or b not in self.nodes:
            raise KeyError("Unknown node")

        if a == b:
            return (0, [a])

        import heapq
        priority_queue = [(0, [a])]
        visited = set()

        while priority_queue:
            cost, path = heapq.heappop(priority_queue)
            node = path[-1]

            if node in visited:
                continue

            visited.add(node)

            if node == b:
                return (cost, path)

            for neighbor in self.neighbors(node):
                if neighbor not in visited:
                    new_cost = cost + self.edges.get((node, neighbor), float('inf'))
                    new_path = path + [neighbor]
                    heapq.heappush(priority_queue, (new_cost, new_path))

        return None
    def __init__(self):
        self.nodes = set()
        self.edges = {}

    def add_node(self, n):
        self.nodes.add(n)

    def add_edge(self, a, b, weight=1):
        if a in self.nodes and b in self.nodes:
            self.edges[(a, b)] = weight
            self.nodes.add(b)
            self.nodes.add(a)

    def nodes(self):
        return list(self.nodes)

    def neighbors(self, a):
        return self.nodes.get(a, [])

    def bfs(self, start):
        visited = set()
        queue = [start]
        while queue:
            node = queue.pop(0)
            if node not in visited:
                visited.add(node)
                queue.extend(self.neighbors(node))
        return visited

    def shortest_path(self, a, b):
        if a not in self.nodes or b not in self.nodes:
            raise KeyError("Unknown node")

        if a == b:
            return (0, [a])

        import heapq
        priority_queue = [(0, [a])]
        visited = set()

        while priority_queue:
            cost, path = heapq.heappop(priority_queue)
            node = path[-1]

            if node in visited:
                continue

            visited.add(node)

            if node == b:
                return (cost, path)

            for neighbor in self.neighbors(node):
                if neighbor not in visited:
                    new_cost = cost + self.edges.get((node, neighbor), float('inf'))
                    new_path = path + [neighbor]
                    heapq.heappush(priority_queue, (new_cost, new_path))

        return None
    def __init__(self):
        self.nodes = set()
        self.edges = {}

    def add_node(self, n):
        self.nodes.add(n)

    def add_edge(self, a, b, weight=1):
        if a in self.nodes and b in self.nodes:
            self.edges[(a, b)] = weight
            self.nodes.add(b)
            self.nodes.add(a)

    def nodes(self):
        return list(self.nodes)

    def neighbors(self, a):
        return self.nodes.get(a, [])

    def bfs(self, start):
        visited = set()
        queue = [start]
        while queue:
            node = queue.pop(0)
            if node not in visited:
                visited.add(node)
                queue.extend(self.neighbors(node))
        return visited

    def shortest_path(self, a, b):
        if a not in self.nodes or b not in self.nodes:
            raise KeyError("Unknown node")

        if a == b:
            return (0, [a])

        import heapq
        priority_queue = [(0, [a])]
        visited = set()

        while priority_queue:
            cost, path = heapq.heappop(priority_queue)
            node = path[-1]

            if node in visited:
                continue

            visited.add(node)

            if node == b:
                return (cost, path)

            for neighbor in self.neighbors(node):
                if neighbor not in visited:
                    new_cost = cost + self.edges.get((node, neighbor), float('inf'))
                    new_path = path + [neighbor]
                    heapq.heappush(priority_queue, (new_cost, new_path))

        return None
    def __init__(self):
        self.nodes = set()
        self.edges = {}

    def add_node(self, n):
        self.nodes.add(n)

    def add_edge(self, a, b, weight=1):
        if a in self.nodes and b in self.nodes:
            self.edges[(a, b)] = weight
            self.nodes.add(b)
            self.nodes.add(a)

    def nodes(self):
        return list(self.nodes)

    def neighbors(self, a):
        return self.nodes.get(a, [])

    def bfs(self, start):
        visited = set()
        queue = [start]
        while queue:
            node = queue.pop(0)
            if node not in visited:
                visited.add(node)
                queue.extend(self.neighbors(node))
        return visited

    def shortest_path(self, a, b):
        if a not in self.nodes or b not in self.nodes:
            raise KeyError("Unknown node")

        if a == b:
            return (0, [a])

        import heapq
        priority_queue = [(0, [a])]
        visited = set()

        while priority_queue:
            cost, path = heapq.heappop(priority_queue)
            node = path[-1]

            if node in visited:
                continue

            visited.add(node)

            if node == b:
                return (cost, path)

            for neighbor in self.neighbors(node):
                if neighbor not in visited:
                    new_cost = cost + self.edges.get((node, neighbor), float('inf'))
                    new_path = path + [neighbor]
                    heapq.heappush(priority_queue, (new_cost, new_path))

        return None
    def __init__(self):
        self.nodes = set()
        self.edges = {}

    def add_node(self, n):
        self.nodes.add(n)

    def add_edge(self, a, b, weight=1):
        if a in self.nodes and b in self.nodes:
            self.edges[(a, b)] = weight
            self.nodes.add(b)
            self.nodes.add(a)

    def nodes(self):
        return list(self.nodes)

    def neighbors(self, a):
        return self.nodes.get(a, [])

    def bfs(self, start):
        visited = set()
        queue = [start]
        while queue:
            node = queue.pop(0)
            if node not in visited:
                visited.add(node)
                queue.extend(self.neighbors(node))
        return visited

    def shortest_path(self, a, b):
        if a not in self.nodes or b not in self.nodes:
            raise KeyError("Unknown node")

        if a == b:
            return (0, [a])

        import heapq
        priority_queue = [(0, [a])]
        visited = set()

        while priority_queue:
            cost, path = heapq.heappop(priority_queue)
            node = path[-1]

            if node in visited:
                continue

            visited.add(node)

            if node == b:
                return (cost, path)

            for neighbor in self.neighbors(node):
                if neighbor not in visited:
                    new_cost = cost + self.edges.get((node, neighbor), float('inf'))
                    new_path = path + [neighbor]
                    heapq.heappush(priority_queue, (new_cost, new_path))

        return None
    def __init__(self):
        self.nodes = set()
        self.edges = {}

    def add_node(self, n):
        self.nodes.add(n)

    def add_edge(self, a, b, weight=1):
        if a in self.nodes and b in self.nodes:
            self.edges[(a, b)] = weight
            self.nodes.add(b)
            self.nodes.add(a)

    def nodes(self):
        return list(self.nodes)

    def neighbors(self, a):
        return self.nodes.get(a, [])

    def bfs(self, start):
        visited = set()
        queue = [start]
        while queue:
            node = queue.pop(0)
            if node not in visited:
                visited.add(node)
                queue.extend(self.neighbors(node))
        return visited

    def shortest_path(self, a, b):
        if a not in self.nodes or b not in self.nodes:
            raise KeyError("Unknown node")

        if a == b:
            return (0, [a])

        import heapq
        priority_queue = [(0, [a])]
        visited = set()

        while priority_queue:
            cost, path = heapq.heappop(priority_queue)
            node = path[-1]

            if node in visited:
                continue

            visited.add(node)

            if node == b:
                return (cost, path)

            for neighbor in self.neighbors(node):
                if neighbor not in visited:
                    new_cost = cost + self.edges.get((node, neighbor), float('inf'))
                    new_path = path + [neighbor]
                    heapq.heappush(priority_queue, (new_cost, new_path))

        return None
    def __init__(self):
        self.nodes = set()
        self.edges = {}

    def add_node(self, n):
        self.nodes.add(n)

    def add_edge(self, a, b, weight=1):
        if a in self.nodes and b in self.nodes:
            self.edges[(a, b)] = weight
            self.nodes.add(b)
            self.nodes.add(a)

    def nodes(self):
        return list(self.nodes)

    def neighbors(self, a):
        return self.nodes.get(a, [])

    def bfs(self, start):
        visited = set()
        queue = [start]
        while queue:
            node = queue.pop(0)
            if node not in visited:
                visited.add(node)
                queue.extend(self.neighbors(node))
        return visited

    def shortest_path(self, a, b):
        if a not in self.nodes or b not in self.nodes:
            raise KeyError("Unknown node")

        if a == b:
            return (0, [a])

        import heapq
        priority_queue = [(0, [a])]
        visited = set()

        while priority_queue:
            cost, path = heapq.heappop(priority_queue)
            node = path[-1]

            if node in visited:
                continue

            visited.add(node)

            if node == b:
                return (cost, path)

            for neighbor in self.neighbors(node):
                if neighbor not in visited:
                    new_cost = cost + self.edges.get((node, neighbor), float('inf'))
                    new_path = path + [neighbor]
                    heapq.heappush(priority_queue, (new_cost, new_path))

        return None
    def __init__(self):
        self.nodes = set()
        self.edges = {}

    def add_node(self, n):
        self.nodes.add(n)

    def add_edge(self, a, b, weight=1):
        if a in self.nodes and b in self.nodes:
            self.edges[(a, b)] = weight
            self.nodes.add(b)
            self.nodes.add(a)

    def nodes(self):
        return list(self.nodes)

    def neighbors(self, a):
        return self.nodes.get(a, [])

    def bfs(self, start):
        visited = set()
        queue = [start]
        while queue:
            node = queue.pop(0)
            if node not in visited:
                visited.add(node)
                queue.extend(self.neighbors(node))
        return visited

    def shortest_path(self, a, b):
        if a not in self.nodes or b not in self.nodes:
            raise KeyError("Unknown node")

        if a == b:
            return (0, [a])

        import heapq
        priority_queue = [(0, [a])]
        visited = set()

        while priority_queue:
            cost, path = heapq.heappop(priority_queue)
            node = path[-1]

            if node in visited:
                continue

            visited.add(node)

            if node == b:
                return (cost, path)

            for neighbor in self.neighbors(node):
                if neighbor not in visited:
                    new_cost = cost + self.edges.get((node, neighbor), float('inf'))
                    new_path = path + [neighbor]
                    heapq.heappush(priority_queue, (new_cost, new_path))

        return None
    def __init__(self):
        self.nodes = set()
        self.edges = {}

    def add_node(self, n):
        self.nodes.add(n)

    def add_edge(self, a, b, weight=1):
        if a in self.nodes and b in self.nodes:
            self.edges[(a, b)] = weight
            self.nodes.add(b)
            self.nodes.add(a)

    def nodes(self):
        return list(self.nodes)

    def neighbors(self, a):
        return self.nodes.get(a, [])

    def bfs(self, start):
        visited = set()
        queue = [start]
        while queue:
            node = queue.pop(0)
            if node not in visited:
                visited.add(node)
                queue.extend(self.neighbors(node))
        return visited

    def shortest_path(self, a, b):
        if a not in self.nodes or b not in self.nodes:
            raise KeyError("Unknown node")

        if a == b:
            return (0, [a])

        import heapq
        priority_queue = [(0, [a])]
        visited = set()

        while priority_queue:
            cost, path = heapq.heappop(priority_queue)
            node = path[-1]

            if node in visited:
                continue

            visited.add(node)

            if node == b:
                return (cost, path)

            for neighbor in self.neighbors(node):
                if neighbor not in visited:
                    new_cost = cost + self.edges.get((node, neighbor), float('inf'))
                    new_path = path + [neighbor]
                    heapq.heappush(priority_queue, (new_cost, new_path))

        return None
    def __init__(self):
        self.nodes = set()
        self.edges = {}

    def add_node(self, n):
        self.nodes.add(n)

    def add_edge(self, a, b, weight=1):
        if a in self.nodes and b in self.nodes:
            self.edges[(a, b)] = weight
            self.nodes.add(b)
            self.nodes.add(a)

    def nodes(self):
        return list(self.nodes)

    def neighbors(self, a):
        return self.nodes.get(a, [])

    def bfs(self, start):
        visited = set()
        queue = [start]
        while queue:
            node = queue.pop(0)
            if node not in visited:
                visited.add(node)
                queue.extend(self.neighbors(node))
        return visited

    def shortest_path(self, a, b):
        if a not in self.nodes or b not in self.nodes:
            raise KeyError("Unknown node")

        if a == b:
            return (0, [a])

        import heapq
        priority_queue = [(0, [a])]
        visited = set()

        while priority_queue:
            cost, path = heapq.heappop(priority_queue)
            node = path[-1]

            if node in visited:
                continue

            visited.add(node)

            if node == b:
                return (cost, path)

            for neighbor in self.neighbors(node):
                if neighbor not in visited:
                    new_cost = cost + self.edges.get((node, neighbor), float('inf'))
                    new_path = path + [neighbor]
                    heapq.heappush(priority_queue, (new_cost, new_path))

        return None
    def __init__(self):
        self.nodes = set()
        self.edges = {}

    def add_node(self, n):
        self.nodes.add(n)

    def add_edge(self, a, b, weight=1):
        if a in self.nodes and b in self.nodes:
            self.edges[(a, b)] = weight
            self.nodes.add(b)
            self.nodes.add(a)

    def nodes(self):
        return list(self.nodes)

    def neighbors(self, a):
        return self.nodes.get(a, [])

    def bfs(self, start):
        visited = set()
        queue = [start]
        while queue:
            node = queue.pop(0)
            if node not in visited:
                visited.add(node)
                queue.extend(self.neighbors(node))
        return visited

    def shortest_path(self, a, b):
        if a not in self.nodes or b not in self.nodes:
            raise KeyError("Unknown node")

        if a == b:
            return (0, [a])

        import heapq
        priority_queue = [(0, [a])]
        visited = set()

        while priority_queue:
            cost, path = heapq.heappop(priority_queue)
            node = path[-1]

            if node in visited:
                continue

            visited.add(node)

            if node == b:
                return (cost, path)

            for neighbor in self.neighbors(node):
                if neighbor not in visited:
                    new_cost = cost + self.edges.get((node, neighbor), float('inf'))
                    new_path = path + [neighbor]
                    heapq.heappush(priority_queue, (new_cost, new_path))

        return None
    def __init__(self):
        self.nodes = set()
        self.edges = {}

    def add_node(self, n):
        self.nodes.add(n)

    def add_edge(self, a, b, weight=1):
        if a in self.nodes and b in self.nodes:
            self.edges[(a, b)] = weight
            self.nodes.add(b)
            self.nodes.add(a)

    def nodes(self):
        return list(self.nodes)

    def neighbors(self, a):
        return self.nodes.get(a, [])

    def bfs(self, start):
        visited = set()
        queue = [start]
        while queue:
            node = queue.pop(0)
            if node not in visited:
                visited.add(node)
                queue.extend(self.neighbors(node))
        return visited

    def shortest_path(self, a, b):
        if a not in self.nodes or b not in self.nodes:
            raise KeyError("Unknown node")

        if a == b:
            return (0, [a])

        import heapq
        priority_queue = [(0, [a])]
        visited = set()

        while priority_queue:
            cost, path = heapq.heappop(priority_queue)
            node = path[-1]

            if node in visited:
                continue

            visited.add(node)

            if node == b:
                return (cost, path)

            for neighbor in self.neighbors(node):
                if neighbor not in visited:
                    new_cost = cost + self.edges.get((node, neighbor), float('inf'))
                    new_path = path + [neighbor]
                    heapq.heappush(priority_queue, (new_cost, new_path))

        return None
    def __init__(self):
        self.nodes = set()
        self.edges = {}

    def add_node(self, n):
        self.nodes.add(n)

    def add_edge(self, a, b, weight=1):
        if a in self.nodes and b in self.nodes:
            self.edges[(a, b)] = weight
            self.nodes.add(b)
            self.nodes.add(a)

    def nodes(self):
        return list(self.nodes)

    def neighbors(self, a):
        return self.nodes.get(a, [])

    def bfs(self, start):
        visited = set()
        queue = [start]
        while queue:
            node = queue.pop(0)
            if node not in visited:
                visited.add(node)
                queue.extend(self.neighbors(node))
        return visited

    def shortest_path(self, a, b):
        if a not in self.nodes or b not in self.nodes:
            raise KeyError("Unknown node")

        if a == b:
            return (0, [a])

        import heapq
        priority_queue = [(0, [a])]
        visited = set()

        while priority_queue:
            cost, path = heapq.heappop(priority_queue)
            node = path[-1]

            if node in visited:
                continue

            visited.add(node)

            if node == b:
                return (cost, path)

            for neighbor in self.neighbors(node):
                if neighbor not in visited:
                    new_cost = cost + self.edges.get((node, neighbor), float('inf'))
                    new_path = path + [neighbor]
                    heapq.heappush(priority_queue, (new_cost, new_path))

        return None
    def __init__(self):
        self.nodes = set()
        self.edges = {}

    def add_node(self, n):
        self.nodes.add(n)

    def add_edge(self, a, b, weight=1):
        if a in self.nodes and b in self.nodes:
            self.edges[(a, b)] = weight
            self.nodes.add(b)
            self.nodes.add(a)

    def nodes(self):
        return list(self.nodes)

    def neighbors(self, a):
        return self.nodes.get(a, [])

    def bfs(self, start):
        visited = set()
        queue = [start]
        while queue:
            node = queue.pop(0)
            if node not in visited:
                visited.add(node)
                queue.extend(self.neighbors(node))
        return visited

    def shortest_path(self, a, b):
        if a not in self.nodes or b not in self.nodes:
            raise KeyError("Unknown node")

        if a == b:
            return (0, [a])

        import heapq
        priority_queue = [(0, [a])]
        visited = set()

        while priority_queue:
            cost, path = heapq.heappop(priority_queue)
            node = path[-1]

            if node in visited:
                continue

            visited.add(node)

            if node == b:
                return (cost, path)

            for neighbor in self.neighbors(node):
                if neighbor not in visited:
                    new_cost = cost + self.edges.get((node, neighbor), float('inf'))
                    new_path = path + [neighbor]
                    heapq.heappush(priority_queue, (new_cost, new_path))

        return None
    def __init__(self):
        self.nodes = set()
        self.edges = {}

    def add_node(self, n):
        self.nodes.add(n)

    def add_edge(self, a, b, weight=1):
        if a in self.nodes and b in self.nodes:
            self.edges[(a, b)] = weight
            self.nodes.add(b)
            self.nodes.add(a)

    def nodes(self):
        return list(self.nodes)

    def neighbors(self, a):
        return self.nodes.get(a, [])

    def bfs(self, start):
        visited = set()
        queue = [start]
        while queue:
            node = queue.pop(0)
            if node not in visited:
                visited.add(node)
                queue.extend(self.neighbors(node))
        return visited

    def shortest_path(self, a, b):
        if a not in self.nodes or b not in self.nodes:
            raise KeyError("Unknown node")

        if a == b:
            return (0, [a])

        import heapq
        priority_queue = [(0, [a])]
        visited = set()

        while priority_queue:
            cost, path = heapq.heappop(priority_queue)
            node = path[-1]

            if node in visited:
                continue

            visited.add(node)

            if node == b:
                return (cost, path)

            for neighbor in self.neighbors(node):
                if neighbor not in visited:
                    new_cost = cost + self.edges.get((node, neighbor), float('inf'))
                    new_path = path + [neighbor]
                    heapq.heappush(priority_queue, (new_cost, new_path))

        return None
    def __init__(self):
        self.nodes = {}
        self.edges = {}

    def add_node(self, n):
        if n not in self.nodes:
            self.nodes[n] = []

    def add_edge(self, a, b, weight=1):
        if a in self.nodes and b in self.nodes:
            self.edges[(a, b)] = weight
            self.nodes[a].append(b)
            self.nodes[b].append(a)

    def nodes(self):
        return list(self.nodes.keys())

    def neighbors(self, a):
        return self.nodes.get(a, [])

    def bfs(self, start):
        visited = set()
        queue = [start]
        while queue:
            node = queue.pop(0)
            if node not in visited:
                visited.add(node)
                queue.extend(self.neighbors(node))
        return visited

    def shortest_path(self, a, b):
        if a not in self.nodes or b not in self.nodes:
            raise KeyError("Unknown node")

        if a == b:
            return (0, [a])

        import heapq
        priority_queue = [(0, [a])]
        visited = set()

        while priority_queue:
            cost, path = heapq.heappop(priority_queue)
            node = path[-1]

            if node in visited:
                continue

            visited.add(node)

            if node == b:
                return (cost, path)

            for neighbor in self.neighbors(node):
                if neighbor not in visited:
                    new_cost = cost + self.edges.get((node, neighbor), float('inf'))
                    new_path = path + [neighbor]
                    heapq.heappush(priority_queue, (new_cost, new_path))

        return None
    def __init__(self):
        self._nodes = set()
        self.edges = {}

    def add_node(self, n):
        self._nodes.add(n)

    def add_edge(self, a, b, weight=1):
        if a not in self._nodes or b not in self._nodes:
            raise ValueError("Both nodes must exist in the graph")
        self.edges[a].append((b, weight))
        self.edges[b].append((a, weight))

    def nodes(self):
        return self._nodes

    def neighbors(self, a):
        if a not in self._nodes:
            raise KeyError(f"Node {a} is unknown")
        return [neighbor for neighbor, _ in self.edges[a]]

    def bfs(self, start):
        if start not in self._nodes:
            raise KeyError(f"Start node {start} is unknown")
        
        visited = set()
        queue = deque([start])
        result = []

        while queue:
            node = queue.popleft()
            if node not in visited:
                visited.add(node)
                result.append(node)
                neighbors = sorted(self.neighbors(node))
                for neighbor in neighbors:
                    if neighbor not in visited:
                        queue.append(neighbor)

        return result

    def add_node(self, n):
        self.nodes.add(n)

    def add_edge(self, a, b, weight=1):
        if a not in self.nodes or b not in self.nodes:
            raise ValueError("Both nodes must exist in the graph")
        self.edges[a].append((b, weight))
        self.edges[b].append((a, weight))

    def nodes(self):
        return self.nodes

    def neighbors(self, a):
        if a not in self.nodes:
            raise KeyError(f"Node {a} is unknown")
        return [neighbor for neighbor, _ in self.edges[a]]

    def bfs(self, start):
        if start not in self.nodes:
            raise KeyError(f"Start node {start} is unknown")
        
        visited = set()
        queue = deque([start])
        result = []

        while queue:
            node = queue.popleft()
            if node not in visited:
                visited.add(node)
                result.append(node)
                neighbors = sorted(self.neighbors(node))
                for neighbor in neighbors:
                    if neighbor not in visited:
                        queue.append(neighbor)

        return result

    def add_node(self, n):
        self._nodes.add(n)

    def add_edge(self, a, b, weight=1):
        if a not in self._nodes or b not in self._nodes:
            raise ValueError("Both nodes must exist in the graph")
        self.edges[a].append((b, weight))
        self.edges[b].append((a, weight))

    def nodes(self):
        return self._nodes

    def neighbors(self, a):
        if a not in self._nodes:
            raise KeyError(f"Node {a} is unknown")
        return [neighbor for neighbor, _ in self.edges[a]]

    def bfs(self, start):
        if start not in self._nodes:
            raise KeyError(f"Start node {start} is unknown")
        
        visited = set()
        queue = deque([start])
        result = []

        while queue:
            node = queue.popleft()
            if node not in visited:
                visited.add(node)
                result.append(node)
                neighbors = sorted(self.neighbors(node))
                for neighbor in neighbors:
                    if neighbor not in visited:
                        queue.append(neighbor)

        return result

    def bfs(self, start):
        if start not in self._nodes:
            raise KeyError(f"Start node {start} is unknown")
        
        visited = set()
        queue = deque([start])
        result = []

        while queue:
            node = queue.popleft()
            if node not in visited:
                visited.add(node)
                result.append(node)
                neighbors = sorted(self.neighbors(node))
                for neighbor in neighbors:
                    if neighbor not in visited:
                        queue.append(neighbor)

        return result

    def add_node(self, n):
        self.nodes.add(n)

    def add_edge(self, a, b, weight=1):
        if weight <= 0:
            raise ValueError("Weight must be a positive number")
        if a not in self.nodes:
            self.add_node(a)
        if b not in self.nodes:
            self.add_node(b)
        self.edges[(a, b)] = weight

    def nodes(self):
        return sorted(self.nodes)

    def neighbors(self, a):
        if a not in self.nodes:
            return []
        return sorted([(b, self.edges[(a, b)]) for b in self.nodes if (a, b) in self.edges])

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
    except ValueError:
        pass
    else:
        assert False, "ValueError not raised for negative weight"