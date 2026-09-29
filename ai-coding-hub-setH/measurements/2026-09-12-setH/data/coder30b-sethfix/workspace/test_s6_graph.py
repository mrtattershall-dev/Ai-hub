import pytest
from s6_graph import Graph

def test_shortest_path_basic():
    """Test basic shortest path functionality."""
    g = Graph()
    
    # Test shortest_path from a to a (same node)
    g.add_node("A")
    result = g.shortest_path("A", "A")
    assert result == (0, ["A"])
    
    # Test shortest_path with direct edge
    g.add_node("B")
    g.add_edge("A", "B", 5)
    result = g.shortest_path("A", "B")
    assert result == (5, ["A", "B"])
    
    # Test shortest_path with multiple edges
    g.add_node("C")
    g.add_edge("B", "C", 3)
    result = g.shortest_path("A", "C")
    assert result == (8, ["A", "B", "C"])

def test_shortest_path_unreachable():
    """Test shortest_path when destination is unreachable."""
    g = Graph()
    g.add_node("A")
    g.add_node("B")
    g.add_node("C")
    g.add_edge("A", "B", 5)
    
    # B is not connected to C, so C is unreachable from A
    result = g.shortest_path("A", "C")
    assert result is None

def test_shortest_path_unknown_node():
    """Test shortest_path with unknown node raises KeyError."""
    g = Graph()
    g.add_node("A")
    g.add_node("B")
    
    # Try to find path to unknown node
    with pytest.raises(KeyError):
        g.shortest_path("A", "C")
    
    # Try to find path from unknown node
    with pytest.raises(KeyError):
        g.shortest_path("C", "A")

def test_shortest_path_complex():
    """Test shortest_path with more complex graph."""
    g = Graph()
    
    # Create a graph: A -> B(1) -> C(2) 
    #                |-> D(4) -> E(1)
    #                |-> F(3) -> G(2)
    g.add_node("A")
    g.add_node("B")
    g.add_node("C")
    g.add_node("D")
    g.add_node("E")
    g.add_node("F")
    g.add_node("G")
    
    g.add_edge("A", "B", 1)
    g.add_edge("B", "C", 2)
    g.add_edge("A", "D", 4)
    g.add_edge("D", "E", 1)
    g.add_edge("A", "F", 3)
    g.add_edge("F", "G", 2)
    
    # Shortest path from A to C should be A->B->C with cost 3
    result = g.shortest_path("A", "C")
    assert result == (3, ["A", "B", "C"])
    
    # Shortest path from A to E should be A->D->E with cost 5
    result = g.shortest_path("A", "E")
    assert result == (5, ["A", "D", "E"])
    
    # Shortest path from A to G should be A->F->G with cost 5
    result = g.shortest_path("A", "G")
    assert result == (5, ["A", "F", "G"])

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
def test_has_cycle():
    """Test the has_cycle method."""
    g = Graph()
    
    # Test empty graph
    assert g.has_cycle() == False
    
    # Test single node with no edges
    g.add_node("A")
    assert g.has_cycle() == False
    
    # Test single node with self-loop (cycle)
    g.add_edge("A", "A", 1)
    assert g.has_cycle() == True
    
    # Test two nodes with no cycle
    g2 = Graph()
    g2.add_node("A")
    g2.add_node("B")
    g2.add_edge("A", "B", 1)
    assert g2.has_cycle() == False
    
    # Test two nodes with cycle
    g3 = Graph()
    g3.add_node("A")
    g3.add_node("B")
    g3.add_edge("A", "B", 1)
    g3.add_edge("B", "A", 1)
    assert g3.has_cycle() == True
    
    # Test complex graph with cycle
    g4 = Graph()
    g4.add_node("A")
    g4.add_node("B")
    g4.add_node("C")
    g4.add_node("D")
    g4.add_edge("A", "B", 1)
    g4.add_edge("B", "C", 1)
    g4.add_edge("C", "D", 1)
    g4.add_edge("D", "A", 1)  # Creates cycle
    assert g4.has_cycle() == True
    
    # Test complex graph without cycle
    g5 = Graph()
    g5.add_node("A")
    g5.add_node("B")
    g5.add_node("C")
    g5.add_node("D")
    g5.add_edge("A", "B", 1)
    g5.add_edge("A", "C", 1)
    g5.add_edge("B", "D", 1)
    g5.add_edge("C", "D", 1)
    assert g5.has_cycle() == False

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
def test_topo_order():
    """Test the topo_order method."""
    g = Graph()
    
    # Test empty graph
    assert g.topo_order() == []
    
    # Test single node
    g.add_node("A")
    assert g.topo_order() == ["A"]
    
    # Test simple linear graph: A -> B -> C
    g2 = Graph()
    g2.add_node("A")
    g2.add_node("B")
    g2.add_node("C")
    g2.add_edge("A", "B", 1)
    g2.add_edge("B", "C", 1)
    assert g2.topo_order() == ["A", "B", "C"]
    
    # Test graph with multiple sources: A -> C, B -> C
    g3 = Graph()
    g3.add_node("A")
    g3.add_node("B")
    g3.add_node("C")
    g3.add_edge("A", "C", 1)
    g3.add_edge("B", "C", 1)
    assert g3.topo_order() == ["A", "B", "C"] or g3.topo_order() == ["B", "A", "C"]
    
    # Test graph with multiple sources and branches: A -> B, A -> C, B -> D, C -> D
    g4 = Graph()
    g4.add_node("A")
    g4.add_node("B")
    g4.add_node("C")
    g4.add_node("D")
    g4.add_edge("A", "B", 1)
    g4.add_edge("A", "C", 1)
    g4.add_edge("B", "D", 1)
    g4.add_edge("C", "D", 1)
    result = g4.topo_order()
    # Should start with A (smallest), then B and C (in order), then D
    assert result[0] == "A"
    assert "B" in result and "C" in result
    assert result.index("B") < result.index("D")
    assert result.index("C") < result.index("D")

def test_topo_order_cycle():
    """Test that topo_order raises ValueError when graph has a cycle."""
    # Test cycle: A -> B -> A
    g = Graph()
    g.add_node("A")
    g.add_node("B")
    g.add_edge("A", "B", 1)
    g.add_edge("B", "A", 1)
    
    with pytest.raises(ValueError, match="Graph has a cycle"):
        g.topo_order()
    
    # Test cycle: A -> B -> C -> A
    g2 = Graph()
    g2.add_node("A")
    g2.add_node("B")
    g2.add_node("C")
    g2.add_edge("A", "B", 1)
    g2.add_edge("B", "C", 1)
    g2.add_edge("C", "A", 1)
    
    with pytest.raises(ValueError, match="Graph has a cycle"):
        g2.topo_order()
