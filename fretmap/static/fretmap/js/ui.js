/**
 * FRETMAP UI v18 - CONSOLIDATED BUILD
 */
var VOL_FLOOR = 0.005, HOLD_FRAMES = 8, ATTACK_THRESH = 1.5, MASTERY_DIFFICULTY = 0.5;
var STRINGS = [{ name: "E", freq: 82.41 }, { name: "A", freq: 110.00 }, { name: "D", freq: 146.83 }, { name: "G", freq: 196.00 }, { name: "B", freq: 246.94 }, { name: "e", freq: 329.63 }];
const COLORS = { bg: '#121212', panel: '#1a1a1a', accent: '#4caf50', target: '#2e7d32', fret: '#444', string: '#555' };
const STR_SPACING = 14, FRET_WIDTH = 20, FIXED_MIN = 9;

function buildUI() {
    const root = document.getElementById('app-root');
    if (!root) return;
    root.innerHTML = '';

    // 1. Overlay
    const overlay = createEl('div', { id: 'calibration-overlay' }, { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', background: COLORS.bg, zIndex: '1000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' });
    overlay.appendChild(createEl('h2', { innerText: 'SYSTEM READY' }, { color: COLORS.accent, marginBottom: '20px' }));
    const startBtn = createEl('button', { id: 'start-btn', innerText: 'START MICROPHONE' }, { padding: '20px 60px', background: COLORS.accent, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '20px', fontWeight: 'bold' });
    startBtn.onclick = () => { if (typeof initAudio === 'function') initAudio(); };
    overlay.appendChild(startBtn);
    root.appendChild(overlay);

    // 2. HUD
    const hud = createEl('div', { id: 'mastery-hud' }, { padding: '15px 30px', background: COLORS.panel, display: 'none', borderBottom: '2px solid #333' });
    const hContent = hud.appendChild(createEl('div', {}, { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }));
    const hLeft = hContent.appendChild(createEl('div', {}));
    hLeft.appendChild(createEl('div', { id: 'zone-label', innerText: 'ZONE 0' }, { fontWeight: 'bold', color: COLORS.accent }));
    hLeft.appendChild(createEl('div', { id: 'calib-pct', innerText: 'READY' }, { fontSize: '11px', color: '#888' }));
    hLeft.appendChild(createEl('button', { innerText: '📊 VIEW DB STATS', onclick: showStatsOverlay }, { background: '#333', color: '#ccc', border: 'none', padding: '5px 10px', fontSize: '10px', marginTop: '8px', cursor: 'pointer', borderRadius: '4px' }));

    const hSliders = hContent.appendChild(createEl('div', {}, { display: 'flex', gap: '25px' }));
    hSliders.appendChild(makeSlider('STRICTNESS', 0, 100, 50, (v) => { MASTERY_DIFFICULTY = v/100; if(typeof recalculateAllMastery==='function') recalculateAllMastery(); }));
    hSliders.appendChild(makeSlider('ATTACK', 1, 30, 15, (v) => { ATTACK_THRESH = v/10; }));
    hSliders.appendChild(makeSlider('STABILITY', 1, 20, 8, (v) => { HOLD_FRAMES = parseInt(v); }));

    const mBar = hud.appendChild(createEl('div', {}, { width: '100%', height: '4px', background: '#222', marginTop: '15px' }));
    mBar.appendChild(createEl('div', { id: 'mastery-fill' }, { width: '0%', height: '100%', background: COLORS.accent }));
    root.appendChild(hud);

    // 3. Main Stage
    const main = root.appendChild(createEl('div', {}, { flex: '1', display: 'flex' }));
    const sidebar = main.appendChild(createEl('div', { id: 'note-queue-sidebar' }, { width: '120px', background: '#000', display: 'none', flexDirection: 'column', alignItems: 'center', padding: '20px 0', borderRight: '1px solid #222' }));
    sidebar.appendChild(createEl('div', { innerText: 'NEXT' }, { fontSize: '10px', color: '#444', marginBottom: '10px' }));
    sidebar.appendChild(createEl('div', { id: 'queue-list' }, { display: 'flex', flexDirection: 'column', gap: '15px' }));

    const gameArea = main.appendChild(createEl('div', { id: 'game-area' }, { flex: '1', display: 'none', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }));
    gameArea.appendChild(createEl('div', { id: 'big-note', innerText: '--' }, { fontSize: '160px', fontWeight: 'bold' }));
    gameArea.appendChild(createEl('div', { id: 'string-info', innerText: 'READY' }, { color: COLORS.accent, letterSpacing: '4px', marginBottom: '40px' }));

    const board = gameArea.appendChild(createEl('div', { id: 'fretboard-relative' }, { width: '95%', maxWidth: '900px', height: '240px', background: '#1a1a1a', position: 'relative', borderRadius: '10px' }));
    board.appendChild(createEl('div', { id: 'frets-layer' }, { position: 'absolute', width: '100%', height: '100%' }));
    board.appendChild(createEl('div', { id: 'dots-layer' }, { position: 'absolute', width: '100%', height: '100%', zIndex: '5' }));
    board.appendChild(createEl('div', { id: 'live-dot' }, { position: 'absolute', width: '18px', height: '18px', background: 'red', borderRadius: '50%', display: 'none', zIndex: '10', transform: 'translate(-50%, -50%)', boxShadow: '0 0 15px red' }));
}

function updateQueueUI(queue) {
    const list = document.getElementById('queue-list');
    if (!list) return;
    list.innerHTML = '';
    queue.forEach(n => {
        const item = list.appendChild(createEl('div', {}, { width: '60px', height: '60px', borderRadius: '50%', border: '2px solid #333', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }));
        item.appendChild(createEl('div', { innerText: n.note }, { fontSize: '20px', fontWeight: 'bold' }));
        item.appendChild(createEl('div', { innerText: `S${6-n.string} F${n.fret}` }, { fontSize: '9px', color: '#666' }));
    });
}

function showStatsOverlay() {
    const existing = document.getElementById('stats-overlay');
    if (existing) { existing.remove(); return; }
    const overlay = createEl('div', { id: 'stats-overlay' }, { position: 'fixed', top: '5%', left: '5%', width: '90%', height: '90%', background: '#1a1a1a', zIndex: '2000', borderRadius: '12px', border: '2px solid #4caf50', padding: '20px', display: 'flex', flexDirection: 'column' });
    const head = overlay.appendChild(createEl('div', {}, { display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }));
    head.appendChild(createEl('h3', { innerText: 'TRANSITION DATABASE' }, { color: COLORS.accent }));
    head.appendChild(createEl('button', { innerText: 'CLOSE', onclick: () => overlay.remove() }, { background: 'red', color: 'white', border: 'none', padding: '5px 10px', cursor: 'pointer' }));
    const list = overlay.appendChild(createEl('div', {}, { flex: '1', overflowY: 'auto', background: '#000', padding: '10px', fontFamily: 'monospace' }));
    Object.keys(transitionStats).sort().forEach(key => {
        const s = transitionStats[key];
        list.appendChild(createEl('div', { innerText: `${key.padEnd(12)} | ${Math.round(s.avg)}ms | Reps: ${s.count} | ${s.mastery ? 'MASTERED' : '-'}` }, { borderBottom: '1px solid #222', padding: '5px 0', color: s.mastery ? '#4caf50' : '#888' }));
    });
    document.body.appendChild(overlay);
}

function renderFretboard() {
    const layer = document.getElementById('frets-layer'); if (!layer) return;
    layer.innerHTML = '';
    for (let i = 0; i < 6; i++) {
        let t = 15 + (i * STR_SPACING);
        layer.appendChild(createEl('div', {}, { position: 'absolute', left: '0', width: '100%', top: t + '%', height: (1 + i/2) + 'px', background: '#444', opacity: '0.4' }));
    }
    for (let i = 0; i <= 20; i++) {
        let l = i * FRET_WIDTH;
        layer.appendChild(createEl('div', {}, { position: 'absolute', top: '10%', height: '80%', left: l + '%', width: '2px', background: '#333' }));
    }
}

function drawBoard() {
    const layer = document.getElementById('dots-layer'); if (!layer || !activeTarget) return;
    layer.innerHTML = '';
    let relFret = activeTarget.fret - FIXED_MIN;
    const dot = createEl('div', { innerText: activeTarget.note }, { position: 'absolute', width: '50px', height: '50px', borderRadius: '50%', background: COLORS.target, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', transform: 'translate(-50%, -50%)', top: (15 + (activeTarget.string * STR_SPACING)) + '%', left: ((relFret * FRET_WIDTH) + (FRET_WIDTH / 2)) + '%' });
    layer.appendChild(dot);
}

function makeSlider(label, min, max, val, updateFn) {
    const wrap = createEl('div', {}, { textAlign: 'center' });
    wrap.appendChild(createEl('div', { innerText: label }, { fontSize: '9px', color: '#666' }));
    const slider = createEl('input', { type: 'range', min: min, max: max, value: val });
    slider.oninput = (e) => updateFn(e.target.value);
    wrap.appendChild(slider);
    return wrap;
}

function createEl(tag, props = {}, style = {}) { const el = document.createElement(tag); Object.assign(el, props); Object.assign(el.style, style); return el; }