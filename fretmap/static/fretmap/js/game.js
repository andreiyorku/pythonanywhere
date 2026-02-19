// Game Logic & Server Sync
let transitionStats = {};
let activeTarget = null;
let queue = [];

async function nextTurn() {
    // 1. Shift Queue
    activeTarget = queue.shift();
    // 2. Fetch/Generate New Smart Note
    // 3. Update UI
    drawBoard(activeTarget, queue);
    // 4. Update Big Note Text
    document.getElementById('big-note').innerText = activeTarget.note;
}

function saveResult(id, time) {
    fetch('/fretmap/save', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ id, time })
    });
}