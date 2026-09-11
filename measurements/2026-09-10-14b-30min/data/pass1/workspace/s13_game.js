// s13_game.js

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game state
const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    width: 50,
    height: 50,
    speed: 5
};

// Input system
const keys = {
    up: false,
    down: false,
    left: false,
    right: false
};

document.addEventListener('keydown', (e) => {
    switch (e.key) {
        case 'ArrowUp':
            keys.up = true;
            break;
        case 'ArrowDown':
            keys.down = true;
            break;
        case 'ArrowLeft':
            keys.left = true;
            break;
        case 'ArrowRight':
            keys.right = true;
            break;
    }
});

document.addEventListener('keyup', (e) => {
    switch (e.key) {
        case 'ArrowUp':
            keys.up = false;
            break;
        case 'ArrowDown':
            keys.down = false;
            break;
        case 'ArrowLeft':
            keys.left = false;
            break;
        case 'ArrowRight':
            keys.right = false;
            break;
    }
});

// Physics system
function updatePhysics() {
    if (keys.up && player.y > 0) {
        player.y -= player.speed;
    }
    if (keys.down && player.y < canvas.height - player.height) {
        player.y += player.speed;
    }
    if (keys.left && player.x > 0) {
        player.x -= player.speed;
    }
    if (keys.right && player.x < canvas.width - player.width) {
        player.x += player.speed;
    }
}

// UI system
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
ctx.fillStyle = 'blue';
ctx.fillRect(player.x, player.y, player.width, player.height);
ctx.fillStyle = 'blue';
ctx.fillRect(player.x, player.y, player.width, player.height);
    ctx.fillStyle = 'blue';
    ctx.fillRect(player.x, player.y, player.width, player.height);
}

// Game loop
function gameLoop() {
    updatePhysics();
    render();
    requestAnimationFrame(gameLoop);
}

// Start the game loop
gameLoop();
// Game state
let score = 0;

// UI system
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'blue';
    ctx.fillRect(player.x, player.y, player.width, player.height);
    ctx.fillStyle = 'black';
    ctx.font = '20px Arial';
    ctx.fillText(`Score: ${score}`, 10, 30);
}
