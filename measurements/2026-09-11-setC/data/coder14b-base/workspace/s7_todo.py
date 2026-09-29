class TodoList:
    def __init__(self):
        self.tasks = []
        self.next_id = 1

    from datetime import datetime

    def add(self, title, priority=0, due=None):
        if due is not None:
            try:
                datetime.fromisoformat(due)
            except ValueError:
                raise ValueError("Due date must be an ISO date string like '2026-09-30'")
        self.todos.append({'title': title, 'priority': priority, 'due': due, 'done': False})
        task_id = self.next_id
        self.tasks.append((task_id, title, False))
        self.next_id += 1
        return task_id

    def done(self, item_id):
        for i, (task_id, title, completed) in enumerate(self.tasks):
            if task_id == item_id:
                self.tasks[i] = (task_id, title, True)
                break

    def remove(self, item_id):
        for i, (task_id, title, completed) in enumerate(self.tasks):
            if task_id == item_id:
                del self.tasks[i]
                return
        raise KeyError(f"Item ID {item_id} does not exist")

    def pending(self):
        return [title for _, title, completed in self.tasks if not completed]

    def save(self, path):
        import json
        with open(path, 'w') as f:
            json.dump(self.__dict__, f)

    @classmethod
    def load(cls, path):
        import json
        with open(path, 'r') as f:
            data = json.load(f)
        todo_list = cls()
        todo_list.__dict__.update(data)
        return todo_list

# Test the TodoList class
if __name__ == "__main__":
    todo_list = TodoList()
    assert todo_list.add("Task 1") == 1
    assert todo_list.add("Task 2") == 2
    todo_list.done(1)
    assert todo_list.pending() == ["Task 2"]
    print("All tests passed.")

    # Test save and load
    todo_list = TodoList()
    todo_list.add("Task 1")
    todo_list.add("Task 2")
    todo_list.done(1)
    todo_list.save("test_todo.json")

    loaded_list = TodoList.load("test_todo.json")
    assert loaded_list.pending() == ["Task 2"]
    assert loaded_list.next_id == 3
    print("Save and load tests passed.")