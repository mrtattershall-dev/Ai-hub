function calculateSum() {
    const number1Input = document.getElementById('number1').value;
    const number2Input = document.getElementById('number2').value;

    if (number1Input === '' || number2Input === '') {
        document.getElementById('result').textContent = 'Error: Both inputs must be numbers.';
        return;
    }

    const number1 = parseFloat(number1Input);
    const number2 = parseFloat(number2Input);

    if (isNaN(number1) || isNaN(number2)) {
        document.getElementById('result').textContent = 'Error: Both inputs must be numbers.';
        return;
    }

    const sum = number1 + number2;
    document.getElementById('result').textContent = 'Sum: ' + sum;
}