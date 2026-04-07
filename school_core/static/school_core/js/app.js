// --- STATE MANAGEMENT ---
let currentCourseId = null;
let currentCourseName = "";
let currentCourseOwner = null;
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

let pendingHeaderFile = null;
let pendingBodyFiles = [];

// --- NOTIFICATION SYSTEM ---
function showToast(message, type = "info") {
    const toast = document.createElement('div');
    toast.innerText = message;
    toast.style.cssText = `
        position: fixed; bottom: 20px; right: 20px; z-index: 9999;
        padding: 15px 25px; border-radius: 5px; color: white; font-weight: bold;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3); opacity: 0; transition: opacity 0.3s;
    `;

    if (type === "success") toast.style.background = "#28a745";
    else if (type === "error") toast.style.background = "#dc3545";
    else toast.style.background = "#17a2b8";

    document.body.appendChild(toast);
    setTimeout(() => toast.style.opacity = "1", 10);
    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => document.body.removeChild(toast), 300);
    }, 4000);
}

function handleGitResponse(res) {
    if (res && res.git) {
        if (res.git.success) {
            showToast("✅ Successfully synced to GitHub!", "success");
        } else {
            console.error("Git Sync Error:", res.git.message);
            showToast("❌ Saved locally, but Git Sync failed.", "error");
        }
    }
}


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
        updateUserDisplay(data.username);

        const container = document.getElementById('content-slot');
        container.innerHTML = '<div style="padding: 20px; font-size: 1.2em; font-weight: bold; color: #004085;">🔄 Syncing latest database and images from cloud... Please wait.</div>';

        const pullRes = await api({ action: 'sync_pull' });
        if (pullRes && pullRes.error) {
            showToast("⚠️ Cloud Pull Failed. Check server logs.", "error");
            console.error(pullRes.error);
        } else {
            showToast("✅ Cloud Sync Complete!", "success");
        }

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
    if (viewName === 'hub') loadCourses();

    if (viewName === 'course') {
        if(currentCourseId) {
            document.getElementById('course-title').innerText = currentCourseName;
            const resetBtn = document.getElementById('btn-top-reset-course');
            if (resetBtn) {
                if (currentUserIsAdmin || currentCourseOwner === currentUserId) resetBtn.style.display = 'block';
                else resetBtn.style.display = 'none';
            }
            loadChapters();
        }
    }

    if (viewName === 'chapter') { if(currentChapterId) { document.getElementById('chapter-title').innerText = currentChapterName; loadNotes(); } }
    if (viewName === 'quiz') { document.getElementById('quiz-quit-btn').setAttribute('onclick', `router('${quizReturnView}')`); nextQuestion(); }
}


// --- CONTENT HANDLING ---
function handleFiles(files, section) {
    if (!files || files.length === 0) return;

    if (section === 'header') {
        const file = files[0];
        if (!file.type.startsWith('image/')) return;
        pendingHeaderFile = file;
        const preview = document.getElementById(`preview-text-header`);
        if(preview) { preview.innerText = "Selected: " + file.name; preview.style.display = 'block'; }
    } else if (section === 'body') {
        for (let i = 0; i < files.length; i++) {
            if (files[i].type.startsWith('image/')) {
                pendingBodyFiles.push(files[i]);
            }
        }
        const preview = document.getElementById(`preview-text-body`);
        if(preview) { preview.innerText = pendingBodyFiles.length + " images selected"; preview.style.display = 'block'; }
    }
}

function parseContent(content) {
    if (!content) return { text: "", images: [] };
    const parts = content.split("|||");
    let text = parts[0].startsWith("IMG:") ? "" : parts[0];

    let images = [];
    parts.forEach(p => {
        if (p.startsWith("IMG:")) images.push(p.substring(4));
    });

    return { text, images };
}

function renderMedia(content) {
    const { text, images } = parseContent(content);
    let html = "";
    if (text) html += `<div>${text}</div>`;
    images.forEach(img => {
        html += `<img src="${img}" style="width: 100%; height: auto; display: block; border: 1px solid #ccc; margin-top: 5px; border-radius: 4px; box-sizing: border-box;">`;
    });
    return html;
}

// --- LOCAL STORAGE HELPERS FOR CHECKBOXES ---
function saveChapterSelection(chapId, isChecked) {
    localStorage.setItem(`chapter_selected_${currentUserId}_${chapId}`, isChecked);
}
function saveCourseSelection(courseId, isChecked) {
    localStorage.setItem(`course_selected_${currentUserId}_${courseId}`, isChecked);
}

window.handleChapterCheck = function(courseId, chapCheckbox) {
    saveChapterSelection(chapCheckbox.value, chapCheckbox.checked);

    const courseCb = document.getElementById(`course-check-${courseId}`);
    const allChaps = document.querySelectorAll(`.course-chap-${courseId}`);
    const anyChecked = Array.from(allChaps).some(c => c.checked);

    if (courseCb) {
        courseCb.checked = anyChecked;
        saveCourseSelection(courseId, anyChecked);
    }
}

// --- VIEW LOGIC: HUB ---
function updateTotalFocus() {
    let total = 0;
    document.querySelectorAll('.course-percentage').forEach(inp => {
        if (inp.value.length > 1 && inp.value.startsWith('0') && !inp.value.includes('.')) {
            inp.value = parseInt(inp.value, 10);
        }
        if (parseFloat(inp.value) > 100) inp.value = 100;
        if (parseFloat(inp.value) < 0) inp.value = 0;
        const val = parseFloat(inp.value) || 0;
        total += val;

        if (inp.id) {
            const cid = inp.id.replace('course-pct-', '');
            localStorage.setItem(`focus_pct_${currentUserId}_${cid}`, val);
        }
    });

    const display = document.getElementById('focus-total-display');
    if(display) {
        display.innerText = `Total Focus: ${total}%`;
        display.style.color = total === 100 ? 'green' : 'red';
    }
}

async function populateChapters(courseId) {
    const container = document.getElementById(`hub-chapters-${courseId}`);
    if (container.innerHTML === '') {
        const data = await api({ action: 'get_chapters', course_id: courseId });
        container.innerHTML = '';
        if(data.chapters) {
            data.chapters.forEach(c => {
                const el = document.createElement('div');

                let savedState = localStorage.getItem(`chapter_selected_${currentUserId}_${c.id}`);
                const courseCb = document.getElementById(`course-check-${courseId}`);
                let isChecked = false;

                if (savedState !== null) {
                    isChecked = savedState === 'true';
                } else if (courseCb && courseCb.checked) {
                    isChecked = true;
                    saveChapterSelection(c.id, true);
                }

                el.innerHTML = `<input type="checkbox" class="chap-select course-chap-${courseId}" value="${c.id}" ${isChecked ? 'checked' : ''} onchange="handleChapterCheck('${courseId}', this)"> ${c.name}`;
                container.appendChild(el);
            });
        }
    }
}

async function loadCourses() {
    const data = await api({ action: 'get_courses' });
    const list = document.getElementById('course-list');
    const template = document.getElementById('course-template');
    list.innerHTML = '';
    if(!data || !data.courses) return;

    data.courses.forEach(c => {
        const clone = template.content.cloneNode(true);
        clone.querySelector('.course-name').innerText = c.name;

        const courseCb = clone.querySelector('.course-check');
        courseCb.id = `course-check-${c.id}`;
        courseCb.checked = localStorage.getItem(`course_selected_${currentUserId}_${c.id}`) === 'true';
        courseCb.onchange = (e) => {
            toggleCourseSelection(e.target, c.id);
        };

        const pctInput = clone.querySelector('.course-percentage');
        pctInput.id = `course-pct-${c.id}`;

        const savedPct = localStorage.getItem(`focus_pct_${currentUserId}_${c.id}`);
        if (savedPct !== null) pctInput.value = savedPct;
        else pctInput.value = "";

        clone.querySelector('.btn-expand').onclick = () => toggleHubChapters(c.id);
        clone.querySelector('.btn-open').onclick = () => openCourse(c.id, c.name, c.owner_id);

        const btnRename = clone.querySelector('.btn-rename');
        const btnDelete = clone.querySelector('.btn-delete');
        const btnResetCourse = clone.querySelector('.btn-reset-course');

        if (currentUserIsAdmin || c.owner_id === currentUserId) {
            btnRename.onclick = () => renameCourse(c.id, c.name);
            btnDelete.onclick = () => deleteCourse(c.id);
            btnResetCourse.onclick = () => resetCourseWeights(c.id);
        } else {
            btnRename.style.display = 'none';
            btnDelete.style.display = 'none';
            btnResetCourse.style.display = 'none';
        }

        const chapContainer = clone.querySelector('.hub-chapters-container');
        chapContainer.id = `hub-chapters-${c.id}`;

        if (courseCb.checked) {
            chapContainer.style.display = 'block';
        }

        list.appendChild(clone);
        populateChapters(c.id);
    });

    setTimeout(updateTotalFocus, 100);
}

async function addCourse() {
    const n = document.getElementById('new-course-name').value;
    if(n) {
        showToast("☁️ Saving and pushing to GitHub...", "info");
        const res = await api({ action: 'add_course', name: n });
        handleGitResponse(res);
        loadCourses();
    }
}
async function deleteCourse(id) {
    if(confirm("Delete Course?")) {
        showToast("☁️ Deleting and pushing to GitHub...", "info");
        const res = await api({ action: 'delete_course', course_id: id });
        handleGitResponse(res);
        loadCourses();
    }
}
async function renameCourse(id, oldName) {
    const newName = prompt("Rename Course:", oldName);
    if(newName && newName !== oldName) {
        showToast("☁️ Renaming and pushing to GitHub...", "info");
        const res = await api({ action: 'edit_course', course_id: id, name: newName });
        handleGitResponse(res);
        loadCourses();
    }
}

async function resetCourseWeights(passedCourseId = null) {
    const cid = passedCourseId || currentCourseId;
    if (!cid) return;
    if (confirm("Reset ALL progress for EVERY chapter in this course? This cannot be undone.")) {
        showToast("☁️ Resetting course and pushing to GitHub...", "info");
        const res = await api({ action: 'reset_course', course_id: cid });
        handleGitResponse(res);
    }
}

async function toggleHubChapters(courseId, forceOpen = false) {
    const container = document.getElementById(`hub-chapters-${courseId}`);
    if (container.innerHTML === '') await populateChapters(courseId);

    if (container.style.display === 'none' || forceOpen) {
        container.style.display = 'block';
    } else {
        container.style.display = 'none';
    }
}

async function toggleCourseSelection(masterCheckbox, courseId) {
    saveCourseSelection(courseId, masterCheckbox.checked);

    const container = document.getElementById(`hub-chapters-${courseId}`);
    if (container.innerHTML === '') await populateChapters(courseId);

    if (masterCheckbox.checked) container.style.display = 'block';

    document.querySelectorAll(`.course-chap-${courseId}`).forEach(c => {
        c.checked = masterCheckbox.checked;
        saveChapterSelection(c.value, c.checked);
    });
}


// --- VIEW LOGIC: COURSE ---
async function openCourse(id, name, ownerId) {
    currentCourseId = id;
    currentCourseName = name;
    currentCourseOwner = ownerId;
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

        const viewMode = clone.querySelector('.chap-view-mode');
        const editMode = clone.querySelector('.chap-edit-mode');

        clone.querySelector('.chap-label').innerText = `Index ${c.index}: ${c.name}`;

        const chapSelectCb = clone.querySelector('.chap-select');
        chapSelectCb.value = c.id;

        let savedState = localStorage.getItem(`chapter_selected_${currentUserId}_${c.id}`);
        if (savedState !== null) {
            chapSelectCb.checked = savedState === 'true';
        } else {
            chapSelectCb.checked = false;
        }

        chapSelectCb.onchange = (e) => saveChapterSelection(c.id, e.target.checked);

        clone.querySelector('.btn-notes').onclick = () => openChapter(c.id, c.name);

        const btnDelete = clone.querySelector('.btn-delete');
        const btnEditChap = clone.querySelector('.btn-edit-chap');
        const btnResetChap = clone.querySelector('.btn-reset-chap');

        if (currentUserIsAdmin || c.owner_id === currentUserId) {
            btnDelete.onclick = () => deleteChapter(c.id);
            btnResetChap.onclick = () => resetChapterWeights(c.id);

            btnEditChap.onclick = () => {
                viewMode.style.display = 'none';
                editMode.style.display = 'block';
                editMode.querySelector('.edit-chap-name').value = c.name;
                editMode.querySelector('.edit-chap-index').value = c.index;
            };

            editMode.querySelector('.btn-cancel-chap').onclick = () => {
                viewMode.style.display = 'flex';
                editMode.style.display = 'none';
            };

            editMode.querySelector('.btn-save-chap').onclick = async () => {
                const newName = editMode.querySelector('.edit-chap-name').value;
                const newIndex = editMode.querySelector('.edit-chap-index').value;
                if (!newName || !newIndex) return alert("Please fill out both Name and Index.");

                showToast("☁️ Updating chapter and pushing to GitHub...", "info");
                const res = await api({ action: 'edit_chapter', chapter_id: c.id, name: newName, index: newIndex });
                handleGitResponse(res);
                loadChapters();
            };

        } else {
            btnDelete.style.display = 'none';
            btnEditChap.style.display = 'none';
            btnResetChap.style.display = 'none';
        }

        list.appendChild(clone);
    });
}

async function addChapter() {
    const n = document.getElementById('new-chap-name').value;
    const i = document.getElementById('new-chap-index').value;
    showToast("☁️ Saving chapter and pushing to GitHub...", "info");
    const res = await api({ action: 'add_chapter', course_id: currentCourseId, name: n, index: i });
    handleGitResponse(res);
    loadChapters();
}

async function deleteChapter(id) {
    if(confirm("Delete Chapter?")) {
        showToast("☁️ Deleting chapter and pushing to GitHub...", "info");
        const res = await api({ action: 'delete_chapter', chapter_id: id });
        handleGitResponse(res);
        loadChapters();
    }
}


// --- VIEW LOGIC: CHAPTER ---
async function openChapter(id, name) { currentChapterId = id; currentChapterName = name; router('chapter'); }

async function loadNotes() {
    const data = await api({ action: 'get_notes', chapter_id: currentChapterId });
    const list = document.getElementById('notes-list');
    const template = document.getElementById('note-item-template');
    list.innerHTML = '';
    if(!data || !data.notes) return;

    data.notes.forEach(n => {
        const clone = template.content.cloneNode(true);
        const card = clone.querySelector('.note-card');

        const viewMode = clone.querySelector('.note-view');
        viewMode.querySelector('.note-header').innerHTML = renderMedia(n.header);
        viewMode.querySelector('.note-body').innerHTML = renderMedia(n.body);

        const wSpan = clone.querySelector('.note-weight');
        wSpan.innerText = n.weight;
        if (n.weight !== 10) wSpan.style.fontWeight = 'bold';

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

function enableEditMode(card, note) {
    const view = card.querySelector('.note-view');
    const edit = card.querySelector('.note-edit');

    view.style.display = 'none';
    edit.style.display = 'block';

    const hData = parseContent(note.header);
    const bData = parseContent(note.body);

    const hInput = edit.querySelector('.edit-header-text');
    hInput.value = hData.text;

    const bInput = edit.querySelector('.edit-body-text');
    bInput.value = bData.text;

    const wInput = edit.querySelector('.edit-weight-val');
    wInput.value = note.weight;

    const hControls = edit.querySelector('.edit-header-img-controls');
    hControls.innerHTML = '';
    if (hData.images.length > 0) {
        hControls.innerHTML = `
            <div style="font-size:0.8em; color: blue;">Current Image: <a href="${hData.images[0]}" target="_blank">View</a></div>
            <label style="font-size:0.8em; color: red; cursor:pointer;"><input type="checkbox" class="remove-header-img"> Remove Image</label>
        `;
    }

    const bControls = edit.querySelector('.edit-body-img-controls');
    let keptBodyImages = [...bData.images];

    const renderKeptBodyImages = () => {
        bControls.innerHTML = '';
        keptBodyImages.forEach((img, idx) => {
            const div = document.createElement('div');
            div.style.cssText = "font-size:0.8em; margin-top:3px; display:flex; justify-content:space-between; align-items:center; background:#eee; padding:2px 5px; border-radius:3px;";

            const link = document.createElement('a');
            link.href = img; link.target = "_blank"; link.innerText = `View Existing Answer Image ${idx + 1}`;

            const removeBtn = document.createElement('span');
            removeBtn.style.cssText = "color:red; cursor:pointer; font-weight:bold;";
            removeBtn.innerText = "[X] Delete";
            removeBtn.onclick = () => { keptBodyImages.splice(idx, 1); renderKeptBodyImages(); };

            div.appendChild(link);
            div.appendChild(removeBtn);
            bControls.appendChild(div);
        });
    };
    renderKeptBodyImages();

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
        formData.append('weight', wInput.value);

        const remH = edit.querySelector('.remove-header-img');
        if (remH && remH.checked) formData.append('remove_header_img', 'true');
        const fileH = edit.querySelector('.edit-header-file').files[0];
        if (fileH) formData.append('header_image', fileH);

        formData.append('kept_body_images', JSON.stringify(keptBodyImages));
        const fileBInput = edit.querySelector('.edit-body-file');
        for (let i = 0; i < fileBInput.files.length; i++) {
            formData.append('body_image', fileBInput.files[i]);
        }

        showToast("☁️ Saving edits and pushing to GitHub...", "info");
        const res = await api(formData, true);
        if (res && res.error) alert(res.error);
        else {
            handleGitResponse(res);
            loadNotes();
        }
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
    pendingBodyFiles.forEach(f => formData.append('body_image', f));

    showToast("☁️ Saving note and pushing to GitHub...", "info");
    const res = await api(formData, true);

    if (res && res.error) {
        alert(res.error);
    } else {
        document.getElementById('note-header').value = '';
        document.getElementById('note-body').value = '';
        const ph = document.getElementById('preview-text-header'); if(ph) ph.style.display='none';
        const pb = document.getElementById('preview-text-body'); if(pb) pb.style.display='none';
        pendingHeaderFile = null;
        pendingBodyFiles = [];
        handleGitResponse(res);
        loadNotes();
    }
}

async function deleteNote(id) {
    if(confirm("Delete Note?")) {
        showToast("☁️ Deleting note and pushing to GitHub...", "info");
        const res = await api({ action: 'delete_note', note_id: id });
        handleGitResponse(res);
        loadNotes();
    }
}

async function resetNoteWeight(noteId) {
    showToast("☁️ Resetting note and pushing to GitHub...", "info");
    const res = await api({ action: 'reset_note', note_id: noteId });
    handleGitResponse(res);
    loadNotes();
}

async function resetChapterWeights(passedChapterId = null) {
    const cid = passedChapterId || currentChapterId;
    if (confirm("Reset ALL progress for this chapter?")) {
        showToast("☁️ Resetting chapter and pushing to GitHub...", "info");
        const res = await api({ action: 'reset_chapter', chapter_id: cid });
        handleGitResponse(res);
        if (document.getElementById('notes-list')) loadNotes();
    }
}


// --- QUIZ ENGINE ---
async function startQuiz(returnTo = 'hub') {
    quizReturnView = returnTo;
    const boxes = document.querySelectorAll('.chap-select:checked');
    const ids = Array.from(boxes).map(b => b.value);
    if(ids.length === 0) return alert("Select chapters to review.");

    let coursePercentages = {};

    if (returnTo === 'hub') {
        const selectedCourses = new Set();
        boxes.forEach(b => {
            const cls = Array.from(b.classList).find(c => c.startsWith('course-chap-'));
            if (cls) selectedCourses.add(cls.replace('course-chap-', ''));
        });

        let totalPct = 0;
        selectedCourses.forEach(cid => {
            const pInput = document.getElementById(`course-pct-${cid}`);
            if (pInput) {
                const val = parseFloat(pInput.value) || 0;
                coursePercentages[cid] = val;
                totalPct += val;
            }
        });

        if (Math.abs(totalPct - 100) > 0.01) {
            return alert(`Total focus must equal exactly 100%. You are currently at ${totalPct}%.`);
        }
    }

    const data = await api({ action: 'init_quiz', chapter_ids: ids, course_percentages: coursePercentages });
    if (!data.deck || data.deck.length === 0) return alert("No active notes in selection.");

    quizDeck = data.deck;
    router('quiz');
}

async function nextQuestion() {
    const container = document.getElementById('quiz-container');
    if (quizDeck.length === 0) { container.innerHTML = "<h3>Deck empty.</h3>"; return; }
    container.innerHTML = "<h3>Calculating...</h3>";

    let winner = null;
    const candidates = (quizDeck.length > 1 && lastQuizItemId) ? quizDeck.filter(n => n.id !== lastQuizItemId) : quizDeck;

    let totalWeight = candidates.reduce((sum, n) => sum + n.w, 0);
    let randomVal = Math.random() * totalWeight;
    let runningSum = 0;

    for (let note of candidates) {
        runningSum += note.w;
        if (randomVal <= runningSum) {
            winner = note;
            break;
        }
    }

    if (!winner) winner = candidates[candidates.length - 1];

    lastQuizItemId = winner.id;
    currentQuizItem = winner;

    // Fetch the detailed content including Course and Chapter names
    const content = await api({ action: 'get_content', note_id: winner.id });

    container.innerHTML = '';
    const template = document.getElementById('quiz-card-template');
    const clone = template.content.cloneNode(true);

    // Populate the new Course/Chapter Banner
    const cName = clone.querySelector('.q-course-name');
    if(cName) cName.innerText = content.course_name;

    const chName = clone.querySelector('.q-chapter-name');
    if(chName) chName.innerText = content.chapter_name;

    const chIdx = clone.querySelector('.q-chapter-index');
    if(chIdx) chIdx.innerText = content.chapter_index;

    // Populate Question, Answer, and Weight
    clone.querySelector('.q-header').innerHTML = renderMedia(content.header);
    clone.querySelector('.q-body').innerHTML = renderMedia(content.body);
    clone.querySelector('.q-weight').innerText = winner.w.toExponential(2);

    // Setup Answer Actions
    const ansArea = clone.querySelector('.q-answer-area');
    clone.querySelector('.btn-show-answer').onclick = () => { ansArea.style.display = 'block'; };
    clone.querySelector('.btn-correct').onclick = () => handleLocalAnswer(true);
    clone.querySelector('.btn-wrong').onclick = () => handleLocalAnswer(false);

    container.appendChild(clone);
}

async function handleLocalAnswer(isCorrect) {
    if (isCorrect) {
        currentQuizItem.w = Math.max(2.23e-308, currentQuizItem.w / 2);
        showToast("☁️ Correct! Saving and syncing to GitHub...", "info");
    } else {
        // Just show a quick local save message without syncing
        showToast("📝 Wrong answer. Weight unchanged.", "info");
    }

    const res = await api({ action: 'submit_answer', note_id: currentQuizItem.id, is_correct: isCorrect });

    // Only process the Git response if we actually expected one
    if (isCorrect) {
        handleGitResponse(res);
    }

    nextQuestion();
}

// --- GLOBAL PASTE HANDLER ---
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

    if (active.id === 'note-header') {
        handleFiles([file], 'header');
        return;
    }

    if (active.id === 'note-body') {
        pendingBodyFiles.push(file);
        const preview = document.getElementById(`preview-text-body`);
        if(preview) { preview.innerText = pendingBodyFiles.length + " images selected"; preview.style.display = 'block'; }
        return;
    }

    if (active.classList.contains('edit-header-text')) {
        const container = active.closest('.note-edit');
        if (container) {
            const fileInput = container.querySelector('.edit-header-file');
            const dt = new DataTransfer();
            dt.items.add(file);
            fileInput.files = dt.files;
            active.style.backgroundColor = "#e8f0fe";
            setTimeout(() => active.style.backgroundColor = "", 200);
        }
    }
    else if (active.classList.contains('edit-body-text')) {
        const container = active.closest('.note-edit');
        if (container) {
            const fileInput = container.querySelector('.edit-body-file');
            const dt = new DataTransfer();
            for(let i=0; i<fileInput.files.length; i++) dt.items.add(fileInput.files[i]);
            dt.items.add(file);
            fileInput.files = dt.files;
            active.style.backgroundColor = "#e8f0fe";
            setTimeout(() => active.style.backgroundColor = "", 200);
        }
    }
});

window.onload = function() { checkLogin(); };