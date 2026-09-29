import { Particle } from "../entities/Particle.js";

export class ParticleManager {

    constructor() {

        this.particles = [];

    }

    addDust(x, y, count = 8) {

        for (let i = 0; i < count; i++) {

            this.particles.push(
                new Particle(x, y)
            );

        }

    }

    update() {

        this.particles.forEach(p => p.update());

        this.particles =
            this.particles.filter(
                p => p.life > 0
            );

    }

    draw(ctx) {

        this.particles.forEach(
            p => p.draw(ctx)
        );

    }

}