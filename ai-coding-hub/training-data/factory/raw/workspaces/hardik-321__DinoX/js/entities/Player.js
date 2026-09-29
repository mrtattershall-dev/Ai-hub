import { SpriteLoader } from "../core/SpriteLoader.js";

export class Player {

    constructor(game) {

        this.game = game;
        this.jumpCount = 0;

        // Position
        this.x = 100;

        this.width = 56;

        this.normalHeight = 68;
        this.duckHeight = 15;

        this.height = this.normalHeight;

        this.y = this.getGroundY();

        // Physics
        this.velocityY = 0;
        this.gravity = 0.8;
        this.jumpForce = -18;

        // States
        this.isJumping = false;
        this.isDucking = false;

        // Animation
        this.frame = 0;
        this.frameTimer = 0;
        this.frameInterval = 8;

        this.sprite = SpriteLoader.get("player");

        this.frameWidth = 24;
        this.frameHeight = 24;

        this.animationFrame = 0;
        this.animationTimer = 0;
        this.animationSpeed = 8;
        this.currentAnimation = "run";

    }

    getGroundY() {

        return this.game.canvas.height -
               this.game.groundHeight -
               this.normalHeight;

    }

    update() {

        this.velocityY += this.gravity;

        this.y += this.velocityY;

        const ground = this.getGroundY();

        if (this.y >= ground) {

            // Just landed
            if (this.isJumping) {

                // Left foot
                this.game.particleManager.addDust(

                    this.x + 12,

                    this.getGroundY() + this.normalHeight,

                    4

                );

                // Right foot
                this.game.particleManager.addDust(

                    this.x + this.width - 12,

                    this.getGroundY() + this.normalHeight,

                    4

                );

            }

            this.y = ground;

            this.velocityY = 0;

            this.isJumping = false;

        }

        if (!this.isJumping) {

            this.frameTimer++;

            if (this.frameTimer >= this.frameInterval) {

                this.frame = (this.frame + 1) % 2;

                this.frameTimer = 0;

            }

        }
        if (this.isJumping) {

            this.currentAnimation = "jump";

        }
        else if (this.isDucking) {

            this.currentAnimation = "duck";

        }
        else {

            this.currentAnimation = "run";

        }

        // Animation
        this.animationTimer++;

        if (this.animationTimer >= this.animationSpeed) {

            this.animationTimer = 0;

            if (!this.isJumping && !this.isDucking) {

                this.animationFrame++;

                if (this.animationFrame > 3) {

                    this.animationFrame = 0;

                }

            }

        }

    }

    jump() {

        if (this.isJumping) return;

        this.game.sound.play("jump");

        this.velocityY = this.jumpForce;

        this.isJumping = true;

        this.jumpCount++;

    }

    duck() {

        // Cannot duck while jumping or falling
        if (this.isJumping || this.velocityY !== 0) return;

        if (this.isDucking) return;

        this.isDucking = true;

        this.isDucking = true;

    }

    standUp() {

        this.isDucking = false;

    }

    getHitbox() {

        if (this.isDucking) {

            return {

                x: this.x + 10,
                y: this.y + 30,

                width: this.width - 20,
                height: 20

            };

        }

        return {

            x: this.x + 13,
            y: this.y + 7,

            width: this.width - 26,
            height: this.normalHeight - 12

        };

    }

    draw(ctx) {

        let frameX = 0;

        let drawX = this.x;
        let drawY = this.y;
        let drawWidth = this.width;
        let drawHeight = this.height;

        if (this.isJumping) {

            frameX = 4;

        }
        else if (this.isDucking) {

            frameX = 10;

            // Duck sprite settings
            drawWidth = 72;
            drawHeight = 40;

            // Keep feet on the ground
            drawY = this.getGroundY() + (this.normalHeight - drawHeight);

        }
        else {

            frameX = this.animationFrame;

        }

        ctx.fillStyle = "rgba(0,0,0,0.18)";

        ctx.beginPath();

        ctx.ellipse(
            Math.round(drawX + drawWidth / 2),
            this.getGroundY() + drawHeight + 2,
            drawWidth * 0.30,
            4,
            0,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.drawImage(

            this.sprite,

            frameX * this.frameWidth,
            0,

            this.frameWidth,
            this.frameHeight,

            Math.round(drawX),
            Math.round(drawY),

            drawWidth,
            drawHeight

        );

    }

}