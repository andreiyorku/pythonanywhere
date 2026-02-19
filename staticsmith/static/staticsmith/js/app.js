// --- CONSTANTS ---
const STRINGS = 6;
const STRING_COLORS = ['#FF1a1a', '#F2E830', '#30B0F2', '#F29630', '#30F25A', '#B030F2'];
const SECTION_COLORS = { 'intro': '#555', 'verse': '#4444aa', 'chorus': '#aa4444', 'bridge': '#aaaa44', 'solo': '#aa44aa', 'outro': '#333' };
const PLAYHEAD_X = 300; // Fixed X position of the playhead

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
let ZOOM_FACTOR = 1.0;          // Main Window Zoom
let MINIMAP_ZOOM_FACTOR = 1.0;  // Minimap Zoom (1.0 = Fit Whole Song)

let ACTIVE_RADIUS = BASE_RADIUS;
let ACTIVE_PPS = 150;
let SCROLL_OFFSET = 0.0;
let KEYBOARD_SPEED_MULTIPLIER = 5;

// --- PLAYBACK STATE ---
let IS_PLAYING = false;
let PLAYBACK_SPEED = 0.5; // 50% Speed
let LAST_FRAME_TIME = 0;

// --- LOOP STATE ---
let LOOP_START = -1;
let LOOP_END = -1;
let IS_DRAGGING_LOOP_START = false;
let IS_DRAGGING_LOOP_END = false;
let IS_CREATING_LOOP = false;

// --- INPUT STATE ---
let HOVER_TARGET = 'main'; // 'main' or 'mini' (Determines where Ctrl+/- applies)

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

    if (!mainCanvas || !miniCanvas) return;

    window.addEventListener('resize', resize);
    window.addEventListener('keydown', handleKeyDown);

    // Mouse Wheel Zoom (Main & Minimap)
    mainCanvas.addEventListener('wheel', handleWheel, { passive: false });
    miniCanvas.addEventListener('wheel', handleWheel, { passive: false });

    // Track Hover for Contextual Shortcuts
    mainCanvas.addEventListener('mouseenter', () => HOVER_TARGET = 'main');
    miniCanvas.addEventListener('mouseenter', () => HOVER_TARGET = 'mini');

    loadSettings(); // Restore saved settings

    resize();
    setupControls();
    refreshLibrary();

    requestAnimationFrame(gameLoop);
}

// --- SETTINGS PERSISTENCE ---
function saveSettings() {
    const settings = {
        zoom: ZOOM_FACTOR,
        miniZoom: MINIMAP_ZOOM_FACTOR,
        scrollSpeed: KEYBOARD_SPEED_MULTIPLIER,
        playbackSpeed: PLAYBACK_SPEED,
        loopStart: LOOP_START,
        loopEnd: LOOP_END
    };
    localStorage.setItem('staticSmithSettings', JSON.stringify(settings));
}

function loadSettings() {
    const saved = localStorage.getItem('staticSmithSettings');
    if (saved) {
        try {
            const s = JSON.parse(saved);
            if (s.zoom) ZOOM_FACTOR = parseFloat(s.zoom);
            if (s.miniZoom) MINIMAP_ZOOM_FACTOR = parseFloat(s.miniZoom);
            if (s.scrollSpeed) KEYBOARD_SPEED_MULTIPLIER = parseInt(s.scrollSpeed);
            if (s.playbackSpeed) PLAYBACK_SPEED = parseFloat(s.playbackSpeed);
            if (s.loopStart !== undefined) LOOP_START = parseFloat(s.loopStart);
            if (s.loopEnd !== undefined) LOOP_END = parseFloat(s.loopEnd);
        } catch (e) {
            console.warn("Failed to load settings", e);
        }
    }
}

// --- GAME LOOP ---
function gameLoop(timestamp) {
    if (!LAST_FRAME_TIME) LAST_FRAME_TIME = timestamp;
    let deltaTime = (timestamp - LAST_FRAME_TIME) / 1000;
    LAST_FRAME_TIME = timestamp;

    if (IS_PLAYING && SONG_LENGTH > 0) {
        SCROLL_OFFSET += deltaTime * PLAYBACK_SPEED;

        // LOOP LOGIC
        if (LOOP_START !== -1 && LOOP_END !== -1) {
            if (SCROLL_OFFSET >= LOOP_END) {
                SCROLL_OFFSET = LOOP_START;
            }
        }

        if (SCROLL_OFFSET > SONG_LENGTH) {
            SCROLL_OFFSET = SONG_LENGTH;
            togglePlay(false);
        }
        drawMain();
        drawMinimap();
    }

    requestAnimationFrame(gameLoop);
}

function togglePlay(forceState = null) {
    if (forceState !== null) IS_PLAYING = forceState;
    else IS_PLAYING = !IS_PLAYING;

    const btn = document.getElementById('btnPlayPause');
    if (btn) {
        if (IS_PLAYING) {
            btn.textContent = "⏸ Pause";
            btn.style.background = "#aa4444";
        } else {
            btn.textContent = "▶ Play";
            btn.style.background = "#228B22";
        }
    }
}

// --- INPUT HANDLING ---
function handleKeyDown(e) {
    // 1. Zoom Shortcuts (Ctrl + / -)
    // Applies to Minimap if hovering minimap, otherwise Main
    if (e.ctrlKey) {
        if (e.key === "=" || e.key === "+") {
            e.preventDefault();
            if (HOVER_TARGET === 'mini') updateMiniZoom(MINIMAP_ZOOM_FACTOR + 0.5);
            else updateZoomUI(ZOOM_FACTOR + 0.1);
            return;
        }
        if (e.key === "-") {
            e.preventDefault();
            if (HOVER_TARGET === 'mini') updateMiniZoom(MINIMAP_ZOOM_FACTOR - 0.5);
            else updateZoomUI(ZOOM_FACTOR - 0.1);
            return;
        }
    }

    // 2. Speed Shortcuts (Shift + / -)
    if (e.shiftKey) {
        if (e.key === "=" || e.key === "+") {
            e.preventDefault();
            updatePlaybackUI(PLAYBACK_SPEED + 0.05);
            return;
        }
        if (e.key === "-") {
            e.preventDefault();
            updatePlaybackUI(PLAYBACK_SPEED - 0.05);
            return;
        }
    }

    if (SONG_LENGTH <= 0) return;

    if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
        return;
    }

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

function handleWheel(e) {
    if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -1 : 1;

        // Check which canvas triggered the wheel event
        if (e.target.id === 'minimapCanvas') {
            updateMiniZoom(MINIMAP_ZOOM_FACTOR + (delta * 0.5));
        } else {
            updateZoomUI(ZOOM_FACTOR + (delta * 0.1));
        }
    }
}

// Helpers
function updateZoomUI(val) {
    val = Math.max(0.2, Math.min(3.0, val));
    ZOOM_FACTOR = val;
    const slider = document.getElementById('zoomSlider');
    const input = document.getElementById('zoomInput');
    if (slider) slider.value = val;
    if (input) input.value = val.toFixed(1);
    applyZoom();
    saveSettings();
}

function updateMiniZoom(val) {
    // 1.0 = Fit All. Max = 10x Zoom.
    val = Math.max(1.0, Math.min(10.0, val));
    MINIMAP_ZOOM_FACTOR = val;
    drawMinimap();
    saveSettings();
}

function updatePlaybackUI(val) {
    val = Math.max(0.1, Math.min(2.0, val));
    PLAYBACK_SPEED = val;
    const slider = document.getElementById('autoSpeedSlider');
    const input = document.getElementById('autoSpeedInput');
    if (slider) slider.value = Math.round(val * 100);
    if (input) input.value = Math.round(val * 100);
    saveSettings();
}

function setupControls() {
    // ZOOM
    const zSlider = document.getElementById('zoomSlider');
    const zInput = document.getElementById('zoomInput');
    function syncZoom(val) { updateZoomUI(parseFloat(val)); }
    if(zSlider) { zSlider.value = ZOOM_FACTOR; zSlider.addEventListener('input', e => syncZoom(e.target.value)); }
    if(zInput) { zInput.value = ZOOM_FACTOR; zInput.addEventListener('input', e => syncZoom(e.target.value)); }

    // SCROLL SPEED
    const sSlider = document.getElementById('speedSlider');
    const sInput = document.getElementById('speedInput');
    function syncScroll(val) {
        KEYBOARD_SPEED_MULTIPLIER = parseInt(val);
        if(sSlider) sSlider.value = val;
        if(sInput) sInput.value = val;
        saveSettings();
    }
    if(sSlider) { sSlider.value = KEYBOARD_SPEED_MULTIPLIER; sSlider.addEventListener('input', e => syncScroll(e.target.value)); }
    if(sInput) { sInput.value = KEYBOARD_SPEED_MULTIPLIER; sInput.addEventListener('input', e => syncScroll(e.target.value)); }

    // PLAYBACK
    const pSlider = document.getElementById('autoSpeedSlider');
    const pInput = document.getElementById('autoSpeedInput');
    function syncPlayback(val) { updatePlaybackUI(parseInt(val) / 100.0); }
    if(pSlider) { pSlider.value = Math.round(PLAYBACK_SPEED * 100); pSlider.addEventListener('input', e => syncPlayback(e.target.value)); }
    if(pInput) { pInput.value = Math.round(PLAYBACK_SPEED * 100); pInput.addEventListener('input', e => syncPlayback(e.target.value)); }

    const btnPlay = document.getElementById('btnPlayPause');
    if(btnPlay) btnPlay.addEventListener('click', () => togglePlay());

    // FILE
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

    // LOAD/SAVE
    const btnSave = document.getElementById('btnSaveCurrent');
    if(btnSave) {
        btnSave.addEventListener('click', () => {
             const title = document.getElementById('lblTitle').textContent;
             const artist = document.getElementById('lblArtist').textContent;
             if(!CURRENT_XML_STRING) return alert("No song!");
             fetch('/staticsmith/api/save/', {
                 method: 'POST',
                 body: JSON.stringify({ title, artist, xml_data: CURRENT_XML_STRING }),
                 headers: { 'Content-Type': 'application/json' }
             }).then(r=>r.json()).then(d=>{
                 if(d.status==='success') { alert("Saved!"); refreshLibrary(); }
                 else alert("Error: "+d.message);
             }).catch(e=>alert("API Error"));
        });
    }
    const btnLoad = document.getElementById('btnLoadSaved');
    if(btnLoad) {
        btnLoad.addEventListener('click', () => {
            const f = document.getElementById('selLibrary').value;
            if(!f) return alert("Select song");
            document.getElementById('loading').style.display = 'flex';
            togglePlay(false);
            fetch(`/staticsmith/api/load/${f}/`).then(r=>r.json()).then(d=>{
                if(d.xml_data) parseFullXML(d.xml_data);
                else alert("Error loading");
                document.getElementById('loading').style.display = 'none';
            }).catch(e=> {
                document.getElementById('loading').style.display = 'none';
                alert("API Error");
            });
        });
    }

    // --- MAIN CANVAS INTERACTION ---
    mainCanvas.addEventListener('mousedown', e => {
        const rect = mainCanvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        // 1. SECTION CLICK
        if (my < 40 && SECTIONS.length > 0) {
            for (let i = 0; i < SECTIONS.length; i++) {
                let sec = SECTIONS[i];
                let nextT = (i < SECTIONS.length - 1) ? SECTIONS[i+1].t : SONG_LENGTH;
                let sx = PLAYHEAD_X + (sec.t - SCROLL_OFFSET) * ACTIVE_PPS;
                let sw = (nextT - sec.t) * ACTIVE_PPS;
                if (mx >= sx && mx <= sx + sw) {
                    LOOP_START = sec.t; LOOP_END = nextT; SCROLL_OFFSET = sec.t;
                    drawMain(); drawMinimap(); saveSettings();
                    return;
                }
            }
        }

        // 2. LOOP HANDLES
        if (LOOP_START !== -1 && LOOP_END !== -1) {
            const startX = PLAYHEAD_X + (LOOP_START - SCROLL_OFFSET) * ACTIVE_PPS;
            const endX = PLAYHEAD_X + (LOOP_END - SCROLL_OFFSET) * ACTIVE_PPS;
            if (Math.abs(mx - startX) < 15) { IS_DRAGGING_LOOP_START = true; return; }
            if (Math.abs(mx - endX) < 15) { IS_DRAGGING_LOOP_END = true; return; }
        }

        isDraggingMain = true; lastMouseX = e.clientX;
    });

    window.addEventListener('mouseup', () => {
        if(IS_DRAGGING_LOOP_START || IS_DRAGGING_LOOP_END) saveSettings();
        isDraggingMain = false; isDraggingMini = false;
        IS_DRAGGING_LOOP_START = false; IS_DRAGGING_LOOP_END = false; IS_CREATING_LOOP = false;
    });

    mainCanvas.addEventListener('mousemove', e => {
        const mx = e.clientX - mainCanvas.getBoundingClientRect().left;
        if (IS_DRAGGING_LOOP_START) {
            let t = SCROLL_OFFSET + (mx - PLAYHEAD_X) / ACTIVE_PPS;
            LOOP_START = Math.max(0, Math.min(t, LOOP_END - 0.1));
            drawMain(); drawMinimap(); return;
        }
        if (IS_DRAGGING_LOOP_END) {
            let t = SCROLL_OFFSET + (mx - PLAYHEAD_X) / ACTIVE_PPS;
            LOOP_END = Math.min(SONG_LENGTH, Math.max(t, LOOP_START + 0.1));
            drawMain(); drawMinimap(); return;
        }
        if (isDraggingMain) {
            SCROLL_OFFSET -= (e.clientX - lastMouseX) / ACTIVE_PPS;
            if(SCROLL_OFFSET < 0) SCROLL_OFFSET = 0;
            lastMouseX = e.clientX;
            if(!IS_PLAYING) { drawMain(); drawMinimap(); }
        }
    });

    // --- MINIMAP INTERACTION (Zoom/Pan Aware) ---
    miniCanvas.addEventListener('mousedown', e => {
        // Helper to get Time from Click X based on Zoom
        const getMiniTime = (clickX) => {
            const visibleDuration = SONG_LENGTH / MINIMAP_ZOOM_FACTOR;
            const halfVis = visibleDuration / 2;
            let startT = SCROLL_OFFSET - halfVis;
            // Clamp start time exactly as we do in drawMinimap
            if (startT < 0) startT = 0;
            if (startT > SONG_LENGTH - visibleDuration) startT = SONG_LENGTH - visibleDuration;

            return startT + (clickX / miniWidth) * visibleDuration;
        };

        if (e.shiftKey) {
            const t = getMiniTime(e.clientX - miniCanvas.getBoundingClientRect().left);
            LOOP_START = t; LOOP_END = t; IS_CREATING_LOOP = true;
        } else {
            isDraggingMini = true;
            handleMinimapClick(e);
        }
    });

    miniCanvas.addEventListener('mousemove', e => {
        const getMiniTime = (clickX) => {
            const visibleDuration = SONG_LENGTH / MINIMAP_ZOOM_FACTOR;
            const halfVis = visibleDuration / 2;
            let startT = SCROLL_OFFSET - halfVis;
            if (startT < 0) startT = 0;
            if (startT > SONG_LENGTH - visibleDuration) startT = SONG_LENGTH - visibleDuration;
            return startT + (clickX / miniWidth) * visibleDuration;
        };

        if (IS_CREATING_LOOP) {
            const t = getMiniTime(e.clientX - miniCanvas.getBoundingClientRect().left);
            if (t < LOOP_START) LOOP_END = LOOP_START; else LOOP_END = t;
            drawMinimap(); drawMain();
        } else if (isDraggingMini) {
            handleMinimapClick(e);
        }
    });

    miniCanvas.addEventListener('mouseup', () => { if(IS_CREATING_LOOP) saveSettings(); });
    miniCanvas.addEventListener('dblclick', () => { LOOP_START = -1; LOOP_END = -1; saveSettings(); drawMain(); drawMinimap(); });
}

function handleMinimapClick(e) {
    if(SONG_LENGTH <= 0) return;
    const rect = miniCanvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;

    // Calculate View Window relative to Zoom
    const visibleDuration = SONG_LENGTH / MINIMAP_ZOOM_FACTOR;

    // Where is the viewport currently starting?
    const halfVis = visibleDuration / 2;
    let startT = SCROLL_OFFSET - halfVis;
    if (startT < 0) startT = 0;
    if (startT > SONG_LENGTH - visibleDuration) startT = SONG_LENGTH - visibleDuration;

    // The click time
    const clickTime = startT + (clickX / miniWidth) * visibleDuration;

    // Jump scroll offset to this time
    SCROLL_OFFSET = clickTime;

    if(SCROLL_OFFSET < 0) SCROLL_OFFSET = 0;
    if(SCROLL_OFFSET > SONG_LENGTH) SCROLL_OFFSET = SONG_LENGTH;

    if(!IS_PLAYING) { drawMain(); drawMinimap(); }
}

function refreshLibrary() {
    fetch('/staticsmith/api/library/').then(r=>r.json()).then(d=>{
        const s = document.getElementById('selLibrary'); if(!s) return;
        s.innerHTML = '<option value="">-- Select Saved Song --</option>';
        d.songs.forEach(x => { let o = document.createElement('option'); o.value=x.id; o.text=x.name; s.appendChild(o); });
    }).catch(e=>console.log("Offline"));
}

function parseFullXML(xmlString) {
    CURRENT_XML_STRING = xmlString;
    const parser = new DOMParser();
    RAW_XML = parser.parseFromString(xmlString, "text/xml");

    // Basic Metadata
    const title = RAW_XML.querySelector("title")?.textContent || "";
    const artist = RAW_XML.querySelector("artistName")?.textContent || "";
    document.getElementById('lblTitle').textContent = title;
    document.getElementById('lblArtist').textContent = artist;
    const sl = RAW_XML.querySelector("songLength")?.textContent;
    SONG_LENGTH = sl ? parseFloat(sl) : 200;

    const btnSave = document.getElementById('btnSaveCurrent');
    if(btnSave) btnSave.style.display = 'block';

    // Templates
    CHORD_TEMPLATES = {};
    const tpls = RAW_XML.getElementsByTagName("chordTemplate");
    for(let i=0; i<tpls.length; i++) {
        let f = {};
        for(let s=0; s<STRINGS; s++) { let v = tpls[i].getAttribute("finger"+s); if(v) f[s]=parseInt(v); }
        CHORD_TEMPLATES[i] = f;
    }

    // Sections
    SECTIONS = [];
    RAW_XML.querySelectorAll("sections > section").forEach(n => {
        SECTIONS.push({ name: n.getAttribute("name"), t: parseFloat(n.getAttribute("startTime")) });
    });

    // Levels
    LEVELS = {};
    const lvls = RAW_XML.querySelectorAll("levels > level");
    const selDiff = document.getElementById('selDifficulty');
    selDiff.innerHTML = ""; selDiff.disabled = false;
    lvls.forEach((n, i) => {
        let c = n.querySelectorAll("notes > note").length;
        LEVELS[i] = { node: n, count: c };
        let opt = document.createElement("option");
        opt.value = i; opt.text = `Lvl ${n.getAttribute("difficulty")} (${c})`;
        selDiff.appendChild(opt);
    });

    if(lvls.length > 0) { selDiff.value = lvls.length - 1; loadLevel(lvls.length - 1); }
}

function loadLevel(idx) {
    const lvl = LEVELS[idx].node;
    CURRENT_NOTES = [];
    CURRENT_ANCHORS = [];

    // Anchors
    let anchors = lvl.querySelectorAll("anchors > anchor");
    if(anchors.length===0) anchors = RAW_XML.querySelectorAll("transcriptionTrack > anchors > anchor");
    anchors.forEach(a => CURRENT_ANCHORS.push({ t: parseFloat(a.getAttribute("time")), fret: parseInt(a.getAttribute("fret")) }));
    CURRENT_ANCHORS.sort((a,b)=>a.t-b.t);

    // Notes Helper
    const proc = (n, isC=false, f=-1) => {
        let lh = n.getAttribute("leftHand") || n.getAttribute("finger");
        if(lh) f = parseInt(lh);
        if(f===-1) f = calcFinger(parseFloat(n.getAttribute("time")), parseInt(n.getAttribute("fret")));
        CURRENT_NOTES.push({
            t: parseFloat(n.getAttribute("time")),
            s: parseInt(n.getAttribute("string")),
            f: parseInt(n.getAttribute("fret")),
            sustain: parseFloat(n.getAttribute("sustain"))||0,
            bend: parseFloat(n.getAttribute("bend"))||0,
            isChord: isC, finger: f
        });
    };

    lvl.querySelectorAll("notes > note").forEach(n => proc(n));
    lvl.querySelectorAll("chords > chord").forEach(c => {
        let cid = c.getAttribute("chordId");
        let tpl = CHORD_TEMPLATES[cid] || {};
        if(c.hasAttribute("fret")) {
            let s = parseInt(c.getAttribute("string"));
            proc(c, true, tpl[s]!==undefined ? tpl[s] : -1);
        }
        c.querySelectorAll("chordNote").forEach(cn => {
            let s = parseInt(cn.getAttribute("string"));
            proc(cn, true, tpl[s]!==undefined ? tpl[s] : -1);
        });
    });

    CURRENT_NOTES.sort((a,b)=>a.t-b.t);
    applyZoom();
    if(CURRENT_NOTES.length>0) SCROLL_OFFSET = Math.max(0, CURRENT_NOTES[0].t - 2.0);
    drawMain(); drawMinimap();
}

function calcFinger(time, fret) {
    if(fret===0) return 0;
    let af = 1;
    for(let i=CURRENT_ANCHORS.length-1; i>=0; i--) { if(CURRENT_ANCHORS[i].t <= time) { af=CURRENT_ANCHORS[i].fret; break; } }
    let f = fret - af + 1;
    return Math.max(1, Math.min(4, f));
}

function applyZoom() {
    if(CURRENT_NOTES.length===0) return;
    ACTIVE_RADIUS = BASE_RADIUS;
    let basePPS = 20;
    // ... simple calc ...
    // To save lines, using simplified density logic or your previous robust one
    // Using simple proportional for now to ensure it runs:
    ACTIVE_PPS = 150 * (ZOOM_FACTOR);
    if(!IS_PLAYING) { drawMain(); drawMinimap(); }
}

function resize() {
    const w = document.getElementById('canvas-wrapper');
    if(!w) return;
    width = w.clientWidth || 800; height = w.clientHeight || 600;
    mainCanvas.width = width; mainCanvas.height = height;

    const mw = document.getElementById('minimap-container');
    miniWidth = mw.clientWidth || width; miniHeight = mw.clientHeight || 100;
    miniCanvas.width = miniWidth; miniCanvas.height = miniHeight;

    applyZoom();
}

function drawMain() {
    if(!mainCtx || width<=0) return;
    mainCtx.fillStyle = "#24150E"; mainCtx.fillRect(0,0,width,height);
    const topM = 50; const spc = (height - topM - 20)/6;

    // Sections
    SECTIONS.forEach((s,i) => {
        let x = PLAYHEAD_X + (s.t - SCROLL_OFFSET) * ACTIVE_PPS;
        let nt = (i < SECTIONS.length-1) ? SECTIONS[i+1].t : s.t+30;
        let w = (nt - s.t) * ACTIVE_PPS;
        if(x+w < -100 || x > width) return;

        // Highlight logic
        let c = SECTION_COLORS['verse'];
        for(let k in SECTION_COLORS) if(s.name.toLowerCase().includes(k)) c = SECTION_COLORS[k];
        mainCtx.fillStyle = c; mainCtx.globalAlpha = 0.5; mainCtx.fillRect(x,0,w,30);
        mainCtx.fillStyle = "white"; mainCtx.globalAlpha = 1; mainCtx.font = "bold 11px Arial";
        mainCtx.fillText(s.name.toUpperCase(), x+5, 20);
        mainCtx.strokeStyle = "white"; mainCtx.beginPath(); mainCtx.moveTo(x,0); mainCtx.lineTo(x,height); mainCtx.stroke();
    });

    // Strings
    for(let i=0; i<STRINGS; i++) {
        let y = topM + spc*(i+0.5);
        mainCtx.shadowBlur=10; mainCtx.shadowColor=STRING_COLORS[i];
        mainCtx.strokeStyle=STRING_COLORS[i]; mainCtx.lineWidth=3; mainCtx.globalAlpha=0.4;
        mainCtx.beginPath(); mainCtx.moveTo(0,y); mainCtx.lineTo(width,y); mainCtx.stroke();
        mainCtx.shadowBlur=0; mainCtx.strokeStyle="white"; mainCtx.lineWidth=1; mainCtx.globalAlpha=0.7;
        mainCtx.beginPath(); mainCtx.moveTo(0,y); mainCtx.lineTo(width,y); mainCtx.stroke();
    }

    // Notes
    mainCtx.globalAlpha=1; const r=ACTIVE_RADIUS;
    CURRENT_NOTES.forEach(n => {
        let x = PLAYHEAD_X + (n.t - SCROLL_OFFSET) * ACTIVE_PPS;
        let y = topM + spc*(n.s + 0.5);
        if(x < -50 || x > width+50) return;

        if(n.sustain > 0) {
            mainCtx.fillStyle = STRING_COLORS[n.s]; mainCtx.globalAlpha=0.3;
            mainCtx.fillRect(x, y-r*0.3, n.sustain*ACTIVE_PPS, r*0.6);
        }
        mainCtx.globalAlpha=1;
        mainCtx.beginPath(); mainCtx.arc(x,y,r,0,Math.PI*2);
        mainCtx.strokeStyle=STRING_COLORS[n.s]; mainCtx.lineWidth=3; mainCtx.stroke();

        mainCtx.fillStyle="white"; mainCtx.font="bold 12px Arial"; mainCtx.textAlign="center"; mainCtx.textBaseline="middle";
        mainCtx.fillText(n.f, x, y);
    });

    // Loop
    if(LOOP_START!==-1 && LOOP_END!==-1) {
        let xs = PLAYHEAD_X + (Math.min(LOOP_START,LOOP_END)-SCROLL_OFFSET)*ACTIVE_PPS;
        let xe = PLAYHEAD_X + (Math.max(LOOP_START,LOOP_END)-SCROLL_OFFSET)*ACTIVE_PPS;
        mainCtx.fillStyle="rgba(0,255,0,0.1)"; mainCtx.fillRect(xs,0,xe-xs,height);
        mainCtx.fillStyle="#0F0"; mainCtx.fillRect(xs-2,0,4,height);
        mainCtx.fillStyle="#F00"; mainCtx.fillRect(xe-2,0,4,height);
    }

    // Playhead
    mainCtx.strokeStyle="#0FF"; mainCtx.lineWidth=2;
    mainCtx.beginPath(); mainCtx.moveTo(PLAYHEAD_X,0); mainCtx.lineTo(PLAYHEAD_X,height); mainCtx.stroke();

    let m = Math.floor(SCROLL_OFFSET/60);
    let s = Math.floor(SCROLL_OFFSET%60).toString().padStart(2,'0');
    document.getElementById('lblTime').textContent = `${m}:${s}`;
}

function drawMinimap() {
    if(!miniCtx) return;
    miniCtx.clearRect(0,0,miniWidth,miniHeight);
    miniCtx.fillStyle="#111"; miniCtx.fillRect(0,0,miniWidth,miniHeight);
    if(SONG_LENGTH<=0) return;

    // SCALING LOGIC FOR MINIMAP
    // If MINIMAP_ZOOM_FACTOR is 1.0, we show song from 0 to SONG_LENGTH
    // If 2.0, we show half the song centered on Playhead.

    const visibleDuration = SONG_LENGTH / MINIMAP_ZOOM_FACTOR;
    const halfVis = visibleDuration / 2;

    // Calculate start time of the minimap viewport
    let startT = SCROLL_OFFSET - halfVis;
    if (startT < 0) startT = 0;
    if (startT > SONG_LENGTH - visibleDuration) startT = SONG_LENGTH - visibleDuration;

    // Pixels per second on minimap
    const scaleX = miniWidth / visibleDuration;

    // Helper to map time to x
    const t2x = (t) => (t - startT) * scaleX;

    // Draw Loop Range
    if (LOOP_START !== -1 && LOOP_END !== -1) {
        let s = Math.min(LOOP_START, LOOP_END);
        let e = Math.max(LOOP_START, LOOP_END);
        let x1 = t2x(s);
        let x2 = t2x(e);
        // Only draw if visible
        if (x2 > 0 && x1 < miniWidth) {
            miniCtx.fillStyle="#334433";
            miniCtx.fillRect(x1, 0, x2-x1, miniHeight);
        }
    }

    // Draw Notes
    const stringH = miniHeight/6;
    CURRENT_NOTES.forEach(n => {
        // Optimization: only draw if in visible range
        if (n.t < startT || n.t > startT + visibleDuration) return;

        let mx = t2x(n.t);
        let my = n.s * stringH + stringH/2;
        miniCtx.fillStyle=STRING_COLORS[n.s];
        miniCtx.fillRect(mx, my-2, 2, 4);
    });

    // Draw Yellow Box (The Viewport of Main Window)
    // The main window shows `width / ACTIVE_PPS` seconds.
    const mainViewDuration = width / ACTIVE_PPS;
    const mainViewStartT = SCROLL_OFFSET - (PLAYHEAD_X / ACTIVE_PPS); // Start of main view relative to time
    // Actually, SCROLL_OFFSET is defined as the time at PLAYHEAD_X.
    // Wait, in drawMain: x = PLAYHEAD_X + (t - SCROLL_OFFSET) * PPS
    // Note at x=0: 0 = PLAYHEAD_X + (t - SCROLL_OFFSET)*PPS => t = SCROLL_OFFSET - PLAYHEAD_X/PPS
    // Note at x=width: t = SCROLL_OFFSET + (width - PLAYHEAD_X)/PPS

    let boxStartT = SCROLL_OFFSET - (PLAYHEAD_X / ACTIVE_PPS);
    let boxEndT = SCROLL_OFFSET + ((width - PLAYHEAD_X) / ACTIVE_PPS);

    let bx1 = t2x(boxStartT);
    let bx2 = t2x(boxEndT);

    miniCtx.strokeStyle="#FF0"; miniCtx.lineWidth=2;
    miniCtx.strokeRect(bx1, 1, bx2-bx1, miniHeight-2);
}

window.onload = init;