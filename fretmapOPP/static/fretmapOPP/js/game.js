import { FretmapAPI } from './api.js';
import { AudioEngine } from './audio.js';
import { UIManager } from './ui.js';

export class GameEngine {
    constructor() {
        this.api = new FretmapAPI();
        this.audio = new AudioEngine();
        this.ui = new UIManager();
        this.stats = {};
        this.target = null;
    }

    async init() {
        const data = await this.api.getData();
        this.stats = data.transitions;
        this.gameLoop();
    }

    async startAudio() {
        await this.audio.start();
        this.ui.showOverlay('calibration-overlay', false);
        this.nextTurn();
    }

    nextTurn() {
        // Logic to select next note
        this.target = { note: 'E', freq: 82.41, detail: 'Str 6 | Fret 0' };
        this.ui.updateNoteDisplay(this.target.note, this.target.detail);
    }

    gameLoop() {
        const res = this.audio.analyze();
        if (res && res.pitch !== -1) {
            // Check hit logic here
        }
        requestAnimationFrame(() => this.gameLoop());
    }
}