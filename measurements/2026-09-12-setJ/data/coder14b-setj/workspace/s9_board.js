document.getElementById('s9-add').addEventListener('click', function() {
    const input = document.getElementById('s9-new');
    const text = input.value.trim();
    if (text !== '') {
        const li = document.createElement('li');
        li.className = 's9-card';
        li.textContent = text;
        document.getElementById('s9-todo-list').appendChild(li);
        input.value = '';
    }
});