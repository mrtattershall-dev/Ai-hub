import { Cactus } from "../entities/Cactus.js";
import { Bird } from "../entities/Bird.js";

export class EnemyManager {

    constructor(game) {

        this.game = game;

        this.enemies = [];

        this.spawnTimer = 0;

        this.minimumGap = 260;

        this.lastSpawnX = -9999;

        this.consecutiveCactus = 0;
        this.consecutiveBird = 0;

        this.updateSpawnInterval();

    }

    update() {

        this.spawnTimer++;

        if (
            this.spawnTimer >= this.spawnInterval &&
            this.canSpawn()
        ) {

            this.spawnEnemy();

            this.spawnTimer = 0;

            this.updateSpawnInterval();

        }

        this.enemies.forEach(enemy => enemy.update());

        this.enemies = this.enemies.filter(
            enemy => !enemy.isOffScreen()
        );

    }

    draw(ctx) {

        this.enemies.forEach(enemy => enemy.draw(ctx));

    }

    updateSpawnInterval() {

        const score = this.game.scoreManager
            ? this.game.scoreManager.score
            : 0;

        if (score < 200) {

            this.minSpawn = 80;
            this.maxSpawn = 120;

        }
        else if (score < 500) {

            this.minSpawn = 70;
            this.maxSpawn = 105;

        }
        else if (score < 1000) {

            this.minSpawn = 60;
            this.maxSpawn = 90;

        }
        else {

            this.minSpawn = 50;
            this.maxSpawn = 75;

        }

        this.spawnInterval =
            Math.floor(
                Math.random() *
                (this.maxSpawn - this.minSpawn + 1)
            ) + this.minSpawn;

    }

    canSpawn() {

        if (this.enemies.length === 0) {

            return true;

        }

        const lastEnemy = this.enemies[this.enemies.length - 1];

        const gap =
            this.game.canvas.width - lastEnemy.x;

        const requiredGap =
            this.minimumGap +
            this.game.gameSpeed * 8;

        return gap >= requiredGap;

    }

    spawnEnemy() {

        const score = this.game.scoreManager.score;

        let birdChance = 0;

        if (score >= 1000) {

            birdChance = 0.70;

        }
        else if (score >= 500) {

            birdChance = 0.60;

        }
        else if (score >= 200) {

            birdChance = 0.50;

        }

        let spawnBird = Math.random() < birdChance;

        if (this.consecutiveBird >= 2) {

            spawnBird = false;

        }

        if (this.consecutiveCactus >= 3) {

            spawnBird = true;

        }

        if (spawnBird) {

            this.enemies.push(
                new Bird(this.game)
            );

            this.consecutiveBird++;

            this.consecutiveCactus = 0;

        }
        else {

            const first = new Cactus(this.game);

            this.enemies.push(first);

            if (this.game.scoreManager.score >= 300) {

                const chance = Math.random();

                // ---------- Triple Cactus (10%) ----------
                if (chance < 0.10) {

                    const second = new Cactus(
                        this.game,
                        first.x + first.width - 4
                    );

                    const third = new Cactus(
                        this.game,
                        second.x + second.width - 4
                    );

                    this.enemies.push(second);
                    this.enemies.push(third);

                }

                // ---------- Double Cactus (25%) ----------
                else if (chance < 0.35) {

                    const second = new Cactus(
                        this.game,
                        first.x + first.width - 4
                    );

                    this.enemies.push(second);

                }

            }

            this.consecutiveCactus++;

            this.consecutiveBird = 0;

        }

    }

}