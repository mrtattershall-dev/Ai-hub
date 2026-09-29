export class SpriteLoader {

    static images = {};

    static load(name, src) {

        return new Promise((resolve, reject) => {

            const image = new Image();

            image.src = src;

            image.onload = () => {

                SpriteLoader.images[name] = image;

                resolve();

            };

            image.onerror = () => {

                reject(`Failed to load ${src}`);

            };

        });

    }

    static get(name) {

        return SpriteLoader.images[name];

    }

}