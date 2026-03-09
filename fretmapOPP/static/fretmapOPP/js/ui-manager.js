export class UIManager {
    updateNote(noteName, stringInfo) {
        document.getElementById('big-note').innerText = noteName;
        document.getElementById('string-info').innerText = stringInfo;
    }

    updateProgress(calibrated, total, masteryPct) {
        document.getElementById('calib-pct').innerText = `${calibrated}/${total}`;
        document.getElementById('mastery-fill').style.width = `${masteryPct}%`;
    }
}