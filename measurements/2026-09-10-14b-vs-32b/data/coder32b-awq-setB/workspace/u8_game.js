const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 20,
    speed: 5,
    dx: 0,
    dy: 0
};

function drawCircle(x, y, radius) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'blue';
    ctx.fill();
    ctx.closePath();
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function update() {
    clearCanvas();
    drawCircle(player.x, player.y, player.radius);
    player.x += player.dx;
    player.y += player.dy;
    wrapPlayer();
    moveObstacles();
    drawObstacles();
    checkCollisions();
    requestAnimationFrame(update);
}

function wrapPlayer() {
    if (player.x + player.radius < 0) {
        player.x = canvas.width + player.radius;
    }
    if (player.x - player.radius > canvas.width) {
        player.x = -player.radius;
    }
    if (player.y + player.radius < 0) {
        player.y = canvas.height + player.radius;
    }
    if (player.y - player.radius > canvas.height) {
        player.y = -player.radius;
    }
}

document.addEventListener('keydown', function(event) {
    switch (event.key) {
        case 'w':
            player.dy = -player.speed;
            break;
        case 's':
            player.dy = player.speed;
            break;
        case 'a':
            player.dx = -player.speed;
            break;
        case 'd':
            player.dx = player.speed;
            break;
    }
});

document.addEventListener('keyup', function(event) {
    switch (event.key) {
        case 'w':
        case 's':
            player.dy = 0;
            break;
        case 'a':
        case 'd':
            player.dx = 0;
            break;
    }
});

update();
// Obstacle data
const obstacles = [
    { x: 100, y: 100, dx: 2, dy: 0 },
    { x: 200, y: 200, dx: -2, dy: 0 },
    { x: 300, y: 300, dx: 0, dy: 2 }
];
// Obstacle movement
function moveObstacles() {
    obstacles.forEach(obstacle => {
        obstacle.x += obstacle.dx;
        obstacle.y += obstacle.dy;
        // Wrap obstacles around the canvas
        if (obstacle.x < 0) obstacle.x = canvas.width;
        if (obstacle.x > canvas.width) obstacle.x = 0;
        if (obstacle.y < 0) obstacle.y = canvas.height;
        if (obstacle.y > canvas.height) obstacle.y = 0;
    });
}
// Draw obstacles
function drawObstacles() {
    obstacles.forEach(obstacle => {
        drawCircle(obstacle.x, obstacle.y, 20); // Assuming obstacles are circles with a radius of 20
    });
}
// Collision detection
function checkCollision(circle1, circle2) {
    const dx = circle1.x - circle2.x;
    const dy = circle1.y - circle2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < circle1.radius + circle2.radius;
}

function checkCollisions() {
    obstacles.forEach(obstacle => {
        if (checkCollision(player, obstacle)) {
            gameOver();
        }
    });
}
// Game Over
function gameOver() {
    ctx.fillStyle = 'red';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2);
    clearInterval(gameInterval);
}
// No need to redeclare obstacles here
// No need to redeclare obstacles here

function checkCollisions() {
    for (let obstacle of obstacles) {
        let dx = player.x - obstacle.x;
        let dy = player.y - obstacle.y;
        let distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < player.radius + obstacle.radius) {
            gameOver();
            break;
        }
    }
}

function gameOver() {
    ctx.fillStyle = 'red';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2);
    player.dx = 0;
    player.dy = 0;
    obstacles.forEach(obstacle => {
        obstacle.dx = 0;
        obstacle.dy = 0;
    });
}
// No need to redeclare obstacles here

function update() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Move player
    player.x += player.dx;
    player.y += player.dy;

    // Move obstacles
    for (let obstacle of obstacles) {
        obstacle.x += obstacle.dx;
        obstacle.y += obstacle.dy;

        // Bounce obstacles off walls
        if (obstacle.x + obstacle.radius > canvas.width || obstacle.x - obstacle.radius < 0) {
            obstacle.dx = -obstacle.dx;
        }
        if (obstacle.y + obstacle.radius > canvas.height || obstacle.y - obstacle.radius < 0) {
            obstacle.dy = -obstacle.dy;
        }
    }

    // Check for collisions
    checkCollisions();

    // Draw player
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'blue';
    ctx.fill();
    ctx.closePath();

    // Draw obstacles
    for (let obstacle of obstacles) {
        ctx.beginPath();
        ctx.arc(obstacle.x, obstacle.y, obstacle.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'red';
        ctx.fill();
        ctx.closePath();
    }

    requestAnimationFrame(update);
}

function checkCollisions() {
    for (let obstacle of obstacles) {
        let dx = player.x - obstacle.x;
        let dy = player.y - obstacle.y;
        let distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < player.radius + obstacle.radius) {
            gameOver();
            break;
        }
    }
}

function gameOver() {
    ctx.fillStyle = 'red';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2);
    player.dx = 0;
    player.dy = 0;
    obstacles.forEach(obstacle => {
        obstacle.dx = 0;
        obstacle.dy = 0;
    });
}

update();
