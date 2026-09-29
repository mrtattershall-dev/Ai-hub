export class ScoreManager {

    constructor() {

        this.score = 0;

        this.newHighScoreTimer = 0;

        this.highScore = Number(localStorage.getItem("highScore")) || 0;

        this.frameCounter = 0;

        this.milestone = "";

        this.milestoneTimer = 0;

        this.newHighScoreShown = false;

    }

    update() {

        this.frameCounter++;

        // Increase score every 6 frames (~10 points per second at 60 FPS)
        if (this.frameCounter >= 6) {

            this.score++;

            if (this.score > 0 && this.score % 100 === 0) {

                this.milestone = `⭐ ${this.score} POINTS !`;

                this.milestoneTimer = 120;

            }

            this.frameCounter = 0;

        }

        if (this.score > this.highScore) {

            this.highScore = this.score;

            if (!this.newHighScoreShown) {

                this.newHighScoreTimer = 120;

                this.newHighScoreShown = true;

            }

            localStorage.setItem("highScore", this.highScore);

        }

        if (this.milestoneTimer > 0) {

            this.milestoneTimer--;

        }

        if (this.newHighScoreTimer > 0) {

            this.newHighScoreTimer--;

        }

    }

    reset() {

        this.score = 0;

        this.frameCounter = 0;

        this.milestone = "";

        this.milestoneTimer = 0;

        this.newHighScoreShown = false;

    }

}