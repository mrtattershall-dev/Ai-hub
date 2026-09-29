export class Cloud {

    constructor(game) {

        this.game = game;

        this.reset();

    }

    reset() {

        this.x = this.game.canvas.width + Math.random() * 300;

        this.y = 20 + Math.random() * 70;

        this.width = 70 + Math.random() * 40;

        this.height = 30;

        this.speed = 1 + Math.random();

    }

    update() {

        this.x -= this.speed + this.game.gameSpeed * 0.02;

        if (this.x + this.width < 0) {

            this.reset();

        }

    }

    draw(ctx) {

        ctx.save();

        // Make clouds less distracting
        ctx.globalAlpha = 0.35;

        ctx.fillStyle = "#FFFFFF";

        ctx.beginPath();

        ctx.arc(this.x + 15, this.y + 15, 15, 0, Math.PI * 2);

        ctx.arc(this.x + 35, this.y + 8, 18, 0, Math.PI * 2);

        ctx.arc(this.x + 55, this.y + 15, 15, 0, Math.PI * 2);

        ctx.fill();

        ctx.restore();

    }

}