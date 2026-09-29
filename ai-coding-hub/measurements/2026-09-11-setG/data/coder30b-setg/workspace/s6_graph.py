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
        Raises ValueError if weight is not a positive number.
        Adding an edge that exists replaces its weight."""
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
        """Return every node sorted."""
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
                
                # Add neighbors in sorted order to queue
                for neighbor, _ in self.neighbors(node):
                    if neighbor not in visited:
                        queue.append(neighbor)
        
        return result

    def shortest_path(self, a, b):
        """Return (cost, [a, ..., b]) for the cheapest path from a to b.
        Returns None if b cannot be reached from a.
        Raises KeyError if a or b is not in the graph.
        shortest_path(a, a) is (0, [a])."""
        if a not in self.nodes_set or b not in self.nodes_set:
            raise KeyError("Start or end node not in graph")
        
        # Dijkstra's algorithm
        distances = {node: float('inf') for node in self.nodes_set}
        distances[a] = 0
        previous = {}
        unvisited = set(self.nodes_set)
        
        while unvisited:
            # Get node with smallest distance
            current = min(unvisited, key=lambda node: distances[node])
            
            # If we can't reach b, return None
            if distances[current] == float('inf'):
                return None
            
            # If we reached the target
            if current == b:
                break
            
            unvisited.remove(current)
            
            # Update distances to neighbors
            if current in self.edges:
                for neighbor, weight in self.edges[current].items():
                    if neighbor in unvisited:
                        new_distance = distances[current] + weight
                        if new_distance < distances[neighbor]:
                            distances[neighbor] = new_distance
                            previous[neighbor] = current
        
        # If b is unreachable
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
                if node in self.edges:
                    for neighbor, _ in self.edges[node].items():
                        # If neighbor is in recursion stack, we found a cycle
                        if neighbor in rec_stack:
                            return True
                        # If neighbor leads to cycle, return True
                        if dfs(neighbor):
                            return True
                
                # Remove node from recursion stack
                rec_stack.remove(node)
            
            return False
        
        # Check all nodes for cycles
        for node in self.nodes_set:
            if node not in visited:
                if dfs(node):
                    return True
        
        return False

    def topo_order(self):
        """Return the nodes in topological order.
        Raises ValueError if the graph has a cycle."""
        if self.has_cycle():
            raise ValueError("Graph has a cycle")
        
        # Calculate in-degrees for all nodes
        in_degree = {node: 0 for node in self.nodes_set}
        for node in self.nodes_set:
            if node in self.edges:
                for neighbor, _ in self.edges[node].items():
                    in_degree[neighbor] += 1
        
        # Initialize queue with all nodes with in-degree 0
        queue = [node for node in self.nodes_set if in_degree[node] == 0]
        # Sort to ensure we always pick the smallest node first
        queue.sort()
        
        result = []
        while queue:
            # Take the smallest node from the queue
            node = queue.pop(0)
            result.append(node)
            
            # Reduce in-degree of neighbors
            if node in self.edges:
                for neighbor, _ in self.edges[node].items():
                    in_degree[neighbor] -= 1
                    # If in-degree becomes 0, add to queue
                    if in_degree[neighbor] == 0:
                        queue.append(neighbor)
                        # Keep queue sorted to always pick smallest
                        queue.sort()
        
        return result


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
    
    # Test edge replacement
    g.add_edge("a", "b", 10)
    assert g.neighbors("a") == [("b", 10)]
    
    # Test multiple edges
    g.add_edge("b", "c", 3)
    g.add_edge("a", "c", 7)
    assert g.neighbors("a") == [("b", 10), ("c", 7)]
    assert g.neighbors("b") == [("c", 3)]
    assert g.neighbors("c") == []
    
    # Test nodes() with multiple nodes
    assert g.nodes() == ["a", "b", "c"]
    
    # Test weight validation
    try:
        g.add_edge("c", "a", -1)
        assert False, "Should have raised ValueError"
    except ValueError:
        pass
    
    try:
        g.add_edge("c", "a", 0)
        assert False, "Should have raised ValueError"
    except ValueError:
        pass
    
    try:
        g.add_edge("c", "a", "invalid")
        assert False, "Should have raised ValueError"
    except ValueError:
        pass
    
    # Test neighbors of non-existent node
    assert g.neighbors("d") == []
    
    # Test bfs
    assert g.bfs("a") == ["a", "b", "c"]
    
    # Test shortest_path
    # Test shortest_path from a to d (should be None)
    g.add_node("d")
    assert g.shortest_path("a", "d") == None
    
    # Test shortest_path from a to a (should be (0, [a]))
    assert g.shortest_path("a", "a") == (0, ["a"])
    
    # Test shortest_path with a simple graph
    g.add_node("d")
    g.add_edge("c", "d", 2)
    g.add_edge("b", "d", 1)
    result = g.shortest_path("a", "d")
    # Should be (a->b->d) with cost 10+1=11 or (a->c->d) with cost 7+2=9
    # The shortest should be a->c->d with cost 9
    assert result[0] == 9
    assert result[1] == ["a", "c", "d"]
    
    # Test shortest_path with unreachable node
    g.add_node("e")
    print("All tests passed!")

    def remove_node(self, n):
        """Remove a node and all edges to or from it.
        Raises KeyError if node is not in the graph."""
        if n not in self.nodes_set:
            raise KeyError("Node not in graph")
        
        # Remove the node from the nodes set
        self.nodes_set.remove(n)
        
        # Remove all edges from this node
        if n in self.edges:
            del self.edges[n]
        
        # Remove all edges to this node
        for node in self.edges:
            if n in self.edges[node]:
                # Remove the edge (node, n) with its weight
                self.edges[node] = [(neighbor, weight) for neighbor, weight in self.edges[node] if neighbor != n]

    def shortest_path(self, a, b):
        """Return (cost, [a, ..., b]) for the cheapest path from a to b.
        Returns None if b cannot be reached from a.
        Raises KeyError if a or b is not in the graph.
        shortest_path(a, a) is (0, [a])."""
        if a not in self.nodes_set or b not in self.nodes_set:
            raise KeyError("Start or end node not in graph")
            raise KeyError("Start or end node not in graph")
        
        # Dijkstra's algorithm
        distances = {node: float('inf') for node in self.nodes_set}
        distances[a] = 0
        previous = {}
        unvisited = set(self.nodes_set)
        
        while unvisited:
            # Get node with smallest distance
            current = min(unvisited, key=lambda node: distances[node])
            
            # If we can't reach b, return None
            if distances[current] == float('inf'):
                return None
            
            # If we reached the target
            if current == b:
                break
            
            unvisited.remove(current)
            
            # Update distances to neighbors
            if current in self.edges:
                for neighbor, weight in self.edges[current].items():
                    if neighbor in unvisited:
                        new_distance = distances[current] + weight
                        if new_distance < distances[neighbor]:
                            distances[neighbor] = new_distance
                            previous[neighbor] = current
        
        # If b is unreachable
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
    
    # Test edge replacement
    g.add_edge("a", "b", 10)
    assert g.neighbors("a") == [("b", 10)]
    
    # Test multiple edges
    g.add_edge("b", "c", 3)
    g.add_edge("a", "c", 7)
    assert g.neighbors("a") == [("b", 10), ("c", 7)]
    assert g.neighbors("b") == [("c", 3)]
    assert g.neighbors("c") == []
    
    # Test nodes() with multiple nodes
    assert g.nodes() == ["a", "b", "c"]
    
    # Test remove_node
    g.remove_node("b")
    assert "b" not in g.nodes()
    assert g.neighbors("a") == ["c"]
    assert g.neighbors("c") == []
    
    # Test remove_node with non-existent node
    
    try:
        g.add_edge("c", "a", 0)
        assert False, "Should have raised ValueError"
    except ValueError:
        pass
    
    try:
        g.add_edge("c", "a", "invalid")
        assert False, "Should have raised ValueError"
    except ValueError:
        pass
    
    # Test neighbors of non-existent node
    assert g.neighbors("d") == []
    
    # Test bfs
    assert g.bfs("a") == ["a", "b", "c"]
    
    # Test shortest_path
    # Test shortest_path from a to d (should be None)
    g.add_node("d")
    assert g.shortest_path("a", "d") == None
    
    # Test shortest_path from a to a (should be (0, [a]))
    assert g.shortest_path("a", "a") == (0, ["a"])
    
    # Test shortest_path with a simple graph
    g.add_node("d")
    g.add_edge("c", "d", 2)
    g.add_edge("b", "d", 1)
    result = g.shortest_path("a", "d")
    # Should be (a->b->d) with cost 10+1=11 or (a->c->d) with cost 7+2=9
    # The shortest should be a->c->d with cost 9
    assert result[0] == 9
    assert result[1] == ["a", "c", "d"]
    
    # Test shortest_path with unreachable node
    g.add_node("e")
    assert g.shortest_path("a", "e") == None
    
    print("All tests passed!")
    def reachable(self, a):
        """Return a sorted list of nodes reachable from a by one or more edges.
        a itself is only included when it lies on a cycle.
        Raises KeyError if a is not in the graph."""
        if a not in self.nodes_set:
            raise KeyError(f"Node {a} not in graph")
        
        # Get all nodes reachable from a using BFS
        reachable_nodes = set(self.bfs(a))
        
        # If a is not on a cycle, remove it from the result
        if not self._node_on_cycle(a):
            reachable_nodes.discard(a)
        
        # Return sorted list
        return sorted(list(reachable_nodes))
    
    def _node_on_cycle(self, node):
        """Check if a node lies on a cycle."""
        # Simple approach: check if there's a path from node back to itself
        # We'll use a modified DFS to detect cycles
        visited = set()
        rec_stack = set()
        
        def dfs(current_node):
            if current_node not in visited:
                visited.add(current_node)
                rec_stack.add(current_node)
                
                # Check neighbors
                if current_node in self.edges:
                    for neighbor, _ in self.edges[current_node].items():
                        # If neighbor is in recursion stack, we found a cycle
                        if neighbor in rec_stack:
                            return True
                        # If neighbor leads to cycle, return True
                        if dfs(neighbor):
                            return True
                
                # Remove node from recursion stack
                rec_stack.remove(node)
            
            return False
        
        # Check if node is on a cycle by doing DFS from the node
        # We need to check if there's a path from node back to node
        # But we need to be careful about the recursion stack
        # Let's use a simpler approach: check if node is in a cycle by checking if 
        # there's a path from node to itself (excluding direct self-loop)
        # Actually, let's use the existing has_cycle method with a modification
        
        # Check if node is on a cycle by temporarily removing it and checking if the graph still has cycles
        # But that's complex. Let's just do a direct cycle detection from the node.
        
        # Simpler approach: if node has a self-loop, it's on a cycle
        if node in self.edges and node in self.edges[node]:
            return True
            
        # For other cases, we'll do a DFS from the node to see if we can reach it again
        # But we need to be careful about the recursion stack logic
        # Let's just use the existing has_cycle logic but check if the node is part of any cycle
        
        # A node is on a cycle if:
        # 1. It has a self-loop, or
        # 2. It's part of a cycle in the graph
        
        # Let's do a simpler approach: we'll check if there's a path from node back to node
        # using a modified DFS that tracks the path
        def dfs_path(current, target, visited_nodes):
            if current == target:
                return True
            visited_nodes.add(current)
            if current in self.edges:
                for neighbor, _ in self.edges[current].items():
                    if neighbor not in visited_nodes:
                        if dfs_path(neighbor, target, visited_nodes):
                            return True
            visited_nodes.discard(current)
            return False
        
        # Check if there's a path from node back to itself (excluding direct self-loop)
        # This is a bit tricky. Let's just check if the node is part of any cycle
        # by using the existing has_cycle method but with a different approach
        
        # Actually, let's just check if the node is part of a cycle by checking:
        # 1. If it has a self-loop (direct cycle)
        # 2. If there's a path from it back to itself through other nodes
        # But that's complex. Let's use a simpler approach:
        # If the node is in the graph and the graph has a cycle, we need to check
        # if the node is part of that cycle. We can do this by temporarily removing
        # the node and checking if the graph still has a cycle.
        
        # Simpler approach: if the node is in a cycle, it will be part of the cycle detection
        # Let's just check if there's a path from node to itself using BFS/DFS
        # But we need to avoid the direct self-loop case
        
        # Let's use the existing has_cycle method but with a different approach:
        # We'll do a DFS from the node and see if we can return to it
        # But we need to be careful about the recursion stack
        
        # Let's implement a proper cycle detection from the node
        def cycle_from_node(start_node):
            visited = set()
            rec_stack = set()
            
            def dfs_cycle(current):
                if current not in visited:
                    visited.add(current)
                    rec_stack.add(current)
                    
                    if current in self.edges:
                        for neighbor, _ in self.edges[current].items():
                            if neighbor == start_node and current != start_node:
                                # Found a path back to start (not a self-loop)
                                return True
                            if neighbor in rec_stack:
                                # Found a cycle
                                return True
                            if dfs_cycle(neighbor):
                                return True
                    
                    rec_stack.discard(current)
                
                return False
            
            return dfs_cycle(start_node)
        
        # Check if node is on a cycle
        # If it has a self-loop, it's definitely on a cycle
        if node in self.edges and node in self.edges[node]:
            return True
            
        # Otherwise, check if there's a path from node back to node
        return cycle_from_node(node)

    def components(self):
        """Return the weakly connected components of the graph as a list of lists.
        Each component is a sorted list of nodes, and the list of components is sorted
        by the first node in each component.
        """
        visited = set()
        components = []
        
        # For each unvisited node, perform DFS to find all nodes in its component
        for node in self.nodes():
            if node not in visited:
                # Find all nodes in this component
                component = []
                
                def dfs_component(current_node):
                    if current_node not in visited:
                        visited.add(current_node)
                        component.append(current_node)
                        
                        # Check neighbors in the forward direction
                        if current_node in self.edges:
                            for neighbor, _ in self.edges[current_node].items():
                                dfs_component(neighbor)
                        
                        # Check neighbors in the reverse direction (for weak connectivity)
                        # We need to check all nodes that have an edge to current_node
                        for node_check, edges in self.edges.items():
                            if current_node in edges:
                                dfs_component(node_check)
                
                dfs_component(node)
                component.sort()  # Sort component nodes
                components.append(component)
        
        # Sort components by their first node
        components.sort(key=lambda comp: comp[0] if comp else None)
        return components
