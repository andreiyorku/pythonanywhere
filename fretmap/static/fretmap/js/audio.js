/**
 * FRETMAP AUDIO ENGINE - v12
 * Responsibility: Pitch detection and raw signal processing.
 */

// Global audio state
var audioCtx, analyser, dataArray, isListening = false, lastRMS = 0;

console.log("%c[AUDIO] Engine script loaded.", "color: #2196f3; font-weight: bold;");

/**
 * Request microphone access and setup the Web Audio graph.
 * Triggered by the "START MICROPHONE" button in ui.js.
 */
async function initAudio() {
    console.log("[AUDIO] Requesting microphone access...");
    
    try {
        // 1. Browser Compatibility Check
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert("Your browser does not support microphone access in this context (must be localhost or HTTPS).");
            return;
        }

        // 2. Stream Acquisition
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: { 
                echoCancellation: false, 
                autoGainControl: false, 
                noiseSuppression: false 
            } 
        });

        // 3. Context & Node Setup
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 4096; // High resolution for pitch detection

        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        dataArray = new Float32Array(analyser.fftSize);
        isListening = true;

        console.log("%c[AUDIO] Stream active and routing to Analyser.", "color: #4caf50;");
        
        // 4. Start Processing Loop
        audioLoop();

        // 5. Signal the Game Engine that we are ready to play
        if (typeof onAudioReady === 'function') {
            onAudioReady();
        } else {
            console.warn("[AUDIO] Handshake failed: onAudioReady not found in game.js.");
        }

    } catch (err) {
        console.error("[AUDIO] Microphone Error:", err);
        if (err.name === 'NotAllowedError') {
            alert("Permission denied. Please click the lock icon in your address bar and allow the microphone.");
        } else {
            alert("Error accessing microphone: " + err.name);
        }
    }
}

/**
 * Autocorrelation algorithm to find the fundamental frequency (pitch).
 */
function autoCorrelate(buf, sampleRate) {
    // 1. Calculate RMS (Volume)
    let rms = 0;
    for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / buf.length);

    // 2. Signal Floor Check (Is it too quiet?)
    // Uses the global VOL_FLOOR defined in ui.js, defaults to 0.005
    const floor = (typeof VOL_FLOOR !== 'undefined') ? VOL_FLOOR : 0.005;
    if (rms < floor) return { pitch: -1, rms: rms };

    // 3. Simple Autocorrelation
    let r1 = 0, r2 = buf.length - 1, thres = 0.2;
    for (let i = 0; i < buf.length / 2; i++) {
        if (Math.abs(buf[i]) < thres) { r1 = i; break; }
    }
    for (let i = 1; i < buf.length / 2; i++) {
        if (Math.abs(buf[buf.length - i]) < thres) { r2 = buf.length - i; break; }
    }

    let subBuf = buf.slice(r1, r2);
    let c = new Array(subBuf.length).fill(0);
    for (let i = 0; i < subBuf.length; i++) {
        for (let j = 0; j < subBuf.length - i; j++) {
            c[i] = c[i] + subBuf[j] * subBuf[j + i];
        }
    }

    let d = 0; while (c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < subBuf.length; i++) {
        if (c[i] > maxval) {
            maxval = c[i];
            maxpos = i;
        }
    }

    return { pitch: sampleRate / maxpos, rms: rms };
}

/**
 * High-frequency loop for real-time analysis.
 */
function audioLoop() {
    if (!isListening) return;

    // Pull raw time-domain data
    analyser.getFloatTimeDomainData(dataArray);

    // Get Pitch
    let res = autoCorrelate(dataArray, audioCtx.sampleRate);

    // Update the live visualizer in ui.js
    if (typeof updateMonitor === 'function') {
        updateMonitor(res);
    }

    // Pass the results to the game logic in game.js
    if (typeof processAudioResults === 'function') {
        processAudioResults(res.pitch, res.rms);
    }

    lastRMS = res.rms;

    // Schedule next frame
    requestAnimationFrame(audioLoop);
}