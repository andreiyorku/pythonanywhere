// school_core/static/school_core/js/app.js
console.log("App loaded");

async function loadView(viewName, param = null) {
    const container = document.getElementById('app-container');

    try {
        // 1. Fetch the HTML component
        const templateResponse = await fetch(`/static/school_core/components/${viewName}.html`);
        const templateHtml = await templateResponse.text();

        // 2. Fetch the SQL Data
        let apiUrl = `/school/api/data/?type=${viewName}`;
        if (param) apiUrl += `&id=${param}`;

        const dataResponse = await fetch(apiUrl);
        const result = await dataResponse.json();

        // 3. Inject the HTML first (This removes the "Loading..." text)
        container.innerHTML = templateHtml;

        // 4. Trigger the renderer even if data is empty []
        if (viewName === 'main_hub') {
            renderMainHub(result.data);
        } else if (viewName === 'course_dashboard') {
            renderCourseDashboard(result.data);
        }

    } catch (err) {
        console.error("SPA Load Error:", err);
        container.innerHTML = "Failed to load content.";
    }
}

function renderMainHub(subjects) {
    const list = document.getElementById('subject-list');
    if (!list) return;

    // Even if subjects is an empty array [], this logic keeps the hub interactive
    if (subjects.length === 0) {
        list.innerHTML = "<p>No subjects yet. Use the panel above to add your first course!</p>";
        return;
    }

    list.innerHTML = subjects.map(s => `
        <div class="subject-card" onclick="loadView('course_dashboard', ${s.id})">
            <h3>${s.name}</h3>
        </div>
    `).join('');
}

function renderCourseDashboard(chapters) {
    const list = document.getElementById('chapter-list-container');
    const selectionList = document.getElementById('chapter-selection-list');

    // Populate the Custom Quiz Selection (Checkboxes)
    selectionList.innerHTML = chapters.map(c => `
        <label>
            <input type="checkbox" class="quiz-chapter-checkbox" value="${c.id}">
            Chapter ${c.chapter_number}: ${c.title}
        </label>
    `).join('<br>');

    // Populate the Chapter List (Standard View)
    list.innerHTML = chapters.map(c => `
        <div class="chapter-row">
            <span>Chapter ${c.chapter_number}: ${c.title}</span>
            <button onclick="loadView('chapter_view', ${c.id})">Edit/View Notes</button>
        </div>
    `).join('');
}

async function createNewCourse() {
    const input = document.getElementById('new-course-name');
    const name = input.value.trim();

    if (!name) return alert("Please enter a name");

    const response = await fetch('/school/api/manage/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_course', name: name })
    });

    const result = await response.json();
    if (result.status === 'success') {
        input.value = ''; // Clear input
        loadView('main_hub'); // Refresh the list
    } else {
        alert(result.message || "Error creating subject");
    }
}