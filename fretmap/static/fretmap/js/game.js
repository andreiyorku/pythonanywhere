/**
 * FRETMAP GAME ENGINE - v15
 */
var PENDULUM = [[9,10,11,12],[8],[13],[7],[14],[6],[15],[5],[16],[4],[17],[3],[18],[2],[19],[1],[20],[0],[21],[22]];
var transitionStats = {}, activeFrets = [], currentZoneIndex = 0, phase = 'GAME';
var queue = [], calibrationQueue = [], isExpansionCalib = false;
var activeTarget = null, prevNote = null, lastTurnTime = 0, hitStability = 0;
var globalMin = 1000, globalMax = 3500;

async function loadDatabaseHistory() {
    try {
        const res = await fetch('/fretmap/get_user_data/');
        const data = await res.json();
        transitionStats = data.transitions || {};
        if (data.settings) currentZoneIndex = data.settings.zone_index || 0;
        buildActiveFretboard();
        updateMasteryUI();
    } catch (e) { console.warn("DB Connection Error"); }
}

function onAudioReady() {
    if (checkNeedsCalibration()) startInitialCalibration();
    else startTraining();
}

function checkNeedsCalibration() {
    let total = (activeFrets.length * 6) * ((activeFrets.length * 6) - 1);
    let cal = 0;
    for (var id in transitionStats) if (transitionStats[id].isCalibrated) cal++;
    return cal < total;
}

function startInitialCalibration() {
    phase = 'CALIB'; isExpansionCalib = true;
    let staticQueue = [];
    [9,10,11,12].forEach((f, idx) => {
        let r = (idx % 2 === 0) ? [0,1,2,3,4,5] : [5,4,3,2,1,0];
        for(let i=0; i<r.length-1; i++) {
            let n1 = formatNoteObj(r[i], f), n2 = formatNoteObj(r[i+1], f);
            if(!isDone(n1.id, n2.id)) staticQueue.push({from: n1, to: n2});
        }
    });
    [0,1,2,3,4,5].forEach(s => {
        let r = [9,10,11,12];
        for(let i=0; i<r.length-1; i++) {
            let n1 = formatNoteObj(s, r[i]), n2 = formatNoteObj(s, r[i+1]);
            if(!isDone(n1.id, n2.id)) staticQueue.push({from: n1, to: n2});
        }
    });
    calibrationQueue = staticQueue;
    runNextCalibTurn();
}

function isDone(id1, id2) {
    let key = `${id1}_${id2}`;
    return transitionStats[key] && transitionStats[key].isCalibrated;
}

function runNextCalibTurn() {
    if (calibrationQueue.length === 0) { startTraining(); return; }
    const jump = calibrationQueue.shift();
    prevNote = jump.from; activeTarget = jump.to;
    lastTurnTime = performance.now();
    updateMasteryUI();
    drawBoard();
}

function processAudioResults(freq, rms) {
    if (freq === -1 || !activeTarget) return;
    let diff = Math.abs(freq - activeTarget.freq);
    if (diff < (activeTarget.freq * 0.025)) {
        if ((rms > lastRMS * ATTACK_THRESH) && (rms > VOL_FLOOR * 2)) successTrigger();
        else { hitStability++; if (hitStability >= HOLD_FRAMES) { hitStability = 0; successTrigger(); } }
    } else { hitStability = Math.max(0, hitStability - 1); }
}

function successTrigger() {
    const timeTaken = performance.now() - lastTurnTime;
    document.body.style.backgroundColor = '#1b5e20';
    setTimeout(() => document.body.style.backgroundColor = '#121212', 100);
    const key = `${prevNote.id}_${activeTarget.id}`;
    if (timeTaken < globalMin) globalMin = timeTaken;
    if (timeTaken > globalMax && timeTaken < 5000) globalMax = timeTaken;
    let stat = transitionStats[key] || { avg: timeTaken, min: timeTaken, count: 0, mastery: 0, isCalibrated: 0 };
    if (isExpansionCalib) {
        stat.isCalibrated = 1; stat.mastery = 0; stat.avg = timeTaken; stat.count = 0;
        transitionStats[key] = stat;
        saveToDatabase(key, stat);
        runNextCalibTurn();
    } else {
        stat.avg = ((stat.avg * stat.count) + timeTaken) / (stat.count + 1);
        stat.count++;
        transitionStats[key] = stat;
        recalculateAllMastery();
        saveToDatabase(key, stat);
        nextTurn();
    }
}

function recalculateAllMastery() {
    if (isExpansionCalib) return;
    let target = globalMax - (MASTERY_DIFFICULTY * (globalMax - globalMin));
    for (let id in transitionStats) {
        let fret = parseInt(id.split('_')[1].split('-')[1]);
        let t = (fret < 9 || fret > 12) ? target * 1.15 : target;
        transitionStats[id].mastery = (transitionStats[id].isCalibrated && transitionStats[id].avg <= t) ? 1 : 0;
    }
    updateMasteryUI();
}

function updateMasteryUI() {
    let cal = 0, mast = 0;
    for (var id in transitionStats) { if(transitionStats[id].isCalibrated) cal++; if(transitionStats[id].mastery) mast++; }
    let total = (activeFrets.length * 6) * ((activeFrets.length * 6) - 1);
    if(document.getElementById('calib-pct')) document.getElementById('calib-pct').innerText = isExpansionCalib ? `MAPPING: ${calibrationQueue.length} REMAINING` : `CALIBRATED: ${cal}/${total}`;
    if(document.getElementById('mastery-pct')) document.getElementById('mastery-pct').innerText = `MASTERED: ${mast}/${total}`;
    let fill = document.getElementById('mastery-fill');
    if(fill) fill.style.width = isExpansionCalib ? "0%" : ((mast / Math.max(1, total)) * 100) + "%";
}

function startTraining() {
    phase = 'GAME'; isExpansionCalib = false;
    document.getElementById('calibration-overlay').style.display = 'none';
    document.getElementById('game-area').style.display = 'flex';
    document.getElementById('mastery-hud').style.display = 'block';
    renderFretboard();
    queue = [generateSmartNote(null), generateSmartNote(null), generateSmartNote(null)];
    nextTurn();
}

function skipCalibration() { isExpansionCalib = false; startTraining(); }

function nextTurn() {
    prevNote = activeTarget; lastTurnTime = performance.now();
    activeTarget = queue.shift(); queue.push(generateSmartNote(queue[queue.length-1]));
    document.getElementById('big-note').innerText = activeTarget.note;
    document.getElementById('string-info').innerText = `Str ${6 - activeTarget.string} | Fret ${activeTarget.fret}`;
    drawBoard();
}

function formatNoteObj(s, fr) {
    const freqs = [82.41, 110.00, 146.83, 196.00, 246.94, 329.63];
    const t = freqs[s] * Math.pow(2, fr/12);
    const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const num = 12 * (Math.log(t / 440) / Math.log(2)) + 69;
    return { id: `${s}-${fr}`, note: names[Math.round(num) % 12], string: s, fret: fr, freq: t };
}

function generateSmartNote(origin) {
    let fPool = activeFrets.length > 0 ? activeFrets : [9,10,11,12];
    let n;
    do { n = formatNoteObj(Math.floor(Math.random() * 6), fPool[Math.floor(Math.random() * fPool.length)]); }
    while (origin && n.id === origin.id);
    return n;
}

async function saveToDatabase(id, stat) {
    fetch('/fretmap/save_transition/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
        body: JSON.stringify({
            id: id,
            avg: stat.avg,
            min: stat.min,
            count: stat.count,
            mastery: stat.mastery,
            isCalibrated: 1 // Sending explicit integer
        })
    });
}

function buildActiveFretboard() {
    activeFrets = [];
    for(var i = 0; i <= currentZoneIndex; i++) activeFrets = activeFrets.concat(PENDULUM[i]);
}

function getCookie(n) { let v = document.cookie.match('(^|;) ?'+n+'=([^;]*)(;|$)'); return v ? v[2] : null; }

window.onload = () => { buildUI(); loadDatabaseHistory(); };