from s6_graph import Graph

# Test 1: Basic functionality
print("Test 1: Basic functionality")
text = """a -> b
c -> d 5
"""
g = Graph.from_text(text)
print("Nodes:", g.nodes())
print("Neighbors of a:", g.neighbors('a'))
print("Neighbors of c:", g.neighbors('c'))

# Test 2: Comments and blank lines
print("\nTest 2: Comments and blank lines")
text = """# This is a comment
a -> b

# Another comment
c -> d 3

"""
g = Graph.from_text(text)
print("Nodes:", g.nodes())
print("Neighbors of a:", g.neighbors('a'))
print("Neighbors of c:", g.neighbors('c'))

# Test 3: Error handling - malformed line
print("\nTest 3: Error handling")
try:
    text = """a -> b
invalid line
c -> d
"""
    g = Graph.from_text(text)
    print("ERROR: Should have raised ValueError")
except ValueError as e:
    print("Correctly caught ValueError:", str(e))

# Test 4: Error handling - invalid weight
print("\nTest 4: Error handling - invalid weight")
try:
    text = """a -> b
c -> d invalidweight
"""
    g = Graph.from_text(text)
    print("ERROR: Should have raised ValueError")
except ValueError as e:
    print("Correctly caught ValueError:", str(e))