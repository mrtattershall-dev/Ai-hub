document.addEventListener('DOMContentLoaded', function() {
    const addButton = document.getElementById('s9-add');
    const newTaskInput = document.getElementById('s9-new');
    const todoList = document.getElementById('s9-todo-list');

    addButton.addEventListener('click', function() {
        const taskText = newTaskInput.value.trim();
        if (taskText !== '') {
            const newTask = document.createElement('li');
            newTask.className = 's9-card';
            newTask.textContent = taskText;
            todoList.appendChild(newTask);
            newTaskInput.value = '';
        }
    });
});