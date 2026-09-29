document.addEventListener('DOMContentLoaded', function() {
    const addButton = document.getElementById('s9-add');
    const inputField = document.getElementById('s9-new');
    const todoList = document.getElementById('s9-todo').querySelector('ul');
    const doingList = document.getElementById('s9-doing').querySelector('ul');
    const doneList = document.getElementById('s9-done').querySelector('ul');
    
    // Function to move a card to the next column
    function moveCardRight(card) {
        const parent = card.parentElement;
        if (parent === todoList) {
            // Move from To Do to Doing
            doingList.appendChild(card);
        } else if (parent === doingList) {
            // Move from Doing to Done
            doneList.appendChild(card);
        }
        // If already in Done, do nothing
    }
    
    // Function to move a card to the previous column
    function moveCardLeft(card) {
        const parent = card.parentElement;
        if (parent === doingList) {
            // Move from Doing to To Do
            todoList.appendChild(card);
        } else if (parent === doneList) {
            // Move from Done to Doing
            doingList.appendChild(card);
        }
        // If already in To Do, do nothing
    }
    
    addButton.addEventListener('click', function() {
        const taskText = inputField.value.trim();
        
        if (taskText !== '') {
            const li = document.createElement('li');
            li.className = 's9-card';
            li.textContent = taskText;
            
            // Create left and right buttons
            const leftButton = document.createElement('button');
            leftButton.className = 's9-left';
            leftButton.textContent = '←';
            
            const rightButton = document.createElement('button');
            rightButton.className = 's9-right';
            rightButton.textContent = '→';
            
            // Add buttons to the card
            li.appendChild(leftButton);
            li.appendChild(rightButton);
            
            todoList.appendChild(li);
            inputField.value = '';
        }
    });
    
    // Add event listeners for the buttons
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('s9-right')) {
            const card = e.target.parentElement;
            moveCardRight(card);
        }
        if (e.target.classList.contains('s9-left')) {
            const card = e.target.parentElement;
            moveCardLeft(card);
        }
    });
    
    inputField.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addButton.click();
        }
    });
});