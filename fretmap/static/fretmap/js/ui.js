/**
 * FRETMAP UI v22 - GOLD MASTER
 * Responsibility: DOM creation and Visual Note Updates
 */
var VOL_FLOOR = 0.005, HOLD_FRAMES = 8, ATTACK_THRESH = 1.5, MASTERY_DIFFICULTY = 0.5;
var STRINGS = [{ name: "E", freq: 82.41 }, { name: "A", freq: 110.00 }, { name: "D", freq: 146.83 }, { name: "G", freq: 196.00 }, { name: "B", freq: 246.94 }, { name: "e", freq: 329.63 }];
const COLORS = { bg: '#121212', panel: '#1a1a1a', accent: '#4caf50', target: '#2e7d32', fret: '#444', string: '#555' };
const STR_SPACING = 14, FRET_WIDTH = 25, FIXED_MIN = 9;

function buildUI() {
    const root = document.getElementById('app-root');
    if (!root) return;
    root.innerHTML = '';

    // --- CALIBRATION OVERLAY ---
    const overlay = createEl('div', { id: 'calibration-overlay' }, { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', background: COLORS.bg, zIndex: '1000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' });
    overlay.appendChild(createEl('h2', { innerText: 'SYSTEM READY' }, { color: COLORS.accent, marginBottom: '20px' }));
    const startBtn = createEl('button', { id: 'start-btn', innerText: 'START MICROPHONE' }, { padding: '20px 60px', background: COLORS.accent, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '20px', fontWeight: 'bold' });
    startBtn.onclick = () => { if (typeof initAudio === 'function') initAudio(); };
    overlay.appendChild(startBtn);
    root.appendChild(overlay);

    // --- HUD (Top Bar) ---
    const hud = createEl('div', { id: 'mastery-hud' }, { padding: '15px 30px', background: COLORS.panel, display: 'none', borderBottom: '1px solid #333' });
    const hContent = hud.appendChild(createEl('div', {}, { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }));
    const hL = hContent.appendChild(createEl('div', {}));
    hL.appendChild(createEl('div', { id: 'zone-label', innerText: 'ZONE 0' }, { fontWeight: 'bold', color: COLORS.accent }));
    hL.appendChild(createEl('div', { id: 'calib-pct', innerText: 'READY' }, { fontSize: '11px', color: '#888' }));
    hL.appendChild(createEl('button', { innerText: '📊 VIEW DB STATS', onclick: showStatsOverlay }, { background: '#333', color: '#ccc', border: 'none', padding: '5px 10px', fontSize: '10px', marginTop: '8px', cursor: 'pointer', borderRadius: '4px' }));

    const hSlid = hContent.appendChild(createEl('div', {}, { display: 'flex', gap: '20px' }));
    hSlid.appendChild(makeSlider('STRICTNESS', 0, 100, 50, (v) => { MASTERY_DIFFICULTY = v/100; if(typeof recalculateAllMastery==='function') recalculateAllMastery(); }));
    hSlid.appendChild(makeSlider('ATTACK', 1, 30, 15, (v) => { ATTACK_THRESH = v/10; }));
    hSlid.appendChild(makeSlider('STABILITY', 1, 20, 8, (v) => { HOLD_FRAMES = parseInt(v); }));
    root.appendChild(hud);

    // --- MAIN GAME AREA ---
    const game = root.appendChild(createEl('div', { id: 'game-area' }, { flex: '1', display: 'none', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }));

    // BIG NOTE (Current Target)
    game.appendChild(createEl('div', { id: 'big-note', innerText: '--' }, { fontSize: '160px', fontWeight: 'bold', color: 'white' }));

    // HORIZONTAL QUEUE (Next 3 Notes)
    const qWrap = game.appendChild(createEl('div', { id: 'queue-list' }, { display: 'flex', gap: '15px', color: COLORS.accent, letterSpacing: '4px', marginBottom: '40px', fontSize: '24px', fontWeight: 'bold' }));
    qWrap.innerText = "READY";

    // FRETBOARD CONTAINER
    const board = game.appendChild(createEl('div', { id: 'fretboard-relative' }, { width: '90%', maxWidth: '800px', height: '240px', background: '#121212', position: 'relative' }));
    board.appendChild(createEl('div', { id: 'frets-layer' }, { position: 'absolute', width: '100%', height: '100%' }));
    board.appendChild(createEl('div', { id: 'dots-layer' }, { position: 'absolute', width: '100%', height: '100%', zIndex: '5' }));
    board.appendChild(createEl('div', { id: 'live-dot' }, { position: 'absolute', width: '18px', height: '18px', background: 'red', borderRadius: '50%', display: 'none', zIndex: '10', transform: 'translate(-50%, -50%)', boxShadow: '0 0 15px red' }));
}

/**
 * Updates the horizontal list of upcoming notes
 */
function updateQueueUI(q) {
    const list = document.getElementById('queue-list');
    if (!list) return;
    list.innerHTML = '';
    q.forEach((n, i) => {
        const span = createEl('span', { innerText: n.note }, { opacity: 1 - (i * 0.3) });
        list.appendChild(span);
        if (i < q.length - 1) list.appendChild(createEl('span', { innerText: '>' }, { color: '#333' }));
    });
}

function renderFretboard() {
    const layer = document.getElementById('frets-layer'); if (!layer) return;
    layer.innerHTML = '';
    // Draw 6 Strings
    for (let i = 0; i < 6; i++) {
        let t = 15 + (i * STR_SPACING);
        layer.appendChild(createEl('div', {}, { position: 'absolute', left: '0', width: '100%', top: t + '%', height: (1 + i/2) + 'px', background: '#444', opacity: '0.4' }));
    }
    // Draw 5 Fret Lines (forming frets 9, 10, 11, 12)
    for (let i = 0; i <= 4; i++) {
        let l = i * FRET_WIDTH;
        layer.appendChild(createEl('div', {}, { position: 'absolute', top: '10%', height: '80%', left: l + '%', width: '1px', background: '#333' }));
    }
}

function drawBoard() {
    const layer = document.getElementById('dots-layer'); if (!layer || !activeTarget) return;
    layer.innerHTML = '';
    let relFret = activeTarget.fret - FIXED_MIN;
    const dot = createEl('div', { innerText: activeTarget.note }, { position: 'absolute', width: '50px', height: '50px', borderRadius: '50%', background: COLORS.target, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', transform: 'translate(-50%, -50%)', top: (15 + (activeTarget.string * STR_SPACING)) + '%', left: ((relFret * FRET_WIDTH) + (FRET_WIDTH / 2)) + '%' });
    layer.appendChild(dot);
}

function showStatsOverlay() {
    const existing = document.getElementById('stats-overlay'); if (existing) { existing.remove(); return; }
    const overlay = createEl('div', { id: 'stats-overlay' }, { position: 'fixed', top: '5%', left: '5%', width: '90%', height: '90%', background: '#1a1a1a', zIndex: '2000', borderRadius: '12px', border: '2px solid #4caf50', display: 'flex', flexDirection: 'column', padding: '20px' });
    const head = overlay.appendChild(createEl('div', {}, { display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }));
    head.appendChild(createEl('h3', { innerText: 'SQLITE DATABASE' }, { color: COLORS.accent }));
    head.appendChild(createEl('button', { innerText: 'CLOSE [X]', onclick: () => overlay.remove() }, { background: 'red', color: 'white', border: 'none', padding: '5px 15px', cursor: 'pointer' }));
    const list = overlay.appendChild(createEl('div', {}, { flex: '1', overflowY: 'auto', background: '#000', padding: '10px', fontFamily: 'monospace' }));
    Object.keys(transitionStats).sort().forEach(key => {
        const s = transitionStats[key];
        list.appendChild(createEl('div', { innerText: `${key.padEnd(12)} | ${Math.round(s.avg)}ms | Reps: ${s.count}` }, { borderBottom: '1px solid #222', padding: '5px 0', color: s.mastery ? '#4caf50' : '#888' }));
    });
    document.body.appendChild(overlay);
}

function makeSlider(l, min, max, val, fn) {
    const w = createEl('div', {}, { textAlign: 'center' }); w.appendChild(createEl('div', { innerText: l }, { fontSize: '9px', color: '#666' }));
    const s = createEl('input', { type: 'range', min: min, max: max, value: val }); s.oninput = (e) => fn(e.target.value);
    w.appendChild(s); return w;
}

function createEl(tag, props = {}, style = {}) { const el = document.createElement(tag); Object.assign(el, props); Object.assign(el.style, style); return el; }