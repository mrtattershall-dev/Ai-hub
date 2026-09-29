document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('r9-input');
    const list = document.getElementById('r9-list');

    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            const newItem = document.createElement('li');
            newItem.textContent = input.value;
            list.appendChild(newItem);
            input.value = '';
        }
    });
});