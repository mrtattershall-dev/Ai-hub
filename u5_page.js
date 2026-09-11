document.addEventListener('DOMContentLoaded', function() {
    const num1Input = document.getElementById('num1');
    const num2Input = document.getElementById('num2');
    const calculateButton = document.getElementById('calculate');
    const resultParagraph = document.getElementById('result');

    calculateButton.addEventListener('click', function() {
        const num1 = parseFloat(num1Input.value) || 0;
        const num2 = parseFloat(num2Input.value) || 0;
        const sum = num1 + num2;
        resultParagraph.textContent = `Sum: ${sum}`;
    });
});