from collections import deque

class Graph:
    def __init__(self):
        # Store nodes and edges
        self.nodes_set = set()
        self.edges = {}
    
    def add_node(self, n):
        """Add a node to the graph."""
        self.nodes_set.add(n)
    
    def add_edge(self, a, b, weight=1):
        """Add an edge between nodes a and b with given weight."""
        # Check if weight is positive
        if weight <= 0:
            raise ValueError("Weight must be a positive number")
        
        # Add nodes if they don't exist
        self.add_node(a)
        self.add_node(b)
        
        # Add edge (replace if exists)
        if a not in self.edges:
            self.edges[a] = {}
        self.edges[a][b] = weight
    
    def nodes(self):
        """Return every node sorted."""
        return sorted(list(self.nodes_set))
    
    def neighbors(self, a):
        """Return a sorted list of (b, weight) tuples for neighbors of node a."""
        if a not in self.edges:
            return []
        
        # Return neighbors sorted by node name
        return sorted([(node, weight) for node, weight in self.edges[a].items()])
    
    def bfs(self, start):
        """Return nodes reachable from start in breadth-first order, visiting neighbors in sorted order."""
        if start not in self.nodes_set:
            raise KeyError("Start node not in graph")
        
        visited = set()
        queue = deque([start])
        result = []
        
        while queue:
            node = queue.popleft()
            if node not in visited:
                visited.add(node)
                result.append(node)
                # Add neighbors in sorted order
                neighbors = sorted(self.neighbors(node), key=lambda x: x[0])
                for neighbor, _ in neighbors:
                    if neighbor not in visited:
                        queue.append(neighbor)
        
        return result

    def shortest_path(self, a, b):
        """Return (cost, [a, ..., b]) for the cheapest path from a to b, or None if b cannot be reached.
        shortest_path(a, a) is (0, [a]). An unknown node raises KeyError."""
        if a not in self.nodes_set or b not in self.nodes_set:
            raise KeyError("Node not in graph")
        
        # Dijkstra's algorithm
        distances = {node: float('inf') for node in self.nodes_set}
        distances[a] = 0
        previous = {}
        unvisited = set(self.nodes_set)
        
        while unvisited:
            # Get node with smallest distance
            current = min(unvisited, key=lambda node: distances[node])
            
            # If we can't reach b or we've processed all nodes, stop
            if distances[current] == float('inf') or current == b:
                break
                
            # Process neighbors
            for neighbor, weight in self.neighbors(current):
                if neighbor in unvisited:
                    new_distance = distances[current] + weight
                    if new_distance < distances[neighbor]:
                        distances[neighbor] = new_distance
                        previous[neighbor] = current
            
            unvisited.remove(current)
        
        # If we never reached b, return None
        if b not in distances or distances[b] == float('inf'):
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
        An edge from a node to itself counts as a cycle."""
        # Track visited nodes and recursion stack for DFS
        visited = set()
        rec_stack = set()
        
        def dfs(node):
            if node not in visited:
                visited.add(node)
                rec_stack.add(node)
                
                # Check neighbors
                for neighbor, _ in self.neighbors(node):
                    if neighbor not in visited:
                        if dfs(neighbor):
                            return True
                    elif neighbor in rec_stack:
                        # Back edge found - cycle detected
                        return True
                
                # Remove from recursion stack
                rec_stack.remove(node)
            
            return False
        
        # Check all nodes for cycles
        for node in self.nodes():
            if node not in visited:
                if dfs(node):
                    return True
        
    def topo_order(self):
        """Return the nodes in topological order, taking the smallest node that is ready next.
        Raises ValueError if the graph has a cycle."""
        # Calculate in-degrees for all nodes
        in_degree = {node: 0 for node in self.nodes_set}
        
        # Count incoming edges for each node
        for node in self.nodes_set:
            for neighbor, _ in self.neighbors(node):
                in_degree[neighbor] += 1
        
        # Initialize queue with nodes having in-degree 0
        queue = deque([node for node in self.nodes_set if in_degree[node] == 0])
        
        result = []
        
        # Process nodes in topological order
        while queue:
            # Get the smallest node (sorted order)
            current = min(queue)
            queue.remove(current)
            result.append(current)
            
            # Reduce in-degree of neighbors
            for neighbor, _ in self.neighbors(current):
                in_degree[neighbor] -= 1
                # If in-degree becomes 0, add to queue
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)
        
        # If result doesn't contain all nodes, there's a cycle
        if len(result) != len(self.nodes_set):
            raise ValueError("Graph has a cycle")
        
        return result

    def remove_node(self, n):
        """Remove a node and all edges to/from it. Raise KeyError if node doesn't exist."""
        if n not in self.nodes_set:
            raise KeyError("Node not in graph")
        
        # Remove the node from the set
        self.nodes_set.remove(n)
        
        # Remove all edges pointing to this node
        for node in self.nodes_set:
            if node in self.edges and n in self.edges[node]:
                del self.edges[node][n]
        
        # Remove all edges from this node
        if n in self.edges:
            del self.edges[n]

if __name__ == "__main__":
    # Test the Graph implementation
    g = Graph()
    
    # Test add_node
    g.add_node("a")
    g.add_node("b")
    g.add_node("c")
    
    # Test nodes()
    assert g.nodes() == ["a", "b", "c"]
    
    # Test add_edge
    g.add_edge("a", "b", 5)
    g.add_edge("b", "c", 3)
    
    # Test neighbors
    assert g.neighbors("a") == [("b", 5)]
    assert g.neighbors("b") == [("c", 3)]
    assert g.neighbors("c") == []
    
    # Test add_edge with existing edge (should replace weight)
    g.add_edge("a", "b", 10)
    assert g.neighbors("a") == [("b", 10)]
    
    # Test add_edge with weight = 0 (should raise ValueError)
    try:
        g.add_edge("a", "c", 0)
        assert False, "Should have raised ValueError"
    except ValueError:
        pass
    
    # Test add_edge with negative weight (should raise ValueError)
    try:
        g.add_edge("a", "c", -1)
        assert False, "Should have raised ValueError"
    except ValueError:
        pass
    
    # Test nodes() after adding edges
    assert g.nodes() == ["a", "b", "c"]
    
    # Test with unconnected nodes
    g.add_node("d")
    assert g.nodes() == ["a", "b", "c", "d"]
    assert g.neighbors("d") == []
    
    # Test bfs
    assert g.bfs("a") == ["a", "b", "c"]
    assert g.bfs("b") == ["b", "c"]
    assert g.bfs("c") == ["c"]
    
    # Test bfs with unconnected node
    g.add_node("e")
    assert g.bfs("e") == ["e"]
    
    # Test bfs with unknown start
    try:
        g.bfs("z")
        assert False, "Should have raised KeyError"
    except KeyError:
        pass
    
    print("All tests passed!")