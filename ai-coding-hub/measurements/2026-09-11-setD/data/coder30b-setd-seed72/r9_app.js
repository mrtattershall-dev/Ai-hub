document.addEventListener('DOMContentLoaded', function() {
    const input = document.getElementById('r9-input');
    const list = document.getElementById('r9-list');
    
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
});