document.addEventListener('DOMContentLoaded', function() {
    const input = document.getElementById('textInput');
    const list = document.getElementById('itemList');
    
    input.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            const text = input.value.trim();
            if (text) {
                const li = document.createElement('li');
                li.textContent = text;
                list.appendChild(li);
                input.value = '';
            }
        }
    });
});