function incrementCounter() {
    const counterElement = document.getElementById('counter');
    let count = parseInt(counterElement.textContent, 10);
    count++;
    counterElement.textContent = count;
}
function resetCounter() {
    document.getElementById('counter').textContent = '0';
}
