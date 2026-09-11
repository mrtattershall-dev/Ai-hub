document.addEventListener('DOMContentLoaded', function() {
    const num1Input = document.getElementById('num1');
    const num2Input = document.getElementById('num2');
    const calculateButton = document.getElementById('calculate');
    const resultParagraph = document.getElementById('result');

    calculateButton.addEventListener('click', function() {
        const num1Value = num1Input.value.trim();
        const num2Value = num2Input.value.trim();
        
        // Check if inputs are empty
        if (num1Value === '' || num2Value === '') {
            resultParagraph.textContent = 'Error: Both inputs must be filled.';
            resultParagraph.style.color = 'red';
            return;
        }
        
        // Check if inputs are valid numbers
        const num1 = parseFloat(num1Value);
        const num2 = parseFloat(num2Value);
        
        if (isNaN(num1) || isNaN(num2)) {
            resultParagraph.textContent = 'Error: Both inputs must be valid numbers.';
            resultParagraph.style.color = 'red';
            return;
        }
        
        const sum = num1 + num2;
        resultParagraph.textContent = `Sum: ${sum}`;
        resultParagraph.style.color = 'black';
    });
});