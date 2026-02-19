// --- AUDIO ENGINE STATE ---
let audioCtx, analyser, dataArray;
let isListening = false;

const STRINGS = [
    { name: "E", freq: 82.41 }, { name: "A", freq: 110.00 }, { name: "D", freq: 146.83 },
    { name: "G", freq: 196.00 }, { name: "B", freq: 246.94 }, { name: "E", freq: 329.63 }
];

let lastRMS = 0;
let VOL_FLOOR = 0.005;
let ATTACK_THRESH = 1.5;

// --- INITIALIZATION ---
async function initAudioEngine() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, autoGainControl: false, noiseSuppression: false }
    });

    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 4096;
    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);
    dataArray = new Float32Array(analyser.fftSize);

    isListening = true;
    requestAnimationFrame(audioLoop);
}

// --- CONTINUOUS LISTENING LOOP ---
function audioLoop() {
    if (!isListening) return;

    analyser.getFloatTimeDomainData(dataArray);
    let result = autoCorrelate(dataArray, audioCtx.sampleRate);

    // Update the visual monitor (Function in ui.js)
    updateMonitor(result);

    // Pass detection to the game logic (Function in game.js)
    if (typeof runGameLogic === "function") {
        runGameLogic(result.pitch, result.rms);
    }

    lastRMS = result.rms;
    requestAnimationFrame(audioLoop);
}

// --- PITCH DETECTION MATH ---
function autoCorrelate(buf, sampleRate) {
    let SIZE = buf.length;
    let rms = 0;
    for (let i=0; i<SIZE; i++) { rms += buf[i]*buf[i]; }
    rms = Math.sqrt(rms/SIZE);

    if (rms < VOL_FLOOR) return { pitch: -1, rms: rms };

    let r1=0, r2=SIZE-1, thres=0.2;
    for (let i=0; i<SIZE/2; i++) if (Math.abs(buf[i])<thres) { r1=i; break; }
    for (let i=1; i<SIZE/2; i++) if (Math.abs(buf[SIZE-i])<thres) { r2=SIZE-i; break; }
    let subBuf = buf.slice(r1, r2);
    let c = new Array(subBuf.length).fill(0);
    for (let i=0; i<subBuf.length; i++)
        for (let j=0; j<subBuf.length-i; j++) c[i] = c[i] + subBuf[j]*subBuf[j+i];
    let d=0; while (c[d]>c[d+1]) d++;
    let maxval=-1, maxpos=-1;
    for (let i=d; i<subBuf.length; i++) if (c[i] > maxval) { maxval = c[i]; maxpos = i; }

    return { pitch: sampleRate/maxpos, rms: rms };
}