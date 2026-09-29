export class Particle {

    constructor(x, y) {

        this.x = x;
        this.y = y;

        this.size = 2 + Math.random() * 2;

        this.speedX = (Math.random() - 0.5) * 3;
        this.speedY = -0.8 - Math.random() * 0.5;

        this.life = 16;
        this.maxLife = 16;

    }

    update() {

        this.x += this.speedX;

        this.y += this.speedY;

        this.speedY += 0.08;

        this.life--;

    }

    draw(ctx) {

        ctx.globalAlpha = this.life / this.maxLife;

        ctx.fillStyle = "#8D6E63";

        ctx.beginPath();

        ctx.arc(

            this.x,

            this.y,

            this.size / 2,

            0,

            Math.PI * 2

        );

        ctx.fill();

        ctx.globalAlpha = 1;

    }

}