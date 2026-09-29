document.getElementById('s9-add').addEventListener('click', function() {
    const input = document.getElementById('s9-new');
    const text = input.value.trim();
    if (text !== '') {
        const li = document.createElement('li');
        li.className = 's9-card';
        li.textContent = text;
        document.getElementById('s9-todo-list').appendChild(li);
input.value = '';
updateCounters();
saveCards();
    }
});
    const input = document.getElementById('s9-new');
    const text = input.value.trim();
    if (text !== '') {
        const li = document.createElement('li');
        li.className = 's9-card';
        li.textContent = text;
        document.getElementById('s9-todo-list').appendChild(li);
        input.value = '';
    }
function updateCounters() {
    const todoCount = document.getElementById('s9-todo-list').children.length;
    const doingCount = document.getElementById('s9-doing-list').children.length;
    const doneCount = document.getElementById('s9-done-list').children.length;

    document.getElementById('s9-count-todo').textContent = todoCount;
    document.getElementById('s9-count-doing').textContent = doingCount;
    document.getElementById('s9-count-done').textContent = doneCount;
}

document.getElementById('s9-add').addEventListener('click', function() {
    const input = document.getElementById('s9-new');
    const text = input.value.trim();
    if (text !== '') {
        const li = document.createElement('li');
        li.className = 's9-card';
        li.textContent = text;
        document.getElementById('s9-todo-list').appendChild(li);
        input.value = '';
        updateCounters();
    }
});

document.getElementById('s9-todo-list').addEventListener('click', function(event) {
    if (event.target.tagName === 'LI') {
        event.target.remove();
        document.getElementById('s9-doing-list').appendChild(event.target);
        updateCounters();
    }
});

document.getElementById('s9-doing-list').addEventListener('click', function(event) {
    if (event.target.tagName === 'LI') {
        event.target.remove();
        document.getElementById('s9-done-list').appendChild(event.target);
        updateCounters();
    }
});
document.addEventListener('DOMContentLoaded', function() {
    const savedCards = localStorage.getItem('s9-board');
    if (savedCards) {
        const cardsData = JSON.parse(savedCards);

        cardsData.todo.forEach(card => {
            const li = document.createElement('li');
            li.className = 's9-card';
            li.textContent = card;
            document.getElementById('s9-todo-list').appendChild(li);
        });

        cardsData.doing.forEach(card => {
            const li = document.createElement('li');
            li.className = 's9-card';
            li.textContent = card;
            document.getElementById('s9-doing-list').appendChild(li);
        });

        cardsData.done.forEach(card => {
            const li = document.createElement('li');
            li.className = 's9-card';
            li.textContent = card;
            document.getElementById('s9-done-list').appendChild(li);
        });

        updateCounters();
    }
});
function saveCards() {
    const todoCards = Array.from(document.getElementById('s9-todo-list').children).map(li => li.textContent);
    const doingCards = Array.from(document.getElementById('s9-doing-list').children).map(li => li.textContent);
    const doneCards = Array.from(document.getElementById('s9-done-list').children).map(li => li.textContent);

    const cardsData = {
        todo: todoCards,
        doing: doingCards,
        done: doneCards
    };

    localStorage.setItem('s9-board', JSON.stringify(cardsData));
    console.log('Cards saved to localStorage:', cardsData);
}

document.addEventListener('DOMContentLoaded', function() {
    const savedCards = localStorage.getItem('s9-board');
    if (savedCards) {
        const cardsData = JSON.parse(savedCards);

        cardsData.todo.forEach(card => {
            const li = document.createElement('li');
            li.className = 's9-card';
            li.textContent = card;
            document.getElementById('s9-todo-list').appendChild(li);
        });

        cardsData.doing.forEach(card => {
            const li = document.createElement('li');
            li.className = 's9-card';
            li.textContent = card;
            document.getElementById('s9-doing-list').appendChild(li);
        });

        cardsData.done.forEach(card => {
            const li = document.createElement('li');
            li.className = 's9-card';
            li.textContent = card;
            document.getElementById('s9-done-list').appendChild(li);
        });

        updateCounters();
        console.log('Cards loaded from localStorage:', cardsData);
    }
});
function saveCards() {
    const todoCards = Array.from(document.getElementById('s9-todo-list').children).map(li => li.textContent);
    const doingCards = Array.from(document.getElementById('s9-doing-list').children).map(li => li.textContent);
    const doneCards = Array.from(document.getElementById('s9-done-list').children).map(li => li.textContent);

    const cardsData = {
        todo: todoCards,
        doing: doingCards,
        done: doneCards
    };

    localStorage.setItem('s9-board', JSON.stringify(cardsData));
    console.log('Cards saved to localStorage:', cardsData);
}

document.addEventListener('DOMContentLoaded', function() {
    const savedCards = localStorage.getItem('s9-board');
    if (savedCards) {
        const cardsData = JSON.parse(savedCards);

        cardsData.todo.forEach(card => {
            const li = document.createElement('li');
            li.className = 's9-card';
            li.textContent = card;
            document.getElementById('s9-todo-list').appendChild(li);
        });

        cardsData.doing.forEach(card => {
            const li = document.createElement('li');
            li.className = 's9-card';
            li.textContent = card;
            document.getElementById('s9-doing-list').appendChild(li);
        });

        cardsData.done.forEach(card => {
            const li = document.createElement('li');
            li.className = 's9-card';
            li.textContent = card;
            document.getElementById('s9-done-list').appendChild(li);
        });

        updateCounters();
        console.log('Cards loaded from localStorage:', cardsData);
    }
});
