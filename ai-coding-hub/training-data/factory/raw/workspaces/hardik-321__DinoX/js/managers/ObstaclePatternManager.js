export class ObstaclePatternManager {

    constructor(game) {

        this.game = game;

        this.patterns = [

            // ---------------- EASY ----------------

            {
                id: "single_cactus",
                difficulty: 1,
                sequence: [
                    { type: "cactus", distance: 0 }
                ]
            },

            {
                id: "single_bird",
                difficulty: 1,
                sequence: [
                    { type: "bird", distance: 0 }
                ]
            },

            // ---------------- NORMAL ----------------

            {
                id: "double_cactus",
                difficulty: 2,
                sequence: [

                    { type: "cactus", distance: 0 },

                    { type: "cactus", distance: 35 }

                ]
            },

            {
                id: "bird_then_cactus",
                difficulty: 2,
                sequence: [

                    { type: "bird", distance: 0 },

                    { type: "cactus", distance: 45 }

                ]
            },

            // ---------------- HARD ----------------

            {
                id: "cactus_then_bird",
                difficulty: 3,
                sequence: [

                    { type: "cactus", distance: 0 },

                    { type: "bird", distance: 40 }

                ]
            }

        ];

    }

    getDifficulty() {

        const score = this.game.scoreManager.score;

        if (score < 200) return 1;

        if (score < 700) return 2;

        return 3;

    }

    getRandomPattern() {

        const difficulty = this.getDifficulty();

        const available = this.patterns.filter(

            pattern => pattern.difficulty <= difficulty

        );

        return available[
            Math.floor(Math.random() * available.length)
        ];

    }

}