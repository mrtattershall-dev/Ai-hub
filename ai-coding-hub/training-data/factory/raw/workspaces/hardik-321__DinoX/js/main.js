import { Game } from "./core/Game.js";
import { SpriteLoader } from "./core/SpriteLoader.js";
import { LoadingScreen } from "./ui/LoadingScreen.js";

const canvas = document.getElementById("gameCanvas");

const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

LoadingScreen.draw(ctx, canvas);

async function start() {

    try {

        await new Promise(resolve => setTimeout(resolve, 800));
        
        await Promise.all([
            SpriteLoader.load(
                "player",
                "./assets/images/player/dino.png"
            ),

            SpriteLoader.load(
                "ground",
                "./assets/images/environment/ground.png"
            ),

            SpriteLoader.load(
                "background",
                "./assets/images/environment/background.png"
            ),

            SpriteLoader.load(
                "cactus",
                "./assets/images/enemies/cactus.png"
            ),

            SpriteLoader.load(
                "bird1",
                "./assets/images/enemies/bird1.png"
            ),

            SpriteLoader.load(
                "bird2",
                "./assets/images/enemies/bird2.png"
            ),

            SpriteLoader.load(
                "bird3",
                "./assets/images/enemies/bird3.png"
            )
        ]);

        const game = new Game();

        game.start();

    }
    catch (error) {

        console.error(error);

    }

}

start();