document.addEventListener('DOMContentLoaded', () => {
    const cart = document.getElementById('q9-cart');
    const totalDisplay = document.querySelectorAll('#q9-total')[0];

    cart.addEventListener('click', (event) => {
        if (event.target.classList.contains('q9-inc')) {
            const li = event.target.parentElement;
            let quantity = parseInt(li.querySelector('span').textContent.split(' ')[1]);
            quantity++;
            li.querySelector('span').textContent = `${li.querySelector('span').textContent.split(' ')[0]} - ${quantity} cents`;
            updateTotal();
        } else if (event.target.classList.contains('q9-dec')) {
            const li = event.target.parentElement;
            let quantity = parseInt(li.querySelector('span').textContent.split(' ')[1]);
            quantity--;
            if (quantity <= 0) {
                cart.removeChild(li);
            } else {
                li.querySelector('span').textContent = `${li.querySelector('span').textContent.split(' ')[0]} - ${quantity} cents`;
                updateTotal();
            }
        }
    });

    function updateTotal() {
        let total = 0;
        const items = cart.querySelectorAll('li');
        items.forEach(item => {
            const price = parseInt(item.querySelector('span').textContent.split(' ')[1]);
            total += price;
        });
        totalDisplay.textContent = `$${(total / 100).toFixed(2)}`;
    }
});
document.getElementById('q9-apply').addEventListener('click', function() {
  const code = document.getElementById('q9-code').value;
  const messageElement = document.getElementById('q9-msg');
  
  if (code === 'SAVE10') {
    // Apply 10% discount
    const totalElement = document.getElementById('q9-total');
    let total = parseFloat(totalElement.textContent);
    total *= 0.9;
    totalElement.textContent = total.toFixed(2);
    messageElement.textContent = 'Discount applied!';
  } else {
    // Invalid code
    messageElement.textContent = 'Invalid code';
  }
});
document.getElementById('q9-clear').addEventListener('click', function() {
    // Clear the cart (this is a placeholder for actual cart clearing logic)
    // For now, just show the "Cart is empty" message
    document.getElementById('q9-empty').style.display = 'block';
});
// Function to update the delivery message
function updateDeliveryMessage(total) {
  const deliveryElement = document.getElementById('q9-delivery');
  if (total >= 10.00) {
    deliveryElement.textContent = 'Free delivery';
  } else {
    deliveryElement.textContent = `Add $${(10.00 - total).toFixed(2)} for free delivery`;
  }
}

// Example usage: Assume total is calculated somewhere in the code
let total = 0; // Initialize total

// Example usage: Assume total is calculated somewhere in the code
// This is a placeholder for the actual calculation of total
total = calculateTotal(); // Replace with the actual function to calculate total
updateDeliveryMessage(total);
// Function to calculate the total amount based on the items in the cart
function calculateTotal() {
  // Example items in the cart
  const items = [
    { name: 'Apple', price: 0.50, quantity: 1 },
    { name: 'Bread', price: 2.25, quantity: 1 },
    { name: 'Milk', price: 1.99, quantity: 1 }
  ];

  // Calculate the total
  let total = 0;
  items.forEach(item => {
    total += item.price * item.quantity;
  });

  return total;
}
// Save discount code to localStorage on input change
document.getElementById('discountCode').addEventListener('input', function() {
    const discountCode = this.value;
    localStorage.setItem('q9-code', discountCode);
});
// Apply discount code from localStorage on page load
window.addEventListener('load', function() {
    const savedCode = localStorage.getItem('q9-code');
    if (savedCode) {
        document.getElementById('discountCode').value = savedCode;
        // Assuming there is a function applyDiscount(code) that applies the discount
        applyDiscount(savedCode);
    }
});
// Function to apply the discount code
function applyDiscount(code) {
    // Example implementation: check if the code is valid and apply a discount
    if (code === 'DISCOUNT10') {
        // Apply a 10% discount
        const discount = 0.10;
        // Assuming there is a function calculateTotal() that calculates the total price
        const total = calculateTotal();
        const discountedTotal = total * (1 - discount);
        document.getElementById('q9-total').textContent = `$${discountedTotal.toFixed(2)}`;
        document.getElementById('q9-msg').textContent = 'Discount applied!';
    } else {
        document.getElementById('q9-msg').textContent = 'Invalid code';
    }
}

// Function to calculate the total price
function calculateTotal() {
    // Example implementation: sum up the prices of all items in the cart
    let total = 0;
    const cartItems = document.querySelectorAll('#q9-cart li');
    cartItems.forEach(item => {
        const price = parseInt(item.querySelector('span').textContent.split(' - ')[1].replace(' cents', ''));
        total += price;
    });
    return total;
}
