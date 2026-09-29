// Get references to the DOM elements
const newTaskInput = document.getElementById('s9-new');
const addButton = document.getElementById('s9-add');
const todoList = document.getElementById('s9-todo').querySelector('ul');
const doingList = document.getElementById('s9-doing').querySelector('ul');
const doneList = document.getElementById('s9-done').querySelector('ul');

// Get references to the counter elements
const todoCount = document.getElementById('s9-count-todo');
const doingCount = document.getElementById('s9-count-doing');
const doneCount = document.getElementById('s9-count-done');

// Load saved state on page load
document.addEventListener('DOMContentLoaded', function() {
    loadState();
});

// Add event listener to the button
addButton.addEventListener('click', addTask);

// Also allow adding tasks by pressing Enter in the input field
newTaskInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        addTask();
    }
});

// Function to save the current board state to localStorage
function saveState() {
    const state = {
        todo: [],
        doing: [],
        done: []
    };
    
    // Get all cards from each column
    for (let i = 0; i < todoList.children.length; i++) {
        state.todo.push(todoList.children[i].textContent.replace(/[\n\r\t]/g, '').trim());
    }
    
    for (let i = 0; i < doingList.children.length; i++) {
        state.doing.push(doingList.children[i].textContent.replace(/[\n\r\t]/g, '').trim());
    }
    
    for (let i = 0; i < doneList.children.length; i++) {
        state.done.push(doneList.children[i].textContent.replace(/[\n\r\t]/g, '').trim());
    }
    
    // Save to localStorage
    localStorage.setItem('s9-board', JSON.stringify(state));
}

// Function to load the board state from localStorage
function loadState() {
    const savedState = localStorage.getItem('s9-board');
    
    if (savedState) {
        const state = JSON.parse(savedState);
        
        // Clear current lists
        todoList.innerHTML = '';
        doingList.innerHTML = '';
        doneList.innerHTML = '';
        
        // Add cards back to their respective columns
        state.todo.forEach(taskText => {
            addTaskFromText(taskText, todoList);
        });
        
        state.doing.forEach(taskText => {
            addTaskFromText(taskText, doingList);
        });
        
        state.done.forEach(taskText => {
            addTaskFromText(taskText, doneList);
        });
        
        // Update counts
        updateCounts();
    }
}

// Helper function to create a task from text
function addTaskFromText(taskText, targetList) {
    if (taskText !== '') {
        // Create a new list item
        const li = document.createElement('li');
        li.className = 's9-card';
        li.textContent = taskText;
        
        // Create left and right buttons
        const leftButton = document.createElement('button');
        leftButton.className = 's9-left';
        leftButton.textContent = '←';
        leftButton.onclick = function() { 
            moveCard(this.parentElement, 'left'); 
            saveState(); // Save after moving
        };
        
        const rightButton = document.createElement('button');
        rightButton.className = 's9-right';
        rightButton.textContent = '→';
        rightButton.onclick = function() { 
            moveCard(this.parentElement, 'right'); 
            saveState(); // Save after moving
        };
        
        // Create delete button
        const deleteButton = document.createElement('button');
        deleteButton.className = 's9-del';
        deleteButton.textContent = '×';
        deleteButton.onclick = function() { 
            this.parentElement.remove(); 
            updateCounts(); 
            saveState(); // Save after deleting
        };
        
        // Add buttons to the card
        li.appendChild(leftButton);
        li.appendChild(rightButton);
        li.appendChild(deleteButton);
        
        // Add the task to the target list
        targetList.appendChild(li);
    }
}

function addTask() {
    // Get the value from the input field
    const taskText = newTaskInput.value.trim();
    
    // Only add if the text is not empty
    if (taskText !== '') {
        // Create a new list item
        const li = document.createElement('li');
        li.className = 's9-card';
        li.textContent = taskText;
        
        // Create left and right buttons
        const leftButton = document.createElement('button');
        leftButton.className = 's9-left';
        leftButton.textContent = '←';
        leftButton.onclick = function() { 
            moveCard(this.parentElement, 'left'); 
            saveState(); // Save after moving
        };
        
        const rightButton = document.createElement('button');
        rightButton.className = 's9-right';
        rightButton.textContent = '→';
        rightButton.onclick = function() { 
            moveCard(this.parentElement, 'right'); 
            saveState(); // Save after moving
        };
        
        // Create delete button
        const deleteButton = document.createElement('button');
        deleteButton.className = 's9-del';
        deleteButton.textContent = '×';
        deleteButton.onclick = function() { 
            this.parentElement.remove(); 
            updateCounts(); 
            saveState(); // Save after deleting
        };
        
        // Add buttons to the card
        li.appendChild(leftButton);
        li.appendChild(rightButton);
        li.appendChild(deleteButton);
        
        // Add the new task to the end of the To Do list
        todoList.appendChild(li);
        
        // Update the counters
        updateCounts();
        
        // Clear the input field
        newTaskInput.value = '';
        
        // Focus back on the input field for quick successive additions
        newTaskInput.focus();
        
        // Save state after adding a new task
        saveState();
    }
}
function moveCard(cardElement, direction) {
    // Get references to the column containers
    const todoList = document.getElementById('s9-todo').querySelector('ul');
    const doingList = document.getElementById('s9-doing').querySelector('ul');
    const doneList = document.getElementById('s9-done').querySelector('ul');
    
    // Get the parent list of the card
    const parentList = cardElement.parentElement;
    
    // Determine the target list based on direction
    let targetList;
    if (direction === 'right') {
        // Moving right: To Do -> Doing -> Done
        if (parentList === todoList) {
            targetList = doingList;
        } else if (parentList === doingList) {
            targetList = doneList;
        } else {
            // Already in Done, do nothing
            return;
        }
    } else if (direction === 'left') {
        // Moving left: Done -> Doing -> To Do
        if (parentList === doneList) {
            targetList = doingList;
        } else if (parentList === doingList) {
            targetList = todoList;
        } else {
            // Already in To Do, do nothing
            return;
        }
    }
    
    // Move the card to the target list
    if (targetList) {
        targetList.appendChild(cardElement);
    }
    
    // Update the counters
    updateCounts();
}

function updateCounts() {
    // Count the number of cards in each column
    todoCount.textContent = todoList.children.length;
    doingCount.textContent = doingList.children.length;
    doneCount.textContent = doneList.children.length;
}
