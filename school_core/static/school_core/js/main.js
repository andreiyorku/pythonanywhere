import { state } from './Store.js';
import ApiService from './ApiService.js';
import UI from './UI.js';
import AuthController from './Auth.js';
import QuizController from './Quiz.js';
import ContentController from './Content.js';

// ==========================================
// --- GLOBAL APP EXPORTS ---
// Because ES6 modules are scoped, we expose specific methods
// to the 'window.App' object so inline HTML 'onclick=' works.
// ==========================================
window.App = {
    // Auth
    logout: () => AuthController.logout(),
    toggleAuthMode: () => AuthController.toggleMode(),
    performAuth: () => AuthController.performAuth(router),

    // UI
    openImageModal: (src) => UI.openImageModal(src),

    // Quiz
    startQuiz: (returnTo) => QuizController.start(returnTo, router),
    nextQuestion: () => QuizController.nextQuestion(),

    // Hub / Courses
    addCourse: () => ContentController.addCourse(),
    handleChapterCheck: (cid, el) => ContentController.handleChapterCheck(cid, el),

    // Chapters / Notes
    addChapter: () => ContentController.addChapter(),
    addNote: () => ContentController.addNote(),

    // Router access
    router: (view) => router(view)
};


// ==========================================
// --- ROUTER ENGINE ---
// ==========================================
async function router(viewName) {
    // Auto-sync remaining progress when leaving the quiz view
    if (viewName !== 'quiz') {
        if (state.gitSyncInterval) {
            clearInterval(state.gitSyncInterval);
            state.gitSyncInterval = null;
        }
        if (state.pendingGitSync) {
            ApiService.post({ action: 'trigger_git_sync' });
            state.pendingGitSync = false;
        }
    }

    const container = document.getElementById('content-slot');
    try {
        const res = await fetch(`/school_core/partial/${viewName}/`);
        if(!res.ok) throw new Error("View not found");
        const html = await res.text();
        container.innerHTML = html;
    } catch (err) {
        console.error(err);
        return;
    }

    if (viewName === 'auth') return;
    if (viewName === 'hub') ContentController.loadCourses();

    if (viewName === 'course') {
        if(state.courseId) {
            document.getElementById('course-title').innerText = state.courseName;
            const resetBtn = document.getElementById('btn-top-reset-course');
            if (resetBtn) {
                if (state.isAdmin || state.courseOwner === state.userId) resetBtn.style.display = 'block';
                else resetBtn.style.display = 'none';
            }
            ContentController.loadChapters();
        }
    }

    if (viewName === 'chapter') {
        if(state.chapterId) {
            document.getElementById('chapter-title').innerText = state.chapterName;
            ContentController.loadNotes();
        }
    }

    if (viewName === 'quiz') {
        document.getElementById('quiz-quit-btn').setAttribute('onclick', `window.App.router('${state.quizReturnView}')`);
        QuizController.nextQuestion();
    }
}


// ==========================================
// --- GLOBAL EVENT LISTENERS (Paste Files) ---
// ==========================================
window.addEventListener('paste', e => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    let file = null;
    for (let item of items) {
        if (item.type.indexOf('image') === 0) {
            file = item.getAsFile();
            break;
        }
    }
    if (!file) return;

    const active = document.activeElement;
    if (!active) return;

    // Pasting into Add Note
    if (active.id === 'note-header') {
        state.pendingHeaderFile = file;
        const preview = document.getElementById(`preview-text-header`);
        if(preview) { preview.innerText = "Selected: " + file.name; preview.style.display = 'block'; }
        return;
    }
    if (active.id === 'note-body') {
        state.pendingBodyFiles.push(file);
        const preview = document.getElementById(`preview-text-body`);
        if(preview) { preview.innerText = state.pendingBodyFiles.length + " images selected"; preview.style.display = 'block'; }
        return;
    }

    // Pasting into Edit Note
    if (active.classList.contains('edit-header-text')) {
        const container = active.closest('.note-edit') || active.closest('.q-edit-mode');
        if (container) {
            const fileInput = container.querySelector('.edit-header-file');
            const dt = new DataTransfer(); dt.items.add(file); fileInput.files = dt.files;
            active.style.backgroundColor = "#e8f0fe"; setTimeout(() => active.style.backgroundColor = "", 200);
        }
    }
    else if (active.classList.contains('edit-body-text')) {
        const container = active.closest('.note-edit') || active.closest('.q-edit-mode');
        if (container) {
            const fileInput = container.querySelector('.edit-body-file');
            const dt = new DataTransfer();
            for(let i=0; i<fileInput.files.length; i++) dt.items.add(fileInput.files[i]);
            dt.items.add(file); fileInput.files = dt.files;
            active.style.backgroundColor = "#e8f0fe"; setTimeout(() => active.style.backgroundColor = "", 200);
        }
    }
});


// ==========================================
// --- BOOTSTRAP ---
// ==========================================
window.onload = function() {
    // Kick off the application by checking if the user's session is alive
    AuthController.checkLogin(router);
};