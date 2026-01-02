// --- CONSTANTS ---
const STRINGS = 6;
const STRING_COLORS = ['#FF1a1a', '#F2E830', '#30B0F2', '#F29630', '#30F25A', '#B030F2'];
const SECTION_COLORS = { 'intro': '#555', 'verse': '#4444aa', 'chorus': '#aa4444', 'bridge': '#aaaa44', 'solo': '#aa44aa', 'outro': '#333' };

// --- STATE ---
let RAW_XML = null;
let LEVELS = {};
let SECTIONS = [];
let PHRASES = [];

let CURRENT_NOTES = [];
let CURRENT_ANCHORS = [];
let SONG_LENGTH = 0;

// --- VIEW SETTINGS ---
const BASE_RADIUS = 28;

// Active values
let ZOOM_FACTOR = 1.0;
let ACTIVE_RADIUS = 28;
let ACTIVE_PPS = 150;
let SCROLL_OFFSET = 0.0;

// --- CANVAS ---
let mainCanvas, mainCtx, miniCanvas, miniCtx;
let width, height, miniWidth, miniHeight;
let isDraggingMain = false;
let isDraggingMini = false;
let lastMouseX = 0;

// --- INIT ---
function init() {
    mainCanvas = document.getElementById('fretboardCanvas');
    mainCtx = mainCanvas.getContext('2d');
    miniCanvas = document.getElementById('minimapCanvas');
    miniCtx = miniCanvas.getContext('2d');

    window.addEventListener('resize', resize);
    resize();
    setupControls();
}

function setupControls() {
    // File Upload
    document.getElementById('file-upload').addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        document.getElementById('loading').style.display = 'flex';
        const reader = new FileReader();
        reader.onload = evt => {
            parseFullXML(evt.target.result);
            document.getElementById('loading').style.display = 'none';
        };
        reader.readAsText(file);
    });

    // Difficulty Switcher
    document.getElementById('selDifficulty').addEventListener('change', e => {
        loadLevel(e.target.value);
    });

    // ZOOM SLIDER
    document.getElementById('zoomSlider').addEventListener('input', e => {
        ZOOM_FACTOR = parseFloat(e.target.value);
        document.getElementById('lblZoomVal').textContent = Math.round(ZOOM_FACTOR * 100) + "%";
        applyZoom();
    });

    // Mouse Interactions
    mainCanvas.addEventListener('mousedown', e => { isDraggingMain = true; lastMouseX = e.clientX; });
    window.addEventListener('mouseup', () => { isDraggingMain = false; isDraggingMini = false; });
    mainCanvas.addEventListener('mousemove', e => {
        if (isDraggingMain) {
            let delta = (e.clientX - lastMouseX) / ACTIVE_PPS;
            SCROLL_OFFSET -= delta;
            if(SCROLL_OFFSET < 0) SCROLL_OFFSET = 0;
            lastMouseX = e.clientX;
            drawMain();
            drawMinimap();
        }
    });

    miniCanvas.addEventListener('mousedown', e => { isDraggingMini = true; handleMinimapClick(e); });
    miniCanvas.addEventListener('mousemove', e => { if(isDraggingMini) handleMinimapClick(e); });
}

function handleMinimapClick(e) {
    const rect = miniCanvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    if(SONG_LENGTH > 0) {
        const ratio = clickX / miniWidth;
        const viewWidthTime = width / ACTIVE_PPS;
        SCROLL_OFFSET = (ratio * SONG_LENGTH) - (viewWidthTime / 2);
        if(SCROLL_OFFSET < 0) SCROLL_OFFSET = 0;
        drawMain();
        drawMinimap();
    }
}

// --- PARSING ---
function parseFullXML(xmlString) {
    const parser = new DOMParser();
    RAW_XML = parser.parseFromString(xmlString, "text/xml");

    document.getElementById('lblTitle').textContent = getTag(RAW_XML, "title");
    document.getElementById('lblArtist').textContent = getTag(RAW_XML, "artistName");
    SONG_LENGTH = parseFloat(getTag(RAW_XML, "songLength") || 200);

    SECTIONS = [];
    RAW_XML.querySelectorAll("sections > section").forEach(node => {
        SECTIONS.push({ name: node.getAttribute("name"), t: parseFloat(node.getAttribute("startTime")) });
    });

    PHRASES = [];
    RAW_XML.querySelectorAll("phraseIterations > phraseIteration").forEach(node => {
        PHRASES.push({ t: parseFloat(node.getAttribute("time")) });
    });

    LEVELS = {};
    const levelNodes = RAW_XML.querySelectorAll("levels > level");
    const selDiff = document.getElementById('selDifficulty');
    selDiff.innerHTML = "";
    selDiff.disabled = false;

    levelNodes.forEach((node, index) => {
        const diff = node.getAttribute("difficulty");
        const count = node.querySelectorAll("notes > note").length;
        LEVELS[index] = { node: node, count: count };
        const opt = document.createElement("option");
        opt.value = index;
        opt.text = `Lvl ${diff} (${count} notes)`;
        selDiff.appendChild(opt);
    });

    if(levelNodes.length > 0) {
        selDiff.value = levelNodes.length - 1;
        loadLevel(levelNodes.length - 1);
    }
}

function loadLevel(index) {
    const levelNode = LEVELS[index].node;
    CURRENT_NOTES = [];

    levelNode.querySelectorAll("notes > note").forEach(n => CURRENT_NOTES.push(parseNote(n)));
    levelNode.querySelectorAll("chords > chord").forEach(c => {
            if(c.hasAttribute("fret")) CURRENT_NOTES.push(parseNote(c, true));
            c.querySelectorAll("chordNote").forEach(cn => CURRENT_NOTES.push(parseNote(cn, true)));
    });
    CURRENT_NOTES.sort((a, b) => a.t - b.t);

    CURRENT_ANCHORS = [];
    let anchors = levelNode.querySelectorAll("anchors > anchor");
    if(anchors.length === 0) anchors = RAW_XML.querySelectorAll("transcriptionTrack > anchors > anchor");
    anchors.forEach(a => CURRENT_ANCHORS.push({
        t: parseFloat(a.getAttribute("time")),
        fret: parseInt(a.getAttribute("fret"))
    }));
    CURRENT_ANCHORS.sort((a, b) => a.t - b.t);

    applyZoom();

    if(CURRENT_NOTES.length > 0) SCROLL_OFFSET = Math.max(0, CURRENT_NOTES[0].t - 2.0);
    drawMain();
    drawMinimap();
}

function parseNote(node, isChord=false) {
    return {
        t: parseFloat(node.getAttribute("time")),
        s: parseInt(node.getAttribute("string")),
        f: parseInt(node.getAttribute("fret")),
        sustain: parseFloat(node.getAttribute("sustain")) || 0,
        bend: parseFloat(node.getAttribute("bend")) || 0,
        slideTo: parseInt(node.getAttribute("slideTo")) || -1,
        isChord: isChord
    };
}

function getTag(xml, tag) { return xml.querySelector(tag)?.textContent || ""; }

// --- THE "TRUE KISS" LOGIC ---
function applyZoom() {
    if(CURRENT_NOTES.length === 0) return;

    const spacing = height / 7;
    const desiredDiameter = BASE_RADIUS * 2 * ZOOM_FACTOR; // Full width at zoom

    let maxRequiredPPS = 100; // Start conservative

    for(let i=0; i<CURRENT_NOTES.length-1; i++) {
        let a = CURRENT_NOTES[i];
        let b = CURRENT_NOTES[i+1];
        let dt = b.t - a.t;

        if(dt <= 0.001) continue;

        let dy = Math.abs(a.s - b.s) * spacing;
        if(dy >= desiredDiameter) continue;

        // Force zero gap
        let neededDX = Math.sqrt((desiredDiameter * desiredDiameter) - (dy * dy));
        let neededPPS = neededDX / dt;

        if(neededPPS > maxRequiredPPS) {
            maxRequiredPPS = neededPPS;
        }
    }

    // Set Active Zoom
    ACTIVE_RADIUS = BASE_RADIUS * ZOOM_FACTOR;

    // Check against radius-specific bottleneck
    let finalPPS = 100;
    const diameter = ACTIVE_RADIUS * 2;

    for(let i=0; i<CURRENT_NOTES.length-1; i++) {
        let a = CURRENT_NOTES[i];
        let b = CURRENT_NOTES[i+1];
        let dt = b.t - a.t;
        if(dt <= 0.001) continue;
        let dy = Math.abs(a.s - b.s) * spacing;
        if(dy >= diameter) continue;

        let neededDX = Math.sqrt((diameter * diameter) - (dy * dy));
        let neededPPS = neededDX / dt;

        if(neededPPS > finalPPS) finalPPS = neededPPS;
    }

    if(finalPPS > 800) finalPPS = 800;
    ACTIVE_PPS = finalPPS;

    drawMain();
    drawMinimap();
}

// --- DRAWING ---
function resize() {
    const wrap = document.getElementById('canvas-wrapper');
    if(!wrap) return;
    width = wrap.clientWidth;
    height = wrap.clientHeight;
    mainCanvas.width = width;
    mainCanvas.height = height;

    const miniWrap = document.getElementById('minimap-container');
    miniWidth = miniWrap.clientWidth;
    miniHeight = miniWrap.clientHeight;
    miniCanvas.width = miniWidth;
    miniCanvas.height = miniHeight;

    applyZoom();
}

function drawMain() {
    if(!mainCtx) return;
    mainCtx.clearRect(0, 0, width, height);
    mainCtx.fillStyle = "#24150E";
    mainCtx.fillRect(0, 0, width, height);

    const playheadX = 300;
    const topMargin = 50;
    const spacing = (height - topMargin - 20) / 6;

    // SECTIONS
    SECTIONS.forEach((sec, i) => {
        let x = playheadX + (sec.t - SCROLL_OFFSET) * ACTIVE_PPS;
        let nextT = (i < SECTIONS.length - 1) ? SECTIONS[i+1].t : sec.t + 30;
        let w = (nextT - sec.t) * ACTIVE_PPS;
        if (x + w < 0 || x > width) return;

        let c = SECTION_COLORS['verse'];
        for(let key in SECTION_COLORS) if(sec.name.toLowerCase().includes(key)) c = SECTION_COLORS[key];

        mainCtx.fillStyle = c; mainCtx.globalAlpha = 0.5;
        mainCtx.fillRect(x, 0, w, 30);
        mainCtx.fillStyle = "white"; mainCtx.globalAlpha = 1.0; mainCtx.font = "bold 11px Arial";
        mainCtx.fillText(sec.name.toUpperCase(), x + 5, 20);
        mainCtx.strokeStyle = "white"; mainCtx.lineWidth = 1;
        mainCtx.beginPath(); mainCtx.moveTo(x, 0); mainCtx.lineTo(x, height); mainCtx.stroke();
    });

    // ANCHORS
    CURRENT_ANCHORS.forEach((anchor, i) => {
        let x = playheadX + (anchor.t - SCROLL_OFFSET) * ACTIVE_PPS;
        let nextT = (i < CURRENT_ANCHORS.length - 1) ? CURRENT_ANCHORS[i+1].t : anchor.t + 5;
        let w = (nextT - anchor.t) * ACTIVE_PPS;
        if (x + w < 0 || x > width) return;

        mainCtx.fillStyle = "#334455"; mainCtx.globalAlpha = 0.4;
        mainCtx.fillRect(x, topMargin, w, spacing*0.8);
        mainCtx.fillRect(x, height - spacing*0.8, w, spacing*0.8);

        mainCtx.fillStyle = "#FFF"; mainCtx.globalAlpha = 0.3;
        mainCtx.font = `bold ${ACTIVE_RADIUS}px Arial`;
        mainCtx.fillText(anchor.fret, x + 5, topMargin + 25);
    });

    // STRINGS
    mainCtx.globalAlpha = 1.0;
    for (let i = 0; i < STRINGS; i++) {
        let y = topMargin + (spacing * (i + 0.5));
        let c = STRING_COLORS[i];
        mainCtx.shadowBlur = 15; mainCtx.shadowColor = c;
        mainCtx.lineWidth = 4; mainCtx.strokeStyle = c; mainCtx.globalAlpha = 0.3;
        mainCtx.beginPath(); mainCtx.moveTo(0, y); mainCtx.lineTo(width, y); mainCtx.stroke();
        mainCtx.shadowBlur = 0; mainCtx.lineWidth = 1; mainCtx.strokeStyle = "#FFF"; mainCtx.globalAlpha = 0.8;
        mainCtx.beginPath(); mainCtx.moveTo(0, y); mainCtx.lineTo(width, y); mainCtx.stroke();
    }

    // NOTES
    mainCtx.globalAlpha = 1.0;
    const r = ACTIVE_RADIUS;
    CURRENT_NOTES.forEach(note => {
        let x = playheadX + (note.t - SCROLL_OFFSET) * ACTIVE_PPS;
        let y = topMargin + (spacing * (note.s + 0.5));
        if (x + (note.sustain*ACTIVE_PPS) < -50 || x > width + 50) return;

        let c = STRING_COLORS[note.s];

        if(note.sustain > 0) {
            let tailW = note.sustain * ACTIVE_PPS;
            mainCtx.fillStyle = c; mainCtx.globalAlpha = 0.3;
            mainCtx.fillRect(x, y - (r*0.3), tailW, r*0.6);
        }
        if(note.bend > 0) {
            mainCtx.strokeStyle = "#FFD700"; mainCtx.lineWidth = 3; mainCtx.globalAlpha = 0.9;
            mainCtx.beginPath(); mainCtx.moveTo(x, y - r);
            mainCtx.quadraticCurveTo(x + 20, y - r - 30, x + 40, y - r - 10); mainCtx.stroke();
        }

        mainCtx.globalAlpha = 1.0;
        mainCtx.beginPath(); mainCtx.arc(x, y, r, 0, Math.PI * 2);
        mainCtx.lineWidth = Math.max(2, r * 0.15);
        mainCtx.strokeStyle = c; mainCtx.stroke();
        mainCtx.beginPath(); mainCtx.arc(x, y, r - 3, 0, Math.PI * 2);
        mainCtx.lineWidth = 1; mainCtx.strokeStyle = "white"; mainCtx.stroke();

        mainCtx.fillStyle = "white"; mainCtx.font = `bold ${Math.floor(r*1.3)}px Arial`;
        mainCtx.textAlign = "center"; mainCtx.textBaseline = "middle";
        mainCtx.lineWidth = 3; mainCtx.strokeStyle = "black";
        mainCtx.strokeText(note.f, x, y); mainCtx.fillText(note.f, x, y);
    });

    // Playhead
    mainCtx.strokeStyle = "#00FFFF"; mainCtx.lineWidth = 2;
    mainCtx.beginPath(); mainCtx.moveTo(playheadX, 0); mainCtx.lineTo(playheadX, height); mainCtx.stroke();

    // Time
    let mins = Math.floor(SCROLL_OFFSET / 60);
    let secs = Math.floor(SCROLL_OFFSET % 60).toString().padStart(2, '0');
    let lbl = document.getElementById('lblTime');
    if(lbl) lbl.textContent = `${mins}:${secs}`;
}

function drawMinimap() {
    if(!miniCtx) return;
    miniCtx.clearRect(0, 0, miniWidth, miniHeight);
    miniCtx.fillStyle = "#111"; miniCtx.fillRect(0, 0, miniWidth, miniHeight);

    if(SONG_LENGTH <= 0) return;

    const scaleX = miniWidth / SONG_LENGTH;
    const stringH = miniHeight / 6;

    CURRENT_NOTES.forEach(note => {
        let mx = note.t * scaleX;
        let my = note.s * stringH + (stringH/2);
        miniCtx.fillStyle = STRING_COLORS[note.s];
        miniCtx.fillRect(mx, my-2, 2, 4);
    });

    const viewStart = SCROLL_OFFSET * scaleX;
    const viewW = (width / ACTIVE_PPS) * scaleX;

    miniCtx.strokeStyle = "#FFF"; miniCtx.lineWidth = 1;
    miniCtx.strokeRect(viewStart, 0, viewW, miniHeight);
    miniCtx.fillStyle = "white"; miniCtx.globalAlpha = 0.1;
    miniCtx.fillRect(viewStart, 0, viewW, miniHeight);
}

// Start when file loads
window.onload = init;