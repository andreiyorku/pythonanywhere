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

// New Image State
let pendingHeaderFile = null;
let pendingBodyFile = null;

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
    const errorBox = document.getElementById('auth-error');

    errorBox.style.display = 'none';

    if (isRegisterMode) {
        title.innerText = "Create Account";
        btn.innerText = "Sign Up";
        document.getElementById('auth-toggle-text').innerHTML = 'Already have an account? <a href="#" onclick="toggleAuthMode()">Login</a>';
    } else {
        title.innerText = "Login";
        btn.innerText = "Login";
        document.getElementById('auth-toggle-text').innerHTML = 'New here? <a href="#" onclick="toggleAuthMode()">Create an account</a>';
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


// --- NEW IMAGE & CONTENT HANDLING ---

function handleFile(file, section) {
    if (!file || !file.type.startsWith('image/')) return;

    // Update Preview Text
    const preview = document.getElementById(`preview-text-${section}`);
    if(preview) {
        preview.innerText = "Selected: " + file.name;
        preview.style.display = 'block';
    }

    if (section === 'header') pendingHeaderFile = file;
    if (section === 'body') pendingBodyFile = file;
}

// HELPER: Parse "Text|||IMG:..." format
function parseContent(content) {
    // Returns object { text: string, img: url | null }
    if (!content) return { text: "", img: null };

    let text = content;
    let img = null;

    // 1. Check for delimiter
    if (content.includes("|||")) {
        const parts = content.split("|||");
        text = parts[0];
        img = parts[1];
    }
    // 2. Legacy Support (Pure IMG)
    else if (content.startsWith("IMG:")) {
        text = "";
        img = content;
    }

    if (img && img.startsWith("IMG:")) {
        img = img.substring(4); // Remove "IMG:" prefix
    } else {
        img = null;
    }

    return { text, img };
}

// HELPER: Render HTML for mixed content
function renderMedia(content) {
    const { text, img } = parseContent(content);
    let html = "";
    if (text) html += `<div>${text}</div>`;
    if (img) html += `<img src="${img}" style="max-width:300px; display:block; border:1px solid #ccc; margin-top:5px; border-radius: 4px;">`;
    return html;
}


// --- VIEW LOGIC: HUB ---
async function loadCourses() {
    const data = await api({ action: 'get_courses' });
    const list = document.getElementById('course-list');
    const template = document.getElementById('course-template');

    list.innerHTML = '';
    if(!data || !data.courses) return;

    if (!template) return console.error("Missing template");

    data.courses.forEach(c => {
        const clone = template.content.cloneNode(true);
        clone.querySelector('.course-name').innerText = c.name;
        clone.querySelector('.course-check').onchange = () => toggleCourseSelection(clone.querySelector('.course-check'), c.id);
        clone.querySelector('.btn-expand').onclick = () => toggleHubChapters(c.id);
        clone.querySelector('.btn-open').onclick = () => openCourse(c.id, c.name);

        const btnDelete = clone.querySelector('.btn-delete');
        if (currentUserIsAdmin || c.owner_id === currentUserId) {
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
    if(name) { await api({ action: 'add_course', name: name }); loadCourses(); }
}

async function deleteCourse(id) {
    if(confirm("Delete?")) { await api({ action: 'delete_course', course_id: id }); loadCourses(); }
}

async function toggleHubChapters(courseId) {
    const container = document.getElementById(`hub-chapters-${courseId}`);
    if (container.style.display === 'none') {
        container.style.display = 'block';
        if (container.innerHTML === '') {
            container.innerText = "Loading...";
            const data = await api({ action: 'get_chapters', course_id: courseId });
            container.innerHTML = '';
            if(data.chapters) {
                data.chapters.forEach(c => {
                    const el = document.createElement('div');
                    el.innerHTML = `<input type="checkbox" class="chap-select course-chap-${courseId}" value="${c.id}"> ${c.name}`;
                    container.appendChild(el);
                });
            }
        }
    } else {
        container.style.display = 'none';
    }
}

async function toggleCourseSelection(masterCheckbox, courseId) {
    const container = document.getElementById(`hub-chapters-${courseId}`);
    if (container.innerHTML === '') await toggleHubChapters(courseId);
    if (masterCheckbox.checked) container.style.display = 'block';
    document.querySelectorAll(`.course-chap-${courseId}`).forEach(c => c.checked = masterCheckbox.checked);
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
        clone.querySelector('.chap-select').value = c.id;
        clone.querySelector('.btn-notes').onclick = () => openChapter(c.id, c.name);

        const btnDelete = clone.querySelector('.btn-delete');
        if (currentUserIsAdmin || c.owner_id === currentUserId) {
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
    if(confirm("Delete?")) { await api({ action: 'delete_chapter', chapter_id: id }); loadChapters(); }
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
        const card = clone.querySelector('.note-card');

        // 1. RENDER NORMAL VIEW
        const viewMode = clone.querySelector('.note-view');
        viewMode.querySelector('.note-header').innerHTML = renderMedia(n.header);
        viewMode.querySelector('.note-body').innerHTML = renderMedia(n.body);

        const wSpan = clone.querySelector('.note-weight');
        wSpan.innerText = n.weight;
        if (n.weight !== 10) wSpan.style.fontWeight = 'bold';

        // 2. SETUP BUTTONS
        const btnReset = clone.querySelector('.btn-reset');
        if (n.weight !== 10) btnReset.onclick = () => resetNoteWeight(n.id);
        else btnReset.style.display = 'none';

        const canEdit = (currentUserIsAdmin || (currentUserId && n.owner_id === currentUserId));
        const btnDelete = clone.querySelector('.btn-delete');
        const btnEdit = clone.querySelector('.btn-edit');

        if (canEdit) {
            btnDelete.onclick = () => deleteNote(n.id);
            btnEdit.onclick = () => enableEditMode(card, n);
        } else {
            btnDelete.style.display = 'none';
            btnEdit.style.display = 'none';
        }

        list.appendChild(clone);
    });
}

// --- EDIT MODE LOGIC ---
function enableEditMode(card, note) {
    const view = card.querySelector('.note-view');
    const edit = card.querySelector('.note-edit');

    // Toggle visibility
    view.style.display = 'none';
    edit.style.display = 'block';

    // Parse current content
    const hData = parseContent(note.header);
    const bData = parseContent(note.body);

    // Fill Text Inputs
    const hInput = edit.querySelector('.edit-header-text');
    hInput.value = hData.text;

    const bInput = edit.querySelector('.edit-body-text');
    bInput.value = bData.text;

    // Handle Header Image Controls
    const hControls = edit.querySelector('.edit-header-img-controls');
    hControls.innerHTML = '';
    if (hData.img) {
        hControls.innerHTML = `
            <div style="font-size:0.8em; color: blue;">Current Image: <a href="${hData.img}" target="_blank">View</a></div>
            <label style="font-size:0.8em; color: red; cursor:pointer;"><input type="checkbox" class="remove-header-img"> Remove Image</label>
        `;
    }

    // Handle Body Image Controls
    const bControls = edit.querySelector('.edit-body-img-controls');
    bControls.innerHTML = '';
    if (bData.img) {
        bControls.innerHTML = `
            <div style="font-size:0.8em; color: blue;">Current Image: <a href="${bData.img}" target="_blank">View</a></div>
            <label style="font-size:0.8em; color: red; cursor:pointer;"><input type="checkbox" class="remove-body-img"> Remove Image</label>
        `;
    }

    // Bind Actions
    edit.querySelector('.btn-cancel-edit').onclick = () => {
        view.style.display = 'block';
        edit.style.display = 'none';
    };

    edit.querySelector('.btn-save-edit').onclick = async () => {
        const formData = new FormData();
        formData.append('action', 'edit_note');
        formData.append('note_id', note.id);
        formData.append('header', hInput.value);
        formData.append('body', bInput.value);

        // Check removals
        const remH = edit.querySelector('.remove-header-img');
        if (remH && remH.checked) formData.append('remove_header_img', 'true');

        const remB = edit.querySelector('.remove-body-img');
        if (remB && remB.checked) formData.append('remove_body_img', 'true');

        // Check new files
        const fileH = edit.querySelector('.edit-header-file').files[0];
        if (fileH) formData.append('header_image', fileH);

        const fileB = edit.querySelector('.edit-body-file').files[0];
        if (fileB) formData.append('body_image', fileB);

        const res = await api(formData, true);
        if (res.error) alert(res.error);
        else loadNotes(); // Reload to see changes
    };
}

async function addNote() {
    const headerInput = document.getElementById('note-header').value;
    const bodyInput = document.getElementById('note-body').value;

    const formData = new FormData();
    formData.append('action', 'add_note');
    formData.append('chapter_id', currentChapterId);
    formData.append('header', headerInput);
    formData.append('body', bodyInput);

    if (pendingHeaderFile) formData.append('header_image', pendingHeaderFile);
    if (pendingBodyFile) formData.append('body_image', pendingBodyFile);

    const res = await api(formData, true);
    if (res && res.error) {
        alert(res.error);
    } else {
        // Reset Inputs
        document.getElementById('note-header').value = '';
        document.getElementById('note-body').value = '';
        const ph = document.getElementById('preview-text-header'); if(ph) ph.style.display='none';
        const pb = document.getElementById('preview-text-body'); if(pb) pb.style.display='none';
        pendingHeaderFile = null;
        pendingBodyFile = null;
        loadNotes();
    }
}

async function deleteNote(id) {
    if(confirm("Delete?")) { await api({ action: 'delete_note', note_id: id }); loadNotes(); }
}


// --- VIEW LOGIC: QUIZ ENGINE ---
async function startQuiz(returnTo = 'hub') {
    quizReturnView = returnTo;
    const boxes = document.querySelectorAll('.chap-select:checked');
    const ids = Array.from(boxes).map(b => b.value);
    if(ids.length === 0) return alert("Select chapters");

    const data = await api({ action: 'init_quiz', chapter_ids: ids });
    if (!data.deck || data.deck.length === 0) return alert("No notes.");

    quizDeck = data.deck;
    router('quiz');
}

async function nextQuestion() {
    const container = document.getElementById('quiz-container');
    if (quizDeck.length === 0) { container.innerHTML = "<h3>Deck empty.</h3>"; return; }
    container.innerHTML = "<h3>Calculating...</h3>";

    let winner = null;
    let maxScore = -1;
    const candidates = (quizDeck.length > 1 && lastQuizItemId)
        ? quizDeck.filter(n => n.id !== lastQuizItemId)
        : quizDeck;

    candidates.forEach(note => {
        let score = note.w * Math.random();
        if (score > maxScore) { maxScore = score; winner = note; }
    });

    lastQuizItemId = winner.id;
    currentQuizItem = winner;

    const content = await api({ action: 'get_content', note_id: winner.id });

    container.innerHTML = '';
    const template = document.getElementById('quiz-card-template');
    const clone = template.content.cloneNode(true);

    // RENDER MIXED CONTENT
    clone.querySelector('.q-header').innerHTML = renderMedia(content.header);
    clone.querySelector('.q-body').innerHTML = renderMedia(content.body);
    clone.querySelector('.q-weight').innerText = winner.w.toExponential(2);

    const ansArea = clone.querySelector('.q-answer-area');
    clone.querySelector('.btn-show-answer').onclick = () => { ansArea.style.display = 'block'; };
    clone.querySelector('.btn-correct').onclick = () => handleLocalAnswer(true);
    clone.querySelector('.btn-wrong').onclick = () => handleLocalAnswer(false);

    container.appendChild(clone);
}

async function handleLocalAnswer(isCorrect) {
    if (isCorrect) currentQuizItem.w = Math.max(2.23e-308, currentQuizItem.w / 2);
    await api({ action: 'submit_answer', note_id: currentQuizItem.id, is_correct: isCorrect });
    nextQuestion();
}

async function resetNoteWeight(noteId) {
    await api({ action: 'reset_note', note_id: noteId });
    loadNotes();
}

async function resetChapterWeights() {
    if (confirm("Reset ALL progress for this chapter?")) {
        await api({ action: 'reset_chapter', chapter_id: currentChapterId });
        loadNotes();
    }
}

// --- INITIALIZATION ---
window.onload = function() {
    checkLogin();
};