// Game variables
let canvas;
let ctx;
let ball;
let paddle;

// Initialize the game
function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    // Test: Draw a simple rectangle to see if drawing works
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(10, 10, 50, 50);
    
    // Ball properties
    ball = {
        x: canvas.width / 2,
        y: canvas.height / 2,
        radius: 10,
        dx: 2,
        dy: 2
    };
    
    // Start the game loop
    gameLoop();
}

// Game loop
function gameLoop() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw ball
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.closePath();
    
    // Update ball position
    ball.x += ball.dx;
    ball.y += ball.dy;
    
    // Bounce off walls
    if (ball.x - ball.radius < 0 || ball.x + ball.radius > canvas.width) {
        ball.dx = -ball.dx;
    }
    if (ball.y - ball.radius < 0 || ball.y + ball.radius > canvas.height) {
        ball.dy = -ball.dy;
    }
    
    // Continue the loop
    requestAnimationFrame(gameLoop);
}

// Start the game when the page loads
window.addEventListener('load', init);