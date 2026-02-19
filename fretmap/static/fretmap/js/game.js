// --- GAME STATE ---
let transitionStats = {};
let lastTurnTime = 0;
let phase = 'CALIB';
let calibIndex = 0;
let calibScore = 0;
let queue = [];
let activeTarget = null;
let prevNote = null;
let hitStability = 0;

// --- DATABASE FUNCTIONS ---
async function loadDatabaseHistory() {
    try {
        const res = await fetch('/fretmap/get_user_data/');
        const data = await res.json();
        if (data.history) transitionStats = data.history;
        console.log("DB Loaded", transitionStats);
    } catch(e) {
        console.log("Running without backend history.");
    }
}

function saveToDatabase(id, timeTaken) {
    fetch('/fretmap/save/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken') // Django Security Requirement
        },
        body: JSON.stringify({ id: id, time: timeTaken })
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

// --- GAME LOGIC ---
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
    } else calibScore = Math.max(0, calibScore - 1);
}

function startTraining() {
    phase = 'GAME';
    document.getElementById('calibration-overlay').style.display = 'none';
    document.getElementById('game-area').style.display = 'flex';
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
    document.body.style.backgroundColor = '#1b5e20';
    setTimeout(() => document.body.style.backgroundColor = '#121212', 100);

    let now = performance.now();
    if(prevNote) {
        let transitionKey = `${prevNote.string}-${prevNote.fret}_${activeTarget.string}-${activeTarget.fret}`;
        let timeTaken = now - lastTurnTime;

        // Update Local Stats
        if(!transitionStats[transitionKey]) transitionStats[transitionKey] = { total: 0, count: 0 };
        transitionStats[transitionKey].total += timeTaken;
        transitionStats[transitionKey].count++;

        // --> ADDED: Save to Django DB
        saveToDatabase(transitionKey, timeTaken);
    }
    nextTurn();
}

function generateSmartNote(originNote) {
    if(!originNote) return createRandomNote();
    let candidates = [];
    for(let i=0; i<5; i++) candidates.push(createRandomNote());
    let worstCandidate = candidates[0];
    let worstAvg = -1;
    candidates.forEach(cand => {
        let key = `${originNote.string}-${originNote.fret}_${cand.string}-${cand.fret}`;
        let stat = transitionStats[key];
        let avg = stat ? (stat.total / stat.count) : 0;
        if(avg > worstAvg) { worstAvg = avg; worstCandidate = cand; }
    });
    return worstCandidate;
}

function createRandomNote() {
    let sIdx = Math.floor(Math.random() * 6);
    let fret = Math.floor(Math.random() * 4) + 9;
    let base = STRINGS[sIdx].freq;
    let targetFreq = base * Math.pow(2, fret/12);
    let info = getNoteInfo(targetFreq);
    return { note: info.note, string: sIdx, fret: fret, freq: targetFreq };
}

function nextTurn() {
    prevNote = activeTarget;
    lastTurnTime = performance.now();
    if(!activeTarget) activeTarget = queue.shift();
    else {
        activeTarget = queue.shift();
        let lastInQueue = queue[queue.length-1];
        queue.push(generateSmartNote(lastInQueue));
    }
    document.getElementById('big-note').innerText = activeTarget.note;
    document.getElementById('string-info').innerText = `String ${6 - activeTarget.string} | Fret ${activeTarget.fret}`;
    document.getElementById('q1-txt').innerText = queue[0].note;
    document.getElementById('q2-txt').innerText = queue[1].note;
    document.getElementById('q3-txt').innerText = queue[2].note;
    drawBoard();
}