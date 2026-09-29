import { Player } from "../entities/Player.js";
import { Input } from "./Input.js";
import { EnemyManager } from "../managers/EnemyManager.js";
import { GameState } from "./GameState.js";
import { CollisionManager } from "./CollisionManager.js";
import { HUD } from "../ui/HUD.js";
import { ScoreManager } from "../managers/ScoreManager.js";
import { Ground } from "../entities/Ground.js";
import { CloudManager } from "../managers/CloudManager.js";
import { EnvironmentManager } from "../managers/EnvironmentManager.js";
import { SpriteLoader } from "./SpriteLoader.js";
import { SoundManager } from "../managers/SoundManager.js";
import { ParticleManager } from "../managers/ParticleManager.js";


export class Game {

    constructor() {

        this.canvas = document.getElementById("gameCanvas");

        this.virtualWidth = 1400;
        this.virtualHeight = 700;

        this.offsetX = 0;
        this.offsetY = 0;

        this.ctx = this.canvas.getContext("2d");
        this.ctx.imageSmoothingEnabled = false;
        this.gameSpeed = 6;
        this.maxGameSpeed = 15;
        this.groundHeight = 120;
        this.shakeDuration = 0;
        this.shakeStrength = 0;
        this.state = GameState.READY;
        this.countdown = 3;
        this.countdownTimer = this.isMobile ? 40 : 60;
        this.canRestart = false;
        this.gameOverTimer = 0;
        this.lastMilestone = "";
        this.runTime = 0;

        this.resize();

        this.player = new Player(this);

        this.ground = new Ground(this);

        this.cloudManager = new CloudManager(this);

        this.environment = new EnvironmentManager(this);

        this.sound = new SoundManager();

        this.soundMuted = false;

        this.particleManager = new ParticleManager();

        this.background = SpriteLoader.get("background");

        this.input = new Input();

        this.scoreManager = new ScoreManager();

        this.enemyManager = new EnemyManager(this);

        this.hud = new HUD(this);

        window.addEventListener("resize", () => {
            this.resize();
        });

        this.sound.load("jump", "assets/sounds/jump.wav");

        this.sound.load("hit", "assets/sounds/hit.wav");

        this.sound.load(
            "milestone",
            "assets/sounds/milestone.wav"
        );

    }

    resize() {

        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        this.ctx.imageSmoothingEnabled = false;

        this.offsetX =
            (this.canvas.width - this.virtualWidth) / 2;

        this.offsetY =
            (this.canvas.height - this.virtualHeight) / 2;

    }


    restart() {

        this.state = GameState.RUNNING;

        this.player = new Player(this);

        this.enemyManager = new EnemyManager(this);

        this.scoreManager.reset();

        this.canRestart = false;

        this.gameOverTimer = 0;

        this.lastMilestone = "";

        this.runTime = 0;

    }

    updateDifficulty() {

        this.gameSpeed = Math.min(
            6 + Math.floor(this.scoreManager.score / 100),
            this.maxGameSpeed
        );

    }

    update() {

        if (this.input.wasPressed("KeyM")) {

            this.soundMuted = !this.soundMuted;

            this.sound.enabled = !this.soundMuted;

        }

        if (this.input.wasPressed("KeyP")) {

            if (this.state === GameState.RUNNING) {

                this.state = GameState.PAUSED;

            }
            else if (this.state === GameState.PAUSED) {

                this.state = GameState.RUNNING;

            }

        }

        if (this.state === GameState.PAUSED) {

            return;

        }

        if (this.state === GameState.READY) {

            if (this.input.wasPressed("Space")) {

                this.state = GameState.COUNTDOWN;

                this.countdown = 3;

                this.countdownTimer = this.isMobile ? 40 : 60;

            }

            return;

        }

        if (this.state === GameState.COUNTDOWN) {

            this.countdownTimer--;

            if (this.countdownTimer <= 0) {

                this.countdown--;

                this.countdownTimer = 60;

                if (this.countdown < 0) {

                    this.state = GameState.RUNNING;

                }

            }

            return;

        }

        if (this.state === GameState.GAME_OVER) {

            this.gameOverTimer++;

            // Wait about 1 second (60 FPS)
            if (this.gameOverTimer < 60) {

                return;

            }

            if (this.input.wasPressed("Space")) {

                this.restart();

            }

            return;

        }

        if (this.input.wasPressed("Space")) {

            this.player.jump();

        }
        if (
            this.input.isPressed("ArrowDown") ||
            this.input.isPressed("KeyS")
        ) {

            this.player.duck();

        } else {

            this.player.standUp();

        }

        this.player.update();

        this.ground.update();

        this.cloudManager.update();

        this.environment.update();

        this.enemyManager.update();

        this.particleManager.update();

        this.scoreManager.update();

        this.runTime++;

        if (
            this.scoreManager.milestone !== "" &&
            this.scoreManager.milestone !== this.lastMilestone
        ) {

            this.sound.play("milestone");

            this.lastMilestone =
                this.scoreManager.milestone;

        }

        this.updateDifficulty();

        if (this.shakeDuration > 0) {

            this.shakeDuration--;

        }

        if (CollisionManager.check(this.player, this.enemyManager)) {

            this.sound.play("hit");

            this.shakeDuration = 8;
            this.shakeStrength = 2;

            this.gameOverTimer = 0;

            this.state = GameState.GAME_OVER;

        }

    }

    draw(){

        this.ctx.fillStyle = this.environment.getSkyColor();

        this.ctx.save();

        if (this.shakeDuration > 0) {

            const offsetX =
                (Math.random() - 0.5) * this.shakeStrength;

            const offsetY =
                (Math.random() - 0.5) * this.shakeStrength;

            this.ctx.translate(offsetX, offsetY);

        }

        this.ctx.fillRect(
            0,
            0,
            this.canvas.width,
            this.canvas.height
        );

        this.cloudManager.draw(this.ctx);

        this.ground.draw(this.ctx);

        this.particleManager.draw(this.ctx);

        this.enemyManager.draw(this.ctx);

        this.player.draw(this.ctx);

        this.hud.draw(this.ctx);

        this.ctx.restore();

    }

    loop = () => {

        this.update();

        this.draw();

        this.input.update();

        requestAnimationFrame(this.loop);

    }

    start() {

        this.loop();

    }

}