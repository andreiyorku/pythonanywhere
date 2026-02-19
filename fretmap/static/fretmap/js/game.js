// --- STATE & PENDULUM PROGRESSION ---
const PENDULUM = [
    [9, 10, 11, 12], // Zone 0: The Kernel
    [8],  // Zone 1: Expand Low
    [13], // Zone 2: Expand High
    [7],  // Zone 3: Expand Low
    [14], // Zone 4: Expand High
    [6], [15], [5], [16], [4], [17], [3], [18], [2], [19], [1], [20], [0], [21], [22]
];

let transitionStats = {};
let currentZoneIndex = 0;
let activeFrets = [];
let newlyUnlockedFrets = [];

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
            if(typeof updateStrict === 'function') updateStrict(data.strictness);
        }
        if (data.attack) {
            document.getElementById('attack-slider').value = data.attack;
            if(typeof updateAttack === 'function') updateAttack(data.attack);
        }

        console.log("DB Loaded. Current Zone:", currentZoneIndex);
        buildActiveFretboard();
        updateMasteryUI();
    } catch(e) {
        console.log("Running without backend history. Starting at Zone 0.");
        currentZoneIndex = 0;
        buildActiveFretboard();
        updateMasteryUI();
    }
}

function saveToDatabase(id, timeTaken, masteryStatus) {
    fetch('/fretmap/save/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
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

    if (typeof renderFretboard === "function") {
        renderFretboard();
    }
}

function checkMastery(stat, recentTime) {
    // Require at least 3 attempts to prove mastery
    if (stat.count < 3) return 0;

    let target = stat.avg - ((stat.avg - stat.best) / 2);
    return recentTime <= target ? 1 : 0;
}

function updateMasteryUI() {
    let totalNotes = activeFrets.length * 6;
    let totalPairs = totalNotes * (totalNotes - 1);

    let exploredCount = 0;
    let masteredCount = 0;

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

    fetch('/fretmap/save/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
        body: JSON.stringify({ id: "SYS_UPDATE", time: 0, mastery: 0, new_zone: currentZoneIndex })
    });
}


// --- SMART GENERATOR (GLOBAL HUNTER AI) ---
function generateSmartNote(originNote) {
    if(!originNote) return createRandomNote();

    let validCandidates = [];
    let unexploredImmediate = [];

    // 1. Build a list of ALL immediate valid destinations
    for(let s = 0; s < 6; s++) {
        for(let i = 0; i < activeFrets.length; i++) {
            let f = activeFrets[i];

            // Rule 1 & 2: No A -> A, and True Anti-Ping-Pong
            if (s === originNote.string && f === originNote.fret) continue;
            let twoNotesBack = queue.length >= 2 ? queue[queue.length - 2] : activeTarget;
            if (twoNotesBack && s === twoNotesBack.string && f === twoNotesBack.fret) continue;

            validCandidates.push({string: s, fret: f});
        }
    }

    let worstCandidate = validCandidates[0];
    let worstAvg = -1;

    // 2. Scan immediate destinations
    validCandidates.forEach(cand => {
        let key = `${originNote.string}-${originNote.fret}_${cand.string}-${cand.fret}`;
        let stat = transitionStats[key];

        if (!stat || stat.count === 0) {
            unexploredImmediate.push(cand); // Found an empty path right next to us!
        } else {
            let avg = stat.avg;
            if (newlyUnlockedFrets.includes(cand.fret)) avg += 500;
            if (avg > worstAvg) { worstAvg = avg; worstCandidate = cand; }
        }
    });

    // 3. IMMEDIATE LOCK: If we are standing next to an empty path, take it immediately.
    if (unexploredImmediate.length > 0) {
        let pick = unexploredImmediate[Math.floor(Math.random() * unexploredImmediate.length)];
        return formatNoteObj(pick.string, pick.fret);
    }

    // 4. GLOBAL HUNTER: We are fully calibrated from this note. Is there anything missing globally?
    let missingOrigins = [];
    for(let s1 = 0; s1 < 6; s1++){
        for(let f1 of activeFrets) {
            for(let s2 = 0; s2 < 6; s2++) {
                for(let f2 of activeFrets) {
                    if(s1 === s2 && f1 === f2) continue;

                    let testKey = `${s1}-${f1}_${s2}-${f2}`;
                    let testStat = transitionStats[testKey];

                    // Found a missing path somewhere else on the neck!
                    if(!testStat || testStat.count === 0) {
                        missingOrigins.push({string: s1, fret: f1});
                    }
                }
            }
        }
    }

    // If missing path globally exists, force engine to travel to its starting point.
    if (missingOrigins.length > 0) {
        let huntTarget = missingOrigins[Math.floor(Math.random() * missingOrigins.length)];

        let twoNotesBack = queue.length >= 2 ? queue[queue.length - 2] : activeTarget;
        if (twoNotesBack && huntTarget.string === twoNotesBack.string && huntTarget.fret === twoNotesBack.fret) {
             return formatNoteObj(worstCandidate.string, worstCandidate.fret); // Fallback for one turn to break loop
        }
        return formatNoteObj(huntTarget.string, huntTarget.fret);
    }

    // 5. ZONE MASTERED: 100% Calibrated. Return to normal "Worst-First" Mastery mode.
    return formatNoteObj(worstCandidate.string, worstCandidate.fret);
}

function createRandomNote() {
    let sIdx = Math.floor(Math.random() * 6);
    let fret = activeFrets[Math.floor(Math.random() * activeFrets.length)];
    return formatNoteObj(sIdx, fret);
}

function formatNoteObj(sIdx, fret) {
    let base = STRINGS[sIdx].freq;
    let targetFreq = base * Math.pow(2, fret/12);
    // Safety check to ensure UI function is loaded
    let info = typeof getNoteInfo === "function" ? getNoteInfo(targetFreq) : {note: "--"};
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

    updateMasteryUI();

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

        // --- NEW: Print exactly what the engine recorded ---
        console.log(`✅ HIT RECORDED: ${transitionKey} | Time: ${Math.round(timeTaken)}ms | New Avg: ${Math.round(stat.avg)}ms | Mastered: ${stat.mastery === 1 ? 'YES' : 'NO'}`);

        // Save to Django DB
        saveToDatabase(transitionKey, timeTaken, stat.mastery);

        updateMasteryUI();
    } else {
        // Print for the very first note of the session
        console.log(`✅ FIRST NOTE HIT: Timer started.`);
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

    // --- NEW: Print what the engine is currently waiting to hear ---
    console.log(`🎯 WAITING FOR: String ${6 - activeTarget.string}, Fret ${activeTarget.fret} (${activeTarget.note})`);

    if (typeof drawBoard === "function") {
        drawBoard();
    }
}