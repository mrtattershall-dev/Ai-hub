document.addEventListener('DOMContentLoaded', function() {
    const addButton = document.getElementById('s9-add');
    const inputField = document.getElementById('s9-new');
    const todoList = document.getElementById('s9-todo').querySelector('ul');
    
    addButton.addEventListener('click', function() {
        const text = inputField.value.trim();
        if (text) {
            const li = document.createElement('li');
            li.className = 's9-card';
            li.textContent = text;
            todoList.appendChild(li);
            inputField.value = '';
        }
    });
});