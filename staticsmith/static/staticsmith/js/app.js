// --- CONSTANTS ---
const STRINGS = 6;
const STRING_COLORS = ['#FF1a1a', '#F2E830', '#30B0F2', '#F29630', '#30F25A', '#B030F2'];
const SECTION_COLORS = { 'intro': '#555', 'verse': '#4444aa', 'chorus': '#aa4444', 'bridge': '#aaaa44', 'solo': '#aa44aa', 'outro': '#333' };

// --- STATE ---
let RAW_XML = null;
let CURRENT_XML_STRING = "";
let LEVELS = {};
let SECTIONS = [];
let PHRASES = [];
let CHORD_TEMPLATES = {};

let CURRENT_NOTES = [];
let CURRENT_ANCHORS = [];
let SONG_LENGTH = 0;

// --- VIEW SETTINGS ---
const BASE_RADIUS = 28;
let ZOOM_FACTOR = 1.0;
// FIXED: Active Radius is now constant (same as 100% zoom)
let ACTIVE_RADIUS = BASE_RADIUS;
let ACTIVE_PPS = 150;
let SCROLL_OFFSET = 0.0;
let KEYBOARD_SPEED_MULTIPLIER = 5;

// --- CANVAS ---
let mainCanvas, mainCtx, miniCanvas, miniCtx;
let width, height, miniWidth, miniHeight;
let isDraggingMain = false, isDraggingMini = false, lastMouseX = 0;

// --- INIT ---
function init() {
    mainCanvas = document.getElementById('fretboardCanvas');
    mainCtx = mainCanvas.getContext('2d');
    miniCanvas = document.getElementById('minimapCanvas');
    miniCtx = miniCanvas.getContext('2d');

    window.addEventListener('resize', resize);
    window.addEventListener('keydown', handleKeyDown);

    resize();
    setupControls();
    refreshLibrary();
}

function handleKeyDown(e) {
    if (SONG_LENGTH <= 0) return;
    let jump = 0.5 * (KEYBOARD_SPEED_MULTIPLIER / 2);

    if (e.key === "ArrowRight") {
        SCROLL_OFFSET += jump;
        if(SCROLL_OFFSET > SONG_LENGTH) SCROLL_OFFSET = SONG_LENGTH;
        drawMain();
        drawMinimap();
    } else if (e.key === "ArrowLeft") {
        SCROLL_OFFSET -= jump;
        if(SCROLL_OFFSET < 0) SCROLL_OFFSET = 0;
        drawMain();
        drawMinimap();
    }
}

function setupControls() {
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

    document.getElementById('selDifficulty').addEventListener('change', e => {
        loadLevel(e.target.value);
    });

    document.getElementById('zoomSlider').addEventListener('input', e => {
        ZOOM_FACTOR = parseFloat(e.target.value);
        document.getElementById('lblZoomVal').textContent = Math.round(ZOOM_FACTOR * 100) + "%";
        applyZoom();
    });

    document.getElementById('speedSlider').addEventListener('input', e => {
        KEYBOARD_SPEED_MULTIPLIER = parseInt(e.target.value);
        let label = "Normal";
        if (KEYBOARD_SPEED_MULTIPLIER < 4) label = "Slow";
        if (KEYBOARD_SPEED_MULTIPLIER > 7) label = "Fast";
        document.getElementById('lblScrollSpeed').textContent = label;
    });

    const btnSave = document.getElementById('btnSaveCurrent');
    if(btnSave) {
        btnSave.addEventListener('click', () => {
            const title = document.getElementById('lblTitle').textContent;
            const artist = document.getElementById('lblArtist').textContent;
            if(!CURRENT_XML_STRING) return alert("No song loaded to save!");

            fetch('/staticsmith/api/save/', {
                method: 'POST',
                body: JSON.stringify({ title: title, artist: artist, xml_data: CURRENT_XML_STRING }),
                headers: { 'Content-Type': 'application/json' }
            })
            .then(res => res.json())
            .then(data => {
                if(data.status === 'success') {
                    alert("Saved to Library: " + data.filename);
                    refreshLibrary();
                } else {
                    alert("Error saving: " + data.message);
                }
            })
            .catch(err => alert("API Error: " + err));
        });
    }

    const btnLoad = document.getElementById('btnLoadSaved');
    if(btnLoad) {
        btnLoad.addEventListener('click', () => {
            const filename = document.getElementById('selLibrary').value;
            if(!filename) return alert("Please select a song first.");
            document.getElementById('loading').style.display = 'flex';
            fetch(`/staticsmith/api/load/${filename}/`)
            .then(res => res.json())
            .then(data => {
                if(data.xml_data) {
                    parseFullXML(data.xml_data);
                } else {
                    alert("Error loading file.");
                }
                document.getElementById('loading').style.display = 'none';
            })
            .catch(err => {
                document.getElementById('loading').style.display = 'none';
                alert("API Error: " + err);
            });
        });
    }

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

function refreshLibrary() {
    fetch('/staticsmith/api/library/')
    .then(res => res.json())
    .then(data => {
        const sel = document.getElementById('selLibrary');
        sel.innerHTML = '<option value="">-- Select Saved Song --</option>';
        data.songs.forEach(song => {
            const opt = document.createElement('option');
            opt.value = song.id;
            opt.text = song.name;
            sel.appendChild(opt);
        });
    })
    .catch(err => console.log("Library refresh failed:", err));
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
    CURRENT_XML_STRING = xmlString;
    const parser = new DOMParser();
    RAW_XML = parser.parseFromString(xmlString, "text/xml");

    document.getElementById('lblTitle').textContent = getTag(RAW_XML, "title");
    document.getElementById('lblArtist').textContent = getTag(RAW_XML, "artistName");
    SONG_LENGTH = parseFloat(getTag(RAW_XML, "songLength") || 200);

    const btnSave = document.getElementById('btnSaveCurrent');
    if(btnSave) btnSave.style.display = 'block';

    CHORD_TEMPLATES = {};
    const templates = RAW_XML.getElementsByTagName("chordTemplate");
    for(let i=0; i<templates.length; i++) {
        const node = templates[i];
        let fingers = {};
        for(let s=0; s<STRINGS; s++) {
            let f = node.getAttribute("finger" + s);
            if(f) fingers[s] = parseInt(f);
        }
        CHORD_TEMPLATES[i] = fingers;
    }

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

    CURRENT_ANCHORS = [];
    let anchors = levelNode.querySelectorAll("anchors > anchor");
    if(anchors.length === 0) anchors = RAW_XML.querySelectorAll("transcriptionTrack > anchors > anchor");
    anchors.forEach(a => CURRENT_ANCHORS.push({
        t: parseFloat(a.getAttribute("time")),
        fret: parseInt(a.getAttribute("fret"))
    }));
    CURRENT_ANCHORS.sort((a, b) => a.t - b.t);

    levelNode.querySelectorAll("notes > note").forEach(n => {
        let note = parseNote(n, false);
        if (note.finger === -1) note.finger = calculateFinger(note.t, note.f);
        CURRENT_NOTES.push(note);
    });

    levelNode.querySelectorAll("chords > chord").forEach(c => {
        let cId = c.getAttribute("chordId");
        let tpl = CHORD_TEMPLATES[cId] || {};

        if(c.hasAttribute("fret")) {
            let s = parseInt(c.getAttribute("string"));
            let f = (tpl[s] !== undefined) ? tpl[s] : -1;
            let note = parseNote(c, true, f);
            if(note.finger === -1) note.finger = calculateFinger(note.t, note.f);
            CURRENT_NOTES.push(note);
        }
        c.querySelectorAll("chordNote").forEach(cn => {
            let s = parseInt(cn.getAttribute("string"));
            let f = (tpl[s] !== undefined) ? tpl[s] : -1;
            let note = parseNote(cn, true, f);
            if(note.finger === -1) note.finger = calculateFinger(note.t, note.f);
            CURRENT_NOTES.push(note);
        });
    });

    CURRENT_NOTES.sort((a, b) => a.t - b.t);
    applyZoom();
    if(CURRENT_NOTES.length > 0) SCROLL_OFFSET = Math.max(0, CURRENT_NOTES[0].t - 2.0);
    drawMain();
    drawMinimap();
}

function calculateFinger(time, fret) {
    if(fret === 0) return 0;
    let anchorFret = 1;
    for (let i = CURRENT_ANCHORS.length - 1; i >= 0; i--) {
        if (CURRENT_ANCHORS[i].t <= time) {
            anchorFret = CURRENT_ANCHORS[i].fret;
            break;
        }
    }
    let finger = fret - anchorFret + 1;
    if(finger < 1) finger = 1;
    if(finger > 4) finger = 4;
    return finger;
}

function parseNote(node, isChord=false, finger=-1) {
    let xmlFinger = node.getAttribute("leftHand") || node.getAttribute("finger");
    if(xmlFinger) finger = parseInt(xmlFinger);

    return {
        t: parseFloat(node.getAttribute("time")),
        s: parseInt(node.getAttribute("string")),
        f: parseInt(node.getAttribute("fret")),
        sustain: parseFloat(node.getAttribute("sustain")) || 0,
        bend: parseFloat(node.getAttribute("bend")) || 0,
        slideTo: parseInt(node.getAttribute("slideTo")) || -1,
        isChord: isChord,
        finger: parseInt(finger)
    };
}

function getTag(xml, tag) { return xml.querySelector(tag)?.textContent || ""; }

// --- ZOOM LOGIC ---
function applyZoom() {
    if(CURRENT_NOTES.length === 0) return;

    // 1. FIXED NOTE SIZE
    // Radius is always BASE_RADIUS (28), it does not scale with zoom slider
    ACTIVE_RADIUS = BASE_RADIUS;

    // 2. CONSTANTS
    const spacing = height / 7;
    const diameter = ACTIVE_RADIUS * 2;

    // 3. BASELINE SPEED CALCULATION (Zero Gap at Fixed Radius)
    // We calculate the minimum speed required to prevent overlap for notes of size 28.
    let baseKissingPPS = 20; // Minimum floor

    for(let i=0; i<CURRENT_NOTES.length-1; i++) {
        let a = CURRENT_NOTES[i];
        let b = CURRENT_NOTES[i+1];
        let dt = b.t - a.t;

        if(dt <= 0.001) continue;

        let dy = Math.abs(a.s - b.s) * spacing;
        if(dy >= diameter) continue;

        let neededDX = Math.sqrt((diameter * diameter) - (dy * dy));
        let neededPPS = neededDX / dt;

        if(neededPPS > baseKissingPPS) {
            baseKissingPPS = neededPPS;
        }
    }
    if(baseKissingPPS > 1200) baseKissingPPS = 1200;

    // 4. APPLY ZOOM SLIDER TO DENSITY
    // The user wants "Kissing" (Zero Gap) specifically at Zoom 120 (1.2).
    // So we normalize the slider: At 1.2, multiplier is 1.0 (Base Speed).
    // At > 1.2, speed increases (Gaps). At < 1.2, speed decreases (Overlap).

    ACTIVE_PPS = baseKissingPPS * (ZOOM_FACTOR / 1.2);

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
        let w = (i < CURRENT_ANCHORS.length - 1) ? (CURRENT_ANCHORS[i+1].t - anchor.t) * ACTIVE_PPS : 100;
        if (x + w < 0 || x > width) return;

        mainCtx.fillStyle = "#FFF"; mainCtx.globalAlpha = 0.3;
        let fontSize = Math.max(12, ACTIVE_RADIUS);
        mainCtx.font = `bold ${fontSize}px Arial`;
        mainCtx.textAlign = "left";
        mainCtx.fillText("P" + anchor.fret, x + 5, height - 10);
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

    // NOTES & FINGERS
    mainCtx.globalAlpha = 1.0;
    // Radius is constant now
    const r = ACTIVE_RADIUS;
    let fontSize = Math.max(9, Math.floor(r * 1.3));
    let fingerFont = `bold ${fontSize}px Arial`;

    CURRENT_NOTES.forEach(note => {
        let x = playheadX + (note.t - SCROLL_OFFSET) * ACTIVE_PPS;
        let y = topMargin + (spacing * (note.s + 0.5));
        if (x + (note.sustain*ACTIVE_PPS) < -50 || x > width + 50) return;
        let c = STRING_COLORS[note.s];

        // Sustain
        if(note.sustain > 0) {
            let tailW = note.sustain * ACTIVE_PPS;
            mainCtx.fillStyle = c; mainCtx.globalAlpha = 0.3;
            mainCtx.fillRect(x, y - (r*0.3), tailW, r*0.6);
        }
        // Bend
        if(note.bend > 0) {
            mainCtx.strokeStyle = "#FFD700"; mainCtx.lineWidth = 3; mainCtx.globalAlpha = 0.9;
            mainCtx.beginPath(); mainCtx.moveTo(x, y - r);
            mainCtx.quadraticCurveTo(x + 20, y - r - 30, x + 40, y - r - 10); mainCtx.stroke();
        }

        // Note Head
        mainCtx.globalAlpha = 1.0;
        mainCtx.beginPath(); mainCtx.arc(x, y, r, 0, Math.PI * 2);
        mainCtx.lineWidth = Math.max(1, r * 0.15);
        mainCtx.strokeStyle = c; mainCtx.stroke();

        mainCtx.beginPath(); mainCtx.arc(x, y, r - 3, 0, Math.PI * 2);
        mainCtx.lineWidth = 1; mainCtx.strokeStyle = "white"; mainCtx.stroke();

        // Fret Number
        mainCtx.fillStyle = "white";
        mainCtx.font = fingerFont;
        mainCtx.textAlign = "center"; mainCtx.textBaseline = "middle";
        mainCtx.lineWidth = 3; mainCtx.strokeStyle = "black";
        mainCtx.strokeText(note.f, x, y);
        mainCtx.fillText(note.f, x, y);

        // Finger Number
        if(note.finger > 0 && note.f > 0) {
            let fingerY = y - r - (fontSize * 0.6);
            if(note.bend > 0) fingerY -= 15;

            mainCtx.fillStyle = "#FFD700";
            mainCtx.font = `bold ${Math.max(10, fontSize)}px Arial`;
            mainCtx.fillText(note.finger, x, fingerY);
        }
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

    // Clean Yellow Border
    miniCtx.strokeStyle = "#FFFF00";
    miniCtx.lineWidth = 2;
    miniCtx.strokeRect(viewStart, 0, viewW, miniHeight);
}

window.onload = init;