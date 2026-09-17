import stack
s = stack.Stack()
s.push(1); s.push(2)
assert s.peek() == 2, s.peek()
assert s.pop() == 2
assert s.size() == 1, s.size()
assert stack.Stack().peek() is None
print("OK")
