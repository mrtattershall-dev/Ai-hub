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

// Function to save board state to localStorage
function saveState() {
    const state = {
        todo: [],
        doing: [],
        done: []
    };
    
    // Save todo items
    for (let i = 0; i < todoList.children.length; i++) {
        state.todo.push(todoList.children[i].querySelector('span').textContent);
    }
    
    // Save doing items
    for (let i = 0; i < doingList.children.length; i++) {
        state.doing.push(doingList.children[i].querySelector('span').textContent);
    }
    
    // Save done items
    for (let i = 0; i < doneList.children.length; i++) {
        state.done.push(doneList.children[i].querySelector('span').textContent);
    }
    
    localStorage.setItem('s9-board', JSON.stringify(state));
}

// Function to load board state from localStorage
function loadState() {
    const savedState = localStorage.getItem('s9-board');
    if (savedState) {
        const state = JSON.parse(savedState);
        
        // Clear existing lists
        todoList.innerHTML = '';
        doingList.innerHTML = '';
        doneList.innerHTML = '';
        
        // Load todo items
        state.todo.forEach(taskText => {
            addTaskToColumn(taskText, todoList);
        });
        
        // Load doing items
        state.doing.forEach(taskText => {
            addTaskToColumn(taskText, doingList);
        });
        
        // Load done items
        state.done.forEach(taskText => {
            addTaskToColumn(taskText, doneList);
        });
        
        // Update counters
        updateCounters();
    }
}

// Helper function to add a task to a specific column
function addTaskToColumn(taskText, listElement) {
    // Create new list item
    const li = document.createElement('li');
    li.className = 's9-card';
    
    // Create task text span
    const taskSpan = document.createElement('span');
    taskSpan.textContent = taskText;
    
    // Create delete button
    const deleteButton = document.createElement('button');
    deleteButton.className = 's9-del';
    deleteButton.textContent = 'X';
    
    // Add elements to list item
    li.appendChild(taskSpan);
    li.appendChild(deleteButton);
    
    // Add to the specified list
    listElement.appendChild(li);
}


// Add event listener to the button
addButton.addEventListener('click', function() {
    addTask();
    saveState();
});

// Also allow adding tasks with Enter key
newTaskInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        addTask();
        saveState();
    }
});
// Function to update the counters
function updateCounters() {
    todoCount.textContent = todoList.children.length;
    doingCount.textContent = doingList.children.length;
    doneCount.textContent = doneList.children.length;
}

// Add task function
function addTask() {
    const taskText = newTaskInput.value.trim();
    
    // Only add if text is not empty
    if (taskText !== '') {
        // Create new list item
        const li = document.createElement('li');
        li.className = 's9-card';
        
        // Create task text span
        const taskSpan = document.createElement('span');
        taskSpan.textContent = taskText;
        
        // Create delete button
        const deleteButton = document.createElement('button');
        deleteButton.className = 's9-del';
        deleteButton.textContent = 'X';
        
        // Add elements to list item
        li.appendChild(taskSpan);
        li.appendChild(deleteButton);
        
        // Add to the To Do list
        todoList.appendChild(li);
        
        // Update counters
        updateCounters();
        
        // Clear the input
        newTaskInput.value = '';
    }
}

// Add event listener to delete buttons
document.addEventListener('click', function(event) {
    if (event.target.classList.contains('s9-del')) {
        const card = event.target.parentElement;
        card.remove();
        updateCounters();
        saveState();
    }
});
