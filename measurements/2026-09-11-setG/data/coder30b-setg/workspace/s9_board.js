document.addEventListener('DOMContentLoaded', function() {
    const addButton = document.getElementById('s9-add');
    const inputField = document.getElementById('s9-new');
    const todoList = document.getElementById('s9-todo').querySelector('ul');
    const doingList = document.getElementById('s9-doing').querySelector('ul');
    const doneList = document.getElementById('s9-done').querySelector('ul');
    
    // Load saved state from localStorage
    function loadBoardState() {
        const savedState = localStorage.getItem('s9-board');
        if (savedState) {
            const state = JSON.parse(savedState);
            // Clear existing lists
            todoList.innerHTML = '';
            doingList.innerHTML = '';
            doneList.innerHTML = '';
            
            // Rebuild lists from saved state
            state.todo.forEach(text => {
                const li = createCard(text);
                todoList.appendChild(li);
            });
            state.doing.forEach(text => {
                const li = createCard(text);
                doingList.appendChild(li);
            });
            state.done.forEach(text => {
                const li = createCard(text);
                doneList.appendChild(li);
            });
            
            updateCounts();
            return true;
        }
        return false;
    }
    
    function createCard(text) {
        const li = document.createElement('li');
        li.className = 's9-card';
        li.textContent = text;
        
        // Create left and right buttons
        const leftButton = document.createElement('button');
        leftButton.className = 's9-left';
        leftButton.textContent = '←';
        leftButton.addEventListener('click', function(e) {
            e.stopPropagation();
            moveCard(li, -1);
        });
        
        const rightButton = document.createElement('button');
        rightButton.className = 's9-right';
        rightButton.textContent = '→';
        rightButton.addEventListener('click', function(e) {
            e.stopPropagation();
            moveCard(li, 1);
        });
        
        // Create delete button
        const deleteButton = document.createElement('button');
        deleteButton.className = 's9-del';
        deleteButton.textContent = '×';
        deleteButton.addEventListener('click', function(e) {
            e.stopPropagation();
            li.remove();
            updateCounts();
            saveBoardState(); // Save after deletion
        });
        
        li.appendChild(leftButton);
        li.appendChild(rightButton);
        li.appendChild(deleteButton);
        
        return li;
    }
    
    function moveCard(card, direction) {
        const currentList = card.parentElement;
        let targetList;
        
        if (direction === 1) {
            // Moving right
            if (currentList === todoList) {
                targetList = doingList;
            } else if (currentList === doingList) {
                targetList = doneList;
            } else {
                // Already in Done, do nothing
                return;
            }
        } else if (direction === -1) {
            // Moving left
            if (currentList === doingList) {
                targetList = todoList;
            } else if (currentList === doneList) {
                targetList = doingList;
            } else {
                // Already in To Do, do nothing
                return;
            }
        }
        
        if (targetList) {
            targetList.appendChild(card);
            saveBoardState(); // Save after moving
        }
    }
    
    function saveBoardState() {
        const state = {
            todo: Array.from(todoList.children).map(li => li.textContent),
            doing: Array.from(doingList.children).map(li => li.textContent),
            done: Array.from(doneList.children).map(li => li.textContent)
        };
        localStorage.setItem('s9-board', JSON.stringify(state));
        updateCounts();
    }
    
    function updateCounts() {
        document.getElementById('s9-count-todo').textContent = todoList.children.length;
        document.getElementById('s9-count-doing').textContent = doingList.children.length;
        document.getElementById('s9-count-done').textContent = doneList.children.length;
    }
    
    addButton.addEventListener('click', function() {
        const text = inputField.value.trim();
        if (text) {
            const li = createCard(text);
            todoList.appendChild(li);
            inputField.value = '';
            saveBoardState(); // Save after adding
        }
    });
    
    inputField.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevent form submission
            const text = inputField.value.trim();
            if (text) {
                const li = createCard(text);
                todoList.appendChild(li);
                inputField.value = '';
                saveBoardState();
            }
        }
    });
    
    // Load saved state or initialize with empty board
    loadBoardState();
});

function updateCounts() {
    const todoList = document.getElementById('s9-todo').querySelector('ul');
    const doingList = document.getElementById('s9-doing').querySelector('ul');
    const doneList = document.getElementById('s9-done').querySelector('ul');
    
    document.getElementById('s9-count-todo').textContent = todoList.children.length;
    document.getElementById('s9-count-doing').textContent = doingList.children.length;
    document.getElementById('s9-count-done').textContent = doneList.children.length;
}