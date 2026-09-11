const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const ball = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 10,
    vx: 2,
    vy: 2
};

function drawBall() {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#0095DD';
    ctx.fill();
    ctx.closePath();
}

function update() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBall();

    // Ball movement
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Collision with walls
    if (ball.x + ball.radius > canvas.width || ball.x - ball.radius < 0) {
        ball.vx = -ball.vx;
    }
    if (ball.y + ball.radius > canvas.height || ball.y - ball.radius < 0) {
        ball.vy = -ball.vy;
    }

    requestAnimationFrame(update);
}

update();
const paddle = {
    x: canvas.width / 2,
    y: canvas.height - 20,
    width: 100,
    height: 10,
    speed: 5
};

function drawPaddle() {
    ctx.beginPath();
    ctx.rect(paddle.x, paddle.y, paddle.width, paddle.height);
    ctx.fillStyle = '#0095DD';
    ctx.fill();
    ctx.closePath();
}
document.addEventListener('keydown', function(event) {
    if (event.key === 'ArrowLeft' && paddle.x > 0) {
        paddle.x -= paddle.speed;
    } else if (event.key === 'ArrowRight' && paddle.x < canvas.width - paddle.width) {
        paddle.x += paddle.speed;
    }
});
function checkCollision() {
    if (ball.y + ball.radius > paddle.y && ball.x > paddle.x && ball.x < paddle.x + paddle.width) {
        ball.vy = -ball.vy;
    }
}
