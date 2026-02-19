import { BASE_RADIUS } from './config.js';

export const state = {
    // Data
    rawXML: null,
    currentXMLString: "",
    levels: {},
    sections: [],
    phrases: [],
    chordTemplates: {},
    currentNotes: [],
    currentAnchors: [],
    songLength: 0,

    // View Settings
    zoomFactor: 1.0,
    minimapZoomFactor: 1.0,
    activeRadius: BASE_RADIUS,
    activePPS: 150,
    scrollOffset: 0.0,
    keyboardSpeedMultiplier: 5,

    // Playback
    isPlaying: false,
    playbackSpeed: 0.5,
    lastFrameTime: 0,

    // Loop State
    loopStart: -1,
    loopEnd: -1,
    loopAnchor: 0,              // NEW: Remembers where you started dragging
    isDraggingLoopStart: false,
    isDraggingLoopEnd: false,
    isCreatingLoop: false,      // Minimap creation
    isCreatingLoopMain: false,  // NEW: Main Window creation

    // Persistence
    lastLoadedId: null,

    // Canvas Contexts
    width: 800,
    height: 600,
    miniWidth: 800,
    miniHeight: 100
};

export function saveSettings() {
    const s = {
        zoom: state.zoomFactor,
        miniZoom: state.minimapZoomFactor,
        scrollSpeed: state.keyboardSpeedMultiplier,
        playbackSpeed: state.playbackSpeed,
        loopStart: state.loopStart,
        loopEnd: state.loopEnd,
        lastLoadedId: state.lastLoadedId
    };
    localStorage.setItem('staticSmithSettings', JSON.stringify(s));
}

export function loadSettings() {
    const saved = localStorage.getItem('staticSmithSettings');
    if (saved) {
        try {
            const s = JSON.parse(saved);
            if (s.zoom) state.zoomFactor = parseFloat(s.zoom);
            if (s.miniZoom) state.minimapZoomFactor = parseFloat(s.miniZoom);
            if (s.scrollSpeed) state.keyboardSpeedMultiplier = parseInt(s.scrollSpeed);
            if (s.playbackSpeed) state.playbackSpeed = parseFloat(s.playbackSpeed);
            if (s.loopStart !== undefined) state.loopStart = parseFloat(s.loopStart);
            if (s.loopEnd !== undefined) state.loopEnd = parseFloat(s.loopEnd);
            if (s.lastLoadedId) state.lastLoadedId = s.lastLoadedId;
        } catch (e) {
            console.warn("Settings load error", e);
        }
    }
}