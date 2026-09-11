# Stability of PriorityQueue.pop()

The `pop()` method in `s4_queue.js` is stable when two items have equal priority. This is because the items are sorted by priority and then `shift()` is used to remove the first item. Since `shift()` maintains the order of insertion, the method is stable.