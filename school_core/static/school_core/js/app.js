// --- STATE MANAGEMENT ---
let currentCourseId = null;
let currentCourseName = "";
let currentChapterId = null;
let currentChapterName = "";
let quizQueue = [];
let currentQuizItem = null;
let currentQuizChapterIds = [];
let lastQuizItemId = null;
let quizReturnView = 'hub';
let isRegisterMode = false;
let currentUserIsAdmin = false;
let currentUserId = null;

// New Image State for Header and Body
let pendingHeaderFile = null;
let pendingBodyFile = null;
let lastActiveUploadZone = 'body'; // Default target for paste events

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
        currentUserId = data.id;
        currentUserIsAdmin = data.is_admin;
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
        checkLogin();
    } else {
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
    location.reload();
}

function updateUserDisplay(username) {
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

    if (viewName === 'auth') return;

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


// --- IMAGE HANDLING (UPDATED) ---

function setMode(section, type) {
    // section is 'header' or 'body', type is 'text' or 'image'
    // Example ID: header-mode-text, body-mode-image
    const textMode = document.getElementById(`${section}-mode-text`);
    const imgMode = document.getElementById(`${section}-mode-image`);

    if (textMode && imgMode) {
        textMode.style.display = (type === 'text') ? 'block' : 'none';
        imgMode.style.display = (type === 'image') ? 'block' : 'none';
    }

    // Update active zone for Paste events to know where to go
    if (type === 'image') lastActiveUploadZone = section;
}

function handleFile(file, section) {
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        // Update Preview Image
        const img = document.getElementById(`preview-img-${section}`);
        if(img) {
            img.src = e.target.result;
            img.style.display = 'block';
        }

        // Update Drop Area Text
        const dropText = document.getElementById(`drop-area-${section}`);
        if(dropText) {
            dropText.innerText = "Selected: " + file.name;
        }
    };
    reader.readAsDataURL(file);

    // Save to global state variables
    if (section === 'header') pendingHeaderFile = file;
    if (section === 'body') pendingBodyFile = file;
}

// Global Paste Listener - Intelligent Routing
window.addEventListener('paste', (e) => {
    // Check if we are in the chapter view (do drop areas exist?)
    const hDrop = document.getElementById('drop-area-header');
    const bDrop = document.getElementById('drop-area-body');

    if (hDrop && bDrop) {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let item of items) {
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                // Determine target based on visible inputs or last click
                const isHeaderImageMode = document.getElementById('header-mode-image').style.display !== 'none';
                const isBodyImageMode = document.getElementById('body-mode-image').style.display !== 'none';

                let target = lastActiveUploadZone;

                // Fallback logic: if target is text mode, try the other one
                if (target === 'header' && !isHeaderImageMode && isBodyImageMode) target = 'body';
                if (target === 'body' && !isBodyImageMode && isHeaderImageMode) target = 'header';

                // Auto-switch radio button if needed (optional UX polish)
                if (target === 'header' && !isHeaderImageMode) {
                    document.querySelector('input[name="hType"][value="image"]')?.click();
                    setMode('header', 'image');
                }
                if (target === 'body' && !isBodyImageMode) {
                    document.querySelector('input[name="bType"][value="image"]')?.click();
                    setMode('body', 'image');
                }

                handleFile(item.getAsFile(), target);
            }
        }
    }
});

// Attach Drag & Drop handlers dynamically
function attachImageHandlers() {
    ['header', 'body'].forEach(section => {
        const dropArea = document.getElementById(`drop-area-${section}`);
        if(dropArea) {
            dropArea.onclick = () => {
                lastActiveUploadZone = section;
                document.getElementById(`file-input-${section}`).click();
            };
            dropArea.addEventListener('dragover', (e) => { e.preventDefault(); dropArea.style.backgroundColor = '#e0e0e0'; });
            dropArea.addEventListener('dragleave', (e) => { e.preventDefault(); dropArea.style.backgroundColor = 'white'; });
            dropArea.addEventListener('drop', (e) => {
                e.preventDefault();
                dropArea.style.backgroundColor = 'white';
                if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0], section);
            });
        }
    });
}

// --- RENDER HELPER ---
function renderMedia(text) {
    if (text && text.startsWith('IMG:')) {
        const url = text.substring(4);
        return `<img src="${url}" style="max-width:300px; display:block; border:1px solid #ccc; margin-top:5px; border-radius: 4px;">`;
    }
    // Return text wrapped in div to maintain block structure
    return `<div>${text}</div>`;
}


// --- VIEW LOGIC: HUB ---
async function loadCourses() {
    const data = await api({ action: 'get_courses' });
    const list = document.getElementById('course-list');
    const template = document.getElementById('course-template');

    list.innerHTML = '';
    if(!data || !data.courses) return;

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

        // UPDATED: Use renderMedia for BOTH Header and Body
        clone.querySelector('.note-header').innerHTML = renderMedia(n.header);
        clone.querySelector('.note-body').innerHTML = renderMedia(n.body);

        // Highlight weight
        const weightSpan = clone.querySelector('.note-weight');
        weightSpan.innerText = n.weight;
        if (n.weight !== 10) weightSpan.style.fontWeight = 'bold';

        // Reset Button
        const btnReset = clone.querySelector('.btn-reset');
        if (n.weight !== 10) {
            btnReset.onclick = () => resetNoteWeight(n.id);
        } else {
            btnReset.style.display = 'none';
        }

        // Delete Button
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
    const headerInput = document.getElementById('note-header').value;
    const bodyInput = document.getElementById('note-body').value;

    const isHeaderImage = document.getElementById('header-mode-image').style.display !== 'none';
    const isBodyImage = document.getElementById('body-mode-image').style.display !== 'none';

    // Build FormData
    const formData = new FormData();
    formData.append('action', 'add_note');
    formData.append('chapter_id', currentChapterId);

    // 1. Handle Header
    if (isHeaderImage) {
        if (pendingHeaderFile) {
            formData.append('header_image', pendingHeaderFile);
        } else {
            return alert("Please upload a Header Image");
        }
    } else {
        if (!headerInput) return alert("Header Text is required");
        formData.append('header', headerInput);
    }

    // 2. Handle Body
    if (isBodyImage) {
        if (pendingBodyFile) {
            formData.append('body_image', pendingBodyFile);
        }
    } else {
        formData.append('body', bodyInput);
    }

    await api(formData, true); // True = isFile (multipart)

    // Reset Inputs
    document.getElementById('note-header').value = '';
    document.getElementById('note-body').value = '';
    pendingHeaderFile = null;
    pendingBodyFile = null;

    // Reset Previews
    document.getElementById('preview-img-header').style.display = 'none';
    document.getElementById('drop-area-header').innerText = "Click to Upload Header Image (or Paste)";
    document.getElementById('preview-img-body').style.display = 'none';
    document.getElementById('drop-area-body').innerText = "Click to Upload Answer Image (or Paste)";

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

    // UPDATED: Render Header with renderMedia
    clone.querySelector('.q-header').innerHTML = renderMedia(content.header);
    clone.querySelector('.q-body').innerHTML = renderMedia(content.body);

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

async function resetNoteWeight(noteId) {
    await api({ action: 'reset_note', note_id: noteId });
    loadNotes();
}

async function resetChapterWeights() {
    if (confirm("Are you sure? This will wipe your memory progress for ALL notes in this chapter.")) {
        await api({ action: 'reset_chapter', chapter_id: currentChapterId });
        loadNotes();
    }
}

// --- INITIALIZATION ---
window.onload = function() {
    checkLogin();
};