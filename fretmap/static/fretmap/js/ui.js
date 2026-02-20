// --- GLOBAL UI SETTINGS ---
var VOL_FLOOR = 0.005;
var HOLD_FRAMES = 8;
var ATTACK_THRESH = 1.5;

const COLORS = {
    bg: '#121212',
    panel: '#1a1a1a',
    accent: '#4caf50',
    target: '#2e7d32',
    fret: '#444',
    string: '#555'
};

const STR_SPACING = 14;
const FRET_WIDTH = 25;

// Helper to create elements with styles
function createEl(tag, props = {}, style = {}) {
    const el = document.createElement(tag);
    Object.assign(el, props);
    Object.assign(el.style, style);
    return el;
}

function buildUI() {
    const root = document.getElementById('app-root');
    if (!root) return;
    root.innerHTML = '';

    // 1. CALIBRATION OVERLAY
    const overlay = createEl('div', { id: 'calibration-overlay' }, {
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
        background: COLORS.bg, zIndex: 1000, display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
    });

    overlay.appendChild(createEl('h2', { innerText: 'GUITAR CONNECTED' }, { color: COLORS.accent, margin: '0 0 10px 0' }));
    overlay.appendChild(createEl('p', { id: 'calib-msg', innerText: 'Initialize audio to begin' }, { color: '#888', margin: '0 0 20px 0' }));

    const pBg = overlay.appendChild(createEl('div', {}, { width: '300px', height: '10px', background: '#333', borderRadius: '5px', overflow: 'hidden', marginBottom: '30px' }));
    pBg.appendChild(createEl('div', { id: 'calib-bar' }, { width: '0%', height: '100%', background: COLORS.accent }));

    overlay.appendChild(createEl('button', { id: 'start-btn', innerText: 'START MICROPHONE', onclick: () => initAudio() }, {
        padding: '15px 40px', background: COLORS.target, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px'
    }));

    overlay.appendChild(createEl('button', { innerText: 'SKIP CALIBRATION', onclick: () => skipCalibration() }, {
        marginTop: '20px', background: 'transparent', color: '#555', border: 'none', cursor: 'pointer', textDecoration: 'underline'
    }));

    root.appendChild(overlay);

    // 2. MASTERY HUD
    const hud = createEl('div', { id: 'mastery-hud' }, {
        padding: '15px 20px', background: COLORS.panel, borderBottom: '1px solid #333', display: 'none'
    });
    const hTop = hud.appendChild(createEl('div', {}, { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }));
    hTop.appendChild(createEl('div', { id: 'zone-label', innerText: 'ZONE 0' }, { fontWeight: 'bold', color: COLORS.accent }));
    hTop.appendChild(createEl('div', { id: 'mastery-pct', innerText: 'MASTERED: 0' }, { color: '#888' }));

    const mBar = hud.appendChild(createEl('div', {}, { width: '100%', height: '4px', background: '#222', marginTop: '10px' }));
    mBar.appendChild(createEl('div', { id: 'mastery-fill' }, { width: '0%', height: '100%', background: COLORS.accent }));
    root.appendChild(hud);

    // 3. GAME AREA
    const game = createEl('div', { id: 'game-area' }, {
        flex: 1, display: 'none', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
    });

    game.appendChild(createEl('div', { id: 'big-note', innerText: '--' }, { fontSize: '120px', fontWeight: 'bold', margin: '0' }));
    game.appendChild(createEl('div', { id: 'string-info', innerText: 'WAITING...' }, { color: COLORS.accent, letterSpacing: '2px', marginBottom: '40px' }));

    const qBox = game.appendChild(createEl('div', {}, { display: 'flex', gap: '15px', marginBottom: '50px', opacity: '0.4' }));
    ['q1-txt', 'q2-txt', 'q3-txt'].forEach(id => {
        qBox.appendChild(createEl('div', { id, innerText: '--' }, {
            width: '45px', height: '45px', border: '1px solid #444', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'
        }));
    });

    // Fretboard Container
    const boardWrap = game.appendChild(createEl('div', {}, { width: '90%', maxWidth: '800px', position: 'relative' }));
    const board = boardWrap.appendChild(createEl('div', { id: 'fretboard-relative' }, {
        height: '240px', background: '#181818', border: '1px solid #333', position: 'relative'
    }));

    board.appendChild(createEl('div', { id: 'frets-layer' }, { position: 'absolute', width: '100%', height: '100%' }));
    board.appendChild(createEl('div', { id: 'dots-layer' }, { position: 'absolute', width: '100%', height: '100%', zIndex: 5 }));
    board.appendChild(createEl('div', { id: 'live-dot' }, {
        position: 'absolute', width: '14px', height: '14px', background: 'red',
        borderRadius: '50%', display: 'none', zIndex: 10, boxShadow: '0 0 10px red'
    }));

    root.appendChild(game);
}

// Draw the Grid
function renderFretboard() {
    const layer = document.getElementById('frets-layer');
    if (!layer) return;
    layer.innerHTML = '';

    // Strings (Horizontal)
    for (let i = 0; i < 6; i++) {
        let top = 15 + (i * STR_SPACING);
        layer.appendChild(createEl('div', {}, {
            position: 'absolute', left: 0, width: '100%', top: top + '%',
            height: (1 + i/2) + 'px', background: COLORS.string, opacity: 0.6
        }));
    }

    // Frets (Vertical)
    for (let i = 0; i <= 4; i++) {
        let left = i * FRET_WIDTH;
        layer.appendChild(createEl('div', {}, {
            position: 'absolute', top: 0, bottom: 0, left: left + '%',
            width: '2px', background: COLORS.fret
        }));
    }
}

// Draw the Target Dot
function drawBoard() {
    const layer = document.getElementById('dots-layer');
    if (!layer || !activeTarget) return;
    layer.innerHTML = '';

    const dot = createEl('div', { innerText: activeTarget.note }, {
        position: 'absolute', width: '44px', height: '44px', borderRadius: '50%',
        background: COLORS.target, color: 'white', display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontWeight: 'bold',
        fontSize: '20px', transform: 'translate(-50%, -50%)', zIndex: 10
    });

    let top = 15 + (activeTarget.string * STR_SPACING);
    let left = ((activeTarget.fret - 9) * FRET_WIDTH) + (FRET_WIDTH / 2);

    dot.style.top = top + '%';
    dot.style.left = left + '%';
    layer.appendChild(dot);
}