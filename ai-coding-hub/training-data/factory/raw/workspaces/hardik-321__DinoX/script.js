const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let obstacles = [];
let gameOver = false;
let score = 0;
let highScore = Number(localStorage.getItem("highScore")) || 0;

// Canvas size
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Ground position
const groundY = canvas.height - 120;
let groundOffset = 0;
let gameSpeed = 8;

// Dinosaur
const dino = {
    x: 100,
    y: groundY - 60,
    width: 50,
    height: 60,

    velocityY: 0,
    gravity: 0.8,
    jumpForce: -18,

    isJumping: false
};

function updateDino() {

    // Apply gravity
    dino.velocityY += dino.gravity;

    // Move the dinosaur
    dino.y += dino.velocityY;

    // Stop at the ground
    if (dino.y >= groundY - dino.height) {

        dino.y = groundY - dino.height;
        dino.velocityY = 0;
        dino.isJumping = false;

    }

}

//Cactus Spawning
function spawnObstacle() {

    obstacles.push({

        x: canvas.width,
        y: groundY - 60,
        width: 35,
        height: 60

    });

}

// Draw everything
function draw(){

    // Sky
    ctx.fillStyle="#f7f7f7";
    ctx.fillRect(0,0,canvas.width,canvas.height);

    // Moving Ground
    ctx.fillStyle = "#444";
    ctx.fillRect(0, groundY, canvas.width, 4);

    // Ground lines
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 2;

    for(let i = -groundOffset; i < canvas.width; i += 40){

        ctx.beginPath();
        ctx.moveTo(i, groundY);
        ctx.lineTo(i + 20, groundY + 10);
        ctx.stroke();

    }

    // Dinosaur (temporary rectangle)
    ctx.fillStyle="green";
    ctx.fillRect(
        dino.x,
        dino.y,
        dino.width,
        dino.height
    );

    //Obstacle
    ctx.fillStyle = "green";

    for(let obstacle of obstacles){

        ctx.fillRect(
            obstacle.x,
            obstacle.y,
            obstacle.width,
            obstacle.height
        );

    }

    //For Score increasing
    ctx.fillStyle = "#222";
    ctx.font = "28px monospace";

    ctx.fillText(
        "Score: " + Math.floor(score),
        30,
        50
    );

    //For High Score 
        ctx.fillText(
        "High Score: " + highScore,
        30,
        90
    );
}

// Game Loop
function gameLoop(){

    if(gameOver){

        draw();

        ctx.fillStyle = "red";
        ctx.font = "60px Arial";
        ctx.fillText("GAME OVER", canvas.width/2 - 180, canvas.height/2);

        return;

    }

    
    groundOffset += gameSpeed;

    if(groundOffset >= 40){
        groundOffset = 0;
    }

    updateDino();
    updateObstacles();
    score += 0.1;
    if(score > highScore){

        highScore = Math.floor(score);

        localStorage.setItem("highScore", highScore);

    }
    checkCollision();
    draw();

    requestAnimationFrame(gameLoop);
}

gameLoop();

//Obstacle in every 2 sec
setInterval(() => {

    spawnObstacle();

}, 2000);

//Keyboard control
window.addEventListener("keydown", function(event){

    if(event.code === "Space" && !dino.isJumping){

        dino.velocityY = dino.jumpForce;
        dino.isJumping = true;

    }

});

//Obstacle moving
function updateObstacles(){

    for(let i = 0; i < obstacles.length; i++){

        obstacles[i].x -= gameSpeed;

    }

    obstacles = obstacles.filter(obstacle => obstacle.x + obstacle.width > 0);

}

//To Check Collision
function checkCollision(){

    for(let obstacle of obstacles){

        if(
            dino.x < obstacle.x + obstacle.width &&
            dino.x + dino.width > obstacle.x &&
            dino.y < obstacle.y + obstacle.height &&
            dino.y + dino.height > obstacle.y
        ){

            gameOver = true;

        }

    }

}