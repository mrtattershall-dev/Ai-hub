document.addEventListener('DOMContentLoaded', function() {
    const input = document.getElementById('r9-input');
    const list = document.getElementById('r9-list');
    const clearButton = document.getElementById('r9-clear');
    
    // Load saved items from localStorage
    function loadItems() {
        const savedItems = localStorage.getItem('r9-items');
        if (savedItems) {
            const items = JSON.parse(savedItems);
            items.forEach(item => {
                const li = document.createElement('li');
                li.textContent = item.text;
                if (item.done) {
                    li.classList.add('done');
                }
                list.appendChild(li);
            });
        }
    }
    
    // Save items to localStorage
    function saveItems() {
        const items = [];
        list.querySelectorAll('li').forEach(li => {
            items.push({
                text: li.textContent,
                done: li.classList.contains('done')
            });
        });
        localStorage.setItem('r9-items', JSON.stringify(items));
    }
    
    // Load items when page loads
    loadItems();
    
    input.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            const text = input.value.trim();
            if (text.length > 0) {
                // Check for duplicate (case-insensitive)
                const existingItems = list.querySelectorAll('li');
                let isDuplicate = false;
                existingItems.forEach(item => {
                    if (item.textContent.toLowerCase() === text.toLowerCase()) {
                        isDuplicate = true;
                    }
                });
                
                if (!isDuplicate) {
                    const li = document.createElement('li');
                    li.textContent = text;
                    list.appendChild(li);
                    input.value = '';
                    saveItems(); // Save after adding new item
                }
            }
        }
    });
    
    // Mark item as done when clicked
    list.addEventListener('click', function(event) {
        if (event.target.tagName === 'LI') {
            event.target.classList.toggle('done');
            saveItems(); // Save after toggling done state
        }
    });
    
    clearButton.addEventListener('click', function() {
        // Filter out done items (items with class "done")
        const items = list.querySelectorAll('li');
        items.forEach(item => {
            if (item.classList.contains('done')) {
                item.remove();
            }
        });
        saveItems(); // Save after clearing done items
    });
});