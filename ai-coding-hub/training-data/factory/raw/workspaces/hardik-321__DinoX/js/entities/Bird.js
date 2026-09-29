import { SpriteLoader } from "../core/SpriteLoader.js";

export class Bird {

    constructor(game) {

        this.game = game;

        this.width = 64;
        this.height = 42;

        this.x = this.game.canvas.width + 250;

        const ground =
            this.game.canvas.height -
            this.game.groundHeight;

        // Bird Height
        const random = Math.random();

        if (random < 0.35) {

            this.type = "low";

            // Jump
            this.y = ground - this.height - 5;

        }
        else if (random < 0.80) {

            this.type = "medium";

            // Duck
            this.y = ground - this.height - 64;

        }
        else {

            this.type = "high";

            // Ignore
            this.y = ground - this.height - 145;

        }

        // Animation

        this.frames = [

            SpriteLoader.get("bird1"),
            SpriteLoader.get("bird2"),
            SpriteLoader.get("bird3")

        ];

        this.currentFrame = 0;

        this.frameTimer = 0;

        this.frameInterval = 8;

        console.log(this.type, this.y);
    }

    update() {

        this.x -= this.game.gameSpeed;

        this.frameTimer++;

        if (this.frameTimer >= this.frameInterval) {

            this.currentFrame++;

            this.currentFrame %= this.frames.length;

            this.frameTimer = 0;

        }

    }

    getHitbox() {

        switch (this.type) {

            case "low":

                return {

                    x: this.x + 8,
                    y: this.y + 8,
                    width: this.width - 16,
                    height: this.height - 16

                };

            case "medium":

                return {

                    x: this.x + 7,
                    y: this.y + 3,
                    width: this.width - 14,
                    height: this.height + 4 

                };

            case "high":

                return {

                    x: this.x + 8,
                    y: this.y + 8,
                    width: this.width - 16,
                    height: this.height - 16

                };

        }

    }

    draw(ctx) {

        ctx.imageSmoothingEnabled = false;

        ctx.shadowColor = "rgba(0,0,0,0.6)";
        ctx.shadowBlur = 4;

        ctx.drawImage(

            this.frames[this.currentFrame],

            Math.round(this.x),
            Math.round(this.y),

            this.width,
            this.height

        );

        ctx.shadowBlur = 0;
        
    }

    isOffScreen() {

        return this.x + this.width < 0;

    }

}