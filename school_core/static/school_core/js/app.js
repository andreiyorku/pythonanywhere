// --- STATE MANAGEMENT ---
let currentCourseId = null;
let currentCourseName = ""; // NEW: Remember the name
let currentChapterId = null;
let currentChapterName = ""; // NEW: Remember the name
let quizQueue = [];
let currentQuizItem = null;
let currentQuizChapterIds = [];
let pendingImageFile = null;

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

// --- ROUTER (Fixed for Timing) ---
async function router(viewName) {
    const container = document.getElementById('content-slot');

    // 1. Fetch the HTML Fragment
    try {
        const res = await fetch(`/school_core/partial/${viewName}/`);
        if(!res.ok) throw new Error("View not found");
        const html = await res.text();

        // 2. Inject HTML
        container.innerHTML = html;

        // 3. Re-attach Event Listeners (for Images)
        if(viewName === 'chapter') attachImageHandlers();

    } catch (err) {
        console.error(err);
        return;
    }

    // 4. Trigger Data Loads & Update Titles
    // We do this AFTER the HTML is injected, so the elements actually exist.

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
    // Only capture paste if we are actively looking at the chapter view
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
    list.innerHTML = '';

    if(!data || !data.courses) return;

    data.courses.forEach(c => {
        const div = document.createElement('div');
        div.innerHTML = `<strong>${c.name}</strong>
            <button onclick="openCourse(${c.id}, '${c.name}')">Open</button>
            <button onclick="deleteCourse(${c.id})" style="background: #ffcccc; color: #cc0000; margin-top:5px; padding: 5px;">Delete</button>
        <hr>`;

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

async function deleteCourse(id) {
    if(confirm("Delete this Subject? All chapters and notes inside it will be lost.")) {
        await api({ action: 'delete_course', course_id: id });
        loadCourses(); // Refresh the list
    }
}

// --- VIEW LOGIC: COURSE ---
async function openCourse(id, name) {
    currentCourseId = id;
    currentCourseName = name; // Save name
    router('course');
    // Note: loadChapters is now called by the router automatically
}

async function loadChapters() {
    const data = await api({ action: 'get_chapters', course_id: currentCourseId });
    const list = document.getElementById('chapter-list');
    list.innerHTML = '';

    if(!data || !data.chapters) return;

    data.chapters.forEach(c => {
        const div = document.createElement('div');
        div.innerHTML = `<div><label><input type="checkbox" class="chap-select" value="${c.id}"> Index ${c.index}: ${c.name}</label>
            <button onclick="openChapter(${c.id}, '${c.name}')">Notes</button>
            <button onclick="deleteChapter(${c.id})" style="background: #ffcccc; color: #cc0000; margin-left: 5px; padding: 5px 10px; width: auto; display: inline-block;">Delete</button>
        </div>`;
        list.appendChild(div);
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
        await api({ action: 'delete_chapter', chapter_id: id });
        loadChapters(); // Refresh the list
    }
}

// --- VIEW LOGIC: CHAPTER ---
async function openChapter(id, name) {
    currentChapterId = id;
    currentChapterName = name; // Save name
    router('chapter');
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

    // Manually clear inputs since the view doesn't reload entirely
    document.getElementById('note-header').value = '';
    if(document.getElementById('note-body')) document.getElementById('note-body').value = '';
    pendingImageFile = null;
    if(document.getElementById('preview-img')) document.getElementById('preview-img').style.display = 'none';
    if(document.getElementById('drop-area')) document.getElementById('drop-area').innerText = "Paste Image (Ctrl+V), Drag & Drop, or Click here";

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

    currentQuizChapterIds = ids;
    quizQueue = [];
    router('quiz');
}

async function nextQuestion() {
    const div = document.getElementById('quiz-container');

    if(quizQueue.length === 0) {
        div.innerHTML = "<h3>Fetching more questions...</h3>";
        const data = await api({ action: 'generate_quiz', chapter_ids: currentQuizChapterIds });

        if(!data.quiz || data.quiz.length === 0) {
            div.innerHTML = "<h3>No notes found.</h3><button onclick=\"router('course')\">Back</button>";
            return;
        }
        quizQueue = data.quiz;
    }

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
    await api({ action: 'submit_answer', note_id: currentQuizItem.id, is_correct: isCorrect });
    nextQuestion();
}

// --- INITIALIZATION ---
window.onload = function() {
    router('hub');
};