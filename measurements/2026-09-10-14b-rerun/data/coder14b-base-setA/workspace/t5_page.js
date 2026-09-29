document.addEventListener('DOMContentLoaded', function() {
    const textInput = document.getElementById('textInput');
    const itemList = document.getElementById('itemList');

    textInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            const newItem = document.createElement('li');
            newItem.textContent = textInput.value;
            itemList.appendChild(newItem);
            textInput.value = ''; // Clear the input after adding
        }
    });
});
document.getElementById('clearButton').addEventListener('click', function() {
    const list = document.getElementById('itemList');
    list.innerHTML = '';
});
