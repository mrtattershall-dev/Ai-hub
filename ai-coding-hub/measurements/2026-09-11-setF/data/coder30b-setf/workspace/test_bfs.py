from s6_graph import Graph

# Test the bfs method
def test_bfs():
    # Create a graph
    g = Graph()
    
    # Add nodes
    g.add_node("A")
    g.add_node("B")
    g.add_node("C")
    g.add_node("D")
    g.add_node("E")
    
    # Add edges
    g.add_edge("A", "B", 1)
    g.add_edge("A", "C", 1)
    g.add_edge("B", "D", 1)
    g.add_edge("C", "E", 1)
    g.add_edge("D", "E", 1)
    
    # Test BFS from A
    result = g.bfs("A")
    print(f"BFS from A: {result}")
    
    # Test BFS from B
    result = g.bfs("B")
    print(f"BFS from B: {result}")
    
    # Test BFS from E (leaf node)
    result = g.bfs("E")
    print(f"BFS from E: {result}")
    
    # Test KeyError for unknown start node
    try:
        g.bfs("X")
        print("ERROR: Should have raised KeyError")
    except KeyError as e:
        print(f"Correctly raised KeyError: {e}")

if __name__ == "__main__":
    test_bfs()
# Test the shortest_path method
def test_shortest_path():
    # Create a graph
    g = Graph()
    
    # Add nodes
    g.add_node("A")
    g.add_node("B")
    g.add_node("C")
    g.add_node("D")
    g.add_node("E")
    
    # Add edges with weights
    g.add_edge("A", "B", 4)
    g.add_edge("A", "C", 2)
    g.add_edge("B", "C", 1)
    g.add_edge("B", "D", 5)
    g.add_edge("C", "D", 8)
    g.add_edge("C", "E", 10)
    g.add_edge("D", "E", 2)
    
    # Test shortest path from A to E
    result = g.shortest_path("A", "E")
    print(f"Shortest path from A to E: {result}")
    # Should be A->B->D->E with cost 4+5+2 = 11
    expected = (11, ["A", "B", "D", "E"])
    assert result == expected, f"Expected {expected}, got {result}"
    
    # Test shortest path from A to D
    result = g.shortest_path("A", "D")
    print(f"Shortest path from A to D: {result}")
    # Should be A->B->D with cost 4+5 = 9 (but we need to check the actual shortest path)
    # Actually, A->C->B->D = 2+1+5 = 8, A->B->D = 4+5 = 9
    # So A->C->B->D is shorter
    expected = (8, ["A", "C", "B", "D"])
    assert result == expected, f"Expected {expected}, got {result}"
    
    # Test shortest path from A to A (same node)
    result = g.shortest_path("A", "A")
    print(f"Shortest path from A to A: {result}")
    # Should be cost 0, path [A]
    expected = (0, ["A"])
    assert result == expected, f"Expected {expected}, got {result}"
    
    # Test path that doesn't exist
    g.add_node("F")
    result = g.shortest_path("A", "F")
    print(f"Shortest path from A to F: {result}")
    # Should be None since F is not reachable
    assert result is None, f"Expected None, got {result}"
    
    # Test KeyError for unknown start node
    try:
        g.shortest_path("X", "A")
        print("ERROR: Should have raised KeyError")
    except KeyError as e:
        print(f"Correctly raised KeyError for start node: {e}")
    
    # Test KeyError for unknown end node
    try:
        g.shortest_path("A", "X")
        print("ERROR: Should have raised KeyError")
    except KeyError as e:
        print(f"Correctly raised KeyError for end node: {e}")

if __name__ == "__main__":
    test_bfs()
    test_shortest_path()
# Test the between function
def test_between():
    from s2_logs import parse_log, between
    
    # Create test log entries
    log_text = '''127.0.0.1 - - [10/Oct/2023:13:55:36 +0000] "GET /index.html HTTP/1.1" 200 2326 0.045
192.168.1.1 - - [11/Oct/2023:14:00:00 +0000] "POST /api/data HTTP/1.1" 201 - 0.123
10.0.0.1 - - [09/Oct/2023:12:30:15 +0000] "GET /about HTTP/1.1" 200 1234 0.023
172.16.0.1 - - [12/Oct/2023:15:45:30 +0000] "GET /contact HTTP/1.1" 200 5678 0.067'''
    
    entries = parse_log(log_text)
    
    # Test filtering entries between specific times
    # Filter for entries between 2023-10-10 00:00:00 and 2023-10-11 23:59:59
    result = between(entries, "2023-10-10 00:00:00", "2023-10-11 23:59:59")
    
    # Should return the first two entries (10/Oct and 11/Oct)
    expected_count = 2
    print(f"Entries between 2023-10-10 00:00:00 and 2023-10-11 23:59:59: {len(result)}")
    
    # Check that the result contains the right entries
    if len(result) == expected_count:
        print("✓ Test passed: between function works correctly")
    else:
        print("✗ Test failed: between function returned wrong number of entries")
        print(f"Expected {expected_count}, got {len(result)}")

if __name__ == "__main__":
    test_bfs()
    test_between()
# Test the reachable function
def test_reachable():
    # Create a graph
    g = Graph()
    
    # Add nodes
    g.add_node("A")
    g.add_node("B")
    g.add_node("C")
    g.add_node("D")
    g.add_node("E")
    
    # Add edges
    g.add_edge("A", "B", 1)
    g.add_edge("A", "C", 1)
    g.add_edge("B", "D", 1)
    g.add_edge("C", "E", 1)
    g.add_edge("D", "E", 1)
    
    # Test reachable from A
    result = g.reachable("A")
    print(f"Reachable from A: {result}")
    expected = ["A", "B", "C", "D", "E"]
    assert result == expected, f"Expected {expected}, got {result}"
    
    # Test reachable from B
    result = g.reachable("B")
    print(f"Reachable from B: {result}")
    expected = ["B", "D", "E"]
    assert result == expected, f"Expected {expected}, got {result}"
    
    # Test reachable from E (leaf node)
    result = g.reachable("E")
    print(f"Reachable from E: {result}")
    expected = ["E"]
    assert result == expected, f"Expected {expected}, got {result}"
    
    # Test KeyError for unknown start node
    try:
        g.reachable("X")
        print("ERROR: Should have raised KeyError")
    except KeyError as e:
        print(f"Correctly raised KeyError: {e}")
    
    print("✓ All reachable tests passed!")

if __name__ == "__main__":
    test_bfs()
    test_shortest_path()
    test_reachable()
