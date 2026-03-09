import { GameEngine } from './game.js';

window.addEventListener('DOMContentLoaded', () => {
    const engine = new GameEngine();
    engine.init();

    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.onclick = () => engine.startAudio();
    }
});