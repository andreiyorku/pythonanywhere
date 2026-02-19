import { state } from './state.js';
import { STRINGS } from './config.js';
import { applyZoom, drawMain, drawMinimap } from './renderer.js';

export function parseFullXML(xmlString) {
    state.currentXMLString = xmlString;
    const parser = new DOMParser();
    state.rawXML = parser.parseFromString(xmlString, "text/xml");

    // Metadata
    const title = getTag(state.rawXML, "title");
    const artist = getTag(state.rawXML, "artistName");
    document.getElementById('lblTitle').textContent = title;
    document.getElementById('lblArtist').textContent = artist;

    const sl = getTag(state.rawXML, "songLength");
    state.songLength = sl ? parseFloat(sl) : 200;

    const btnSave = document.getElementById('btnSaveCurrent');
    if(btnSave) btnSave.style.display = 'block';

    // Templates
    state.chordTemplates = {};
    const tpls = state.rawXML.getElementsByTagName("chordTemplate");
    for(let i=0; i<tpls.length; i++) {
        let f = {};
        for(let s=0; s<STRINGS; s++) {
            let v = tpls[i].getAttribute("finger"+s);
            if(v) f[s]=parseInt(v);
        }
        state.chordTemplates[i] = f;
    }

    // Sections
    state.sections = [];
    state.rawXML.querySelectorAll("sections > section").forEach(n => {
        state.sections.push({
            name: n.getAttribute("name"),
            t: parseFloat(n.getAttribute("startTime"))
        });
    });

    // Levels
    state.levels = {};
    const lvls = state.rawXML.querySelectorAll("levels > level");
    const selDiff = document.getElementById('selDifficulty');
    if(selDiff) {
        selDiff.innerHTML = ""; selDiff.disabled = false;
        lvls.forEach((n, i) => {
            let c = n.querySelectorAll("notes > note").length;
            state.levels[i] = { node: n, count: c };
            let opt = document.createElement("option");
            opt.value = i; opt.text = `Lvl ${n.getAttribute("difficulty")} (${c})`;
            selDiff.appendChild(opt);
        });
        if(lvls.length > 0) {
            selDiff.value = lvls.length - 1;
            loadLevel(lvls.length - 1);
        }
    }
}

export function loadLevel(idx) {
    const lvl = state.levels[idx].node;
    state.currentNotes = [];
    state.currentAnchors = [];

    // Anchors
    let anchors = lvl.querySelectorAll("anchors > anchor");
    if(anchors.length===0) anchors = state.rawXML.querySelectorAll("transcriptionTrack > anchors > anchor");
    anchors.forEach(a => state.currentAnchors.push({ t: parseFloat(a.getAttribute("time")), fret: parseInt(a.getAttribute("fret")) }));
    state.currentAnchors.sort((a,b)=>a.t-b.t);

    // Notes
    const proc = (n, isC=false, f=-1) => {
        let lh = n.getAttribute("leftHand") || n.getAttribute("finger");
        if(lh) f = parseInt(lh);
        if(f===-1) f = calcFinger(parseFloat(n.getAttribute("time")), parseInt(n.getAttribute("fret")));
        state.currentNotes.push({
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
        let tpl = state.chordTemplates[cid] || {};
        if(c.hasAttribute("fret")) {
            let s = parseInt(c.getAttribute("string"));
            proc(c, true, tpl[s]!==undefined ? tpl[s] : -1);
        }
        c.querySelectorAll("chordNote").forEach(cn => {
            let s = parseInt(cn.getAttribute("string"));
            proc(cn, true, tpl[s]!==undefined ? tpl[s] : -1);
        });
    });

    state.currentNotes.sort((a,b)=>a.t-b.t);
    applyZoom();
    if(state.currentNotes.length>0) state.scrollOffset = Math.max(0, state.currentNotes[0].t - 2.0);
    drawMain(); drawMinimap();
}

function calcFinger(time, fret) {
    if(fret===0) return 0;
    let af = 1;
    for(let i=state.currentAnchors.length-1; i>=0; i--) {
        if(state.currentAnchors[i].t <= time) { af=state.currentAnchors[i].fret; break; }
    }
    let f = fret - af + 1;
    return Math.max(1, Math.min(4, f));
}

function getTag(xml, tag) {
    const el = xml.querySelector(tag);
    return el ? el.textContent : "";
}