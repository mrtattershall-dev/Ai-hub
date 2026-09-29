from collections import defaultdict

from collections import defaultdict

from collections import defaultdict

class Graph:
    def __init__(self):
        self._nodes = set()
        self.edges = {}

    def nodes(self):
        return list(self._nodes)
        pass

    @staticmethod
    def from_text(text):
        lines = text.splitlines()
        graph = Graph()
        for i, line in enumerate(lines):
            if line.strip() == "" or line.startswith("#"):
                continue
            parts = line.split(" -> ")
            if len(parts) != 2:
                raise ValueError(f"Malformed line {i + 1}")
            a, b = parts
            parts = b.split()
            if len(parts) == 1:
                weight = 1
            elif len(parts) == 2:
                weight = int(parts[1])
            else:
                raise ValueError(f"Malformed line {i + 1}")
            graph.add_edge(a, b, weight)
        return graph
        self._nodes = set()
        self.edges = defaultdict(list)

    def nodes(self):
        return list(self._nodes)

    def add_node(self, n):
        self._nodes.add(n)

    def to_dot(self):
        dot_lines = ["digraph {"]

        # Edges
        for a in sorted(self._nodes):
            for b, weight in sorted(self.edges[a]):
                dot_lines.append(f"  {a} -> {b} [weight={weight}];")

        # Nodes without edges
        for n in sorted(self._nodes):
            if not self.edges[n]:
                dot_lines.append(f"  {n};")

        dot_lines.append("}")
        return "\n".join(dot_lines)

    def nodes(self):
        return list(self._nodes)

    def to_dot(self):
        dot_lines = ["digraph {"]

        # Edges
        for a in sorted(self._nodes):
            for b, weight in sorted(self.edges[a]):
                dot_lines.append(f"  {a} -> {b} [weight={weight}];")

        # Nodes without edges
        for n in sorted(self._nodes):
            if not self.edges[n]:
                dot_lines.append(f"  {n};")

        dot_lines.append("}")
        return "\n".join(dot_lines)

    def to_dot(self):
        dot_lines = ["digraph {"]

        # Edges
        for a in sorted(self.nodes):
            for b, weight in sorted(self.edges[a]):
                dot_lines.append(f"  {a} -> {b} [weight={weight}];")

        # Nodes without edges
        for n in sorted(self.nodes):
            if not self.edges[n]:
                dot_lines.append(f"  {n};")

        dot_lines.append("}")
        return "\n".join(dot_lines)
        self.nodes = set()
        self.edges = defaultdict(list)

    def to_dot(self):
        dot_lines = ["digraph {"]

        # Edges
        for a in sorted(self.nodes):
            for b, weight in sorted(self.edges[a]):
                dot_lines.append(f"  {a} -> {b} [weight={weight}];")

        # Nodes without edges
        for n in sorted(self.nodes):
            if not self.edges[n]:
                dot_lines.append(f"  {n};")

        dot_lines.append("}")
        return "\n".join(dot_lines)
        self._nodes = set()
        self._nodes = set()
        self.edges = {}

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
        return sorted([(b, self.edges[(a, b)]) for b in self.edges if b[0] == a])

if __name__ == "__main__":
    # Test cases
    g = Graph()
    g.add_node(1)
    g.add_node(2)
    g.add_edge(1, 2, 3)
    g.add_edge(2, 1, 4)
    g.add_edge(1, 2, 5)  # Should replace the weight to 5

    assert g.nodes() == [1, 2]
    assert g.neighbors(1) == [(2, 5)]
    assert g.neighbors(2) == [(1, 4)]

    try:
        g.add_edge(1, 2, -1)
    except ValueError as e:
        assert str(e) == "Weight must be a positive number"

    print("All tests passed")
    def bfs(self, start):
        if start not in self.nodes:
            raise KeyError(f"Node {start} not found in the graph")
        
        visited = set()
        queue = deque([start])
        result = []

        while queue:
            node = queue.popleft()
            if node not in visited:
                visited.add(node)
                result.append(node)
                for neighbor, _ in self.neighbors(node):
                    if neighbor not in visited:
                        queue.append(neighbor)

        return result
    def shortest_path(self, start, end):
        import heapq
        if start not in self.nodes or end not in self.nodes:
            raise KeyError("Node not in graph")

        distances = {node: float('inf') for node in self.nodes}
        distances[start] = 0
        priority_queue = [(0, start)]

        while priority_queue:
            current_distance, current_node = heapq.heappop(priority_queue)

            if current_distance > distances[current_node]:
                continue

            if current_node == end:
                return current_distance, [start]

            for neighbor, weight in self.edges[current_node]:
                distance = current_distance + weight

                if distance < distances[neighbor]:
                    distances[neighbor] = distance
                    heapq.heappush(priority_queue, (distance, neighbor))

        return None, []
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

            for neighbor in self.neighbors(node):
                if dfs(neighbor):
                    return True

            rec_stack.remove(node)
            return False

        for node in self.nodes():
            if dfs(node):
                return True

        return False
    def topo_order(self):
        visited = set()
        stack = []
        temp_stack = []

        def dfs(node):
            visited.add(node)
            temp_stack.append(node)

            for neighbor in self.neighbors(node):
                if neighbor[0] not in visited:
                    dfs(neighbor[0])
                elif neighbor[0] in temp_stack:
                    raise ValueError("Graph has a cycle")

            temp_stack.remove(node)
            stack.append(node)

        for node in self.nodes():
            if node not in visited:
                dfs(node)

        return stack[::-1]
    def remove_node(self, n):
        if n not in self.nodes:
            raise KeyError(f"Node {n} not found in the graph")
        
        # Remove all edges connected to the node
        edges_to_remove = [edge for edge in self.edges if n in edge]
        for edge in edges_to_remove:
            del self.edges[edge]
        
        # Remove the node from the set of nodes
        self.nodes.remove(n)
    def reachable(self, a):
        if a not in self.nodes():
            raise KeyError(f"Node {a} is not in the graph")
        visited = set()
        stack = [a]
        reachable_nodes = []

        while stack:
            node = stack.pop()
            if node not in visited:
                visited.add(node)
                reachable_nodes.append(node)
                stack.extend(self.neighbors(node))

        return sorted(reachable_nodes)
    def components(self):
        visited = set()
        components = []

        def dfs(node, component):
            stack = [node]
            while stack:
                current = stack.pop()
                if current not in visited:
                    visited.add(current)
                    component.append(current)
                    for neighbor in self.neighbors(current):
                        if neighbor not in visited:
                            stack.append(neighbor)

        for node in self.nodes():
            if node not in visited:
                component = []
                dfs(node, component)
                components.append(sorted(component))

        return sorted(components, key=lambda x: x[0])
def test_from_text():
    text = """# This is a comment
A -> B
C -> D 2
E -> F
G -> H 3
"""
    graph = Graph.from_text(text)
    assert graph.nodes() == {'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'}
    assert graph.neighbors('A') == {'B'}
    assert graph.neighbors('C') == {'D'}
    assert graph.neighbors('D') == set()
    assert graph.neighbors('E') == {'F'}
    assert graph.neighbors('F') == set()
    assert graph.neighbors('G') == {'H'}
    assert graph.neighbors('H') == set()

    try:
        Graph.from_text("A -> B -> C")
    except ValueError as e:
        assert str(e) == "Malformed line 1"

    try:
        Graph.from_text("A -> B W 3")
    except ValueError as e:
        assert str(e) == "Malformed line 1"

    print("All tests passed!")

if __name__ == "__main__":
    test_from_text()
