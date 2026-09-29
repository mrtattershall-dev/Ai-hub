export class Input {

    constructor() {

        this.keys = new Set();
        this.previousKeys = new Set();
        this.touchStartY = 0;
        this.touchThreshold = 40;

        window.addEventListener("keydown", (event) => {
            if (event.repeat) return;
            this.keys.add(event.code);
        });

        window.addEventListener("keyup", (event) => {
            this.keys.delete(event.code);
        });

        window.addEventListener("touchstart", (event) => {

            this.touchStartY = event.touches[0].clientY;

        });

        window.addEventListener("touchend", (event) => {

            const endY = event.changedTouches[0].clientY;

            const diff = endY - this.touchStartY;

            if (diff > this.touchThreshold) {

                // Swipe Down = Duck
                this.keys.add("ArrowDown");

                setTimeout(() => {

                    this.keys.delete("ArrowDown");

                }, 120);

            } else {

                // Tap = Jump
                this.keys.add("Space");

                setTimeout(() => {

                    this.keys.delete("Space");

                }, 120);

            }

        });

    }

    isPressed(key) {

        return this.keys.has(key);

    }

    wasPressed(key) {

        return this.keys.has(key) &&
               !this.previousKeys.has(key);

    }

    update() {

        this.previousKeys = new Set(this.keys);

    }

}