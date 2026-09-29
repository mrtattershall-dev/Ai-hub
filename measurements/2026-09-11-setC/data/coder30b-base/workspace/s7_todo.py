class TodoList:
    def __init__(self):
        self.todos = []
        self.next_id = 1
    
    def add(self, title, priority=0, due=None):
        todo_id = self.next_id
        self.next_id += 1
        # Validate due date if provided
        if due is not None:
            # Check if due is a valid ISO date string (YYYY-MM-DD)
            if not isinstance(due, str) or len(due) != 10 or due[4] != '-' or due[7] != '-':
                raise ValueError("Due date must be in ISO format 'YYYY-MM-DD'")
            # Additional validation to ensure it's a valid date
            try:
                import datetime
                datetime.datetime.strptime(due, '%Y-%m-%d')
            except ValueError:
                raise ValueError("Due date must be a valid date")
        
        self.todos.append({'id': todo_id, 'title': title, 'done': False, 'priority': priority, 'due': due})
        return todo_id
    def done(self, item_id):
        for todo in self.todos:
            if todo['id'] == item_id:
                todo['done'] = True
                break

    def remove(self, item_id):
        for i, todo in enumerate(self.todos):
            if todo['id'] == item_id:
                del self.todos[i]
                return
        raise KeyError("Item with id {} not found".format(item_id))
    def pending(self):
        # Sort by priority (ascending) and then by insertion order (ascending)
        sorted_todos = sorted([todo for todo in self.todos if not todo['done']], 
                              key=lambda x: (x['priority'], x['id']))
        return [todo['title'] for todo in sorted_todos]
    
    def overdue(self, today):
        """Return titles of not-done items whose due date is before today.
        
        Args:
            today: ISO date string (YYYY-MM-DD) to compare against
            
        Returns:
            List of titles in order they were added
        """
        import datetime
        # Validate today is a valid ISO date string
        if not isinstance(today, str) or len(today) != 10 or today[4] != '-' or today[7] != '-':
            raise ValueError("Today must be in ISO format 'YYYY-MM-DD'")
        try:
            datetime.datetime.strptime(today, '%Y-%m-%d')
        except ValueError:
            raise ValueError("Today must be a valid date")
            
        result = []
        for todo in self.todos:
            if not todo['done'] and todo['due'] is not None:
                # Check if due date is before today
                if todo['due'] < today:
                    result.append(todo['title'])
        return result
    
    def save(self, path):
        import json
        with open(path, 'w') as f:
            json.dump({'todos': self.todos, 'next_id': self.next_id}, f)
    
    @classmethod
    def load(cls, path):
        import json
        with open(path, 'r') as f:
            data = json.load(f)
        todo_list = cls()
        todo_list.todos = data['todos']
        todo_list.next_id = data['next_id']
        return todo_list

# Asserts
todo_list = TodoList()
id1 = todo_list.add("Buy milk")
id2 = todo_list.add("Walk dog")
id3 = todo_list.add("Write report")

assert id1 == 1
assert id2 == 2
assert id3 == 3

assert todo_list.pending() == ["Buy milk", "Walk dog", "Write report"]

todo_list.done(2)
assert todo_list.pending() == ["Buy milk", "Write report"]

todo_list.done(1)
assert todo_list.pending() == ["Write report"]

todo_list.add("Buy bread")
assert todo_list.pending() == ["Write report", "Buy bread"]

todo_list.done(3)
assert todo_list.pending() == ["Buy bread"]

todo_list.done(4)
assert todo_list.pending() == []