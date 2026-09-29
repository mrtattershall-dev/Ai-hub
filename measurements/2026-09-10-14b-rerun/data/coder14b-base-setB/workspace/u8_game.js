// u8_game.js

// Initialize canvas and context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Player properties
const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 10,
    vx: 0,
    vy: 0,
    speed: 5
};

// Input states
const keys = {
    w: false,
    a: false,
    s: false,
    d: false
};

// Event listeners for key presses
document.addEventListener('keydown', (event) => {
    switch (event.key) {
        case 'w': keys.w = true; break;
        case 'a': keys.a = true; break;
        case 's': keys.s = true; break;
        case 'd': keys.d = true; break;
    }
});

document.addEventListener('keyup', (event) => {
    switch (event.key) {
        case 'w': keys.w = false; break;
        case 'a': keys.a = false; break;
        case 's': keys.s = false; break;
        case 'd': keys.d = false; break;
    }
});

// Game loop
function gameLoop() {
    update();
    render();
    requestAnimationFrame(gameLoop);
}

// Update player position based on input
function update() {
    if (keys.w) player.vy = -player.speed;
    if (keys.s) player.vy = player.speed;
    if (keys.a) player.vx = -player.speed;
    if (keys.d) player.vx = player.speed;
// Update position
player.x += player.vx;
player.y += player.vy;

// Wrap around the edges
if (player.x - player.radius < 0) player.x = canvas.width + player.radius;
if (player.x + player.radius > canvas.width) player.x = -player.radius;
if (player.y - player.radius < 0) player.y = canvas.height + player.radius;
if (player.y + player.radius > canvas.height) player.y = -player.radius;

// Reset velocity
player.vx = 0;
player.vy = 0;
}

// Render the player on the canvas
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'blue';
    ctx.fill();
    ctx.closePath();
}

// Start the game loop
gameLoop();
// Obstacle data
const obstacles = [
  { x: 100, y: 100, vx: 2, vy: 0 },
  { x: 200, y: 200, vx: -2, vy: 0 },
  { x: 300, y: 300, vx: 2, vy: 0 }
];

// Update function to handle obstacle movement
function updateObstacles() {
  obstacles.forEach(obstacle => {
    obstacle.x += obstacle.vx;
    obstacle.y += obstacle.vy;

    // Wrap around the screen
    if (obstacle.x < 0) obstacle.x = canvas.width;
    if (obstacle.x > canvas.width) obstacle.x = 0;
    if (obstacle.y < 0) obstacle.y = canvas.height;
    if (obstacle.y > canvas.height) obstacle.y = 0;
  });
}

// Collision detection between player and obstacles
function checkCollision() {
  const playerRadius = 10; // Assuming player is a circle with radius 10
  obstacles.forEach(obstacle => {
    const dx = player.x - obstacle.x;
    const dy = player.y - obstacle.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < playerRadius) {
      // Collision detected
      gameOver = true;
      console.log('Game Over');
    }
  });
}

// Add obstacle movement and collision detection to the update function
function update() {
  updatePlayer();
  updateObstacles();
  checkCollision();
}
