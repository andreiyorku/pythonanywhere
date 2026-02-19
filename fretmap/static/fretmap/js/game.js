// --- STATE & PENDULUM PROGRESSION ---
const PENDULUM = [
    [9, 10, 11, 12], // Zone 0: The Kernel (Ergonomic Start)
    [8],  // Zone 1: Expand Low
    [13], // Zone 2: Expand High
    [7],  // Zone 3: Expand Low
    [14], // Zone 4: Expand High
    [6], [15], [5], [16], [4], [17], [3], [18], [2], [19], [1], [20], [0], [21], [22]
];

let transitionStats = {};
let currentZoneIndex = 0;
let activeFrets = []; // All frets available up to current zone
let newlyUnlockedFrets = []; // Frets specifically in the current zone

// Game Engine State
let phase = 'CALIB';
let calibIndex = 0;
let calibScore = 0;
let queue = [];
let activeTarget = null;
let prevNote = null;
let lastTurnTime = 0;
let hitStability = 0;

// --- DATABASE SYNC ---
async function loadDatabaseHistory() {
    try {
        const res = await fetch('/fretmap/get_user_data/');
        const data = await res.json();
        if (data.history) transitionStats = data.history;
        currentZoneIndex = data.zone_index || 0;

        // Apply loaded slider settings
        if (data.strictness) {
            document.getElementById('strict-slider').value = data.strictness;
            updateStrict(data.strictness);
        }
        if (data.attack) {
            document.getElementById('attack-slider').value = data.attack;
            updateAttack(data.attack);
        }

        console.log("DB Loaded. Current Zone:", currentZoneIndex);
        buildActiveFretboard();
        updateMasteryUI(); // Update persistent HUD immediately
    } catch(e) {
        console.log("Running without backend history.");
        buildActiveFretboard();
    }
}

function saveToDatabase(id, timeTaken, masteryStatus) {
    fetch('/fretmap/save/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken') // Django Security Requirement
        },
        body: JSON.stringify({
            id: id,
            time: timeTaken,
            mastery: masteryStatus
        })
    }).catch(e => console.log("DB Save Failed", e));
}

// Django CSRF Helper
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

// --- THE GATEKEEPER: MASTERY & LEVELING ---
function buildActiveFretboard() {
    activeFrets = [];
    for(let i = 0; i <= currentZoneIndex; i++) {
        activeFrets = activeFrets.concat(PENDULUM[i]);
    }
    newlyUnlockedFrets = PENDULUM[currentZoneIndex];
    console.log("Active Frets:", activeFrets);

    // Tell UI.js to dynamically redraw the visual fretboard
    if (typeof renderFretboard === "function") {
        renderFretboard(activeFrets);
    }
}

function checkMastery(stat, recentTime) {
    // Require at least 3 attempts to prove mastery
    if (stat.count < 3) return 0;

    // Formula from Document: Target = Average - (Average - PersonalBest)/2
    let target = stat.avg - ((stat.avg - stat.best) / 2);

    // If the recent execution time beats the target threshold, it is mastered
    return recentTime <= target ? 1 : 0;
}

function updateMasteryUI() {
    let totalNotes = activeFrets.length * 6;
    let totalPairs = totalNotes * (totalNotes - 1);

    let exploredCount = 0; // Played at least once
    let masteredCount = 0; // Beat the gatekeeper math

    for (const [id, stat] of Object.entries(transitionStats)) {
        // Only count stats that belong to the currently unlocked frets
        let parts = id.replace('_', '-').split('-');
        if (activeFrets.includes(parseInt(parts[1])) && activeFrets.includes(parseInt(parts[3]))) {
            if (stat.count > 0) exploredCount++;
            if (stat.mastery === 1) masteredCount++;
        }
    }

    let calibPercent = Math.min(100, Math.floor((exploredCount / Math.max(1, totalPairs)) * 100));
    let mastPercent = Math.min(100, Math.floor((masteredCount / Math.max(1, totalPairs)) * 100));

    // Update Persistent HUD
    let zoneLabel = document.getElementById('zone-label');
    let calibLabel = document.getElementById('calib-pct');
    let mastLabel = document.getElementById('mastery-pct');
    let fillBar = document.getElementById('mastery-fill');

    if (zoneLabel) zoneLabel.innerText = `ZONE ${currentZoneIndex}: FRETS ${Math.min(...activeFrets)}-${Math.max(...activeFrets)}`;
    if (calibLabel) calibLabel.innerText = `CALIBRATED: ${calibPercent}%`;
    if (mastLabel) mastLabel.innerText = `MASTERED: ${mastPercent}%`;
    if (fillBar) fillBar.style.width = `${mastPercent}%`;

    // Trigger Level Up if Mastered reaches 100%
    if (mastPercent === 100 && totalPairs > 0 && currentZoneIndex < PENDULUM.length - 1) {
        triggerLevelUp();
    }
}

function triggerLevelUp() {
    alert(`ZONE ${currentZoneIndex} MASTERED! Unlocking new territory...`);
    currentZoneIndex++;
    buildActiveFretboard();

    // Send Level Up update to Django Backend
    fetch('/fretmap/save/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
        body: JSON.stringify({ id: "SYS_UPDATE", time: 0, mastery: 0, new_zone: currentZoneIndex })
    });
}


// --- SMART GENERATOR (WORST-FIRST + EXPLORATION PRIORITY) ---
function generateSmartNote(originNote) {
    if(!originNote) return createRandomNote();

    let candidates = [];
    // Increase radar from 8 to 15 to find empty combinations faster
    for(let i=0; i<15; i++) candidates.push(createRandomNote());

    let worstCandidate = candidates[0];
    let worstAvg = -1;

    candidates.forEach(cand => {
        // NEW RULE 1: No repeating the exact same note (A -> A)
        if (originNote && cand.string === originNote.string && cand.fret === originNote.fret) return;

        // NEW RULE 2: True Anti-Ping-Pong (A -> B -> A)
        // Check the note immediately before the origin in the queue
        let twoNotesBack = queue.length >= 2 ? queue[queue.length - 2] : activeTarget;
        if (twoNotesBack && cand.string === twoNotesBack.string && cand.fret === twoNotesBack.fret) return;

        let key = `${originNote.string}-${originNote.fret}_${cand.string}-${cand.fret}`;
        let stat = transitionStats[key];

        // THE FIX: If unexplored, treat it as infinitely slow (99999ms)
        // to force the algorithm to calibrate it immediately.
        let avg = stat ? stat.avg : 99999;

        // Artificial Priority Boost: Force user to visit newly unlocked frets
        if (newlyUnlockedFrets.includes(cand.fret)) {
            avg += 500;
        }

        if(avg > worstAvg) {
            worstAvg = avg;
            worstCandidate = cand;
        }
    });

    return worstCandidate;
}

function createRandomNote() {
    let sIdx = Math.floor(Math.random() * 6);
    // Pick strictly from currently unlocked frets
    let fret = activeFrets[Math.floor(Math.random() * activeFrets.length)];
    let base = STRINGS[sIdx].freq;
    let targetFreq = base * Math.pow(2, fret/12);
    let info = getNoteInfo(targetFreq);

    return { note: info.note, string: sIdx, fret: fret, freq: targetFreq };
}


// --- GAME FLOW LOGIC ---
function runCalib(freq) {
    if(calibIndex >= 6) { startTraining(); return; }
    let targetFreq = STRINGS[calibIndex].freq;

    if(freq !== -1 && Math.abs(freq - targetFreq) < 3.5) {
        calibScore++;
        document.getElementById('calib-bar').style.width = Math.min(100, calibScore * 2) + "%";
        if(calibScore > 50) {
            calibIndex++; calibScore = 0; document.getElementById('calib-bar').style.width = "0%";
            if(calibIndex < 6) document.getElementById('calib-msg').innerText = `Play ${STRINGS[calibIndex].name} String`;
        }
    } else {
        calibScore = Math.max(0, calibScore - 1);
    }
}

function startTraining() {
    phase = 'GAME';
    document.getElementById('calibration-overlay').style.display = 'none';
    document.getElementById('game-area').style.display = 'flex';

    let masteryHud = document.getElementById('mastery-hud');
    if (masteryHud) masteryHud.style.display = 'block';

    updateMasteryUI(); // Initialize the mastery bar

    queue.push(generateSmartNote(null));
    queue.push(generateSmartNote(queue[0]));
    queue.push(generateSmartNote(queue[1]));
    queue.push(generateSmartNote(queue[2]));

    nextTurn();
}

function runGame(freq, rms) {
    if(freq !== -1 && activeTarget) {
        let diff = Math.abs(freq - activeTarget.freq);

        if(diff < (activeTarget.freq * 0.025)) {
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
    } else {
         hitStability = Math.max(0, hitStability - 1);
    }
}

function successTrigger() {
    // Visual Feedback
    document.body.style.backgroundColor = '#1b5e20';
    setTimeout(() => document.body.style.backgroundColor = '#121212', 100);

    let now = performance.now();

    if(prevNote) {
        let transitionKey = `${prevNote.string}-${prevNote.fret}_${activeTarget.string}-${activeTarget.fret}`;
        let timeTaken = now - lastTurnTime;

        // Ensure stats object exists locally
        if(!transitionStats[transitionKey]) {
            transitionStats[transitionKey] = { avg: timeTaken, best: timeTaken, count: 0, mastery: 0 };
        }

        let stat = transitionStats[transitionKey];

        // Update Running Average & Best Time
        stat.avg = ((stat.avg * stat.count) + timeTaken) / (stat.count + 1);
        if (timeTaken < stat.best) stat.best = timeTaken;
        stat.count++;

        // Run Gatekeeper Math
        stat.mastery = checkMastery(stat, timeTaken);

        // Save to Django DB
        saveToDatabase(transitionKey, timeTaken, stat.mastery);

        // Check if Zone is 100% complete
        updateMasteryUI();
    }

    nextTurn();
}

function nextTurn() {
    prevNote = activeTarget;
    lastTurnTime = performance.now();

    if(!activeTarget) {
        activeTarget = queue.shift();
    } else {
        activeTarget = queue.shift();
        let lastInQueue = queue[queue.length-1];
        queue.push(generateSmartNote(lastInQueue));
    }

    // Update UI Elements
    document.getElementById('big-note').innerText = activeTarget.note;
    document.getElementById('string-info').innerText = `String ${6 - activeTarget.string} | Fret ${activeTarget.fret}`;
    document.getElementById('q1-txt').innerText = queue[0].note;
    document.getElementById('q2-txt').innerText = queue[1].note;
    document.getElementById('q3-txt').innerText = queue[2].note;

    if (typeof drawBoard === "function") {
        drawBoard();
    }
}