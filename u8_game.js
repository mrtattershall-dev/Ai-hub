// Simple game with player circle and obstacles
// Goal: Add three moving obstacles and show 'Game Over' when circle touches one

// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game state
let gameState = {
    running: true,
    gameOver: false
};

// Player circle
let player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 20,
    speed: 5
};

// Obstacles array
let obstacles = [];

// Initialize obstacles
function initObstacles() {
    obstacles = [
        { x: 100, y: 100, radius: 15, vx: 2, vy: 1 },
        { x: 300, y: 200, radius: 15, vx: -1, vy: 2 },
        { x: 500, y: 300, radius: 15, vx: 1, vy: -2 }
    ];
}

// Handle keyboard input
let keys = {};

document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

// Update player position based on input
function updatePlayer() {
    if (keys['ArrowLeft'] || keys['a']) {
        player.x -= player.speed;
    }
    if (keys['ArrowRight'] || keys['d']) {
        player.x += player.speed;
    }
    if (keys['ArrowUp'] || keys['w']) {
        player.y -= player.speed;
    }
    if (keys['ArrowDown'] || keys['s']) {
        player.y += player.speed;
    }
    
    // Keep player within canvas bounds
    player.x = Math.max(player.radius, Math.min(canvas.width - player.radius, player.x));
    player.y = Math.max(player.radius, Math.min(canvas.height - player.radius, player.y));
}

// Update obstacle positions
function updateObstacles() {
    for (let i = 0; i < obstacles.length; i++) {
        let obstacle = obstacles[i];
        obstacle.x += obstacle.vx;
        obstacle.y += obstacle.vy;
        
        // Bounce off walls
        if (obstacle.x - obstacle.radius < 0 || obstacle.x + obstacle.radius > canvas.width) {
            obstacle.vx = -obstacle.vx;
        }
        if (obstacle.y - obstacle.radius < 0 || obstacle.y + obstacle.radius > canvas.height) {
            obstacle.vy = -obstacle.vy;
        }
    }
}

// Check collision between player and obstacles
function checkCollisions() {
    for (let i = 0; i < obstacles.length; i++) {
        let obstacle = obstacles[i];
        let dx = player.x - obstacle.x;
        let dy = player.y - obstacle.y;
        let distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < player.radius + obstacle.radius) {
            gameState.gameOver = true;
            gameState.running = false;
            return;
        }
    }
}

// Draw everything
function draw() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw player
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'blue';
    ctx.fill();
    ctx.closePath();
    
    // Draw obstacles
    for (let i = 0; i < obstacles.length; i++) {
        let obstacle = obstacles[i];
        ctx.beginPath();
        ctx.arc(obstacle.x, obstacle.y, obstacle.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'red';
        ctx.fill();
        ctx.closePath();
    }
    
    // Draw game over message
    if (gameState.gameOver) {
        ctx.fillStyle = 'black';
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2);
    }
}

// Game loop
function gameLoop() {
    if (gameState.running) {
        updatePlayer();
        updateObstacles();
        checkCollisions();
    }
    draw();
    requestAnimationFrame(gameLoop);
}

// Initialize and start game
initObstacles();
gameLoop();