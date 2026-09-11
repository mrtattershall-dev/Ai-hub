const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 10,
    speed: 5,
    dx: 0,
    dy: 0
};

function update() {
    // Update player position based on input
    player.x += player.dx;
    player.y += player.dy;

    // Handle wrapping around the edges
    if (player.x + player.radius > canvas.width) {
        player.x = -player.radius;
    } else if (player.x - player.radius < 0) {
        player.x = canvas.width + player.radius;
    }
    if (player.y + player.radius > canvas.height) {
        player.y = -player.radius;
    } else if (player.y - player.radius < 0) {
        player.y = canvas.height + player.radius;
    }

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the player
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'blue';
    ctx.fill();
    ctx.closePath();

    // Request the next frame
    requestAnimationFrame(update);
}

// Handle keyboard input
document.addEventListener('keydown', (event) => {
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

document.addEventListener('keyup', (event) => {
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

// Start the game loop
update();
// Define obstacles
let obstacles = [];
for (let i = 0; i < 3; i++) {
    obstacles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        dx: Math.random() * 2 - 1,
        dy: Math.random() * 2 - 1,
        radius: 10
    });
}

// Update obstacles in the update function
function update() {
    // Update player position based on input
    player.x += player.dx;
    player.y += player.dy;

    // Handle wrapping around the edges
    if (player.x + player.radius > canvas.width) {
        player.x = -player.radius;
    }
    if (player.x - player.radius < 0) {
        player.x = canvas.width + player.radius;
    }
    if (player.y + player.radius > canvas.height) {
        player.y = -player.radius;
    }
    if (player.y - player.radius < 0) {
        player.y = canvas.height + player.radius;
    }

    // Update obstacle positions
    obstacles.forEach(obstacle => {
        obstacle.x += obstacle.dx;
        obstacle.y += obstacle.dy;

        // Handle wrapping around the edges
        if (obstacle.x + obstacle.radius > canvas.width) {
            obstacle.x = -obstacle.radius;
        }
        if (obstacle.x - obstacle.radius < 0) {
            obstacle.x = canvas.width + obstacle.radius;
        }
        if (obstacle.y + obstacle.radius > canvas.height) {
            obstacle.y = -obstacle.radius;
        }
        if (obstacle.y - obstacle.radius < 0) {
            obstacle.y = canvas.height + obstacle.radius;
        }
    });
}
// Collision detection
function checkCollision(circle, obstacle) {
    let dx = circle.x - obstacle.x;
    let dy = circle.y - obstacle.y;
    let distance = Math.sqrt(dx * dx + dy * dy);
    return distance < circle.radius + obstacle.radius;
}

// Update function with collision detection
function update() {
    // Update player position based on input
    player.x += player.dx;
    player.y += player.dy;

    // Handle wrapping around the edges
    if (player.x + player.radius > canvas.width) {
        player.x = -player.radius;
    }
    if (player.x - player.radius < 0) {
        player.x = canvas.width + player.radius;
    }
    if (player.y + player.radius > canvas.height) {
        player.y = -player.radius;
    }
    if (player.y - player.radius < 0) {
        player.y = canvas.height + player.radius;
    }

    // Update obstacle positions
    obstacles.forEach(obstacle => {
        obstacle.x += obstacle.dx;
        obstacle.y += obstacle.dy;

        // Handle wrapping around the edges
        if (obstacle.x + obstacle.radius > canvas.width) {
            obstacle.x = -obstacle.radius;
        }
        if (obstacle.x - obstacle.radius < 0) {
            obstacle.x = canvas.width + obstacle.radius;
        }
        if (obstacle.y + obstacle.radius > canvas.height) {
            obstacle.y = -obstacle.radius;
        }
        if (obstacle.y - obstacle.radius < 0) {
            obstacle.y = canvas.height + obstacle.radius;
        }
    });

    // Check for collisions
    obstacles.forEach(obstacle => {
        if (checkCollision(player, obstacle)) {
            // Handle collision (e.g., show 'Game Over' message)
            console.log('Game Over');
            // Optionally, reset the game or stop the loop
        }
    });
}
// Game Over message
let gameOverMessage = document.createElement('div');
gameOverMessage.textContent = 'Game Over';
gameOverMessage.style.position = 'absolute';
gameOverMessage.style.top = '50%';
gameOverMessage.style.left = '50%';
gameOverMessage.style.transform = 'translate(-50%, -50%)';
gameOverMessage.style.fontSize = '48px';
gameOverMessage.style.color = 'red';
gameOverMessage.style.display = 'none';
document.body.appendChild(gameOverMessage);

// Update function with Game Over message display
function update() {
    // Update player position based on input
    player.x += player.dx;
    player.y += player.dy;

    // Handle wrapping around the edges
    if (player.x + player.radius > canvas.width) {
        player.x = -player.radius;
    }
    if (player.x - player.radius < 0) {
        player.x = canvas.width + player.radius;
    }
    if (player.y + player.radius > canvas.height) {
        player.y = -player.radius;
    }
    if (player.y - player.radius < 0) {
        player.y = canvas.height + player.radius;
    }

    // Update obstacle positions
    obstacles.forEach(obstacle => {
        obstacle.x += obstacle.dx;
        obstacle.y += obstacle.dy;

        // Handle wrapping around the edges
        if (obstacle.x + obstacle.radius > canvas.width) {
            obstacle.x = -obstacle.radius;
        }
        if (obstacle.x - obstacle.radius < 0) {
            obstacle.x = canvas.width + obstacle.radius;
        }
        if (obstacle.y + obstacle.radius > canvas.height) {
            obstacle.y = -obstacle.radius;
        }
        if (obstacle.y - obstacle.radius < 0) {
            obstacle.y = canvas.height + obstacle.radius;
        }
    });

    // Check for collisions
    obstacles.forEach(obstacle => {
        if (checkCollision(player, obstacle)) {
            // Handle collision (e.g., show 'Game Over' message)
            gameOverMessage.style.display = 'block';
            // Optionally, reset the game or stop the loop
        }
    });
}
