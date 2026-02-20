// --- CONFIGURATION ---
const PENDULUM = [
    [9, 10, 11, 12], // Zone 0: The Kernel
    [8], [13], [7], [14], [6], [15], [5], [16], [4], [17], [3], [18], [2], [19], [1], [20], [0], [21], [22]
];

// NOTE: STRINGS and lastRMS are handled by audio.js
// NOTE: VOL_FLOOR, HOLD_FRAMES, and ATTACK_THRESH are handled by ui.js

// Global Data
let transitionStats = {};
let currentZoneIndex = 0;
let activeFrets = [];

// Engine State
let phase = 'CALIB';
let calibIndex = 0;
let calibScore = 0;
let queue = [];
let activeTarget = null;
let prevNote = null;
let lastTurnTime = 0;
let hitStability = 0;

// --- 1. STARTUP & NAVIGATION ---

async function loadDatabaseHistory() {
    try {
        console.log("Fetching user history...");
        const res = await fetch('/fretmap/get_user_data/');
        const data = await res.json();

        if (data.transitions) transitionStats = data.transitions;
        if (data.settings) {
            currentZoneIndex = data.settings.zone_index || 0;
            // The UI sliders are updated in ui.js when buildUI runs
        }

        buildActiveFretboard();
        updateMasteryUI();
    } catch(e) {
        console.log("Starting fresh at Zone 0.");
        currentZoneIndex = 0;
        buildActiveFretboard();
    }
}

function skipCalibration() {
    // If audio hasn't started, initAudio (from audio.js) must be called first
    if (typeof isListening !== "undefined" && !isListening) {
        initAudio().then(() => startTraining());
    } else {
        startTraining();
    }
}

function enterCalibrationMode() {
    phase = 'CALIB';
    calibIndex = 0;
    calibScore = 0;
    document.getElementById('calibration-overlay').style.display = 'flex';
    document.getElementById('game-area').style.display = 'none';
    document.getElementById('mastery-hud').style.display = 'none';
    document.getElementById('calib-msg').innerText = "Play Low E (Thickest)";
    document.getElementById('calib-bar').style.width = "0%";
}

function startTraining() {
    phase = 'GAME';
    document.getElementById('calibration-overlay').style.display = 'none';
    document.getElementById('game-area').style.display = 'flex';
    document.getElementById('mastery-hud').style.display = 'block';

    // Build the mathematical lines for the fretboard
    if (typeof renderFretboard === "function") renderFretboard();

    if (queue.length === 0) {
        queue.push(generateSmartNote(null));
        queue.push(generateSmartNote(queue[0]));
        queue.push(generateSmartNote(queue[1]));
        queue.push(generateSmartNote(queue[2]));
        nextTurn();
    }
}

// --- 2. GAME LOOP LOGIC ---

function runCalib(freq) {
    if(calibIndex >= 6) { startTraining(); return; }
    let targetFreq = STRINGS[calibIndex].freq;

    if(freq !== -1 && Math.abs(freq - targetFreq) < 3.5) {
        calibScore++;
        document.getElementById('calib-bar').style.width = Math.min(100, calibScore * 2) + "%";
        if(calibScore > 50) {
            calibIndex++;
            calibScore = 0;
            document.getElementById('calib-bar').style.width = "0%";
            if(calibIndex < 6) {
                document.getElementById('calib-msg').innerText = `Play ${STRINGS[calibIndex].name} String`;
            }
        }
    } else {
        calibScore = Math.max(0, calibScore - 0.5);
    }
}

function runGame(freq, rms) {
    if(freq !== -1 && activeTarget) {
        let diff = Math.abs(freq - activeTarget.freq);

        if(diff < (activeTarget.freq * 0.025)) {
            // Using global vars from ui.js (VOL_FLOOR, ATTACK_THRESH)
            // and audio.js (lastRMS)
            let isAttack = (rms > lastRMS * ATTACK_THRESH) && (rms > VOL_FLOOR * 2);

            if(isAttack) {
                document.getElementById('attack-bar').style.width = "100%";
                setTimeout(() => document.getElementById('attack-bar').style.width = "0%", 100);
                successTrigger();
            } else {
                hitStability++;
                if(hitStability >= HOLD_FRAMES) {
                    hitStability = 0;
                    successTrigger();
                }
            }
        } else {
            hitStability = Math.max(0, hitStability - 1);
        }
    }
}

function successTrigger() {
    document.body.style.backgroundColor = '#1b5e20';
    setTimeout(() => document.body.style.backgroundColor = '#121212', 100);

    let now = performance.now();

    if(prevNote) {
        let key = `${prevNote.string}-${prevNote.fret}_${activeTarget.string}-${activeTarget.fret}`;
        let timeTaken = now - lastTurnTime;
        let stat = transitionStats[key] || { avg: 99999, min: 99999, count: 0, mastery: 0 };

        if (stat.count === 0) {
            stat.avg = timeTaken;
            stat.min = timeTaken;
        } else {
            stat.avg = ((stat.avg * stat.count) + timeTaken) / (stat.count + 1);
            if (timeTaken < stat.min) stat.min = timeTaken;
        }
        stat.count++;
        stat.mastery = checkMastery(stat, timeTaken);

        transitionStats[key] = stat;
        saveToDatabase(key, stat);
        updateMasteryUI();
    }
    nextTurn();
}

function nextTurn() {
    prevNote = activeTarget;
    lastTurnTime = performance.now();
    activeTarget = queue.shift();
    queue.push(generateSmartNote(queue[queue.length-1]));

    document.getElementById('big-note').innerText = activeTarget.note;
    document.getElementById('string-info').innerText = `String ${6 - activeTarget.string} | Fret ${activeTarget.fret}`;

    // Update queue bubbles
    const q1 = document.getElementById('q1-txt');
    const q2 = document.getElementById('q2-txt');
    const q3 = document.getElementById('q3-txt');
    if(q1) q1.innerText = queue[0].note;
    if(q2) q2.innerText = queue[1].note;
    if(q3) q3.innerText = queue[2].note;

    // Call ui.js rendering
    if (typeof drawBoard === "function") drawBoard();
}

// --- 3. MASTERY & UTILS ---

function buildActiveFretboard() {
    activeFrets = [];
    for(let i = 0; i <= currentZoneIndex; i++) {
        activeFrets = activeFrets.concat(PENDULUM[i]);
    }
    // Refresh the lines if game is already running
    if (typeof renderFretboard === "function") renderFretboard();
}

function checkMastery(stat, recentTime) {
    if (stat.count < 3) return 0;
    // Goal is to be faster than the midpoint of your average and your best
    let target = stat.avg - ((stat.avg - stat.min) / 2);
    return recentTime <= target ? 1 : 0;
}

function updateMasteryUI() {
    let masteredCount = 0;
    for (const [id, stat] of Object.entries(transitionStats)) {
        if (stat.mastery === 1) masteredCount++;
    }

    const zl = document.getElementById('zone-label');
    const mp = document.getElementById('mastery-pct');
    if(zl) zl.innerText = `ZONE ${currentZoneIndex}: FRETS ${Math.min(...activeFrets)}-${Math.max(...activeFrets)}`;
    if(mp) mp.innerText = `MASTERED: ${masteredCount}`;
}

async function saveToDatabase(id, stat) {
    try {
        await fetch('/fretmap/save_transition/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
            body: JSON.stringify({ id, avg: stat.avg, min: stat.min, count: stat.count, mastery: stat.mastery })
        });
    } catch (e) { console.error("Database save failed."); }
}

function generateSmartNote(originNote) {
    let sIdx = Math.floor(Math.random() * 6);
    let fret = activeFrets[Math.floor(Math.random() * activeFrets.length)];
    return formatNoteObj(sIdx, fret);
}

function formatNoteObj(sIdx, fret) {
    let base = STRINGS[sIdx].freq;
    let targetFreq = base * Math.pow(2, fret/12);
    let info = typeof getNoteInfo === "function" ? getNoteInfo(targetFreq) : {note: "--"};
    return { note: info.note, string: sIdx, fret: fret, freq: targetFreq };
}

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}