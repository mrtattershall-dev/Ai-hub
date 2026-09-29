import { Cloud } from "../entities/Cloud.js";

export class CloudManager {

    constructor(game) {

        this.game = game;

        this.clouds = [];

        for (let i = 0; i < 4; i++) {

            this.clouds.push(new Cloud(game));

        }

    }

    update() {

        this.clouds.forEach(cloud => cloud.update());

    }

    draw(ctx) {

        this.clouds.forEach(cloud => cloud.draw(ctx));

    }

}