import { state, saveSettings } from './state.js';
import { parseFullXML, loadLevel } from './parser.js';
import { canvas, drawMain, drawMinimap, applyZoom } from './renderer.js';
import { PLAYHEAD_X } from './config.js';

let hoverTarget = 'main';

export function togglePlay(forceState = null) {
    if (forceState !== null) state.isPlaying = forceState;
    else state.isPlaying = !state.isPlaying;

    const btn = document.getElementById('btnPlayPause');
    if (btn) {
        if (state.isPlaying) {
            btn.textContent = "⏸ Pause";
            btn.style.background = "#aa4444";
        } else {
            btn.textContent = "▶ Play";
            btn.style.background = "#228B22";
        }
    }
}

function updateZoomUI(val) {
    state.zoomFactor = Math.max(0.2, Math.min(3.0, val));
    const s = document.getElementById('zoomSlider');
    const i = document.getElementById('zoomInput');
    if(s) s.value = state.zoomFactor;
    if(i) i.value = state.zoomFactor.toFixed(1);
    applyZoom();
    saveSettings();
}

function updateMiniZoomUI(val) {
    state.minimapZoomFactor = Math.max(1.0, Math.min(20.0, val));
    drawMinimap();
    saveSettings();
}

function updatePlaybackUI(val) {
    state.playbackSpeed = Math.max(0.01, Math.min(2.0, val));
    const s = document.getElementById('autoSpeedSlider');
    const i = document.getElementById('autoSpeedInput');
    if(s) s.value = Math.round(state.playbackSpeed * 100);
    if(i) i.value = Math.round(state.playbackSpeed * 100);
    saveSettings();
}

function loadFromLibrary(filename) {
    if(!filename) return;
    document.getElementById('loading').style.display = 'flex';
    togglePlay(false);
    fetch(`/staticsmith/api/load/${filename}/`)
    .then(r => r.json())
    .then(d => {
        if(d.xml_data) {
            parseFullXML(d.xml_data);
            state.lastLoadedId = filename;
            saveSettings();
            const sel = document.getElementById('selLibrary');
            if(sel) sel.value = filename;
        } else {
            alert("Error loading file.");
        }
        document.getElementById('loading').style.display = 'none';
    })
    .catch(err => {
        console.error(err);
        document.getElementById('loading').style.display = 'none';
    });
}

export function setupControls() {

    window.addEventListener('keydown', e => {
        if (e.ctrlKey) {
            if (e.key === "=" || e.key === "+") {
                e.preventDefault();
                if (hoverTarget === 'mini') updateMiniZoomUI(state.minimapZoomFactor * 1.25);
                else updateZoomUI(state.zoomFactor + 0.1);
            } else if (e.key === "-") {
                e.preventDefault();
                if (hoverTarget === 'mini') updateMiniZoomUI(state.minimapZoomFactor * 0.8);
                else updateZoomUI(state.zoomFactor - 0.1);
            }
        }
        if (e.shiftKey) {
            if (e.code === "Equal" || e.key === "+") {
                e.preventDefault();
                updatePlaybackUI(state.playbackSpeed + 0.01);
            } else if (e.code === "Minus" || e.key === "_" || e.key === "-") {
                e.preventDefault();
                updatePlaybackUI(state.playbackSpeed - 0.01);
            }
        }
        if (state.songLength <= 0) return;
        if (e.code === "Space") { e.preventDefault(); togglePlay(); }

        let jump = 0.5 * (state.keyboardSpeedMultiplier / 2);
        if (e.key === "ArrowRight") {
            state.scrollOffset = Math.min(state.songLength, state.scrollOffset + jump);
            drawMain(); drawMinimap();
        } else if (e.key === "ArrowLeft") {
            state.scrollOffset = Math.max(0, state.scrollOffset - jump);
            drawMain(); drawMinimap();
        }
    });

    const handleWheel = (e) => {
        if (e.ctrlKey) {
            e.preventDefault();
            const isZoomIn = e.deltaY < 0;
            if (e.target.id === 'minimapCanvas') {
                const factor = isZoomIn ? 1.03 : 0.97;
                updateMiniZoomUI(state.minimapZoomFactor * factor);
            } else {
                const delta = isZoomIn ? 0.1 : -0.1;
                updateZoomUI(state.zoomFactor + delta);
            }
        }
    };
    canvas.main.addEventListener('wheel', handleWheel, { passive: false });
    canvas.mini.addEventListener('wheel', handleWheel, { passive: false });
    canvas.main.addEventListener('mouseenter', () => hoverTarget = 'main');
    canvas.mini.addEventListener('mouseenter', () => hoverTarget = 'mini');

    const zs = document.getElementById('zoomSlider');
    const zi = document.getElementById('zoomInput');
    const onZ = (e) => updateZoomUI(parseFloat(e.target.value));
    if(zs) { zs.value=state.zoomFactor; zs.addEventListener('input', onZ); }
    if(zi) { zi.value=state.zoomFactor; zi.addEventListener('input', onZ); }

    const ss = document.getElementById('speedSlider');
    const si = document.getElementById('speedInput');
    const onS = (e) => { state.keyboardSpeedMultiplier = parseInt(e.target.value); if(ss)ss.value=state.keyboardSpeedMultiplier; if(si)si.value=state.keyboardSpeedMultiplier; saveSettings(); };
    if(ss) { ss.value=state.keyboardSpeedMultiplier; ss.addEventListener('input', onS); }
    if(si) { si.value=state.keyboardSpeedMultiplier; si.addEventListener('input', onS); }

    const ps = document.getElementById('autoSpeedSlider');
    const pi = document.getElementById('autoSpeedInput');
    const onP = (e) => updatePlaybackUI(parseInt(e.target.value)/100.0);
    if(ps) { ps.value=Math.round(state.playbackSpeed*100); ps.addEventListener('input', onP); }
    if(pi) { pi.value=Math.round(state.playbackSpeed*100); pi.addEventListener('input', onP); }

    document.getElementById('btnPlayPause').addEventListener('click', () => togglePlay());
    document.getElementById('file-upload').addEventListener('change', e => {
        const file = e.target.files[0];
        if(!file) return;
        document.getElementById('loading').style.display='flex';
        const r = new FileReader();
        r.onload = evt => {
            parseFullXML(evt.target.result);
            state.lastLoadedId = null;
            saveSettings();
            document.getElementById('loading').style.display='none';
        };
        r.readAsText(file);
    });
    document.getElementById('selDifficulty').addEventListener('change', e => loadLevel(e.target.value));

    const btnSave = document.getElementById('btnSaveCurrent');
    if(btnSave) btnSave.addEventListener('click', () => {
        const title = document.getElementById('lblTitle').textContent;
        const artist = document.getElementById('lblArtist').textContent;
        if(!state.currentXMLString) return alert("No song!");
        fetch('/staticsmith/api/save/', { method:'POST', body:JSON.stringify({title,artist,xml_data:state.currentXMLString}), headers:{'Content-Type':'application/json'}})
        .then(r=>r.json()).then(d=> { if(d.status==='success'){alert("Saved!"); refreshLibrary();} else alert("Error: "+d.message); });
    });

    const btnLoad = document.getElementById('btnLoadSaved');
    if(btnLoad) btnLoad.addEventListener('click', () => {
        const f = document.getElementById('selLibrary').value;
        if(!f) return alert("Select song");
        loadFromLibrary(f);
    });

    setupMouseInteractions();
}

export function refreshLibrary() {
    fetch('/staticsmith/api/library/')
    .then(r => r.json())
    .then(d => {
        const sel = document.getElementById('selLibrary');
        if(!sel) return;
        sel.innerHTML = '<option value="">-- Select Saved Song --</option>';
        d.songs.forEach(x => { let o = document.createElement('option'); o.value = x.id; o.text = x.name; sel.appendChild(o); });
        if (state.lastLoadedId) {
            const exists = d.songs.some(s => s.id === state.lastLoadedId);
            if (exists) { sel.value = state.lastLoadedId; loadFromLibrary(state.lastLoadedId); }
        }
    })
    .catch(err => console.log("Library error", err));
}

function setupMouseInteractions() {
    // MAIN CANVAS
    canvas.main.addEventListener('mousedown', e => {
        const rect = canvas.main.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        // 1. Shift+Drag (Manual Loop Creation)
        if (e.shiftKey) {
            // Calculate time at mouse click
            let t = state.scrollOffset + (mx - PLAYHEAD_X) / state.activePPS;
            t = Math.max(0, Math.min(state.songLength, t));

            // Set Start/End to this point and remember Anchor
            state.loopStart = t;
            state.loopEnd = t;
            state.loopAnchor = t;
            state.isCreatingLoopMain = true;

            drawMain(); drawMinimap();
            return;
        }

        // 2. Section Click
        if (my < 40 && state.sections.length > 0) {
            for(let i=0; i<state.sections.length; i++) {
                let sec = state.sections[i];
                let nextT = (i < state.sections.length-1) ? state.sections[i+1].t : state.songLength;
                let sx = PLAYHEAD_X + (sec.t - state.scrollOffset) * state.activePPS;
                let sw = (nextT - sec.t) * state.activePPS;
                if (mx >= sx && mx <= sx + sw) {
                    state.loopStart = sec.t; state.loopEnd = nextT; state.scrollOffset = sec.t;
                    drawMain(); drawMinimap(); saveSettings(); return;
                }
            }
        }

        // 3. Existing Loop Handles
        if (state.loopStart!==-1 && state.loopEnd!==-1) {
            const startX = PLAYHEAD_X + (state.loopStart - state.scrollOffset) * state.activePPS;
            const endX = PLAYHEAD_X + (state.loopEnd - state.scrollOffset) * state.activePPS;
            if(Math.abs(mx-startX) < 15) { state.isDraggingLoopStart=true; return; }
            if(Math.abs(mx-endX) < 15) { state.isDraggingLoopEnd=true; return; }
        }

        // 4. Standard Drag
        state.isDraggingMain = true; state.lastMouseX = e.clientX;
    });

    window.addEventListener('mouseup', () => {
        if(state.isDraggingLoopStart || state.isDraggingLoopEnd || state.isCreatingLoop || state.isCreatingLoopMain) saveSettings();
        state.isDraggingMain = false;
        state.isDraggingMini = false;
        state.isDraggingLoopStart = false;
        state.isDraggingLoopEnd = false;
        state.isCreatingLoop = false;
        state.isCreatingLoopMain = false;
    });

    canvas.main.addEventListener('mousemove', e => {
        const mx = e.clientX - canvas.main.getBoundingClientRect().left;

        // NEW: Creating Loop (Main Window)
        if (state.isCreatingLoopMain) {
            let t = state.scrollOffset + (mx - PLAYHEAD_X) / state.activePPS;
            t = Math.max(0, Math.min(state.songLength, t));

            // Expand from anchor
            state.loopStart = Math.min(state.loopAnchor, t);
            state.loopEnd = Math.max(state.loopAnchor, t);

            drawMain(); drawMinimap();
            return;
        }

        if(state.isDraggingLoopStart) {
            state.loopStart = Math.max(0, Math.min(state.scrollOffset + (mx-PLAYHEAD_X)/state.activePPS, state.loopEnd-0.1));
            drawMain(); drawMinimap(); return;
        }
        if(state.isDraggingLoopEnd) {
            state.loopEnd = Math.min(state.songLength, Math.max(state.scrollOffset + (mx-PLAYHEAD_X)/state.activePPS, state.loopStart+0.1));
            drawMain(); drawMinimap(); return;
        }
        if(state.isDraggingMain) {
            state.scrollOffset = Math.max(0, state.scrollOffset - (e.clientX - state.lastMouseX)/state.activePPS);
            state.lastMouseX = e.clientX;
            if(!state.isPlaying) { drawMain(); drawMinimap(); }
        }
    });

    // MINIMAP INTERACTIONS
    const getMiniTime = (cx) => {
        const visDur = state.songLength / state.minimapZoomFactor;
        let startT = state.scrollOffset - (visDur/2);
        if(startT < 0) startT = 0;
        if(startT > state.songLength - visDur) startT = state.songLength - visDur;
        return startT + (cx / state.miniWidth) * visDur;
    };

    canvas.mini.addEventListener('mousedown', e => {
        const cx = e.clientX - canvas.mini.getBoundingClientRect().left;
        if(e.shiftKey) {
            const t = getMiniTime(cx);
            state.loopStart = t; state.loopEnd = t; state.isCreatingLoop = true;
        } else {
            state.isDraggingMini = true;
            handleMinimapClick(e);
        }
    });

    canvas.mini.addEventListener('mousemove', e => {
        const cx = e.clientX - canvas.mini.getBoundingClientRect().left;
        if(state.isCreatingLoop) {
            const t = getMiniTime(cx);
            if(t < state.loopStart) state.loopEnd = state.loopStart; else state.loopEnd = t;
            drawMain(); drawMinimap();
        } else if (state.isDraggingMini) handleMinimapClick(e);
    });

    canvas.mini.addEventListener('dblclick', () => { state.loopStart=-1; state.loopEnd=-1; saveSettings(); drawMain(); drawMinimap(); });
}

function handleMinimapClick(e) {
    if(state.songLength <= 0) return;
    const cx = e.clientX - canvas.mini.getBoundingClientRect().left;
    const visDur = state.songLength / state.minimapZoomFactor;
    let startT = state.scrollOffset - (visDur/2);
    if(startT < 0) startT = 0; if(startT > state.songLength - visDur) startT = state.songLength - visDur;

    state.scrollOffset = Math.max(0, Math.min(state.songLength, startT + (cx / state.miniWidth) * visDur));
    if(!state.isPlaying) { drawMain(); drawMinimap(); }
}