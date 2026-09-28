import stack
s = stack.Stack()
s.push(1)
s.snapshot()
s.push(2); s.push(3)
s.undo()
assert s.size() == 1, s.size()
assert s.peek() == 1, s.peek()
s.undo()
assert s.size() == 1, "undo with no mark must leave the stack unchanged"
print("OK")
