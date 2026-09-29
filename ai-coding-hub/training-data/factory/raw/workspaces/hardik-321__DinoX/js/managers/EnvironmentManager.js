export class EnvironmentManager {

    constructor(game) {

        this.game = game;

        this.time = 0;

        this.dayLength = 18000;

    }

    update() {

        this.time++;

    }

    getSkyColor() {

        const t = (this.time % this.dayLength) / this.dayLength;

        const angle = t * Math.PI * 2;

        const brightness = (Math.sin(angle) + 1) / 2;

        const r = Math.floor(20 + brightness * 115);
        const g = Math.floor(40 + brightness * 170);
        const b = Math.floor(80 + brightness * 175);

        return `rgb(${r}, ${g}, ${b})`;

    }

}