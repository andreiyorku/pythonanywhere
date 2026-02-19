let VOL_FLOOR = 0.005;
let HOLD_FRAMES = 8;
let ATTACK_THRESH = 1.5;

// The Fixed Fret Window (Always 9-12)
const FIXED_MIN = 9;
const FIXED_MAX = 12;
const FIXED_WIDTH_PCT = 25; // 4 frets = 25% each

// --- UPDATED MATH (Double Strictness) ---
function updateStrict(val) {
    // Math adjusted to allow much higher noise floors and longer stability requirements
    VOL_FLOOR = 0.002 + ((val/100) * 0.04); // Doubled from 0.02
    HOLD_FRAMES = 4 + Math.floor(val/7);    // Roughly doubled (was val/15)
    saveSettingsToDB();
}

function updateAttack(val) {
    ATTACK_THRESH = 3.0 - ((val/100) * 1.9);
    saveSettingsToDB();
}

function saveSettingsToDB() {
    let strictVal = document.getElementById('strict-slider').value;
    let attackVal = document.getElementById('attack-slider').value;

    fetch('/fretmap/save_settings/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
        body: JSON.stringify({ strictness: strictVal, attack: attackVal })
    }).catch(e => console.log("Settings save failed"));
}

function renderFretboard() {
    // We lock the visual board to strictly 4 frets (9, 10, 11, 12)
    const fretsLayer = document.getElementById('frets-layer');
    if(!fretsLayer) return;
    fretsLayer.innerHTML = '';

    for (let i = 0; i < 4; i++) {
        let fretNum = FIXED_MIN + i;
        let leftPos = i * FIXED_WIDTH_PCT;

        let wire = document.createElement('div');
        wire.className = 'fret-wire';
        wire.style.left = leftPos + '%';
        fretsLayer.appendChild(wire);

        let num = document.createElement('div');
        num.className = 'fret-num';
        num.style.left = (leftPos + (FIXED_WIDTH_PCT / 2)) + '%';
        num.innerText = fretNum;
        fretsLayer.appendChild(num);
    }
}

function drawBoard() {
    const layer = document.getElementById('dots-layer');
    if(!layer) return;
    layer.innerHTML = '';

    // Reset indicators
    document.getElementById('split-left').style.display = 'none';
    document.getElementById('split-right').style.display = 'none';

    if(activeTarget) createDot(activeTarget, 'target-dot', activeTarget.note);
    if(queue[0]) createDot(queue[0], 'ghost-dot', '1');
    if(queue[1]) createDot(queue[1], 'ghost-dot', '2');
    if(queue[2]) createDot(queue[2], 'ghost-dot', '3');
}

function createDot(data, cssClass, label) {
    // OVERFLOW LOGIC: Check if it's outside the 9-12 range
    if (data.fret < FIXED_MIN) {
        document.getElementById('split-left').style.display = 'block';
        return; // Don't draw the dot, just show the indicator
    }
    if (data.fret > FIXED_MAX) {
        document.getElementById('split-right').style.display = 'block';
        return; // Don't draw the dot
    }

    let dot = document.createElement('div');
    dot.className = `dot ${cssClass}`;
    dot.innerText = label;

    let topPct = 15 + (data.string * 14);
    let leftPct = ((data.fret - FIXED_MIN) * FIXED_WIDTH_PCT) + (FIXED_WIDTH_PCT / 2);

    dot.style.top = topPct + "%";
    dot.style.left = leftPct + "%";
    document.getElementById('dots-layer').appendChild(dot);
}

// --- DB VIEWER MODAL LOGIC ---
function openDbViewer() {
    document.getElementById('db-modal').style.display = 'block';
    let tbody = document.getElementById('db-tbody');
    tbody.innerHTML = '';

    // Convert JS object to array and sort by Slowest Average First
    let sortedStats = Object.entries(transitionStats).map(([id, stat]) => {
        return { id, ...stat };
    }).sort((a, b) => b.avg - a.avg);

    sortedStats.forEach(stat => {
        let tr = document.createElement('tr');
        tr.style.borderBottom = "1px solid #333";
        let masteryIcon = stat.mastery === 1 ? '✅' : '❌';
        tr.innerHTML = `
            <td style="padding: 8px;">${stat.id}</td>
            <td style="padding: 8px;">${stat.avg.toFixed(1)}</td>
            <td style="padding: 8px;">${stat.best.toFixed(1)}</td>
            <td style="padding: 8px;">${stat.count}</td>
            <td style="padding: 8px;">${masteryIcon}</td>
        `;
        tbody.appendChild(tr);
    });
}

function closeDbViewer() {
    document.getElementById('db-modal').style.display = 'none';
}