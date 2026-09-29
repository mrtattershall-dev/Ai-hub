import { GameState } from "../core/GameState.js";

export class HUD {

    constructor(game) {
        this.game = game;
    }

    draw(ctx) {

        ctx.fillStyle = "#000";

        ctx.font = "bold 24px Arial";

        ctx.textAlign = "right";

        const score = this.game.scoreManager.score
            .toString()
            .padStart(5, "0");

        const highScore = this.game.scoreManager.highScore
            .toString()
            .padStart(5, "0");

        ctx.fillText(

            `HI ${highScore}`,

            this.game.canvas.width - 25,

            40

        );

        ctx.fillText(

            `SC ${score}`,

            this.game.canvas.width - 25,

            75

        );

        ctx.font = "18px Arial";

        ctx.fillStyle = "#444";

        ctx.textAlign = "left";

        ctx.fillText(

            this.game.soundMuted ? "🔇 " : "🔊 ",

            20,

            35

        );

        if (this.game.scoreManager.newHighScoreTimer > 0) {

            ctx.font = "bold 24px Arial";

            ctx.fillStyle = "#FFD700";

            ctx.textAlign = "center";

            ctx.fillText(

                "🏆 NEW HIGH SCORE! 🏆",

                this.game.canvas.width / 2,

                50

            );

        }

        if (this.game.state === GameState.READY) {

            ctx.fillStyle = "rgba(0,0,0,0.65)";

            ctx.fillRect(

                0,

                0,

                this.game.canvas.width,

                this.game.canvas.height

            );

            ctx.textAlign = "center";

            ctx.fillStyle = "#FFFFFF";

            ctx.font = "bold 72px Arial";

            ctx.fillText(

                "DINOX",

                this.game.canvas.width / 2,

                this.game.canvas.height / 2 - 120

            );

            ctx.font = "32px Arial";

            ctx.fillText(

                "Press SPACE to Start",

                this.game.canvas.width / 2,

                this.game.canvas.height / 2 - 30

            );

            ctx.font = "24px Arial";

            ctx.fillText(

                "SPACE = Jump",

                this.game.canvas.width / 2,

                this.game.canvas.height / 2 + 40

            );

            ctx.fillText(

                "↓ = Duck",

                this.game.canvas.width / 2,

                this.game.canvas.height / 2 + 80

            );

            ctx.fillText(

                `HIGH SCORE : ${this.game.scoreManager.highScore
                    .toString()
                    .padStart(5, "0")}`,

                this.game.canvas.width / 2,

                this.game.canvas.height / 2 + 150

            );

        }

        if (this.game.state === GameState.COUNTDOWN) {

            ctx.fillStyle = "rgba(0,0,0,0.55)";

            ctx.fillRect(

                0,
                0,
                this.game.canvas.width,
                this.game.canvas.height

            );

            ctx.textAlign = "center";

            ctx.fillStyle = "#FFFFFF";

            ctx.font = "bold 110px Arial";

            const text = this.game.countdown > 0
                ? this.game.countdown
                : "GO!";

            ctx.fillText(

                text,

                this.game.canvas.width / 2,

                this.game.canvas.height / 2

            );

        }

        if (this.game.state === GameState.PAUSED) {

            ctx.fillStyle = "rgba(0,0,0,0.60)";

            ctx.fillRect(

                0,
                0,
                this.game.canvas.width,
                this.game.canvas.height

            );

            ctx.fillStyle = "#FFFFFF";

            ctx.textAlign = "center";

            ctx.font = "bold 70px Arial";

            ctx.fillText(

                "PAUSED",

                this.game.canvas.width / 2,

                this.game.canvas.height / 2 - 20

            );

            ctx.font = "28px Arial";

            ctx.fillText(

                "Press P to Continue",

                this.game.canvas.width / 2,

                this.game.canvas.height / 2 + 45

            );

        }

        if (this.game.state === GameState.GAME_OVER) {

            ctx.fillStyle = "rgba(0,0,0,0.72)";

            ctx.fillRect(
                0,
                0,
                this.game.canvas.width,
                this.game.canvas.height
            );

            ctx.fillStyle = "#fff";

            ctx.textAlign = "center";

            ctx.font = "bold 68px Arial";

            ctx.fillText(
                "GAME OVER",
                this.game.canvas.width / 2,
                this.game.canvas.height / 2 - 20
            );

            ctx.font = "26px Arial";

            ctx.fillStyle = "#DDDDDD";

            ctx.fillText(

                "FINAL SCORE",

                this.game.canvas.width / 2,

                this.game.canvas.height / 2 + 40

            );

            ctx.font = "bold 42px Arial";

            ctx.fillStyle = "#FFFFFF";

            ctx.fillText(

                this.game.scoreManager.score
                    .toString()
                    .padStart(5, "0"),

                this.game.canvas.width / 2,

                this.game.canvas.height / 2 + 90

            );

            ctx.font = "22px Arial";

            ctx.fillStyle = "#BBBBBB";

            ctx.fillText(

                "BEST",

                this.game.canvas.width / 2,

                this.game.canvas.height / 2 + 135

            );

            ctx.font = "34px Arial";

            ctx.fillStyle = "#FFD700";

            ctx.fillText(

                this.game.scoreManager.highScore
                    .toString()
                    .padStart(5, "0"),

                this.game.canvas.width / 2,

                this.game.canvas.height / 2 + 175

            );

            ctx.font = "24px Arial";

            ctx.fillStyle = "#FFFFFF";

            ctx.fillText(

                "Press SPACE to Restart",

                this.game.canvas.width / 2,

                this.game.canvas.height / 2 + 230

            );

        }

        if (this.game.scoreManager.milestoneTimer > 0) {

            ctx.save();

            ctx.globalAlpha =
                this.game.scoreManager.milestoneTimer / 120;

            ctx.fillStyle = "#FFD700";

            ctx.font = "bold 32px Arial";

            ctx.textAlign = "center";

            ctx.fillText(

                this.game.scoreManager.milestone,

                this.game.canvas.width / 2,

                100

            );

            ctx.restore();

        }

    }

}