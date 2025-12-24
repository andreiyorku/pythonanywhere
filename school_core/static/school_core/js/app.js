// --- STATE MANAGEMENT ---
let currentCourseId = null;
let currentCourseName = ""; // NEW: Remember the name
let currentChapterId = null;
let currentChapterName = ""; // NEW: Remember the name
let quizQueue = [];
let currentQuizItem = null;
let currentQuizChapterIds = [];
let pendingImageFile = null;
let lastQuizItemId = null;
let quizReturnView = 'hub'; // Default return location

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
        // FORCE the quit button to go back to the correct place
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
async function loadCourses() {
    const data = await api({ action: 'get_courses' });
    const list = document.getElementById('course-list');
    const template = document.getElementById('course-template');

    list.innerHTML = '';
    if(!data || !data.courses) return;

    data.courses.forEach(c => {
        // 1. Clone the template
        const clone = template.content.cloneNode(true);

        // 2. Set the Name
        clone.querySelector('.course-name').innerText = c.name;

        // 3. Setup the Checkbox (for the Quiz)
        const checkbox = clone.querySelector('.course-check');
        checkbox.onchange = () => toggleCourseSelection(checkbox, c.id);

        // 4. Setup the Expand Button
        const btnExpand = clone.querySelector('.btn-expand');
        btnExpand.onclick = () => toggleHubChapters(c.id);

        // 5. Setup the EDIT Button (The Broken Part)
        const btnOpen = clone.querySelector('.btn-open');
        btnOpen.onclick = () => openCourse(c.id, c.name); // <--- Make sure this line exists!

        // 6. Setup the Delete Button
        const btnDelete = clone.querySelector('.btn-delete');
        btnDelete.onclick = () => deleteCourse(c.id);

        // 7. Prepare the Chapter Container ID
        clone.querySelector('.hub-chapters-container').id = `hub-chapters-${c.id}`;

        list.appendChild(clone);
    });
}

async function openCourse(id, name) {
    currentCourseId = id;
    currentCourseName = name;
    router('course');
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
                const template = document.getElementById('hub-chapter-template'); // Use the mini template

                data.chapters.forEach(c => {
                    const clone = template.content.cloneNode(true);

                    const checkbox = clone.querySelector('.chap-select');
                    checkbox.value = c.id;
                    checkbox.classList.add(`course-chap-${courseId}`); // Add dynamic class for "Select All" logic

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

// NEW: Select All Chapters when Course is clicked
async function toggleCourseSelection(masterCheckbox, courseId) {
    // 1. Ensure chapters are loaded (so we can check them)
    const container = document.getElementById(`hub-chapters-${courseId}`);
    if (container.innerHTML === '') {
        await toggleHubChapters(courseId);
    }
    // Ensure it's visible if the user checks the box
    if (masterCheckbox.checked) container.style.display = 'block';

    // 2. Check/Uncheck all child checkboxes
    const children = document.querySelectorAll(`.course-chap-${courseId}`);
    children.forEach(child => child.checked = masterCheckbox.checked);
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
        btnDelete.onclick = () => deleteChapter(c.id);

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
// --- CLIENT-SIDE QUIZ ENGINE ---
let quizDeck = []; // Stores {id, w} objects locally

async function startQuiz(returnTo = 'hub') {
    quizReturnView = returnTo;

    const boxes = document.querySelectorAll('.chap-select:checked');
    const ids = Array.from(boxes).map(b => b.value);
    if(ids.length === 0) return alert("Select chapters");

    // 1. Fetch the "Deck" (IDs and Weights only)
    const data = await api({ action: 'init_quiz', chapter_ids: ids });

    if (!data.deck || data.deck.length === 0) {
        alert("No notes found in these chapters.");
        return;
    }

    quizDeck = data.deck; // Store the weights locally!
    console.log(`Loaded ${quizDeck.length} notes into local deck.`);

    router('quiz'); // This will trigger nextQuestion() in the router check
}

async function nextQuestion() {
    const container = document.getElementById('quiz-container');
    container.innerHTML = "<h3>Calculating...</h3>";

    if (quizDeck.length === 0) {
        container.innerHTML = "<h3>Error: Deck empty.</h3>";
        return;
    }

    // --- NEW LOGIC STARTS HERE ---

    let winner = null;
    let maxScore = -1;

    // Filter out the last seen question (unless it's the only one left)
    const candidates = (quizDeck.length > 1 && lastQuizItemId)
        ? quizDeck.filter(n => n.id !== lastQuizItemId)
        : quizDeck;

    candidates.forEach(note => {
        // Simple weighted random: Weight * Random Number
        let score = note.w * Math.random();

        if (score > maxScore) {
            maxScore = score;
            winner = note;
        }
    });

    // Save this as the "Last Seen" for next time
    lastQuizItemId = winner.id;
    currentQuizItem = winner;

    // --- NEW LOGIC ENDS HERE ---

    // 3. FETCH CONTENT (Rest of function stays the same...)
    const content = await api({ action: 'get_content', note_id: winner.id });

    container.innerHTML = `
        <h3>${content.header}</h3>
        <button onclick="document.getElementById('ans').style.display='block'">Show Answer</button>
        <div id="ans" style="display:none; margin-top:20px;">
            ${renderContent(content.body)}
            <br>
            <div style="margin-top:20px;">
                <button onclick="handleLocalAnswer(true)" style="background:#d4edda; color:#155724;">I got it</button>
                <button onclick="handleLocalAnswer(false)" style="background:#f8d7da; color:#721c24;">I missed it</button>
            </div>
            <div style="margin-top:10px; font-size:0.8em; color:#666;">
                Current Weight: ${winner.w.toExponential(2)}
            </div>
        </div>
    `;
}

async function handleLocalAnswer(isCorrect) {
    // 4. UPDATE LOCAL WEIGHT (Instant Feedback)
    if (isCorrect) {
        // Halve the weight locally
        // We use 2.23e-308 to match Python's limit
        currentQuizItem.w = Math.max(2.23e-308, currentQuizItem.w / 2);
    }
    // If wrong, weight stays the same (or you could increase it if you wanted)

    // 5. SYNC WITH SERVER (Background)
    // We don't await this. We let it happen in the background while the user moves on.
    api({
        action: 'submit_answer',
        note_id: currentQuizItem.id,
        is_correct: isCorrect
    });

    // 6. NEXT
    nextQuestion();
}

async function submitAnswer(isCorrect) {
    await api({ action: 'submit_answer', note_id: currentQuizItem.id, is_correct: isCorrect });
    nextQuestion();
}

// --- INITIALIZATION ---dd
window.onload = function() {
    router('hub');
};