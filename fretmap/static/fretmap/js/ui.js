// Fretboard & Monitor Rendering
function drawBoard(active, queue) {
    const layer = document.getElementById('dots-layer');
    if (!layer) return;
    layer.innerHTML = '';
    createDot(active, 'target-dot', active.note);
    queue.forEach((note, i) => createDot(note, 'ghost-dot', i + 1));
}

function createDot(data, cssClass, label) {
    let dot = document.createElement('div');
    dot.className = `dot ${cssClass}`;
    dot.innerText = label;
    // Flipped: S6 (Low E) is Index 0 -> Top
    let topPct = 15 + (data.string * 14);
    let leftPct = ((data.fret - 9) * 25) + 12.5;
    dot.style.top = topPct + "%";
    dot.style.left = leftPct + "%";
    document.getElementById('dots-layer').appendChild(dot);
}

function updateLiveDot(freq) {
    const dot = document.getElementById('live-dot');
    if (!dot || freq === -1) {
        if (dot) dot.style.display = 'none';
        return;
    }

    let bestMatch = { diff: 9999, string: 0, fret: 0 };

    STRINGS.forEach((str, sIdx) => {
        let fretVal = 12 * Math.log2(freq / str.freq);
        let fretRound = Math.round(fretVal);
        let diff = Math.abs(fretVal - fretRound);

        // Only show if it's within our 9-12 zone (with a little padding)
        if (fretRound >= 8 && fretRound <= 13) {
            if (diff < bestMatch.diff) {
                bestMatch = { diff: diff, string: sIdx, fret: fretRound };
            }
        }
    });

    if (bestMatch.diff < 0.4) {
        dot.style.display = 'block';
        dot.style.top = (15 + (bestMatch.string * 14)) + "%";
        dot.style.left = (((bestMatch.fret - 9) * 25) + 12.5) + "%";
    } else {
        dot.style.display = 'none';
    }
}

// Helper for the Hz display
function updateMonitor(result) {
    const hzDisp = document.getElementById('mon-hz');
    const noteDisp = document.getElementById('mon-note');

    if (hzDisp) hzDisp.innerText = result.pitch === -1 ? "-- Hz" : Math.round(result.pitch) + " Hz";
    updateLiveDot(result.pitch);
}