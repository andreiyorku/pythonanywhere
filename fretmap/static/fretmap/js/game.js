// --- GAME STATE ---
let transitionStats = {};
let activeTarget = null;
let queue = [];
let lastTurnTime = 0;
let prevNote = null;

// --- INITIALIZATION (Called by the Start Button) ---
async function initApp() {
    console.log("FretMap Engine Initializing...");

    // 1. Fetch historical data from Django backend
    try {
        const res = await fetch('/fretmap/get_user_data/');
        const data = await res.json();
        transitionStats = data.history || {};
    } catch(e) {
        console.warn("Could not load history, starting fresh.");
    }

    // 2. Initialize Audio Engine (from audio.js)
    try {
        await initAudioEngine(); // Ensure this function exists in audio.js
    } catch(e) {
        alert("Microphone access is required for FretMap.");
        return;
    }

    // 3. Hide Overlay & Show Game
    document.getElementById('overlay').style.display = 'none';
    document.getElementById('game-area').style.display = 'flex';

    // 4. Prime the Queue (Target + 3 Ghosts)
    queue.push(generateSmartNote(null));
    queue.push(generateSmartNote(queue[0]));
    queue.push(generateSmartNote(queue[1]));
    queue.push(generateSmartNote(queue[2]));

    nextTurn();
}

// --- GAME LOOP LOGIC ---
async function nextTurn() {
    prevNote = activeTarget;
    lastTurnTime = performance.now();

    // Shift the queue
    if (!activeTarget) {
        activeTarget = queue.shift();
    } else {
        activeTarget = queue.shift();
        // Add a new smart note based on the last note in the queue
        let lastInQueue = queue[queue.length - 1];
        queue.push(generateSmartNote(lastInQueue));
    }

    // Update UI (Functions in ui.js)
    document.getElementById('big-note').innerText = activeTarget.note;
    document.getElementById('string-info').innerText = `String ${6 - activeTarget.string} | Fret ${activeTarget.fret}`;

    // Refresh the queue text display
    document.getElementById('q1').innerText = queue[0].note;
    document.getElementById('q2').innerText = queue[1].note;
    document.getElementById('q3').innerText = queue[2].note;

    drawBoard(activeTarget, queue);
}

// --- SMART GENERATOR (Worst-First Memory) ---
function generateSmartNote(origin) {
    if (!origin) return createRandomNote();

    let candidates = [];
    for (let i = 0; i < 5; i++) candidates.push(createRandomNote());

    let worstCandidate = candidates[0];
    let worstAvg = -1;

    candidates.forEach(cand => {
        // Prevent immediate repeats (A -> B -> A)
        if (prevNote && cand.string === prevNote.string && cand.fret === prevNote.fret) return;

        let id = `S${origin.string}F${origin.fret}_S${cand.string}F${cand.fret}`;
        let stat = transitionStats[id];
        let avg = stat ? stat.avg : 0;

        if (avg > worstAvg) {
            worstAvg = avg;
            worstCandidate = cand;
        }
    });

    return worstCandidate;
}

function createRandomNote() {
    let sIdx = Math.floor(Math.random() * 6);
    let fret = Math.floor(Math.random() * 4) + 9; // Strictly 9-12
    let base = STRINGS[sIdx].freq;
    let targetFreq = base * Math.pow(2, fret / 12);

    // Note Name Helper
    const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const noteNum = 12 * (Math.log(targetFreq / 440) / Math.log(2)) + 69;
    const noteName = names[Math.round(noteNum) % 12];

    return {
        note: noteName,
        string: sIdx,
        fret: fret,
        freq: targetFreq
    };
}

// --- SUCCESS & SAVING ---
function handleSuccess() {
    let now = performance.now();
    let timeTaken = now - lastTurnTime;

    if (prevNote && activeTarget) {
        let id = `S${prevNote.string}F${prevNote.fret}_S${activeTarget.string}F${activeTarget.fret}`;

        // Update local memory for instant "Worst-First" response
        if (!transitionStats[id]) transitionStats[id] = { avg: 0, count: 0 };
    }
}

function updateMonitor(result) {
    const hzDisp = document.getElementById('mon-hz');
    const noteDisp = document.getElementById('mon-note');

    if (result.pitch === -1) {
        if(hzDisp) hzDisp.innerText = "-- Hz";
        return;
    }

    if(hzDisp) hzDisp.innerText = Math.round(result.pitch) + " Hz";

    // Optional: Logic to show the red "Live Dot" on the fretboard
    updateLiveDot(result.pitch);
}