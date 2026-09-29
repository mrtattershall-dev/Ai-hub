document.addEventListener('DOMContentLoaded', function() {
    const input = document.getElementById('r9-input');
    const list = document.getElementById('r9-list');
    const clearButton = document.getElementById('r9-clear');
    
    input.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            const text = input.value.trim();
            if (text.length > 0) {
                const li = document.createElement('li');
                li.textContent = text;
                list.appendChild(li);
                input.value = '';
            }
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
    });
});