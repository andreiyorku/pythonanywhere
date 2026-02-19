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

// --- AUDIO MATH HELPERS ---
function getNoteInfo(freq) {
    if(freq === -1) return { note: "--", cents: 0, octave: 0 };
    const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const noteNum = 12 * (Math.log(freq / 440) / Math.log(2)) + 69;
    const noteIndex = Math.round(noteNum) % 12;
    return {
        note: noteNames[noteIndex],
        val: noteNum,
        cents: Math.floor((noteNum - Math.round(noteNum)) * 100)
    };
}

// --- LIVE MONITORING ---
function updateMonitor(a) {
    const monHz = document.getElementById('mon-hz');
    const monNote = document.getElementById('mon-note');
    const liveDot = document.getElementById('live-dot');

    if(a.pitch === -1) {
        if(monHz) monHz.innerText = "-- Hz";
        if(monNote) monNote.innerText = "Silence";
        if(liveDot) liveDot.style.display = 'none';
        return;
    }

    let info = getNoteInfo(a.pitch);
    if(monHz) monHz.innerText = Math.round(a.pitch) + " Hz";
    if(monNote) monNote.innerText = info.note;

    let bestMatch = { diff: 9999, string: 0, fret: 0 };
    STRINGS.forEach((str, sIdx) => {
        let fretVal = 12 * Math.log2(a.pitch / str.freq);
        let fretRound = Math.round(fretVal);
        let diff = Math.abs(fretVal - fretRound);

        if(diff < bestMatch.diff) bestMatch = { diff: diff, string: sIdx, fret: fretRound };
    });

    // Only show the live red dot if you are playing inside the 9-12 visible window
    if(bestMatch.diff < 0.4 && liveDot && bestMatch.fret >= FIXED_MIN && bestMatch.fret <= FIXED_MAX) {
        liveDot.style.display = 'block';
        let topPct = 15 + (bestMatch.string * 14);
        let leftPct = ((bestMatch.fret - FIXED_MIN) * FIXED_WIDTH_PCT) + (FIXED_WIDTH_PCT / 2);

        liveDot.style.top = topPct + "%";
        liveDot.style.left = leftPct + "%";
    } else if(liveDot) {
        liveDot.style.display = 'none';
    }
}

// --- FRETBOARD RENDERING ---
function renderFretboard() {
    // Lock visual board to strictly 4 frets (9, 10, 11, 12)
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

    // Reset out-of-bounds indicators
    document.getElementById('split-left').style.display = 'none';
    document.getElementById('split-right').style.display = 'none';

    if(activeTarget) createDot(activeTarget, 'target-dot', activeTarget.note);
    if(queue[0]) createDot(queue[0], 'ghost-dot', '1');
    if(queue[1]) createDot(queue[1], 'ghost-dot', '2');
    if(queue[2]) createDot(queue[2], 'ghost-dot', '3');
}

function createDot(data, cssClass, label) {
    // OVERFLOW LOGIC: Check if note is outside the 9-12 range
    if (data.fret < FIXED_MIN) {
        document.getElementById('split-left').style.display = 'block';
        return; // Don't draw dot, just flash the left warning bar
    }
    if (data.fret > FIXED_MAX) {
        document.getElementById('split-right').style.display = 'block';
        return; // Don't draw dot, just flash the right warning bar
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