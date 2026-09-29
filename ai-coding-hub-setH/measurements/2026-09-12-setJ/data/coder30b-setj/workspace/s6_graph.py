class Graph:
    def __init__(self):
        # Store nodes and edges
        self.nodes_set = set()
        self.edges = {}
    
    def add_node(self, n):
        """Add a node to the graph. Adding an existing node is not an error."""
        self.nodes_set.add(n)
    
    def add_edge(self, a, b, weight=1):
        """Add an edge from node a to node b with given weight.
        Adds both nodes if they don't exist.
        Raises ValueError if weight is not a positive number.
        Replaces existing edge with new weight."""
        # Validate weight
        if not isinstance(weight, (int, float)) or weight <= 0:
            raise ValueError("Weight must be a positive number")
        
        # Add nodes if they don't exist
        self.add_node(a)
        self.add_node(b)
        
        # Add edge (replace if exists)
        if a not in self.edges:
            self.edges[a] = {}
        self.edges[a][b] = weight
    
    def nodes(self):
        """Return a sorted list of all nodes."""
        return sorted(list(self.nodes_set))
    
    def neighbors(self, a):
        """Return a sorted list of (b, weight) tuples for neighbors of node a."""
        if a not in self.edges:
            return []
        
        # Return neighbors sorted by node name
        return sorted([(b, weight) for b, weight in self.edges[a].items()])
    
    def bfs(self, start):
        """Return nodes reachable from start in breadth-first order, visiting neighbors in sorted order.
        Raises KeyError if start is not in the graph."""
        if start not in self.nodes_set:
            raise KeyError(f"Start node {start} not in graph")
        
        visited = set()
        queue = [start]
        result = []
        
        while queue:
            node = queue.pop(0)
            if node not in visited:
                visited.add(node)
                result.append(node)
                # Add neighbors in sorted order
                for neighbor, _ in self.neighbors(node):
                    if neighbor not in visited:
                        queue.append(neighbor)
        
        return result


# Test code
if __name__ == "__main__":
    # Test basic functionality
    g = Graph()
    
    # Test add_node
    g.add_node("a")
    g.add_node("b")
    g.add_node("a")  # Adding existing node should not error
    
    assert g.nodes() == ["a", "b"]
    
    # Test add_edge
    g.add_edge("a", "b", 5)
    assert g.neighbors("a") == [("b", 5)]
    
    # Test add_edge with default weight
    g.add_edge("b", "c")
    assert g.neighbors("b") == [("c", 1)]
    
    # Test replacing edge weight
    g.add_edge("a", "b", 10)
    assert g.neighbors("a") == [("b", 10)]
    
    # Test nodes() with multiple nodes
    g.add_node("z")
    g.add_node("m")
    assert g.nodes() == ["a", "b", "c", "m", "z"]
    
    # Test neighbors with no neighbors
    assert g.neighbors("c") == []
    
    # Test error case - negative weight
    try:
        g.add_edge("c", "d", -1)
        assert False, "Should have raised ValueError"
    except ValueError:
        pass  # Expected
    
    # Test error case - zero weight
    try:
        g.add_edge("c", "d", 0)
        assert False, "Should have raised ValueError"
    except ValueError:
        pass  # Expected
    # Test error case - non-numeric weight
    try:
        g.add_edge("c", "d", "invalid")
        assert False, "Should have raised ValueError"
    except ValueError:
        pass  # Expected
    
    # Test BFS method
    # Create a test graph: a -> b -> c, a -> d
    g.add_edge("a", "b", 1)
    g.add_edge("b", "c", 1)
    g.add_edge("a", "d", 1)
    
    # BFS from 'a' should return ['a', 'b', 'd', 'c'] in breadth-first order
    assert g.bfs("a") == ["a", "b", "d", "c"]
    
    # BFS from 'b' should return ['b', 'c'] 
    assert g.bfs("b") == ["b", "c"]
    
    # BFS from 'c' should return ['c']
    assert g.bfs("c") == ["c"]
    
    # Test KeyError for unknown start node
    try:
        g.bfs("unknown")
        assert False, "Should have raised KeyError"
    except KeyError:
        pass  # Expected

    print("All tests passed!")