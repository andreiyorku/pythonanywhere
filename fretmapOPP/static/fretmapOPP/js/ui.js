export class UIManager {
    constructor() {
        this.colors = { accent: '#4caf50', target: '#2e7d32' };
    }

    updateNoteDisplay(note, detail) {
        document.getElementById('big-note').innerText = note;
        document.getElementById('string-info').innerText = detail;
    }

    updateMastery(percent) {
        const fill = document.getElementById('mastery-fill');
        if (fill) fill.style.width = `${percent}%`;
    }

    showOverlay(id, show) {
        const el = document.getElementById(id);
        if (el) el.style.display = show ? 'flex' : 'none';
    }
}