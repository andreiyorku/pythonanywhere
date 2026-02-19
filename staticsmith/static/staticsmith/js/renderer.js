import { state } from './state.js';
import { STRINGS, STRING_COLORS, SECTION_COLORS, PLAYHEAD_X, BASE_RADIUS } from './config.js';

export const canvas = {
    main: null,
    ctx: null,
    mini: null,
    miniCtx: null
};

export function initCanvas() {
    canvas.main = document.getElementById('fretboardCanvas');
    canvas.ctx = canvas.main.getContext('2d');
    canvas.mini = document.getElementById('minimapCanvas');
    canvas.miniCtx = canvas.mini.getContext('2d');
}

export function resize() {
    const w = document.getElementById('canvas-wrapper');
    if(!w) return;

    state.width = w.clientWidth || 800;
    state.height = w.clientHeight || 600;

    canvas.main.width = state.width;
    canvas.main.height = state.height;

    const mw = document.getElementById('minimap-container');
    state.miniWidth = mw.clientWidth || state.width;
    state.miniHeight = mw.clientHeight || 100;

    canvas.mini.width = state.miniWidth;
    canvas.mini.height = state.miniHeight;

    applyZoom();
}

export function applyZoom() {
    state.activeRadius = BASE_RADIUS;
    state.activePPS = 150 * state.zoomFactor;

    if(!state.isPlaying) {
        drawMain();
        drawMinimap();
    }
}

export function drawMain() {
    if(!canvas.ctx || state.width <= 0) return;
    const ctx = canvas.ctx;
    const { width, height } = state;

    // 1. Clear Screen
    ctx.fillStyle = "#24150E";
    ctx.fillRect(0, 0, width, height);

    const topMargin = 50;
    const spacing = (height - topMargin - 20) / 6;

    // 2. Sections
    state.sections.forEach((sec, i) => {
        let x = PLAYHEAD_X + (sec.t - state.scrollOffset) * state.activePPS;
        let nextT = (i < state.sections.length - 1) ? state.sections[i+1].t : sec.t + 30;
        let w = (nextT - sec.t) * state.activePPS;

        if (x + w < -100 || x > width) return;

        let c = SECTION_COLORS['verse'];
        for(let key in SECTION_COLORS) if(sec.name.toLowerCase().includes(key)) c = SECTION_COLORS[key];

        ctx.fillStyle = c; ctx.globalAlpha = 0.5; ctx.fillRect(x, 0, w, 30);
        ctx.fillStyle = "white"; ctx.globalAlpha = 1.0; ctx.font = "bold 11px Arial";
        ctx.fillText(sec.name.toUpperCase(), x + 5, 20);
        ctx.strokeStyle = "white"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    });

    // 3. Anchors
    state.currentAnchors.forEach(a => {
        let x = PLAYHEAD_X + (a.t - state.scrollOffset) * state.activePPS;
        if (x < -100 || x > width) return;
        ctx.fillStyle = "#FFF"; ctx.globalAlpha = 0.3;
        let fontSize = Math.max(12, state.activeRadius);
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textAlign = "left";
        ctx.fillText("P" + a.fret, x + 5, height - 10);
    });

    // 4. Strings (RESTORED GLOW)
    ctx.globalAlpha = 1.0;
    for (let i = 0; i < STRINGS; i++) {
        let y = topMargin + spacing * (i + 0.5);
        let c = STRING_COLORS[i];

        // Glow Effect
        ctx.shadowBlur = 15; ctx.shadowColor = c;
        ctx.lineWidth = 4; ctx.strokeStyle = c; ctx.globalAlpha = 0.3;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();

        // Core String
        ctx.shadowBlur = 0; ctx.lineWidth = 1; ctx.strokeStyle = "#FFF"; ctx.globalAlpha = 0.8;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    // 5. Notes & Fingers (RESTORED DETAILS)
    ctx.globalAlpha = 1.0;
    const r = state.activeRadius;
    let fontSize = Math.max(9, Math.floor(r * 1.3));
    let fingerFont = `bold ${fontSize}px Arial`;

    state.currentNotes.forEach(n => {
        let x = PLAYHEAD_X + (n.t - state.scrollOffset) * state.activePPS;
        let y = topMargin + spacing * (n.s + 0.5);

        // Optimization
        if (x + (n.sustain * state.activePPS) < -50 || x > width + 50) return;

        let c = STRING_COLORS[n.s];

        // Sustain Tail
        if (n.sustain > 0) {
            let tailW = n.sustain * state.activePPS;
            ctx.fillStyle = c; ctx.globalAlpha = 0.3;
            ctx.fillRect(x, y - r * 0.3, tailW, r * 0.6);
        }

        // Bend Lines (RESTORED)
        if(n.bend > 0) {
            ctx.strokeStyle = "#FFD700"; ctx.lineWidth = 3; ctx.globalAlpha = 0.9;
            ctx.beginPath(); ctx.moveTo(x, y - r);
            ctx.quadraticCurveTo(x + 20, y - r - 30, x + 40, y - r - 10); ctx.stroke();
        }

        // Note Head
        ctx.globalAlpha = 1.0;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.lineWidth = Math.max(1, r * 0.15);
        ctx.strokeStyle = c; ctx.stroke();

        // Inner Circle (RESTORED)
        ctx.beginPath(); ctx.arc(x, y, r - 3, 0, Math.PI * 2);
        ctx.lineWidth = 1; ctx.strokeStyle = "white"; ctx.stroke();

        // Fret Number
        ctx.fillStyle = "white"; ctx.font = fingerFont;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.lineWidth = 3; ctx.strokeStyle = "black";
        ctx.strokeText(n.f, x, y);
        ctx.fillText(n.f, x, y);

        // Finger Number (RESTORED)
        if(n.finger > 0 && n.f > 0) {
            let fingerY = y - r - (fontSize * 0.6);
            if(n.bend > 0) fingerY -= 15;
            ctx.fillStyle = "#FFD700";
            ctx.font = `bold ${Math.max(10, fontSize)}px Arial`;
            ctx.fillText(n.finger, x, fingerY);
        }
    });

    // 6. Loop Markers
    if (state.loopStart !== -1 && state.loopEnd !== -1) {
        let s = Math.min(state.loopStart, state.loopEnd);
        let e = Math.max(state.loopStart, state.loopEnd);
        let xStart = PLAYHEAD_X + (s - state.scrollOffset) * state.activePPS;
        let xEnd = PLAYHEAD_X + (e - state.scrollOffset) * state.activePPS;

        // Visuals
        ctx.fillStyle = "#00FF00"; ctx.fillRect(xStart - 2, 0, 4, height);
        ctx.beginPath(); ctx.arc(xStart, 20, 8, 0, Math.PI*2); ctx.fill();

        ctx.fillStyle = "#FF0000"; ctx.fillRect(xEnd - 2, 0, 4, height);
        ctx.beginPath(); ctx.arc(xEnd, 20, 8, 0, Math.PI*2); ctx.fill();

        ctx.fillStyle = "rgba(0, 255, 0, 0.1)"; ctx.fillRect(xStart, 0, xEnd - xStart, height);
    }

    // 7. Playhead
    ctx.strokeStyle = "#00FFFF"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(PLAYHEAD_X, 0); ctx.lineTo(PLAYHEAD_X, height); ctx.stroke();

    // 8. Time Label
    let m = Math.floor(state.scrollOffset / 60);
    let s = Math.floor(state.scrollOffset % 60).toString().padStart(2, '0');
    const lbl = document.getElementById('lblTime');
    if (lbl) lbl.textContent = `${m}:${s}`;
}

export function drawMinimap() {
    if(!canvas.miniCtx) return;
    const ctx = canvas.miniCtx;
    const { miniWidth, miniHeight } = state;

    ctx.clearRect(0, 0, miniWidth, miniHeight);
    ctx.fillStyle = "#111"; ctx.fillRect(0, 0, miniWidth, miniHeight);

    if(state.songLength <= 0) return;

    // Zoom Logic
    const visibleDuration = state.songLength / state.minimapZoomFactor;
    const halfVis = visibleDuration / 2;
    let startT = state.scrollOffset - halfVis;
    if (startT < 0) startT = 0;
    if (startT > state.songLength - visibleDuration) startT = state.songLength - visibleDuration;

    const scaleX = miniWidth / visibleDuration;
    const t2x = (t) => (t - startT) * scaleX;

    // Loop
    if (state.loopStart !== -1 && state.loopEnd !== -1) {
        let s = Math.min(state.loopStart, state.loopEnd);
        let e = Math.max(state.loopStart, state.loopEnd);
        let x1 = t2x(s);
        let x2 = t2x(e);
        if (x2 > 0 && x1 < miniWidth) {
            ctx.fillStyle = "#334433"; ctx.fillRect(x1, 0, x2 - x1, miniHeight);
        }
    }

    // Notes
    const stringH = miniHeight / 6;
    state.currentNotes.forEach(n => {
        if (n.t < startT || n.t > startT + visibleDuration) return;
        let mx = t2x(n.t);
        let my = n.s * stringH + stringH / 2;
        ctx.fillStyle = STRING_COLORS[n.s];
        ctx.fillRect(mx, my - 2, 2, 4);
    });

    // Viewport Box
    let boxStartT = state.scrollOffset - (PLAYHEAD_X / state.activePPS);
    let boxEndT = state.scrollOffset + ((state.width - PLAYHEAD_X) / state.activePPS);
    let bx1 = t2x(boxStartT);
    let bx2 = t2x(boxEndT);

    ctx.strokeStyle = "#FFFF00"; ctx.lineWidth = 2;
    ctx.strokeRect(bx1, 1, bx2 - bx1, miniHeight - 2);
}