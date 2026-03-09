export class AudioEngine {
    constructor(volFloor = 0.005) {
        this.ctx = null;
        this.analyser = null;
        this.isListening = false;
        this.volFloor = volFloor;
    }

    async init() {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.ctx = new AudioContext();
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 4096;
        this.ctx.createMediaStreamSource(stream).connect(this.analyser);
        this.isListening = true;
    }

    getPitch() {
        // Logic from your existing autoCorrelate function
    }
}
