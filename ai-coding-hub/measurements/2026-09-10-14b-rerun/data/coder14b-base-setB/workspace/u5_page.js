function calculateSum() {
    const num1 = document.getElementById('num1').value.trim();
    const num2 = document.getElementById('num2').value.trim();
    const sumElement = document.getElementById('result');

    if (num1 === '' || num2 === '') {
        sumElement.textContent = 'Error: Please enter both numbers.';
        return;
    }

    const parsedNum1 = parseFloat(num1);
    const parsedNum2 = parseFloat(num2);

    if (isNaN(parsedNum1) || isNaN(parsedNum2)) {
        sumElement.textContent = 'Error: Please enter valid numbers.';
        return;
    }

    const sum = parsedNum1 + parsedNum2;
    sumElement.textContent = `Sum: ${sum}`;
}