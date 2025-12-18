<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>School Manager SPA</title>
    <style>
        /* Basic visibility utility */
        .view-section { display: none; }
        /* Make the Hub visible by default so it doesn't flicker */
        #view-hub { display: block; } 
    </style>
</head>
<body>

    <div style="padding-bottom: 20px; border-bottom: 1px solid #ccc; margin-bottom: 20px;">
        <h1 style="margin:0; cursor:pointer; color:blue;" onclick="router('hub')">School Manager</h1>
        <small>Single Page Application</small>
        <br><br>
        <button onclick="router('hub')">Home / Subjects</button>
    </div>

    <div id="debug-console" style="background: #ffcccc; color: red; padding: 10px; display: none; margin-bottom: 10px; border: 1px solid red;"></div>

    <div id="view-hub" class="view-section">
        <h2>My Subjects</h2>
        <div style="margin-bottom: 15px;">
            <input type="text" id="new-course-name" placeholder="New Subject Name (e.g. Math)">
            <button onclick="addCourse()">Create Subject</button>
        </div>
        <div id="course-grid"></div>
    </div>

    <div id="view-course" class="view-section">
        <h2 id="course-title">Course Name</h2>
        
        <div style="background: #f0f0f0; padding: 10px; margin-bottom: 20px;">
            <h3>Add Chapter</h3>
            <input type="text" id="new-chap-name" placeholder="Chapter Name">
            <input type="number" id="new-chap-index" placeholder="Index (Multiplier)" value="1">
            <button onclick="addChapter()">Add Chapter</button>
        </div>

        <h3>Quiz Builder</h3>
        <div id="chapter-list"></div>
        <br>
        <button onclick="startQuiz()" style="font-weight: bold; padding: 10px;">Start Adaptive Quiz</button>
    </div>

    <div id="view-chapter" class="view-section">
        <h2 id="chapter-title">Chapter Content</h2>
        
        <div style="background: #e6f7ff; padding: 10px; margin-bottom: 20px;">
            <h3>Add New Note</h3>
            <input type="text" id="note-header" placeholder="Header / Question" style="width: 100%; margin-bottom: 5px;">
            <br>
            <textarea id="note-body" rows="3" placeholder="Body / Answer" style="width: 100%; margin-bottom: 5px;"></textarea>
            <br>
            <button onclick="addNote()">Save Note</button>
        </div>

        <div id="notes-list"></div>
    </div>

    <div id="view-quiz" class="view-section">
        <div id="quiz-container"></div>
    </div>


    <script>
        // --- GLOBAL STATE ---
        let currentCourseId = null;
        let currentChapterId = null;
        let quizQueue = [];
        let currentQuizItem = null;

        // --- DEBUG HELPER ---
        function showError(msg) {
            const el = document.getElementById('debug-console');
            el.style.display = 'block';
            el.innerText = "ERROR: " + msg;
        }

        // --- API ENGINE ---
        async function api(payload) {
            try {
                // Pointing to the specific app URL
                const res = await fetch('/school_core/api/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (!res.ok) throw new Error(`Server returned ${res.status}`);
                return await res.json();
            } catch (err) {
                showError("API Connection Failed: " + err.message);
                console.error(err);
                return { courses: [], chapters: [], notes: [] }; // Fallback to prevent crashes
            }
        }

        // --- ROUTER ---
        function router(viewName) {
            // Hide all views
            const allViews = document.querySelectorAll('.view-section');
            allViews.forEach(el => el.style.display = 'none');

            // Show selected view
            const target = document.getElementById('view-' + viewName);
            if (target) {
                target.style.display = 'block';
            } else {
                showError("Could not find view: " + viewName);
            }

            // Trigger data load
            if (viewName === 'hub') loadCourses();
        }

        // --- VIEW LOGIC ---

        async function loadCourses() {
            const data = await api({ action: 'get_courses' });
            const grid = document.getElementById('course-grid');
            grid.innerHTML = '';
            
            if (!data.courses || data.courses.length === 0) {
                grid.innerHTML = '<p>No subjects yet.</p>';
                return;
            }

            data.courses.forEach(c => {
                const div = document.createElement('div');
                div.innerHTML = `<strong>${c.name}</strong> <button onclick="openCourse(${c.id}, '${c.name}')">Open</button>`;
                div.style.padding = "10px";
                div.style.borderBottom = "1px solid #eee";
                grid.appendChild(div);
            });
        }

        async function addCourse() {
            const name = document.getElementById('new-course-name').value;
            if(!name) return;
            await api({ action: 'add_course', name: name });
            document.getElementById('new-course-name').value = '';
            loadCourses();
        }

        async function openCourse(id, name) {
            currentCourseId = id;
            document.getElementById('course-title').innerText = name;
            router('course');
            
            const data = await api({ action: 'get_chapters', course_id: id });
            const list = document.getElementById('chapter-list');
            list.innerHTML = '';
            
            if (data.chapters) {
                data.chapters.forEach(c => {
                    list.innerHTML += `
                        <div style="padding:5px;">
                            <input type="checkbox" class="chap-select" value="${c.id}">
                            <b>Index ${c.index}:</b> ${c.name}
                            <button onclick="openChapter(${c.id}, '${c.name}')" style="font-size:0.8em;">Edit Notes</button>
                        </div>
                    `;
                });
            }
        }

        async function addChapter() {
            const name = document.getElementById('new-chap-name').value;
            const index = document.getElementById('new-chap-index').value;
            if(!name) return;
            await api({ action: 'add_chapter', course_id: currentCourseId, name: name, index: index });
            // Refresh list
            openCourse(currentCourseId, document.getElementById('course-title').innerText);
        }

        async function openChapter(id, name) {
            currentChapterId = id;
            document.getElementById('chapter-title').innerText = name;
            router('chapter');
            
            const data = await api({ action: 'get_notes', chapter_id: id });
            const list = document.getElementById('notes-list');
            list.innerHTML = '';

            if (data.notes) {
                data.notes.forEach(n => {
                    list.innerHTML += `
                        <div style="border:1px solid #ccc; margin:5px; padding:5px;">
                            <div>Q: ${n.header}</div>
                            <div>A: ${n.body}</div>
                            <small>Weight: ${n.weight}</small>
                            <button onclick="deleteNote(${n.id})">Delete</button>
                        </div>
                    `;
                });
            }
        }

        async function addNote() {
            const h = document.getElementById('note-header').value;
            const b = document.getElementById('note-body').value;
            if(!h || !b) return;
            await api({ action: 'add_note', chapter_id: currentChapterId, header: h, body: b });
            // Clear and reload
            document.getElementById('note-header').value = '';
            document.getElementById('note-body').value = '';
            openChapter(currentChapterId, document.getElementById('chapter-title').innerText);
        }

        async function deleteNote(id) {
            if(confirm("Delete note?")) {
                await api({ action: 'delete_note', note_id: id });
                openChapter(currentChapterId, document.getElementById('chapter-title').innerText);
            }
        }

        async function startQuiz() {
            const checkboxes = document.querySelectorAll('.chap-select:checked');
            const ids = Array.from(checkboxes).map(cb => cb.value);
            if(ids.length === 0) { alert("Select chapters first!"); return; }
            
            const data = await api({ action: 'generate_quiz', chapter_ids: ids });
            quizQueue = data.quiz;
            if(!quizQueue || quizQueue.length === 0) { alert("No questions found."); return; }
            
            router('quiz');
            nextQuestion();
        }

        function nextQuestion() {
            const container = document.getElementById('quiz-container');
            if(quizQueue.length === 0) {
                container.innerHTML = `<h3>Done!</h3><button onclick="router('hub')">Home</button>`;
                return;
            }
            currentQuizItem = quizQueue.shift();
            container.innerHTML = `
                <h3>${currentQuizItem.question}</h3>
                <button onclick="this.nextElementSibling.style.display='block'">Show Answer</button>
                <div style="display:none; margin-top:10px;">
                    <p><strong>${currentQuizItem.answer}</strong></p>
                    <button onclick="submitAnswer(true)">I got it</button>
                    <button onclick="submitAnswer(false)">I missed it</button>
                </div>
            `;
        }

        async function submitAnswer(isCorrect) {
            await api({ action: 'submit_answer', note_id: currentQuizItem.id, is_correct: isCorrect });
            nextQuestion();
        }

        // --- INIT ---
        // Start app
        router('hub');
    </script>
</body>
</html>