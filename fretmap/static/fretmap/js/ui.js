// --- UI STATE & SETTINGS ---
let VOL_FLOOR = 0.005;
let HOLD_FRAMES = 8;
let ATTACK_THRESH = 1.5;

function updateStrict(val) {
    VOL_FLOOR = 0.002 + ((val/100) * 0.01);
    HOLD_FRAMES = 4 + Math.floor(val/15);
}

function updateAttack(val) {
    ATTACK_THRESH = 3.0 - ((val/100) * 1.9);
}

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

function updateMonitor(a) {
    const monHz = document.getElementById('mon-hz');
    const monNote = document.getElementById('mon-note');
    const liveDot = document.getElementById('live-dot');

    if(a.pitch === -1) {
        monHz.innerText = "-- Hz";
        monNote.innerText = "Silence";
        liveDot.style.display = 'none';
        return;
    }

    let info = getNoteInfo(a.pitch);
    monHz.innerText = Math.round(a.pitch) + " Hz";
    monNote.innerText = info.note;

    let bestMatch = { diff: 9999, string: 0, fret: 0 };
    STRINGS.forEach((str, sIdx) => {
        let fretVal = 12 * Math.log2(a.pitch / str.freq);
        let fretRound = Math.round(fretVal);
        let diff = Math.abs(fretVal - fretRound);
        if(fretRound >= 8 && fretRound <= 13) {
            if(diff < bestMatch.diff) bestMatch = { diff: diff, string: sIdx, fret: fretRound };
        }
    });

    if(bestMatch.diff < 0.4) {
        liveDot.style.display = 'block';
        let topPct = 15 + (bestMatch.string * 14);
        let leftPct = ((bestMatch.fret - 9) * 25) + 12.5;
        liveDot.style.top = topPct + "%";
        liveDot.style.left = leftPct + "%";
    } else {
        liveDot.style.display = 'none';
    }
}

function drawBoard() {
    const layer = document.getElementById('dots-layer');
    layer.innerHTML = '';
    createDot(activeTarget, 'target-dot', activeTarget.note);
    createDot(queue[0], 'ghost-dot', '1');
    createDot(queue[1], 'ghost-dot', '2');
    createDot(queue[2], 'ghost-dot', '3');
}

function createDot(data, cssClass, label) {
    let dot = document.createElement('div');
    dot.className = `dot ${cssClass}`;
    dot.innerText = label;
    let topPct = 15 + (data.string * 14);
    let leftPct = ((data.fret - 9) * 25) + 12.5;
    dot.style.top = topPct + "%";
    dot.style.left = leftPct + "%";
    document.getElementById('dots-layer').appendChild(dot);
}