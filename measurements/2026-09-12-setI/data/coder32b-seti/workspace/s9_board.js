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
document.addEventListener('DOMContentLoaded', function() {
    const addButton = document.getElementById('s9-add');
    const newTaskInput = document.getElementById('s9-new');
    const todoList = document.getElementById('s9-todo-list');

    addButton.addEventListener('click', function() {
        const taskText = newTaskInput.value.trim();
        if (taskText !== '') {
            const newTask = document.createElement('li');
            newTask.className = 's9-card';
            newTask.innerHTML = `
                <span>${taskText}</span>
                <button class="s9-left">←</button>
                <button class="s9-right">→</button>
            `;
            todoList.appendChild(newTask);
            newTaskInput.value = '';
        }
    });
});
document.addEventListener('DOMContentLoaded', function() {
    const addButton = document.getElementById('s9-add');
    const newTaskInput = document.getElementById('s9-new');
    const todoList = document.getElementById('s9-todo-list');
    const doingList = document.getElementById('s9-doing-list');
    const doneList = document.getElementById('s9-done-list');

    addButton.addEventListener('click', function() {
        const taskText = newTaskInput.value.trim();
        if (taskText !== '') {
            const newTask = document.createElement('li');
            newTask.className = 's9-card';
            newTask.innerHTML = `
                <span>${taskText}</span>
                <button class="s9-left">←</button>
                <button class="s9-right">→</button>
            `;
            todoList.appendChild(newTask);
            newTaskInput.value = '';
        }
    });

    function moveCard(card, targetList) {
        targetList.appendChild(card);
    }

    document.addEventListener('click', function(event) {
        if (event.target.classList.contains('s9-right')) {
            const card = event.target.parentElement;
            if (card.parentElement.id === 's9-todo-list') {
                moveCard(card, doingList);
            } else if (card.parentElement.id === 's9-doing-list') {
                moveCard(card, doneList);
            }
        } else if (event.target.classList.contains('s9-left')) {
            const card = event.target.parentElement;
            if (card.parentElement.id === 's9-doing-list') {
                moveCard(card, todoList);
            } else if (card.parentElement.id === 's9-done-list') {
                moveCard(card, doingList);
            }
        }
    });
});
