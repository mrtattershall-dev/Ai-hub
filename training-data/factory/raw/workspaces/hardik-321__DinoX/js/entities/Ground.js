import { SpriteLoader } from "../core/SpriteLoader.js";

export class Ground {

    constructor(game) {

        this.game = game;

        this.tile = SpriteLoader.get("ground");

        this.x = 0;

        this.scrollSpeed = 0.8;

        this.tileSize = 40;

        this.height = this.game.groundHeight;

    }

    update() {

        this.x -= this.game.gameSpeed * this.scrollSpeed;

        if (this.x <= -this.tileSize) {

            this.x = 0;

        }

    }

    draw(ctx) {

        const y = this.game.canvas.height - this.height;

        // Draw repeated ground tiles
        for (

            let x = this.x - this.tileSize;

            x < this.game.canvas.width + this.tileSize;

            x += this.tileSize

        ) {

            ctx.drawImage(

                this.tile,

                x,
                y,

                this.tileSize,
                this.height

            );

        }

        ctx.fillStyle = "rgba(0,0,0,0.15)";

        ctx.fillRect(

            0,

            y,

            this.game.canvas.width,

            this.height

        );

    }

}