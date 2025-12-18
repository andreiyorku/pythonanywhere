// --- STATE MANAGEMENT ---
let currentCourseId = null;
let currentChapterId = null;
let currentQuizItem = null;
let pendingImageFile = null;

// NEW: Variables for Infinite Quiz
let quizQueue = [];
let currentQuizChapterIds = [];

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

// --- ROUTER ---
function router(viewName) {
    // Hide all views
    ['hub', 'course', 'chapter', 'quiz'].forEach(v => {
        const el = document.getElementById('view-' + v);
        if(el) el.style.display = 'none';
    });

    // Show target view
    const target = document.getElementById('view-' + viewName);
    if(target) target.style.display = 'block';

    // Trigger data loads
    if (viewName === 'hub') loadCourses();
    if (viewName === 'course' && currentCourseId) loadChapters();
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

document.addEventListener('DOMContentLoaded', () => {
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
});

window.addEventListener('paste', (e) => {
    if (document.getElementById('view-chapter').style.display === 'block') {
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
    list.innerHTML = '';

    if(!data || !data.courses) return;

    data.courses.forEach(c => {
        const div = document.createElement('div');
        div.innerHTML = `<strong>${c.name}</strong> <button onclick="openCourse(${c.id}, '${c.name}')">Open</button><hr>`;
        list.appendChild(div);
    });
}

async function addCourse() {
    const name = document.getElementById('new-course-name').value;
    if(!name) return;
    await api({ action: 'add_course', name: name });
    document.getElementById('new-course-name').value = '';
    loadCourses();
}

// --- VIEW LOGIC: COURSE ---
async function openCourse(id, name) {
    currentCourseId = id;
    document.getElementById('course-title').innerText = name;
    router('course');
    loadChapters();
}

async function loadChapters() {
    const data = await api({ action: 'get_chapters', course_id: currentCourseId });
    const list = document.getElementById('chapter-list');
    list.innerHTML = '';

    if(!data || !data.chapters) return;

    data.chapters.forEach(c => {
        const div = document.createElement('div');
        div.innerHTML = `<div><label><input type="checkbox" class="chap-select" value="${c.id}"> Index ${c.index}: ${c.name}</label> <button onclick="openChapter(${c.id}, '${c.name}')">Notes</button></div>`;
        list.appendChild(div);
    });
}

async function addChapter() {
    const name = document.getElementById('new-chap-name').value;
    const index = document.getElementById('new-chap-index').value;
    await api({ action: 'add_chapter', course_id: currentCourseId, name: name, index: index });
    loadChapters();
}

// --- VIEW LOGIC: CHAPTER ---
async function openChapter(id, name) {
    currentChapterId = id;
    document.getElementById('chapter-title').innerText = name;
    router('chapter');
    loadNotes();
}

async function loadNotes() {
    const data = await api({ action: 'get_notes', chapter_id: currentChapterId });
    const list = document.getElementById('notes-list');
    list.innerHTML = '';

    if(!data || !data.notes) return;

    data.notes.forEach(n => {
        const div = document.createElement('div');
        div.style.borderBottom = "1px solid #ccc";
        div.style.padding = "10px";
        div.innerHTML = `
            <b>Q: ${n.header}</b>
            <br>
            A: ${renderContent(n.body)}
            <br>
            <small>Weight: ${n.weight}</small>
            <button onclick="deleteNote(${n.id})">Delete</button>
        `;
        list.appendChild(div);
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
    document.getElementById('note-body').value = '';
    pendingImageFile = null;
    document.getElementById('preview-img').style.display = 'none';
    document.getElementById('drop-area').innerText = "Paste Image (Ctrl+V), Drag & Drop, or Click here";
    loadNotes();
}

async function deleteNote(id) {
    if(confirm("Delete?")) {
        await api({ action: 'delete_note', note_id: id });
        loadNotes();
    }
}

// --- VIEW LOGIC: INFINITE QUIZ ---

async function startQuiz() {
    const boxes = document.querySelectorAll('.chap-select:checked');
    const ids = Array.from(boxes).map(b => b.value);
    if(ids.length === 0) return alert("Select chapters");

    // 1. Store the chapters so we can fetch more later
    currentQuizChapterIds = ids;

    // 2. Clear queue
    quizQueue = [];

    // 3. Go to view and load first question
    router('quiz');
    await nextQuestion();
}

async function nextQuestion() {
    const div = document.getElementById('quiz-container');

    // 1. CHECK IF EMPTY -> FETCH MORE
    if(quizQueue.length === 0) {
        div.innerHTML = "<h3>Fetching more questions...</h3>";

        // Ask backend for 10 more high-priority questions
        const data = await api({ action: 'generate_quiz', chapter_ids: currentQuizChapterIds });

        if(!data.quiz || data.quiz.length === 0) {
            div.innerHTML = "<h3>No notes found in selected chapters. Add some notes first!</h3><button onclick=\"router('course')\">Back</button>";
            return;
        }

        quizQueue = data.quiz;
    }

    // 2. RENDER THE NEXT QUESTION
    currentQuizItem = quizQueue.shift();
    div.innerHTML = `
        <h3>${currentQuizItem.question}</h3>
        <button onclick="document.getElementById('ans').style.display='block'">Show Answer</button>
        <div id="ans" style="display:none; margin-top:20px;">
            ${renderContent(currentQuizItem.answer)}
            <br>
            <button onclick="submitAnswer(true)">I got it</button>
            <button onclick="submitAnswer(false)">I missed it</button>
        </div>
    `;
}

async function submitAnswer(isCorrect) {
    // Send result to backend to update weight
    await api({ action: 'submit_answer', note_id: currentQuizItem.id, is_correct: isCorrect });
    // Immediately load next (or fetch more)
    nextQuestion();
}

// --- INITIALIZATION ---
window.onload = function() { loadCourses(); };