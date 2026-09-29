document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('r9-input');
    const list = document.getElementById('r9-list');

    input.addEventListener('keypress', (event) => {
if (event.key === 'Enter') {
    let trimmedValue = input.value.trim();
    if (trimmedValue !== '') {
        const newItem = document.createElement('li');
        newItem.textContent = trimmedValue;
        list.appendChild(newItem);
        input.value = '';
    }
}
    });
});