import pytest
from s6_graph import Graph

def test_bfs():
    """Test basic bfs functionality."""
    g = Graph()
    
    # Add nodes and edges
    g.add_node("a")
    g.add_node("b")
    g.add_node("c")
    g.add_edge("a", "b", 5)
    g.add_edge("b", "c", 3)
    
    # Test bfs from different starting points
    assert g.bfs("a") == ["a", "b", "c"]
    assert g.bfs("b") == ["b", "c"]
    assert g.bfs("c") == ["c"]

def test_bfs_unconnected():
    """Test bfs with unconnected nodes."""
    g = Graph()
    
    # Add unconnected nodes
    g.add_node("a")
    g.add_node("b")
    g.add_node("c")
    g.add_node("d")
    
    # Add some edges
    g.add_edge("a", "b", 1)
    g.add_edge("c", "d", 2)
    
    # Test bfs from each node
    assert g.bfs("a") == ["a", "b"]
    assert g.bfs("b") == ["b", "a"]
    assert g.bfs("c") == ["c", "d"]
    assert g.bfs("d") == ["d", "c"]

def test_bfs_unknown_start():
    """Test bfs with unknown start node."""
    g = Graph()
    g.add_node("a")
    g.add_node("b")
    g.add_edge("a", "b", 1)
    
    # Should raise KeyError for unknown start
    with pytest.raises(KeyError):
        g.bfs("z")

def test_bfs_sorted_neighbors():
    """Test that bfs visits neighbors in sorted order."""
    g = Graph()
    
    # Add nodes in reverse order to test sorting
    g.add_node("c")
    g.add_node("b")
    g.add_node("a")
    g.add_node("d")
    
    # Add edges to create a specific traversal order
    g.add_edge("a", "d", 1)  # d comes after b in sorted order
    g.add_edge("a", "b", 1)
    g.add_edge("b", "c", 1)
    
    # BFS should visit in sorted order: a, b, c, d
    assert g.bfs("a") == ["a", "b", "c", "d"]

def test_bfs_single_node():
    """Test bfs with a single node."""
    g = Graph()
    g.add_node("a")
    
    assert g.bfs("a") == ["a"]

def test_bfs_complex_graph():
    """Test bfs with a more complex graph."""
    g = Graph()
    
    # Create a diamond-shaped graph
    g.add_node("a")
    g.add_node("b")
    g.add_node("c")
    g.add_node("d")
    
    g.add_edge("a", "b", 1)
    g.add_edge("a", "c", 1)
    g.add_edge("b", "d", 1)
    g.add_edge("c", "d", 1)
    
    # BFS from a should visit nodes in order: a, b, c, d
    # (b and c are visited in sorted order, then d)
    result = g.bfs("a")
    assert "a" in result
    assert "b" in result
    assert "c" in result
    assert "d" in result
    # Check that b and c are visited before d
    a_index = result.index("a")
    b_index = result.index("b")
    c_index = result.index("c")
    d_index = result.index("d")
    assert a_index < b_index
    assert a_index < c_index
    assert b_index < d_index
    assert c_index < d_index
def test_shortest_path():
    """Test basic shortest_path functionality."""
    g = Graph()

def test_shortest_path_unreachable():
    """Test shortest_path with unreachable destination."""
    g = Graph()
    
    # Add unconnected nodes
    g.add_node("a")
    g.add_node("b")
    g.add_node("c")
    
    # Add edge from a to b
    g.add_edge("a", "b", 1)
    
    # b should not be reachable from c
    assert g.shortest_path("c", "b") is None

def test_shortest_path_complex():
    """Test shortest_path with a more complex graph."""
    g = Graph()
    
    # Create a graph with multiple paths
    g.add_node("a")
    g.add_node("b")
    g.add_node("c")
    g.add_node("d")
    g.add_node("e")
    
    g.add_edge("a", "b", 1)
    g.add_edge("a", "c", 4)
    g.add_edge("b", "c", 2)
    g.add_edge("b", "d", 5)
    g.add_edge("c", "d", 1)
    g.add_edge("d", "e", 3)
    
    # Shortest path from a to e should be a->b->c->d->e with cost 1+2+1+3 = 7
    assert g.shortest_path("a", "e") == (7, ["a", "b", "c", "d", "e"])
    
    # Shortest path from a to d should be a->b->d with cost 1+5 = 6
    assert g.shortest_path("a", "d") == (6, ["a", "b", "d"])

def test_shortest_path_unknown_node():
    """Test shortest_path with unknown node."""
    g = Graph()
    g.add_node("a")
    g.add_node("b")
    g.add_edge("a", "b", 1)
    
    # Should raise KeyError for unknown node
    with pytest.raises(KeyError):
        g.shortest_path("a", "z")
    
    with pytest.raises(KeyError):
        g.shortest_path("z", "b")
def test_has_cycle():
    """Test has_cycle functionality."""
    g = Graph()
    
    # Test empty graph
    assert g.has_cycle() == False
    
    # Test graph with single node
    g.add_node("a")
    assert g.has_cycle() == False
    
    # Test graph with self-loop
    g.add_edge("a", "a", 1)
    assert g.has_cycle() == True
    
    # Test graph with no cycles
    g2 = Graph()
    g2.add_node("a")
    g2.add_node("b")
    g2.add_node("c")
    g2.add_edge("a", "b", 1)
    g2.add_edge("b", "c", 1)
    assert g2.has_cycle() == False
    
    # Test graph with cycle
    g3 = Graph()
    g3.add_node("a")
    g3.add_node("b")
    g3.add_node("c")
    g3.add_edge("a", "b", 1)
    g3.add_edge("b", "c", 1)
    g3.add_edge("c", "a", 1)
    assert g3.has_cycle() == True
    
    # Test more complex cycle
    g4 = Graph()
    g4.add_node("a")
    g4.add_node("b")
    g4.add_node("c")
    g4.add_node("d")
    g4.add_edge("a", "b", 1)
    g4.add_edge("b", "c", 1)
    g4.add_edge("c", "d", 1)
    g4.add_edge("d", "b", 1)  # Creates cycle: b -> c -> d -> b
    assert g4.has_cycle() == True
def test_topo_order_linear():
    """Test topo_order with a linear graph."""
    g = Graph()
    
    # Create a linear graph: a -> b -> c
    g.add_node("a")
    g.add_node("b")
    g.add_node("c")
    g.add_edge("a", "b", 1)
    g.add_edge("b", "c", 1)
    
    # Should return nodes in topological order
    assert g.topo_order() == ["a", "b", "c"]


def test_topo_order_multiple_paths():
    """Test topo_order with multiple paths."""
    g = Graph()
    
    # Create a graph with multiple paths: a -> b, a -> c, b -> d, c -> d
    g.add_node("a")
    g.add_node("b")
    g.add_node("c")
    g.add_node("d")
    g.add_edge("a", "b", 1)
    g.add_edge("a", "c", 1)
    g.add_edge("b", "d", 1)
    g.add_edge("c", "d", 1)
    
    # Should return nodes in topological order
    result = g.topo_order()
    # a should come before b and c, and b and c should come before d
    assert result.index("a") < result.index("b")
    assert result.index("a") < result.index("c")
    assert result.index("b") < result.index("d")
    assert result.index("c") < result.index("d")


def test_topo_order_cycle():
    """Test topo_order with a cycle (should raise ValueError)."""
    g = Graph()
    
    # Create a cycle: a -> b -> c -> a
    g.add_node("a")
    g.add_node("b")
    g.add_node("c")
    g.add_edge("a", "b", 1)
    g.add_edge("b", "c", 1)
    g.add_edge("c", "a", 1)
    
    # Should raise ValueError due to cycle
    with pytest.raises(ValueError):
        g.topo_order()


def test_topo_order_single_node():
    """Test topo_order with a single node."""
    g = Graph()
    g.add_node("a")
    
    assert g.topo_order() == ["a"]


def test_topo_order_empty():
    """Test topo_order with an empty graph."""
    g = Graph()
    
    assert g.topo_order() == []
def test_remove_node():
    """Test remove_node functionality."""
    g = Graph()
    
    # Add nodes and edges
    g.add_node("a")
    g.add_node("b")
    g.add_node("c")
    g.add_edge("a", "b", 5)
    g.add_edge("b", "c", 3)
    g.add_edge("a", "c", 7)
    
    # Remove a node in the middle
    g.remove_node("b")
    
    # Node b should be gone
    assert "b" not in g.nodes()
    
    # Edges to/from b should be gone
    assert g.neighbors("a") == [("c", 7)]
    assert g.neighbors("c") == []
    
    # Remove a leaf node
    g.remove_node("c")
    assert "c" not in g.nodes()
    assert g.neighbors("a") == []
    
    # Remove the last node
    g.remove_node("a")
    assert g.nodes() == []
    
    # Test removing unknown node raises KeyError
    g2 = Graph()
    g2.add_node("a")
    with pytest.raises(KeyError):
        g2.remove_node("b")
