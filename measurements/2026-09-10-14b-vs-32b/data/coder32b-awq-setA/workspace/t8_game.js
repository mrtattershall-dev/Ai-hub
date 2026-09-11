const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Ball properties
const ball = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 10,
    vx: 2,
    vy: 2
};

// Draw the ball
function drawBall() {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#0095DD';
    ctx.fill();
    ctx.closePath();
}

// Update the ball position
function updateBall() {
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Collision detection with walls
    if (ball.x + ball.radius > canvas.width || ball.x - ball.radius < 0) {
        ball.vx = -ball.vx;
    }
    if (ball.y + ball.radius > canvas.height || ball.y - ball.radius < 0) {
        ball.vy = -ball.vy;
    }
}

// Game loop
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBall();
    updateBall();
    drawPaddle();
    movePaddle();
    requestAnimationFrame(gameLoop);
}

// Start the game loop
gameLoop();
const paddle = {
    x: canvas.width / 2 - 50,
    y: canvas.height - 20,
    width: 100,
    height: 10,
    dx: 0
};

function drawPaddle() {
ctx.drawImage(paddleImage, paddle.x, paddle.y, paddle.width, paddle.height);
}
document.addEventListener("keydown", keyDownHandler, false);
document.addEventListener("keyup", keyUpHandler, false);

function keyDownHandler(e) {
    if(e.key == "Right" || e.key == "ArrowRight") {
        paddle.dx = 7;
    }
    else if(e.key == "Left" || e.key == "ArrowLeft") {
        paddle.dx = -7;
    }
}

function keyUpHandler(e) {
    if(e.key == "Right" || e.key == "ArrowRight") {
        paddle.dx = 0;
    }
    else if(e.key == "Left" || e.key == "ArrowLeft") {
        paddle.dx = 0;
    }
}
const paddleImage = new Image();
paddleImage.src = 'assets/paddle.png';
paddleImage.onload = function() {
    drawPaddle();
};
function movePaddle() {
    paddle.x += paddle.dx;
    if(paddle.x < 0) {
        paddle.x = 0;
    }
    if(paddle.x + paddle.width > canvas.width) {
        paddle.x = canvas.width - paddle.width;
    }
}
