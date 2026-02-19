import { state, loadSettings } from './state.js';
import { initCanvas, resize, drawMain, drawMinimap } from './renderer.js';
import { setupControls, refreshLibrary, togglePlay } from './controls.js';

function init() {
    initCanvas();
    loadSettings();

    window.addEventListener('resize', resize);
    resize();

    setupControls();
    refreshLibrary();

    requestAnimationFrame(gameLoop);
}

function gameLoop(timestamp) {
    if (!state.lastFrameTime) state.lastFrameTime = timestamp;
    let deltaTime = (timestamp - state.lastFrameTime) / 1000;
    state.lastFrameTime = timestamp;

    if (state.isPlaying && state.songLength > 0) {
        state.scrollOffset += deltaTime * state.playbackSpeed;

        if (state.loopStart !== -1 && state.loopEnd !== -1) {
            // Robust check: Ensure s is always start, e is always end
            let s = Math.min(state.loopStart, state.loopEnd);
            let e = Math.max(state.loopStart, state.loopEnd);

            if (state.scrollOffset >= e) {
                state.scrollOffset = s;
            }
        }

        if (state.scrollOffset > state.songLength) {
            state.scrollOffset = state.songLength;
            togglePlay(false);
        }
        drawMain();
        drawMinimap();
    }
    requestAnimationFrame(gameLoop);
}

window.onload = init;