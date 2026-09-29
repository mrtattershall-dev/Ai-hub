// q9_shop.js - Shop cart functionality

document.addEventListener('DOMContentLoaded', function() {
    const cart = {};
    const cartList = document.getElementById('q9-cart');
    
    // Load cart from localStorage on page load
    function loadCartFromStorage() {
        const savedCart = localStorage.getItem('q9-cart');
        if (savedCart) {
            try {
                const parsedCart = JSON.parse(savedCart);
                for (const name in parsedCart) {
                    cart[name] = parsedCart[name];
                }
            } catch (e) {
                console.error('Failed to parse cart from localStorage', e);
            }
        }
    }
    
    // Save cart to localStorage
    function saveCartToStorage() {
        localStorage.setItem('q9-cart', JSON.stringify(cart));
    }
    
    // Get all add buttons
    const addButtons = document.querySelectorAll('.q9-add');
    
    // Add event listeners to all buttons
    addButtons.forEach(button => {
        button.addEventListener('click', function() {
            const name = this.getAttribute('data-name');
            const price = parseInt(this.getAttribute('data-price'));
            
            // Add item to cart or increment count
            if (cart[name]) {
                cart[name].count++;
            } else {
                cart[name] = { price, count: 1 };
            }
            
            // Save cart to localStorage
            saveCartToStorage();
            
            // Update cart display
            updateCartDisplay();
        });
    });
    
    function updateCartDisplay() {
        // Clear current cart
        cartList.innerHTML = '';
        
        // Calculate total
        let total = 0;
        for (const name in cart) {
            const item = cart[name];
            const li = document.createElement('li');
            li.innerHTML = `${name} x${item.count} <button class="q9-dec">-</button> <button class="q9-inc">+</button>`;
            cartList.appendChild(li);
            total += item.price * item.count;
        }
        
        // Update the cart count display
        document.getElementById('q9-count').textContent = `${total.toFixed(2)} cents`;
    }
    
    // Handle increment and decrement buttons using event delegation
    cartList.addEventListener('click', function(e) {
        if (e.target.classList.contains('q9-dec') || e.target.classList.contains('q9-inc')) {
            const li = e.target.parentElement;
            const text = li.textContent;
            const name = text.split(' x')[0];
            
            if (cart[name]) {
                if (e.target.classList.contains('q9-dec')) {
                    cart[name].count--;
                    if (cart[name].count <= 0) {
                        delete cart[name];
                    }
                } else if (e.target.classList.contains('q9-inc')) {
                    cart[name].count++;
                }
                
                // Save cart to localStorage
                saveCartToStorage();
                
                updateCartDisplay();
            }
        }
    });
    
    // Discount code functionality
    document.getElementById('q9-apply').addEventListener('click', function() {
        const code = document.getElementById('q9-code').value;
        const msgElement = document.getElementById('q9-msg');
        
        // Calculate total
        let total = 0;
        for (const name in cart) {
            const item = cart[name];
            total += item.price * item.count;
        }
        
        if (code === 'SAVE10') {
            // Apply 10% discount
            total = Math.round(total * 0.9 * 100) / 100;
            msgElement.textContent = '10% discount applied!';
            // Update the cart count display with discounted total
            document.getElementById('q9-count').textContent = `${total.toFixed(2)} cents`;
        } else {
            msgElement.textContent = 'Invalid code';
        }
    });
    
    // Load cart from storage when page loads
    loadCartFromStorage();
    
    // Update cart display function to properly calculate and display total
    function updateCartDisplay() {
        // Clear current cart
        cartList.innerHTML = '';
        
        // Calculate total
        let total = 0;
        for (const name in cart) {
            const item = cart[name];
            const li = document.createElement('li');
            li.innerHTML = `${name} x${item.count} <button class="q9-dec">-</button> <button class="q9-inc">+</button>`;
            cartList.appendChild(li);
            total += item.price * item.count;
        }
        
        // Update the cart count display
        document.getElementById('q9-count').textContent = `${total.toFixed(2)} cents`;
    }
});