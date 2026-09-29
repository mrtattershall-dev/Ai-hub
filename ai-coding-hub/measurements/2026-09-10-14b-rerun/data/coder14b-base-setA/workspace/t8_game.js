// t8_game.js

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game state
const ball = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 10,
    vx: 2,
    vy: 2
};

// Rendering function
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the ball
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'red';
    ctx.fill();
    ctx.closePath();

    // Draw the walls
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'black';
    ctx.stroke();
    ctx.closePath();

    // Draw the paddle
    ctx.fillStyle = 'blue';
    ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
}

// Game loop
function gameLoop() {
    // Update game state
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Collision detection with walls
    if (ball.x + ball.radius > canvas.width || ball.x - ball.radius < 0) {
        ball.vx = -ball.vx;
    }
    if (ball.y + ball.radius > canvas.height || ball.y - ball.radius < 0) {
        ball.vy = -ball.vy;
    }

    // Render the game
    render();

    // Request the next frame
    requestAnimationFrame(gameLoop);
}

// Start the game loop
gameLoop();
// Paddle state
let paddle = {
    x: canvas.width / 2,
    y: canvas.height - 30,
    width: 100,
    height: 20,
    speed: 5
};

// Rendering function
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the ball
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'red';
    ctx.fill();
    ctx.closePath();

    // Draw the walls
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'black';
    ctx.stroke();
    ctx.closePath();

    // Draw the paddle
    ctx.fillStyle = 'blue';
    ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
}

// Event listeners for paddle movement
document.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft' && paddle.x > 0) {
        paddle.x -= paddle.speed;
    } else if (event.key === 'ArrowRight' && paddle.x < canvas.width - paddle.width) {
        paddle.x += paddle.speed;
    }
});
// Collision detection with paddle
if (ball.y + ball.radius > paddle.y && ball.y - ball.radius < paddle.y + paddle.height) {
    if (ball.x > paddle.x && ball.x < paddle.x + paddle.width) {
        ball.vy = -ball.vy;
    }
}
