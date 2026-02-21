/**
 * FRETMAP UI ENGINE v15 - CLEAN INTERFACE & TRIPLE CONTROLS
 */
var VOL_FLOOR = 0.005, HOLD_FRAMES = 8, ATTACK_THRESH = 1.5, MASTERY_DIFFICULTY = 0.5;
var STRINGS = [{ name: "E", freq: 82.41 }, { name: "A", freq: 110.00 }, { name: "D", freq: 146.83 }, { name: "G", freq: 196.00 }, { name: "B", freq: 246.94 }, { name: "e", freq: 329.63 }];
const COLORS = { bg: '#121212', panel: '#1a1a1a', accent: '#4caf50', target: '#2e7d32', fret: '#444', string: '#555' };
const STR_SPACING = 14, FRET_WIDTH = 25, FIXED_MIN = 9;

function buildUI() {
    const root = document.getElementById('app-root');
    if (!root) return;
    root.innerHTML = '';

    // Calibration Overlay
    const overlay = createEl('div', { id: 'calibration-overlay' }, { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', background: COLORS.bg, zIndex: '1000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' });
    overlay.appendChild(createEl('h2', { innerText: 'GUITAR CONNECTED' }, { color: COLORS.accent, marginBottom: '20px' }));

    const startBtn = createEl('button', { id: 'start-btn', innerText: 'START CALIBRATION' }, { padding: '20px 60px', background: COLORS.accent, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '20px', fontWeight: 'bold' });
    startBtn.onclick = () => { if (typeof initAudio === 'function') initAudio(); };
    overlay.appendChild(startBtn);

    overlay.appendChild(createEl('button', { innerText: 'SKIP', onclick: () => { if(typeof skipCalibration === 'function') skipCalibration(); } }, { marginTop: '20px', background: 'transparent', color: '#555', border: 'none', cursor: 'pointer', textDecoration: 'underline' }));
    root.appendChild(overlay);

    // HUD (Restored 3 Sliders)
    const hud = createEl('div', { id: 'mastery-hud' }, { padding: '20px', background: COLORS.panel, display: 'none', borderBottom: '2px solid #333' });
    const hContent = hud.appendChild(createEl('div', {}, { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }));

    const hStats = hContent.appendChild(createEl('div', {}));
    hStats.appendChild(createEl('div', { id: 'zone-label', innerText: 'ZONE 0' }, { fontWeight: 'bold', color: COLORS.accent }));
    hStats.appendChild(createEl('div', { id: 'calib-pct', innerText: 'READY' }, { fontSize: '11px', color: '#888' }));
    hStats.appendChild(createEl('div', { id: 'mastery-pct', innerText: 'MASTERED: 0/0' }, { fontSize: '11px', color: '#888' }));

    const hSliders = hContent.appendChild(createEl('div', {}, { display: 'flex', gap: '20px' }));

    function makeSlider(label, id, min, max, val, updateFn) {
        const wrap = createEl('div', {}, { textAlign: 'center' });
        wrap.appendChild(createEl('div', { innerText: label }, { fontSize: '9px', color: '#666', marginBottom: '5px' }));
        const slider = createEl('input', { type: 'range', id: id, min: min, max: max, value: val });
        slider.oninput = (e) => updateFn(e.target.value);
        wrap.appendChild(slider);
        return wrap;
    }

    hSliders.appendChild(makeSlider('STRICTNESS', 'strict-slider', 0, 100, 50, (v) => { MASTERY_DIFFICULTY = v/100; recalculateAllMastery(); }));
    hSliders.appendChild(makeSlider('ATTACK', 'attack-slider', 1, 30, 15, (v) => { ATTACK_THRESH = v/10; }));
    hSliders.appendChild(makeSlider('STABILITY', 'stable-slider', 1, 20, 8, (v) => { HOLD_FRAMES = parseInt(v); }));

    const mBar = hud.appendChild(createEl('div', {}, { width: '100%', height: '6px', background: '#222', marginTop: '15px', borderRadius: '3px', overflow: 'hidden' }));
    mBar.appendChild(createEl('div', { id: 'mastery-fill' }, { width: '0%', height: '100%', background: COLORS.accent, transition: 'width 0.3s' }));
    root.appendChild(hud);

    // Game Area
    const game = createEl('div', { id: 'game-area' }, { flex: '1', display: 'none', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' });
    game.appendChild(createEl('div', { id: 'big-note', innerText: '--' }, { fontSize: '140px', fontWeight: 'bold' }));
    game.appendChild(createEl('div', { id: 'string-info', innerText: 'READY' }, { color: COLORS.accent, letterSpacing: '3px', marginBottom: '40px' }));

    const boardWrap = game.appendChild(createEl('div', {}, { width: '90%', maxWidth: '800px' }));
    const board = boardWrap.appendChild(createEl('div', { id: 'fretboard-relative' }, { height: '220px', background: '#1a1a1a', position: 'relative', borderRadius: '8px' }));
    board.appendChild(createEl('div', { id: 'frets-layer' }, { position: 'absolute', width: '100%', height: '100%' }));
    board.appendChild(createEl('div', { id: 'dots-layer' }, { position: 'absolute', width: '100%', height: '100%', zIndex: '5' }));
    board.appendChild(createEl('div', { id: 'live-dot' }, { position: 'absolute', width: '16px', height: '16px', background: 'red', borderRadius: '50%', display: 'none', zIndex: '10', transform: 'translate(-50%, -50%)', boxShadow: '0 0 10px red' }));
    root.appendChild(game);
}

function renderFretboard() {
    const layer = document.getElementById('frets-layer');
    if (!layer) return;
    layer.innerHTML = '';
    for (let i = 0; i < 6; i++) {
        let t = 15 + (i * STR_SPACING);
        layer.appendChild(createEl('div', {}, { position: 'absolute', left: '0', width: '100%', top: t + '%', height: (1 + i/2) + 'px', background: '#444', opacity: '0.5' }));
    }
    for (let i = 0; i <= 4; i++) {
        let l = i * FRET_WIDTH;
        layer.appendChild(createEl('div', {}, { position: 'absolute', top: '10%', height: '80%', left: l + '%', width: '2px', background: '#333' }));
    }
}

function drawBoard() {
    const layer = document.getElementById('dots-layer');
    if (!layer || !activeTarget) return;
    layer.innerHTML = '';
    let relFret = activeTarget.fret - FIXED_MIN;
    const dot = createEl('div', { innerText: activeTarget.note }, { position: 'absolute', width: '48px', height: '48px', borderRadius: '50%', background: COLORS.target, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', transform: 'translate(-50%, -50%)', boxShadow: '0 5px 15px rgba(0,0,0,0.5)' });
    dot.style.top = (15 + (activeTarget.string * STR_SPACING)) + '%';
    dot.style.left = ((relFret * FRET_WIDTH) + (FRET_WIDTH / 2)) + '%';
    layer.appendChild(dot);
}

function createEl(tag, props = {}, style = {}) {
    const el = document.createElement(tag);
    Object.assign(el, props);
    Object.assign(el.style, style);
    return el;
}

function updateMonitor(res) {
    const liveDot = document.getElementById('live-dot');
    if (res.pitch === -1 || !liveDot) { if (liveDot) liveDot.style.display = 'none'; return; }
    let closest = { dist: 999, s: 0, f: 0 };
    STRINGS.forEach((s, sIdx) => {
        let semitones = 12 * Math.log2(res.pitch / s.freq);
        let fret = Math.round(semitones);
        let dist = Math.abs(semitones - fret);
        if (dist < closest.dist) closest = { dist, s: sIdx, f: fret };
    });
    if (closest.dist < 0.35 && closest.f >= FIXED_MIN && closest.f <= 12) {
        liveDot.style.display = 'block';
        liveDot.style.top = (15 + (closest.s * STR_SPACING)) + "%";
        liveDot.style.left = (((closest.f - FIXED_MIN) * FRET_WIDTH) + (FRET_WIDTH / 2)) + "%";
    } else { liveDot.style.display = 'none'; }
}