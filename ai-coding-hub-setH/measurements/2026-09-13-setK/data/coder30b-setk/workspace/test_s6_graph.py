import unittest
from s6_graph import Graph

class TestGraphShortestPath(unittest.TestCase):
    def test_shortest_path_same_node(self):
        """Test shortest_path from a node to itself."""
        g = Graph()
        g.add_node("A")
        result = g.shortest_path("A", "A")
        self.assertEqual(result, (0, ["A"]))
    
    def test_shortest_path_simple(self):
        """Test shortest_path with a simple path."""
        g = Graph()
        g.add_node("A")
        g.add_node("B")
        g.add_edge("A", "B", 5)
        result = g.shortest_path("A", "B")
        self.assertEqual(result, (5, ["A", "B"]))
    
    def test_shortest_path_unreachable(self):
        """Test shortest_path when destination is unreachable."""
        g = Graph()
        g.add_node("A")
        g.add_node("B")
        g.add_node("C")
        g.add_edge("A", "B", 5)
        result = g.shortest_path("B", "C")
        self.assertIsNone(result)
    
    def test_shortest_path_with_multiple_paths(self):
        """Test shortest_path with multiple possible paths."""
        g = Graph()
        g.add_node("A")
        g.add_node("B")
        g.add_node("C")
        g.add_edge("A", "B", 10)
        g.add_edge("A", "C", 1)
        g.add_edge("C", "B", 1)
        result = g.shortest_path("A", "B")
        self.assertEqual(result, (2, ["A", "C", "B"]))
    
    def test_shortest_path_unknown_node(self):
        """Test shortest_path with unknown node raises KeyError."""
        g = Graph()
        g.add_node("A")
        with self.assertRaises(KeyError):
            g.shortest_path("A", "B")
        with self.assertRaises(KeyError):
            g.shortest_path("B", "A")

    def test_has_cycle_empty_graph(self):
        """Test has_cycle on an empty graph."""
        g = Graph()
        self.assertFalse(g.has_cycle())
    
    def test_has_cycle_single_node(self):
        """Test has_cycle on a graph with a single node."""
        g = Graph()
        g.add_node("A")
        self.assertFalse(g.has_cycle())
    
    def test_has_cycle_single_node_self_loop(self):
        """Test has_cycle on a graph with a self-loop."""
        g = Graph()
        g.add_node("A")
        g.add_edge("A", "A", 1)
        self.assertTrue(g.has_cycle())
    
    def test_has_cycle_simple_cycle(self):
        """Test has_cycle on a simple cycle."""
        g = Graph()
        g.add_node("A")
        g.add_node("B")
        g.add_edge("A", "B", 1)
        g.add_edge("B", "A", 1)
        self.assertTrue(g.has_cycle())
    
    def test_has_cycle_no_cycle(self):
        """Test has_cycle on a graph with no cycles."""
        g = Graph()
        g.add_node("A")
        g.add_node("B")
        g.add_node("C")
        g.add_edge("A", "B", 1)
        g.add_edge("B", "C", 1)
        self.assertFalse(g.has_cycle())
    
    def test_has_cycle_complex_cycle(self):
        """Test has_cycle on a more complex cycle."""
        g = Graph()
        g.add_node("A")
        g.add_node("B")
        g.add_node("C")
        g.add_node("D")
        g.add_edge("A", "B", 1)
        g.add_edge("B", "C", 1)
        g.add_edge("C", "D", 1)
        g.add_edge("D", "A", 1)
        self.assertTrue(g.has_cycle())

if __name__ == '__main__':
    unittest.main()