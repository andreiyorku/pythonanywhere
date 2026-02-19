// --- AUDIO STATE ---
let audioCtx, analyser, dataArray;
let isListening = false;
let lastRMS = 0;

const STRINGS = [
    { name: "E", freq: 82.41 }, { name: "A", freq: 110.00 }, { name: "D", freq: 146.83 },
    { name: "G", freq: 196.00 }, { name: "B", freq: 246.94 }, { name: "E", freq: 329.63 }
];

// Start button triggers this
async function initAudio() {
    document.getElementById('start-btn').style.display = 'none';
    document.getElementById('calib-msg').innerText = "Play Low E (Thickest)";

    // --> ADDED: Trigger DB Load from game.js
    loadDatabaseHistory();

    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, autoGainControl: false, noiseSuppression: false } });
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 4096;
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        dataArray = new Float32Array(analyser.fftSize);
        isListening = true;
        loop();
    } catch(e) { alert("Mic Error: " + e); }
}

function analyzeAudio(buf, sampleRate) {
    let SIZE = buf.length;
    let rms = 0;
    for (let i=0; i<SIZE; i++) { let val = buf[i]; rms += val*val; }
    rms = Math.sqrt(rms/SIZE);

    let pitch = -1;
    if (rms > VOL_FLOOR) {
        let r1=0, r2=SIZE-1, thres=0.2;
        for (let i=0; i<SIZE/2; i++) if (Math.abs(buf[i])<thres) { r1=i; break; }
        for (let i=1; i<SIZE/2; i++) if (Math.abs(buf[SIZE-i])<thres) { r2=SIZE-i; break; }
        let subBuf = buf.slice(r1, r2);
        let subSize = subBuf.length;
        let c = new Array(subSize).fill(0);
        for (let i=0; i<subSize; i++) for (let j=0; j<subSize-i; j++) c[i] = c[i] + subBuf[j]*subBuf[j+i];
        let d=0; while (c[d]>c[d+1]) d++;
        let maxval=-1, maxpos=-1;
        for (let i=d; i<subSize; i++) if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
        pitch = sampleRate/maxpos;
    }
    return { rms: rms, pitch: pitch };
}

function loop() {
    analyser.getFloatTimeDomainData(dataArray);
    let analysis = analyzeAudio(dataArray, audioCtx.sampleRate);

    updateMonitor(analysis);

    if(phase === 'CALIB') runCalib(analysis.pitch);
    else runGame(analysis.pitch, analysis.rms);

    lastRMS = analysis.rms;

    if(isListening) requestAnimationFrame(loop);
}