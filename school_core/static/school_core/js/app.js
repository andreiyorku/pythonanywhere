// --- STATE MANAGEMENT ---
let currentCourseId = null;
let currentCourseName = "";
let currentChapterId = null;
let currentChapterName = "";
let quizQueue = [];
let currentQuizItem = null;
let currentQuizChapterIds = [];
let pendingImageFile = null;
let lastQuizItemId = null;
let quizReturnView = 'hub';
let isRegisterMode = false;
let currentUserIsAdmin = false; // NEW STATE
let currentUserId = null; // NEW
let currentUserIsAdmin = false;

// --- API ENGINE ---
async function api(payload, isFile = false) {
    let options = { method: 'POST' };

    if (isFile) {
        options.body = payload;
    } else {
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify(payload);
    }

    try {
        const res = await fetch('/school_core/api/', options);
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return await res.json();
    } catch (err) {
        console.error("API Error:", err);
        return null;
    }
}

// --- AUTHENTICATION ---
async function checkLogin() {
    const data = await api({ action: 'get_current_user' });

    if (data && data.username) {
        currentUserId = data.id; // <--- SAVE ID
        currentUserIsAdmin = data.is_admin; // <--- SAVE THIS
        console.log("Logged in as:", data.username, "Admin:", currentUserIsAdmin);

        updateUserDisplay(data.username);
        router('hub');
    } else {
        router('auth');
    }
}

async function performAuth() {
    const user = document.getElementById('auth-username').value;
    const pass = document.getElementById('auth-password').value;
    const errorBox = document.getElementById('auth-error');

    if (!user || !pass) return alert("Please enter both fields.");

    const action = isRegisterMode ? 'register' : 'login';

    const data = await api({ action: action, username: user, password: pass });

    if (data.status === 'success') {
        // Success! Go to Hub
        checkLogin();
    } else {
        // Show Error
        errorBox.innerText = data.error || "Authentication failed";
        errorBox.style.display = 'block';
    }
}

function toggleAuthMode() {
    isRegisterMode = !isRegisterMode;
    const title = document.getElementById('auth-title');
    const btn = document.getElementById('auth-btn');
    const toggle = document.getElementById('auth-toggle-text');
    const errorBox = document.getElementById('auth-error');

    errorBox.style.display = 'none';

    if (isRegisterMode) {
        title.innerText = "Create Account";
        btn.innerText = "Sign Up";
        toggle.innerHTML = 'Already have an account? <a href="#" onclick="toggleAuthMode()">Login</a>';
    } else {
        title.innerText = "Login";
        btn.innerText = "Login";
        toggle.innerHTML = 'New here? <a href="#" onclick="toggleAuthMode()">Create an account</a>';
    }
}

async function logout() {
    await api({ action: 'logout' });
    location.reload(); // Refresh page to clear state
}

function updateUserDisplay(username) {
    // Create a small "Hello, User (Logout)" banner at the top
    let banner = document.getElementById('user-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'user-banner';
        banner.style.cssText = "position: absolute; top: 10px; right: 10px; background: #eee; padding: 5px 10px; border-radius: 4px;";
        document.body.prepend(banner);
    }
    banner.innerHTML = `<b>${username}</b> | <a href="#" onclick="logout()">Logout</a>`;
}

// --- ROUTER ---
async function router(viewName) {
    const container = document.getElementById('content-slot');

    try {
        const res = await fetch(`/school_core/partial/${viewName}/`);
        if(!res.ok) throw new Error("View not found");
        const html = await res.text();
        container.innerHTML = html;

        if(viewName === 'chapter') attachImageHandlers();

    } catch (err) {
        console.error(err);
        return;
    }

    if (viewName === 'auth') {
        // No special data needed, just show the form
        return;
    }

    if (viewName === 'hub') {
        loadCourses();
    }

    if (viewName === 'course') {
        if(currentCourseId) {
            document.getElementById('course-title').innerText = currentCourseName;
            loadChapters();
        }
    }

    if (viewName === 'chapter') {
        if(currentChapterId) {
            document.getElementById('chapter-title').innerText = currentChapterName;
            loadNotes();
        }
    }

    if (viewName === 'quiz') {
        const btn = document.getElementById('quiz-quit-btn');
        if(btn) btn.setAttribute('onclick', `router('${quizReturnView}')`);
        nextQuestion();
    }
}


// --- IMAGE HANDLING ---
function setMode(mode) {
    document.getElementById('mode-text').style.display = (mode === 'text') ? 'block' : 'none';
    document.getElementById('mode-image').style.display = (mode === 'image') ? 'block' : 'none';
}

function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    pendingImageFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = document.getElementById('preview-img');
        img.src = e.target.result;
        img.style.display = 'block';
        document.getElementById('drop-area').innerText = "Selected: " + file.name;
    };
    reader.readAsDataURL(file);
}

function attachImageHandlers() {
    const dropArea = document.getElementById('drop-area');
    if(dropArea) {
        dropArea.onclick = () => document.getElementById('file-input').click();
        dropArea.addEventListener('dragover', (e) => { e.preventDefault(); dropArea.style.backgroundColor = '#e0e0e0'; });
        dropArea.addEventListener('dragleave', (e) => { e.preventDefault(); dropArea.style.backgroundColor = 'white'; });
        dropArea.addEventListener('drop', (e) => {
            e.preventDefault();
            dropArea.style.backgroundColor = 'white';
            if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
        });
    }
}

window.addEventListener('paste', (e) => {
    const dropArea = document.getElementById('drop-area');
    if (dropArea) {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let item of items) {
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                const radio = document.querySelector('input[name="nType"][onclick*="image"]');
                if(radio) { radio.click(); radio.checked = true; }
                handleFile(item.getAsFile());
            }
        }
    }
});

// --- HELPER: RENDER BODY ---
function renderContent(text) {
    if (text && text.startsWith('IMG:')) {
        const url = text.substring(4);
        return `<img src="${url}" style="max-width:300px; display:block; border:1px solid #ccc; margin-top:5px;">`;
    }
    return `<div>${text}</div>`;
}


// --- VIEW LOGIC: HUB ---
async function loadCourses() {
    const data = await api({ action: 'get_courses' });
    const list = document.getElementById('course-list');
    const template = document.getElementById('course-template');

    list.innerHTML = '';
    if(!data || !data.courses) return;

    // SAFETY CHECK: Ensure template exists before running
    if (!template) {
        console.error("ERROR: <template id='course-template'> is missing in hub.html");
        return;
    }

    data.courses.forEach(c => {
        const clone = template.content.cloneNode(true);

        clone.querySelector('.course-name').innerText = c.name;

        const checkbox = clone.querySelector('.course-check');
        checkbox.onchange = () => toggleCourseSelection(checkbox, c.id);

        const btnExpand = clone.querySelector('.btn-expand');
        btnExpand.onclick = () => toggleHubChapters(c.id);

        const btnOpen = clone.querySelector('.btn-open');
        btnOpen.onclick = () => openCourse(c.id, c.name);

        const btnDelete = clone.querySelector('.btn-delete');
        // Allow if Admin OR if I own it
        if (currentUserIsAdmin || (currentUserId && c.owner_id === currentUserId)) {
            btnDelete.onclick = () => deleteCourse(c.id);
        } else {
            btnDelete.style.display = 'none';
        }

        clone.querySelector('.hub-chapters-container').id = `hub-chapters-${c.id}`;

        list.appendChild(clone);
    });
}

async function addCourse() {
    const name = document.getElementById('new-course-name').value;
    if(!name) return;
    await api({ action: 'add_course', name: name });
    document.getElementById('new-course-name').value = '';
    loadCourses();
}

async function deleteCourse(id) {
    if(confirm("Delete this Subject?")) {
        const res = await api({ action: 'delete_course', course_id: id });

        if (res && res.error) {
            alert(res.error);
        } else {
            loadCourses();
        }
    }
}

// NEW: Load chapters for the Hub view (Lazy Loading)
async function toggleHubChapters(courseId) {
    const container = document.getElementById(`hub-chapters-${courseId}`);

    if (container.style.display === 'none') {
        container.style.display = 'block';

        if (container.innerHTML === '') {
            container.innerText = "Loading...";
            const data = await api({ action: 'get_chapters', course_id: courseId });
            container.innerHTML = '';

            if (data && data.chapters) {
                const template = document.getElementById('hub-chapter-template');

                data.chapters.forEach(c => {
                    const clone = template.content.cloneNode(true);

                    const checkbox = clone.querySelector('.chap-select');
                    checkbox.value = c.id;
                    checkbox.classList.add(`course-chap-${courseId}`);

                    clone.querySelector('.chap-name').innerText = c.name;
                    container.appendChild(clone);
                });
            } else {
                container.innerHTML = "<em>No chapters found.</em>";
            }
        }
    } else {
        container.style.display = 'none';
    }
}

async function toggleCourseSelection(masterCheckbox, courseId) {
    const container = document.getElementById(`hub-chapters-${courseId}`);
    if (container.innerHTML === '') {
        await toggleHubChapters(courseId);
    }
    if (masterCheckbox.checked) container.style.display = 'block';

    const children = document.querySelectorAll(`.course-chap-${courseId}`);
    children.forEach(child => child.checked = masterCheckbox.checked);
}

// --- VIEW LOGIC: COURSE ---
async function openCourse(id, name) {
    currentCourseId = id;
    currentCourseName = name;
    router('course');
}

async function loadChapters() {
    const data = await api({ action: 'get_chapters', course_id: currentCourseId });
    const list = document.getElementById('chapter-list');
    const template = document.getElementById('chapter-row-template');

    list.innerHTML = '';
    if(!data || !data.chapters) return;

    data.chapters.forEach(c => {
        const clone = template.content.cloneNode(true);

        clone.querySelector('.chap-label').innerText = `Index ${c.index}: ${c.name}`;

        const checkbox = clone.querySelector('.chap-select');
        checkbox.value = c.id;

        const btnNotes = clone.querySelector('.btn-notes');
        btnNotes.onclick = () => openChapter(c.id, c.name);

        // --- UPDATED: HIDE DELETE IF NOT ADMIN ---
        const btnDelete = clone.querySelector('.btn-delete');
        if (currentUserIsAdmin || (currentUserId && c.owner_id === currentUserId)) {
            btnDelete.onclick = () => deleteChapter(c.id);
        } else {
            btnDelete.style.display = 'none';
        }

        list.appendChild(clone);
    });
}

async function addChapter() {
    const name = document.getElementById('new-chap-name').value;
    const index = document.getElementById('new-chap-index').value;
    await api({ action: 'add_chapter', course_id: currentCourseId, name: name, index: index });
    loadChapters();
}

async function deleteChapter(id) {
    if(confirm("Delete this Chapter? All notes inside it will be lost.")) {
        const res = await api({ action: 'delete_chapter', chapter_id: id });

        if (res && res.error) {
            alert(res.error);
        } else {
            loadChapters();
        }
    }
}

// --- VIEW LOGIC: CHAPTER ---
async function openChapter(id, name) {
    currentChapterId = id;
    currentChapterName = name;
    router('chapter');
}

async function loadNotes() {
    const data = await api({ action: 'get_notes', chapter_id: currentChapterId });
    const list = document.getElementById('notes-list');
    const template = document.getElementById('note-item-template');

    list.innerHTML = '';
    if(!data || !data.notes) return;

    data.notes.forEach(n => {
        const clone = template.content.cloneNode(true);

        clone.querySelector('.note-header').innerText = n.header;
        clone.querySelector('.note-body').innerHTML = renderContent(n.body);
        clone.querySelector('.note-weight').innerText = n.weight;

        // --- UPDATED: HIDE DELETE IF NOT ADMIN ---
        const btnDelete = clone.querySelector('.btn-delete');
        if (currentUserIsAdmin || (currentUserId && n.owner_id === currentUserId)) {
            btnDelete.onclick = () => deleteNote(n.id);
        } else {
            btnDelete.style.display = 'none';
        }

        list.appendChild(clone);
    });
}

async function addNote() {
    const header = document.getElementById('note-header').value;
    if (!header) { alert("Header required"); return; }

    const isImageMode = document.getElementById('mode-image').style.display !== 'none';

    if (isImageMode && pendingImageFile) {
        const formData = new FormData();
        formData.append('action', 'add_note');
        formData.append('chapter_id', currentChapterId);
        formData.append('header', header);
        formData.append('image_file', pendingImageFile);
        await api(formData, true);
    } else {
        const body = document.getElementById('note-body').value;
        await api({ action: 'add_note', chapter_id: currentChapterId, header: header, body: body });
    }

    document.getElementById('note-header').value = '';
    if(document.getElementById('note-body')) document.getElementById('note-body').value = '';
    pendingImageFile = null;
    if(document.getElementById('preview-img')) document.getElementById('preview-img').style.display = 'none';
    if(document.getElementById('drop-area')) document.getElementById('drop-area').innerText = "Paste Image (Ctrl+V), Drag & Drop, or Click here";

    loadNotes();
}

async function deleteNote(id) {
    if(confirm("Delete?")) {
        const res = await api({ action: 'delete_note', note_id: id });

        if (res && res.error) {
            alert(res.error);
        } else {
            loadNotes();
        }
    }
}

// --- VIEW LOGIC: QUIZ ENGINE ---
async function startQuiz(returnTo = 'hub') {
    quizReturnView = returnTo;

    const boxes = document.querySelectorAll('.chap-select:checked');
    const ids = Array.from(boxes).map(b => b.value);
    if(ids.length === 0) return alert("Select chapters");

    const data = await api({ action: 'init_quiz', chapter_ids: ids });

    if (!data.deck || data.deck.length === 0) {
        alert("No notes found in these chapters.");
        return;
    }

    quizDeck = data.deck;
    router('quiz');
}

async function nextQuestion() {
    const container = document.getElementById('quiz-container');

    if (quizDeck.length === 0) {
        container.innerHTML = "<h3>Error: Deck empty.</h3>";
        return;
    }

    container.innerHTML = "<h3>Calculating...</h3>";

    let winner = null;
    let maxScore = -1;
    const candidates = (quizDeck.length > 1 && lastQuizItemId)
        ? quizDeck.filter(n => n.id !== lastQuizItemId)
        : quizDeck;

    candidates.forEach(note => {
        let score = note.w * Math.random();
        if (score > maxScore) {
            maxScore = score;
            winner = note;
        }
    });

    lastQuizItemId = winner.id;
    currentQuizItem = winner;

    const content = await api({ action: 'get_content', note_id: winner.id });

    container.innerHTML = '';
    const template = document.getElementById('quiz-card-template');
    const clone = template.content.cloneNode(true);

    clone.querySelector('.q-header').innerText = content.header;
    clone.querySelector('.q-body').innerHTML = renderContent(content.body);
    clone.querySelector('.q-weight').innerText = winner.w.toExponential(2);

    const ansArea = clone.querySelector('.q-answer-area');
    const btnShow = clone.querySelector('.btn-show-answer');
    btnShow.onclick = () => { ansArea.style.display = 'block'; };

    clone.querySelector('.btn-correct').onclick = () => handleLocalAnswer(true);
    clone.querySelector('.btn-wrong').onclick = () => handleLocalAnswer(false);

    container.appendChild(clone);
}

async function handleLocalAnswer(isCorrect) {
    if (isCorrect) {
        currentQuizItem.w = Math.max(2.23e-308, currentQuizItem.w / 2);
    }
    api({
        action: 'submit_answer',
        note_id: currentQuizItem.id,
        is_correct: isCorrect
    });
    nextQuestion();
}

// --- INITIALIZATION ---
window.onload = function() {
    checkLogin();
};