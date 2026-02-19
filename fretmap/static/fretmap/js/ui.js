// Fretboard & Monitor Rendering
function drawBoard(active, queue) {
    const layer = document.getElementById('dots-layer');
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
    // Logic to find closest string/fret for red dot...
}