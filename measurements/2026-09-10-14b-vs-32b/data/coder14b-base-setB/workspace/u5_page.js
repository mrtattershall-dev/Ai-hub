function calculateSum() {
const num1Input = document.getElementById('num1');
const num2Input = document.getElementById('num2');
const num1 = parseFloat(num1Input.value) || 0;
const num2 = parseFloat(num2Input.value) || 0;

if (isNaN(num1) || isNaN(num2) || num1Input.value.trim() === '' || num2Input.value.trim() === '') {
document.getElementById('result').textContent = 'Error: Please enter valid numbers.';
} else {
const sum = num1 + num2;
document.getElementById('result').textContent = 'Sum: ' + sum;
}
}