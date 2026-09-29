export class SoundManager {

    constructor() {

        this.enabled = true;

        this.sounds = {};

    }

    load(name, path) {

        const audio = new Audio(path);

        audio.preload = "auto";

        this.sounds[name] = audio;

    }

    play(name) {

        if (!this.enabled) return;

        const sound = this.sounds[name];

        if (!sound) return;

        sound.currentTime = 0;

        sound.play();

    }

    toggle() {

        this.enabled = !this.enabled;

    }

}