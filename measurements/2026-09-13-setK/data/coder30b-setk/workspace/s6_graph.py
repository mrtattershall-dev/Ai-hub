class Graph:
    def __init__(self):
        self._nodes = set()
        self._edges = {}
    
    def add_node(self, n):
        """Add a node to the graph."""
        self._nodes.add(n)
    
    def add_edge(self, a, b, weight=1):
        """Add an edge from node a to node b with given weight.
        
        Args:
            a: source node
            b: target node  
            weight: positive number (default 1)
            
        Raises:
            ValueError: if weight is not a positive number
        """
        if not isinstance(weight, (int, float)) or weight <= 0:
            raise ValueError("Weight must be a positive number")
        
        self.add_node(a)
        self.add_node(b)
        
        if a not in self._edges:
            self._edges[a] = {}
        self._edges[a][b] = weight
    
    def nodes(self):
        """Return a sorted list of all nodes."""
        return sorted(list(self._nodes))
    
    def neighbors(self, a):
        """Return a sorted list of (node, weight) tuples for neighbors of node a."""
        if a not in self._edges:
            return []
        return sorted([(node, weight) for node, weight in self._edges[a].items()])
    
    def bfs(self, start):
        """Return nodes reachable from start in breadth-first order, visiting neighbors in sorted order.
        
        Args:
            start: starting node
            
        Returns:
            list: nodes in BFS order
            
        Raises:
            KeyError: if start node is not in the graph
        """
        if start not in self._nodes:
            raise KeyError(f"Start node '{start}' not in graph")
            
        visited = set()
        queue = [start]
        result = []
        
        while queue:
            node = queue.pop(0)
            if node not in visited:
                visited.add(node)
                result.append(node)
                # Get neighbors in sorted order
                for neighbor, _ in self.neighbors(node):
                    if neighbor not in visited:
                        queue.append(neighbor)
        
        return result

    def shortest_path(self, a, b):
        """Return the shortest path from node a to node b using Dijkstra's algorithm.
        
        Args:
            a: start node
            b: end node
            
        Returns:
            tuple: (cost, [a, ..., b]) for the cheapest path, or None if b cannot be reached
            If a == b, returns (0, [a])
            
        Raises:
            KeyError: if either node is not in the graph
        """
        if a not in self._nodes:
            raise KeyError(f"Start node '{a}' not in graph")
        if b not in self._nodes:
            raise KeyError(f"End node '{b}' not in graph")
            
        # Special case: same node
        if a == b:
            return (0, [a])
            
        # Dijkstra's algorithm
        distances = {node: float('inf') for node in self._nodes}
        distances[a] = 0
        previous = {}
        unvisited = set(self._nodes)
        
        while unvisited:
            # Find node with minimum distance
            current = min(unvisited, key=lambda node: distances[node])
            
            # If we can't reach b, we're done
            if distances[current] == float('inf'):
                break
                
            # If we reached the target
            if current == b:
                break
                
            unvisited.remove(current)
            
            # Update distances to neighbors
            for neighbor, weight in self.neighbors(current):
                if neighbor in unvisited:
                    new_distance = distances[current] + weight
                    if new_distance < distances[neighbor]:
                        distances[neighbor] = new_distance
                        previous[neighbor] = current
        
        # If we never reached b, it's unreachable
        if b not in previous and a != b:
            return None
            
        # Reconstruct path
        path = []
        current = b
        while current in previous:
            path.append(current)
            current = previous[current]
        path.append(a)
        path.reverse()
        
        return (distances[b], path)

    def has_cycle(self):
        """Return True if the graph has a directed cycle, False otherwise.
        
        A directed cycle is a path that starts and ends at the same node,
        following directed edges. An edge from a node to itself counts as a cycle.
        
        Returns:
            bool: True if there is a directed cycle, False otherwise
        """
        # Track visited nodes and nodes in current recursion stack
        visited = set()
        rec_stack = set()
        
        def dfs(node):
            # Mark current node as visited and add to recursion stack
            visited.add(node)
            rec_stack.add(node)
            
            # Check neighbors
            for neighbor, _ in self.neighbors(node):
                # If neighbor is not visited, recursively check it
                if neighbor not in visited:
                    if dfs(neighbor):
                        return True
                # If neighbor is in recursion stack, we found a cycle
                elif neighbor in rec_stack:
                    return True
            
            # Remove node from recursion stack
            rec_stack.remove(node)
            return False
        
        # Check all nodes for cycles
        for node in self.nodes():
            if node not in visited:
                if dfs(node):
                    return True
        
        return False

if __name__ == "__main__":
    # Test the implementation
    g = Graph()
    
    # Test add_node
    g.add_node("A")
    g.add_node("B")
    g.add_node("C")
    
    # Test nodes() method
    assert g.nodes() == ["A", "B", "C"]
    
    # Test add_edge
    g.add_edge("A", "B", 5)
    g.add_edge("B", "C", 3)
    
    # Test neighbors
    assert g.neighbors("A") == [("B", 5)]
    assert g.neighbors("B") == [("C", 3)]
    assert g.neighbors("C") == []
    
    # Test edge replacement
    g.add_edge("A", "B", 10)
    assert g.neighbors("A") == [("B", 10)]
    
    # Test weight validation
    try:
        g.add_edge("C", "A", -1)
        assert False, "Should have raised ValueError"
    except ValueError:
        pass
    
    try:
        g.add_edge("C", "A", 0)
        assert False, "Should have raised ValueError"
    except ValueError:
        pass
    
    # Test with string nodes
    g.add_node("Z")
    g.add_edge("Z", "A", 2)
    assert g.neighbors("Z") == [("A", 2)]
    
    print("All tests passed!")