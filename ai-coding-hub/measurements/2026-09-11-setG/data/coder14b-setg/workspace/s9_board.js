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
document.addEventListener('DOMContentLoaded', () => {
    const todoList = document.getElementById('s9-todo-list');
    const doingList = document.getElementById('s9-doing-list');
    const doneList = document.getElementById('s9-done-list');

    const countCards = () => {
        const todoCount = todoList.children.length;
        const doingCount = doingList.children.length;
        const doneCount = doneList.children.length;

        document.getElementById('s9-count-todo').textContent = todoCount;
        document.getElementById('s9-count-doing').textContent = doingCount;
        document.getElementById('s9-count-done').textContent = doneCount;
    };

    countCards();

    // Add event listeners to update counts when cards are moved
    const lists = [todoList, doingList, doneList];
    lists.forEach(list => {
        list.addEventListener('dragend', () => {
            countCards();
            // Add any additional logic for moving cards here
        });
    });
});
document.addEventListener('DOMContentLoaded', function() {
  const cards = document.querySelectorAll('.card');
  cards.forEach(card => {
    const deleteButton = document.createElement('button');
    deleteButton.className = 's9-del';
    deleteButton.textContent = 'Delete';
    card.appendChild(deleteButton);

    deleteButton.addEventListener('click', function() {
      card.remove();
    });
  });
});
