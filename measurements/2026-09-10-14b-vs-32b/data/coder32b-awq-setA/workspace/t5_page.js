function addItem() {
    const input = document.getElementById('textInput');
    const itemList = document.getElementById('itemList');
    const text = input.value.trim();

    if (text !== '') {
        const li = document.createElement('li');
        li.textContent = text;
        itemList.appendChild(li);
        input.value = '';
    }
}

document.getElementById('textInput').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        addItem();
    }
});
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('clearButton').addEventListener('click', function() {
        const list = document.getElementById('itemList');
        list.innerHTML = '';
    });
});
