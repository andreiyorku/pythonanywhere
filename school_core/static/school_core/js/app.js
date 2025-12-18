// school_core/static/school_core/app.js
// school_core/static/school_core/js/app.js

async function loadView(viewName, param = null) {
    const container = document.getElementById('app-container');

    // 1. Fetch the HTML snippet
    const templateResponse = await fetch(`/static/school_core/components/${viewName}.html`);
    const templateHtml = await templateResponse.text();

    // 2. Fetch the SQL Data
    let apiUrl = `/school/api/data/?type=${viewName}`;
    if (param) apiUrl += `&id=${param}`;

    const dataResponse = await fetch(apiUrl);
    const result = await dataResponse.json();

    // 3. Inject the template first
    container.innerHTML = templateHtml;

    // 4. Populate the data based on which view it is
    if (viewName === 'main_hub') {
        renderMainHub(result.data);
    }
}

function renderMainHub(subjects) {
    const list = document.getElementById('subject-list');
    if (!list) return;

    if (subjects.length === 0) {
        list.innerHTML = "<p>No subjects found. Create one above!</p>";
        return;
    }

    list.innerHTML = subjects.map(s => `
        <div class="subject-card" onclick="loadView('course_dashboard', ${s.id})">
            <h3>${s.name}</h3>
        </div>
    `).join('');
}

document.addEventListener('DOMContentLoaded', () => {
    loadView('main_hub');
});