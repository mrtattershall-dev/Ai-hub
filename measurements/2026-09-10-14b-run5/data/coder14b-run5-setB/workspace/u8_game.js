const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  radius: 10,
  speed: 5,
  dx: 0,
  dy: 0
};

function drawPlayer() {
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fillStyle = '#00ff00';
  ctx.fill();
  ctx.closePath();
}

function updatePlayer() {
  player.x += player.dx;
  player.y += player.dy;

  // Wrap-around logic
  if (player.x + player.radius < 0) player.x = canvas.width + player.radius;
  if (player.x - player.radius > canvas.width) player.x = -player.radius;
  if (player.y + player.radius < 0) player.y = canvas.height + player.radius;
  if (player.y - player.radius > canvas.height) player.y = -player.radius;
}

function handleInput() {
  document.addEventListener('keydown', (e) => {
    switch (e.key) {
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

  document.addEventListener('keyup', (e) => {
    switch (e.key) {
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
}

function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawPlayer();
  updatePlayer();
  requestAnimationFrame(gameLoop);
}

handleInput();
gameLoop();