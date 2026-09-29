class Graph:
    def __init__(self):
        self._nodes = set()
        self._edges = {}
    
    def add_node(self, n):
        self._nodes.add(n)
    
    def add_edge(self, a, b, weight=1):
        if weight <= 0:
            raise ValueError("Edge weight must be positive")
        self.add_node(a)
        self.add_node(b)
        if a not in self._edges:
            self._edges[a] = []
        self._edges[a].append((b, weight))
    
    def nodes(self):
        return sorted(list(self._nodes))
    
    def neighbors(self, a):
        if a not in self._edges:
            return []
        return sorted(self._edges[a], key=lambda x: x[0])
    
    def bfs(self, start):
        """Return the BFS traversal starting from start node."""
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
            
        Raises:
            KeyError: if either node is not in the graph
        """
        if a not in self._nodes:
            raise KeyError(f"Start node '{a}' not in graph")
        if b not in self._nodes:
            raise KeyError(f"End node '{b}' not in graph")
            
        # Dijkstra's algorithm
        distances = {node: float('inf') for node in self._nodes}
        distances[a] = 0
        previous = {}
        unvisited = set(self._nodes)
        
        while unvisited:
            # Get node with minimum distance
            current = min(unvisited, key=lambda node: distances[node])
            
            # If we can't reach b, stop
            if distances[current] == float('inf'):
                break
                
            # If we reached the target, we're done
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
        
        An edge from a node to itself (a self-loop) counts as a cycle.
        """
        # Track visited nodes and recursion stack for DFS
        visited = set()
        rec_stack = set()
        
        def dfs(node):
            if node not in visited:
                visited.add(node)
                rec_stack.add(node)
                
                # Check all neighbors
                for neighbor, _ in self.neighbors(node):
                    # If neighbor is in recursion stack, we found a cycle
                    if neighbor in rec_stack:
                        return True
                    # If neighbor leads to cycle, we found a cycle
                    if dfs(neighbor):
                        return True
                
                # Remove node from recursion stack
                rec_stack.remove(node)
            
            return False
        
        # Check for cycles starting from each node
        for node in self.nodes():
            if dfs(node):
                return True
        
        return False

    def topo_order(self):
        """Return the nodes in topological order.
        
        Returns:
            list: Nodes in topological order, with ties broken by smallest node ID
            
        Raises:
            ValueError: If the graph has a cycle
        """
        # Calculate in-degrees for all nodes
        in_degree = {node: 0 for node in self._nodes}
        for node in self._nodes:
            for neighbor, _ in self.neighbors(node):
                in_degree[neighbor] += 1

        # Initialize queue with all nodes with in-degree 0
        # Using a list and sorting to ensure we always pick the smallest
        queue = [node for node in self._nodes if in_degree[node] == 0]
        result = []
        
        while queue:
            # Sort to ensure we always pick the smallest node
            queue.sort()
            node = queue.pop(0)
            result.append(node)
            
            # Reduce in-degree of neighbors
            for neighbor, _ in self.neighbors(node):
                in_degree[neighbor] -= 1
                # If in-degree becomes 0, add to queue
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)
        
        # If result doesn't contain all nodes, there's a cycle
        if len(result) != len(self._nodes):
            raise ValueError("Graph has a cycle")
        
        return result

    def reachable(self, a):
        """Return the sorted list of nodes reachable from a by one or more edges.
        
        Args:
            a: start node
            
        Returns:
            list: sorted list of nodes reachable from a
            
        Raises:
            KeyError: if node a is not in the graph
        """
        if a not in self._nodes:
            raise KeyError(f"Start node '{a}' not in graph")
            
        # Use BFS to find all reachable nodes
        visited = set()
        queue = [a]
        result = []
        
        while queue:
            node = queue.pop(0)
            if node not in visited:
                visited.add(node)
                result.append(node)
                for neighbor, _ in self.neighbors(node):
                    if neighbor not in visited:
                        queue.append(neighbor)
        
        # Return sorted list of reachable nodes
        return sorted(result)

    def components(self):
        """Return the weakly connected components of the graph.
        
        A weakly connected component is a maximal set of nodes where each pair
        of nodes is connected by a path, ignoring edge directions.
        
        Returns:
            list: List of components, where each component is a sorted list of nodes.
                  The list of components is sorted by the first node in each component.
        """
        visited = set()
        components = []
        
        # For each unvisited node, perform BFS to find all nodes in its component
        for node in self.nodes():
            if node not in visited:
                # BFS to find all nodes in this component
                component = self.bfs(node)
                # Mark all nodes in this component as visited
                for n in component:
                    visited.add(n)
                # Sort component and add to list
                component.sort()
                components.append(component)
        
        # Sort components by their first node
        components.sort(key=lambda x: x[0] if x else None)
        return components

    @staticmethod
    def from_text(text):
        """Build a graph from text lines in the format "a -> b" or "a -> b W".
        
        Args:
            text (str): Multiline string with graph edges
            
        Returns:
            Graph: New graph built from the text
            
        Raises:
            ValueError: If a line is malformed, with message containing the 1-based line number
        """
        graph = Graph()
        lines = text.strip().split('\n')
        
        for i, line in enumerate(lines, 1):
            line = line.strip()
            # Skip blank lines and comments
            if not line or line.startswith('#'):
                continue
                
            # Parse the line
            try:
                if ' -> ' not in line:
                    raise ValueError(f"Invalid line {i}: missing '->'")
                
                parts = line.split(' -> ')
                if len(parts) != 2:
                    raise ValueError(f"Invalid line {i}: expected exactly one '->'")
                
                a = parts[0].strip()
                b_part = parts[1].strip()
                
                # Check if there's a weight
                if ' ' in b_part:
                    b_and_weight = b_part.split(' ', 1)
                    if len(b_and_weight) != 2:
                        raise ValueError(f"Invalid line {i}: malformed weight")
                    b = b_and_weight[0].strip()
                    try:
                        weight = int(b_and_weight[1])
                    except ValueError:
                        raise ValueError(f"Invalid line {i}: weight must be an integer")
                else:
                    b = b_part
                    weight = 1
                
                # Add the edge
                graph.add_edge(a, b, weight)
            except ValueError as e:
                # Re-raise with line number info
                if "Invalid line" not in str(e):
                    raise ValueError(f"Invalid line {i}: {str(e)}")
                else:
                    raise e
        
        return graph

    def to_dot(self):
        """Return a DOT representation of the graph.
        
        Returns:
            str: DOT format string with edges in format "  a -> b [weight=W];"
                 and isolated nodes in format "  n;" sorted by node name.
        """
        lines = ["digraph {"]
        
        # Collect all edges
        edges = []
        for a in sorted(self._edges.keys()):
            for b, weight in sorted(self._edges[a], key=lambda x: x[0]):
                edges.append(f"  {a} -> {b} [weight={weight}];")
        
        # Add edges to output
        lines.extend(edges)
        
        # Find isolated nodes (nodes with no incoming or outgoing edges)
        nodes_with_edges = set()
        for a in self._edges:
            nodes_with_edges.add(a)
            for b, _ in self._edges[a]:
                nodes_with_edges.add(b)
        
        # Add isolated nodes
        isolated_nodes = [n for n in self._nodes if n not in nodes_with_edges]
        for node in sorted(isolated_nodes):
            lines.append(f"  {node};")
        
        lines.append("}")
        return "\n".join(lines)