from s6_graph import Graph

def test_components_empty():
    """Test components on an empty graph."""
    g = Graph()
    result = g.components()
    expected = []
    assert result == expected, f"Empty graph components: expected {expected}, got {result}"
    print("[PASS] Empty graph test passed")

def test_components_single_node():
    """Test components on a graph with a single node."""
    g = Graph()
    g.add_node("A")
    result = g.components()
    expected = [["A"]]
    assert result == expected, f"Single node graph components: expected {expected}, got {result}"
    print("[PASS] Single node graph test passed")

def test_components_disconnected_nodes():
    """Test components on a graph with disconnected nodes."""
    g = Graph()
    g.add_node("A")
    g.add_node("B")
    g.add_node("C")
    result = g.components()
    expected = [["A"], ["B"], ["C"]]
    # Sort expected since order might vary
    expected.sort(key=lambda x: x[0])
    result.sort(key=lambda x: x[0])
    assert result == expected, f"Disconnected nodes components: expected {expected}, got {result}"
    print("[PASS] Disconnected nodes test passed")

def test_components_connected_graph():
    """Test components on a connected graph."""
    g = Graph()
    g.add_node("A")
    g.add_node("B")
    g.add_node("C")
    g.add_edge("A", "B")
    g.add_edge("B", "C")
    result = g.components()
    expected = [["A", "B", "C"]]
    assert result == expected, f"Connected graph components: expected {expected}, got {result}"
    print("[PASS] Connected graph test passed")

def test_components_mixed():
    """Test components on a graph with multiple components."""
    g = Graph()
    # Component 1: A -> B -> C
    g.add_node("A")
    g.add_node("B")
    g.add_node("C")
    g.add_edge("A", "B")
    g.add_edge("B", "C")
    
    # Component 2: D -> E
    g.add_node("D")
    g.add_node("E")
    g.add_edge("D", "E")
    
    # Component 3: F (isolated)
    g.add_node("F")
    
    result = g.components()
    # Each component should be a sorted list
    # The components list should be sorted by first node
    expected = [["A", "B", "C"], ["D", "E"], ["F"]]
    assert result == expected, f"Mixed components: expected {expected}, got {result}"
    print("[PASS] Mixed components test passed")

def test_components_undirected():
    """Test components on a graph with undirected connections."""
    g = Graph()
    g.add_node("A")
    g.add_node("B")
    g.add_node("C")
    g.add_node("D")
    
    # Create a graph where A-B-C-D are connected in a line (A-B, B-C, C-D)
    # But also add some edges that make it undirected
    g.add_edge("A", "B")
    g.add_edge("B", "C")
    g.add_edge("C", "D")
    
    result = g.components()
    expected = [["A", "B", "C", "D"]]
    assert result == expected, f"Undirected components: expected {expected}, got {result}"
    print("[PASS] Undirected components test passed")

if __name__ == "__main__":
    print("Testing components() method...")
    test_components_empty()
    test_components_single_node()
    test_components_disconnected_nodes()
    test_components_connected_graph()
    test_components_mixed()
    test_components_undirected()
    print("All tests passed!")