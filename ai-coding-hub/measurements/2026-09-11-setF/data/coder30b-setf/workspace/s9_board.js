document.addEventListener('DOMContentLoaded', function() {
    const addButton = document.getElementById('s9-add');
    const inputField = document.getElementById('s9-new');
    const todoList = document.getElementById('s9-todo').querySelector('ul');
    const doingList = document.getElementById('s9-doing').querySelector('ul');
    const doneList = document.getElementById('s9-done').querySelector('ul');
    const msgElement = document.getElementById('s9-msg');
    
    const todoCount = document.getElementById('s9-count-todo');
    const doingCount = document.getElementById('s9-count-doing');
    const doneCount = document.getElementById('s9-count-done');
    
    // Function to check if a card with the same text already exists (case-insensitive, ignore spaces)
    function isCardDuplicate(text) {
        const normalizedText = text.trim().toLowerCase();
        
        // Check all lists for existing cards with the same text
        const allLists = [todoList, doingList, doneList];
        for (const list of allLists) {
            for (let i = 0; i < list.children.length; i++) {
                const existingCardText = list.children[i].textContent.trim().toLowerCase();
                if (existingCardText === normalizedText) {
                    return true;
                }
            }
        }
        return false;
    }
    
    // Function to update the counts
    function updateCounts() {
        todoCount.textContent = 'To Do: ' + todoList.children.length;
        doingCount.textContent = 'Doing: ' + doingList.children.length;
        doneCount.textContent = 'Done: ' + doneList.children.length;
    }
    
    // Function to save the board state to localStorage
    function saveBoardState() {
        const state = {
            todo: [],
            doing: [],
            done: []
        };
        
        // Save todo items
        for (let i = 0; i < todoList.children.length; i++) {
            state.todo.push(todoList.children[i].textContent);
        }
        
        // Save doing items
        for (let i = 0; i < doingList.children.length; i++) {
            state.doing.push(doingList.children[i].textContent);
        }
        
        // Save done items
        for (let i = 0; i < doneList.children.length; i++) {
            state.done.push(doneList.children[i].textContent);
        }
        
        localStorage.setItem('s9-board', JSON.stringify(state));
    }
    
    // Function to load the board state from localStorage
    function loadBoardState() {
        const savedState = localStorage.getItem('s9-board');
        if (savedState) {
            const state = JSON.parse(savedState);
            
            // Clear existing lists
            todoList.innerHTML = '';
            doingList.innerHTML = '';
            doneList.innerHTML = '';
            
            // Load todo items
            state.todo.forEach(text => {
                createCard(text, todoList);
            });
            
            // Load doing items
            state.doing.forEach(text => {
                createCard(text, doingList);
            });
            
            // Load done items
            state.done.forEach(text => {
                createCard(text, doneList);
            });
            
            updateCounts();
        }
    }
    
    // Function to create a card element
    function createCard(text, parentList) {
        const li = document.createElement('li');
        li.className = 's9-card';
        li.textContent = text;
        
        console.log('Creating card with text:', text);
        
        // Create left button
        const leftButton = document.createElement('button');
        leftButton.className = 's9-left';
        leftButton.textContent = '←';
        leftButton.onclick = function() {
            console.log('Left button clicked for:', text);
            moveLeft(li);
        };
        
        // Create right button
        const rightButton = document.createElement('button');
        rightButton.className = 's9-right';
        rightButton.textContent = '→';
        rightButton.onclick = function() {
            console.log('Right button clicked for:', text);
            moveRight(li);
        };
        
        // Create delete button
        const deleteButton = document.createElement('button');
        deleteButton.className = 's9-del';
        deleteButton.textContent = '×';
        deleteButton.onclick = function() {
            console.log('Delete button clicked for:', text);
            li.remove();
            updateCounts();
            saveBoardState(); // Save after deletion
        };
        
        // Add buttons to card
        li.appendChild(leftButton);
        li.appendChild(rightButton);
        li.appendChild(deleteButton);
        
        parentList.appendChild(li);
    }
    
    // Function to move a card to the next column
    function moveRight(card) {
        console.log('Moving right:', card.textContent);
        const parent = card.parentElement;
        if (parent === todoList) {
            // Check if doing list has 3 cards already
            if (doingList.children.length >= 3) {
                msgElement.textContent = 'Doing is full';
                // Clear the message after a successful action
                setTimeout(() => {
                    msgElement.textContent = '';
                }, 2000);
                return;
            }
            doingList.appendChild(card);
        } else if (parent === doingList) {
            doneList.appendChild(card);
        }
        // If already in doneList, do nothing
        updateCounts();
        saveBoardState(); // Save after moving
    }
    
    // Function to move a card to the previous column
    function moveLeft(card) {
        console.log('Moving left:', card.textContent);
        const parent = card.parentElement;
        if (parent === doingList) {
            todoList.appendChild(card);
        } else if (parent === doneList) {
            // Check if doing list has 3 cards already
            if (doingList.children.length >= 3) {
                msgElement.textContent = 'Doing is full';
                // Clear the message after a successful action
                setTimeout(() => {
                    msgElement.textContent = '';
                }, 2000);
                return;
            }
            doingList.appendChild(card);
        }
        // If already in todoList, do nothing
        updateCounts();
        saveBoardState(); // Save after moving
    }
    
    addButton.addEventListener('click', function() {
        const text = inputField.value.trim();
        if (text) {
            // Check if card already exists
            if (isCardDuplicate(text)) {
                msgElement.textContent = 'Card already exists';
                // Clear the message after a short time
                setTimeout(() => {
                    msgElement.textContent = '';
                }, 2000);
                return;
            }
            createCard(text, todoList);
            inputField.value = '';
            updateCounts();
            saveBoardState(); // Save after adding
        }
    });
    
    inputField.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addButton.click();
        }
    });
    
    // Load saved state on page load
    loadBoardState();
    
    // Initialize counts
    updateCounts();
});