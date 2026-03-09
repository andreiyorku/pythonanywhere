import { FretmapAPI } from './api.js';
import { UIManager } from './ui-manager.js';

class GameEngine {
    constructor() {
        this.api = new FretmapAPI();
        this.ui = new UIManager();
        this.stats = {};
        this.currentZone = 0;
    }

    async start() {
        const data = await this.api.loadUserData();
        this.stats = data.transitions;
        this.currentZone = data.settings.zone_index;
        // Game loop logic
    }
}